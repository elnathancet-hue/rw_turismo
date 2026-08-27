-- Pagamento assíncrono (Pix) + tapa-buracos do documento obrigatório.
-- Rodar no SQL Editor. Idempotente.
--
-- POR QUE ESTA MIGRATION EXISTE, EM UMA FRASE:
-- hoje o sistema confirma a reserva quando a Stripe avisa que a SESSÃO foi
-- concluída. Com cartão isso equivale a "o dinheiro entrou". Com Pix, não:
-- a sessão conclui no instante em que o cliente recebe o QR Code, com o
-- pagamento ainda por acontecer. Ligar o Pix sem o estado intermediário abaixo
-- faria o sistema confirmar reserva não paga e queimar o cupom.

-- =====================================================================
-- 1) Estado intermediário: dinheiro prometido, ainda não recebido
-- =====================================================================
alter table public.bookings
  drop constraint if exists bookings_payment_status_check;
alter table public.bookings
  add constraint bookings_payment_status_check
  check (payment_status in (
    'pending',         -- ninguém iniciou pagamento
    'processing',      -- Pix emitido, aguardando a transferência cair
    'paid',
    'failed',
    'refunded',
    'cancelled',
    'requires_review'
  ));

alter table public.payments
  drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check
  check (status in (
    'pending',
    'processing',
    'paid',
    'failed',
    'refunded',
    'cancelled',
    'requires_review'
  ));

-- =====================================================================
-- 2) Idempotência do webhook por evento, e não só por estado
-- =====================================================================
-- A proteção que existe hoje é "a reserva já está confirmada, ignora". Ela
-- cobre reentrega em sequência e NÃO cobre entrega concorrente: dois processos
-- podem ler o estado antigo ao mesmo tempo e os dois seguirem em frente. Isso
-- importa porque increment_coupon_usage é um `used_count + 1` cego — contaria
-- duas vezes. Com o Pix passam a existir dois tipos de evento distintos
-- escrevendo confirmação no mesmo caminho, então a janela dobra.
create table if not exists public.stripe_events (
  event_id text primary key,
  event_type text,
  received_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;

-- Sem policy nenhuma de propósito: só o service_role (que ignora RLS) escreve
-- aqui. É tabela de controle interno, não tem dono nem leitor no site.

create index if not exists stripe_events_received_idx
  on public.stripe_events(received_at desc);

comment on table public.stripe_events is
  'Eventos da Stripe já processados. O webhook reserva o event_id antes de agir e devolve a reserva se falhar, para a reentrega da Stripe conseguir tentar de novo.';

-- =====================================================================
-- 3) Expiração precisa enxergar o estado intermediário
-- =====================================================================
-- Sessão de checkout só expira enquanto está `open`. No instante em que o QR do
-- Pix é emitido ela vira `complete` e NUNCA mais dispara
-- checkout.session.expired. Ou seja: sem isto, um Pix que ninguém paga segura a
-- vaga para sempre — nem o cron nem a página conseguiriam liberar.
-- expire_pending_booking e recriada na secao 8 deste arquivo, junto das
-- irmas release_expired_holds_for_date e expire_overdue_pending_bookings.

create or replace function public.expire_overdue_pending_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_result record;
  v_expired integer := 0;
begin
  for v_booking_id in
    select id
    from public.bookings
    where status = 'pending'
      and payment_status in ('pending', 'processing')
      and expires_at is not null
      and expires_at < now()
    order by expires_at
    limit 500
  loop
    select * into v_result
    from public.expire_pending_booking(v_booking_id);

    if v_result.expired then
      v_expired := v_expired + 1;
    end if;
  end loop;

  return v_expired;
end;
$$;

revoke all on function public.expire_overdue_pending_bookings() from public;
grant execute on function public.expire_overdue_pending_bookings() to service_role;

-- =====================================================================
-- 4) Cast de inteiro que não explode
-- =====================================================================
-- fare_rules é jsonb livre. Um valor digitado errado faria o cast lançar
-- exceção dentro de um trigger e derrubar o insert do passageiro inteiro.
create or replace function public.safe_integer(p_value text)
returns integer
language plpgsql
immutable
as $$
begin
  return p_value::integer;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.safe_integer(text) from public;
grant execute on function public.safe_integer(text) to authenticated;
grant execute on function public.safe_integer(text) to service_role;

-- =====================================================================
-- 5) A exigência de documento passa a valer para TODA origem de reserva
-- =====================================================================
-- Hoje quem calcula o document_status é a RPC da compra online. A venda manual
-- (adminCreateBooking insere passageiros direto pela tabela) não passa por ela,
-- então nasce sempre 'not_required' — a regra do pacote simplesmente não valia
-- para venda por WhatsApp/telefone.
--
-- O lugar certo da regra é o banco, não cada chamador: assim qualquer caminho
-- novo herda a exigência em vez de precisar lembrar dela.
create or replace function public.passengers_set_document_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_departure date;
  v_max_age integer;
begin
  -- Só preenche o que veio no padrão. Quem decidiu explicitamente (a RPC da
  -- compra online) manda — e calcula pela mesma função, então o resultado é o
  -- mesmo de qualquer jeito.
  if new.document_status is distinct from 'not_required' then
    return new;
  end if;

  select d.start_date,
         public.safe_integer(p.fare_rules->>'document_required_max_age')
    into v_departure, v_max_age
  from public.bookings b
  join public.product_dates d on d.id = b.product_date_id
  join public.products p on p.id = b.product_id
  where b.id = new.booking_id;

  if v_departure is null or v_max_age is null then
    return new;
  end if;

  new.document_status := public.initial_document_status(
    new.birth_date,
    v_departure,
    v_max_age
  );

  return new;
end;
$$;

drop trigger if exists passengers_set_document_status_trg on public.passengers;
create trigger passengers_set_document_status_trg
before insert on public.passengers
for each row execute function public.passengers_set_document_status();

-- =====================================================================
-- 6) O cliente não escreve o próprio status de documento
-- =====================================================================
-- A policy passengers_update_own_pending_booking deixa o dono da reserva editar
-- os passageiros enquanto ela está pendente. RLS é por LINHA, não por COLUNA:
-- o mesmo UPDATE que corrige um nome poderia escrever
-- document_status = 'verified' pela chave anônima e passar por cima do portão
-- do pagamento — sem enviar arquivo nenhum.
--
-- Erro alto em vez de ignorar em silêncio: se algum dia o papel privilegiado
-- mudar de nome, eu prefiro uma tela que falha visivelmente a uma que finge que
-- salvou.
-- A funcao e o trigger sao criados na secao 9 deste arquivo, que cobre INSERT
-- alem de UPDATE. Ver o porque la.

-- =====================================================================
-- 7) Compra online sem passageiro deixa de ser possível
-- =====================================================================
-- Sem esta trava, omitir o campo `passengers` na chamada da API criava uma
-- reserva com zero passageiros: a exigência de documento não existia (não há
-- linha para exigir), e Quartos, Assentos, Check-in e o voucher mostravam a
-- saída como se ninguém fosse viajar.
--
-- A contagem é dos nomes PREENCHIDOS, não do tamanho do array: mandar três
-- nomes em branco passava pela checagem antiga e inseria zero linhas.
drop function if exists public.create_pending_booking_transaction(
  uuid, uuid, uuid, text, text, text, integer, text, text, jsonb
);

create or replace function public.create_pending_booking_transaction(
  p_user_id uuid,
  p_product_id uuid,
  p_product_date_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_travelers_count integer,
  p_coupon_code text default null,
  p_accommodation_code text default null,
  p_passengers jsonb default null
)
returns table (
  booking_id uuid,
  total_amount numeric(12,2),
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_product_date public.product_dates%rowtype;
  v_total_amount numeric(12,2);
  v_expires_at timestamptz := now() + interval '30 minutes';
  v_booking_id uuid;
  v_coupon_id uuid := null;
  v_accommodation_code text := null;
  v_accommodation_name text := null;
  v_infant_max integer;
  v_child_max integer;
  v_document_max_age integer;
  v_named_passengers integer;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if p_product_id is null or p_product_date_id is null then
    raise exception 'PRODUCT_AND_DATE_REQUIRED' using errcode = 'P0001';
  end if;

  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'CUSTOMER_NAME_REQUIRED' using errcode = 'P0001';
  end if;

  if p_customer_email is null or length(trim(p_customer_email)) = 0 then
    raise exception 'CUSTOMER_EMAIL_REQUIRED' using errcode = 'P0001';
  end if;

  if p_travelers_count is null or p_travelers_count <= 0 then
    raise exception 'INVALID_TRAVELERS_COUNT' using errcode = 'P0001';
  end if;

  if p_passengers is null or jsonb_typeof(p_passengers) <> 'array' then
    raise exception 'PASSENGERS_REQUIRED' using errcode = 'P0001';
  end if;

  select count(*)
    into v_named_passengers
  from jsonb_array_elements(p_passengers) as item
  where length(trim(coalesce(item->>'full_name', ''))) > 0;

  if v_named_passengers <> p_travelers_count then
    raise exception 'PASSENGERS_COUNT_MISMATCH' using errcode = 'P0001';
  end if;

  perform public.release_expired_holds_for_date(p_product_date_id);

  select *
    into v_product
  from public.products
  where id = p_product_id
    and active = true
    and deleted_at is null
  for update;

  if not found then
    raise exception 'PRODUCT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  select *
    into v_product_date
  from public.product_dates
  where id = p_product_date_id
    and active = true
    and deleted_at is null
  for update;

  if not found then
    raise exception 'PRODUCT_DATE_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  if v_product_date.product_id <> p_product_id then
    raise exception 'PRODUCT_DATE_MISMATCH' using errcode = 'P0001';
  end if;

  if v_product_date.start_date < current_date then
    raise exception 'PRODUCT_DATE_IN_PAST' using errcode = 'P0001';
  end if;

  if v_product_date.available_slots < p_travelers_count then
    raise exception 'NOT_ENOUGH_SLOTS' using errcode = 'P0001';
  end if;

  select q.total_amount, q.coupon_id, q.accommodation_code, q.accommodation_name
    into v_total_amount, v_coupon_id, v_accommodation_code, v_accommodation_name
  from public.quote_booking(
    p_product_id,
    p_product_date_id,
    p_travelers_count,
    p_coupon_code,
    p_accommodation_code,
    p_passengers
  ) as q;

  update public.product_dates
  set available_slots = available_slots - p_travelers_count
  where id = p_product_date_id;

  insert into public.bookings (
    user_id, product_id, product_date_id,
    customer_name, customer_email, customer_phone,
    travelers_count, total_amount, status, payment_status,
    expires_at, slots_released, coupon_id,
    accommodation_code, accommodation_name
  )
  values (
    p_user_id, p_product_id, p_product_date_id,
    trim(p_customer_name), lower(trim(p_customer_email)),
    nullif(trim(coalesce(p_customer_phone, '')), ''),
    p_travelers_count, v_total_amount, 'pending', 'pending',
    v_expires_at, false, v_coupon_id,
    v_accommodation_code, v_accommodation_name
  )
  returning id into v_booking_id;

  v_infant_max := coalesce(public.safe_integer(v_product.fare_rules->>'infant_max_age'), 1);
  v_child_max := coalesce(public.safe_integer(v_product.fare_rules->>'child_max_age'), 11);
  v_document_max_age := public.safe_integer(v_product.fare_rules->>'document_required_max_age');

  insert into public.passengers (
    booking_id, full_name, birth_date, type, document_status
  )
  select
    v_booking_id,
    trim(item->>'full_name'),
    nullif(item->>'birth_date', '')::date,
    public.passenger_type_on_departure(
      nullif(item->>'birth_date', '')::date,
      v_product_date.start_date,
      v_infant_max,
      v_child_max
    ),
    -- 'pending' aqui é o que trava o pagamento mais adiante.
    public.initial_document_status(
      nullif(item->>'birth_date', '')::date,
      v_product_date.start_date,
      v_document_max_age
    )
  from jsonb_array_elements(p_passengers) as item
  where length(trim(coalesce(item->>'full_name', ''))) > 0;

  return query select v_booking_id, v_total_amount, v_expires_at;
end;
$$;

revoke all on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer, text, text, jsonb) from public;
grant execute on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer, text, text, jsonb) to service_role;

-- =====================================================================
-- 8) A varredura precisa enxergar o Pix — e não pode destruir reserva paga
-- =====================================================================
-- release_expired_holds_for_date é a cura sob demanda: quando alguém tenta
-- comprar uma saída "esgotada", ela devolve na hora as vagas de holds vencidos.
-- Ficou cega para 'processing' quando o estado novo entrou, e sem isso um Pix
-- não pago segurava a vaga até a varredura da madrugada.
--
-- Trio que precisa andar junto — mexeu num, confira os outros dois:
--   release_expired_holds_for_date (esta), expire_pending_booking,
--   expire_overdue_pending_bookings.
create or replace function public.release_expired_holds_for_date(
  p_product_date_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released integer := 0;
begin
  if p_product_date_id is null then
    return 0;
  end if;

  -- slots_released = false no WHERE é o que impede devolver a mesma vaga duas
  -- vezes, igual ao expire_pending_booking.
  with expired as (
    update public.bookings b
    set status = 'expired',
        -- Pix vencido vira 'requires_review', e não 'cancelled': o sistema
        -- ADMITE não saber se o dinheiro entrou (o aviso da Stripe pode estar
        -- atrasado ou o evento pode não estar assinado). A vaga volta para o
        -- estoque, que é o interesse do negócio, mas o caso fica visível para
        -- alguém conferir em vez de virar um abandono indistinguível.
        payment_status = case
          when b.payment_status = 'processing' then 'requires_review'
          else 'cancelled'
        end,
        cancelled_at = coalesce(b.cancelled_at, now()),
        slots_released = true
    where b.product_date_id = p_product_date_id
      and b.status = 'pending'
      and b.payment_status in ('pending', 'processing')
      and b.expires_at is not null
      and b.expires_at < now()
      and b.slots_released = false
      -- Nunca mexer em reserva com pagamento confirmado, mesmo que o estado da
      -- reserva não tenha acompanhado. É a última rede antes do pior desfecho
      -- possível: cliente pagou e ficou sem lugar.
      and not exists (
        select 1 from public.payments p
        where p.booking_id = b.id and p.status = 'paid'
      )
    returning b.travelers_count
  )
  select coalesce(sum(travelers_count), 0) into v_released from expired;

  if v_released > 0 then
    update public.product_dates
    set available_slots = available_slots + v_released
    where id = p_product_date_id;
  end if;

  return v_released;
end;
$$;

revoke all on function public.release_expired_holds_for_date(uuid) from public;
grant execute on function public.release_expired_holds_for_date(uuid) to service_role;

-- Mesma regra na expiração de uma reserva específica.
create or replace function public.expire_pending_booking(p_booking_id uuid)
returns table (
  booking_id uuid,
  expired boolean,
  slots_released boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_slots_released boolean;
  v_final_payment_status text;
begin
  if p_booking_id is null then
    raise exception 'BOOKING_ID_REQUIRED' using errcode = 'P0001';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 'processing' entra junto de 'pending': é reserva cujo dinheiro nunca
  -- chegou. O que NÃO pode ser expirado é reserva paga.
  if v_booking.status <> 'pending'
     or v_booking.payment_status not in ('pending', 'processing') then
    return query select v_booking.id, false, v_booking.slots_released;
    return;
  end if;

  -- Rede final: existe pagamento confirmado nesta reserva? Então o estado da
  -- reserva é que está atrasado, não o contrário. Não expira.
  if exists (
    select 1 from public.payments p
    where p.booking_id = v_booking.id and p.status = 'paid'
  ) then
    return query select v_booking.id, false, v_booking.slots_released;
    return;
  end if;

  if v_booking.expires_at is null or v_booking.expires_at >= now() then
    return query select v_booking.id, false, v_booking.slots_released;
    return;
  end if;

  v_slots_released := v_booking.slots_released;

  if v_slots_released = false then
    update public.product_dates
    set available_slots = available_slots + v_booking.travelers_count
    where id = v_booking.product_date_id;

    v_slots_released := true;
  end if;

  -- Pix vencido: 'requires_review' em vez de 'cancelled'. Ver o comentário em
  -- release_expired_holds_for_date.
  v_final_payment_status := case
    when v_booking.payment_status = 'processing' then 'requires_review'
    else 'cancelled'
  end;

  update public.bookings
  set status = 'expired',
      payment_status = v_final_payment_status,
      slots_released = v_slots_released
  where id = v_booking.id;

  -- Sem isto a linha de pagamento fica em 'processing' para sempre, e o painel
  -- financeiro mostra "Aguardando Pix" pendurado numa reserva Expirada.
  update public.payments p
  set status = case
        when v_final_payment_status = 'requires_review' then 'requires_review'
        else 'cancelled'
      end
  where p.booking_id = v_booking.id
    and p.status in ('pending', 'processing');

  return query select v_booking.id, true, v_slots_released;
end;
$$;

revoke all on function public.expire_pending_booking(uuid) from public;
grant execute on function public.expire_pending_booking(uuid) to service_role;

-- =====================================================================
-- 9) A trava das colunas de documento vale no INSERT também
-- =====================================================================
-- A policy passengers_insert_own_pending_booking deixa o dono da reserva
-- inserir passageiros, e RLS não recorta coluna: sem isto, bastava inserir o
-- passageiro já com document_status = 'verified' pela chave anônima para
-- atravessar o portão do pagamento sem enviar arquivo nenhum. O trigger de
-- UPDATE não pegava porque a linha já nascia mentindo.
create or replace function public.passengers_protect_document_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Quem insere de fora nunca decide nada de documento: a exigência é
    -- calculada pelo trigger passengers_set_document_status, e o arquivo só
    -- entra pela rota que confere posse e emite URL assinada.
    if new.document_path is not null
       or new.document_uploaded_at is not null
       or new.document_verified_at is not null
       or new.document_status is distinct from 'not_required' then
      raise exception 'DOCUMENT_FIELDS_ARE_SERVER_ONLY' using errcode = 'P0001';
    end if;

    return new;
  end if;

  if new.document_path is distinct from old.document_path
     or new.document_status is distinct from old.document_status
     or new.document_uploaded_at is distinct from old.document_uploaded_at
     or new.document_verified_at is distinct from old.document_verified_at then
    raise exception 'DOCUMENT_FIELDS_ARE_SERVER_ONLY' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists passengers_protect_document_columns_trg on public.passengers;
create trigger passengers_protect_document_columns_trg
before insert or update on public.passengers
for each row execute function public.passengers_protect_document_columns();

-- Ordem alfabética decide qual BEFORE trigger roda primeiro: "passengers_p…"
-- antes de "passengers_s…". A trava recusa o insert malicioso, e só depois o
-- cálculo do status preenche a exigência de verdade.

-- =====================================================================
-- 10) Marca de evento processado
-- =====================================================================
-- Sem isto a trava só sabia dizer "alguém pegou este evento", nunca "alguém
-- terminou". Um processo morto no meio (timeout da Vercel, deploy, falta de
-- memória) deixava o evento marcado para sempre, e a reentrega da Stripe — que
-- é o conserto automático — era descartada como repetida. Com Pix isso vira
-- "cliente pagou e ficou sem reserva".
alter table public.stripe_events
  add column if not exists processed_at timestamptz;

create index if not exists stripe_events_unprocessed_idx
  on public.stripe_events(received_at)
  where processed_at is null;

-- =====================================================================
-- 11) Confirmacao manual nao pode atropelar um Pix em aberto
-- =====================================================================
create or replace function public.admin_confirm_manual_payment(
  p_admin_id uuid,
  p_booking_id uuid,
  p_amount numeric default null,
  p_method text default 'pix',
  p_notes text default null
)
returns table (
  payment_id uuid,
  booking_id uuid,
  payment_status text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_amount numeric(12,2);
  v_payment_id uuid;
begin
  -- Confirmar dinheiro é papel de caixa: admin ou financeiro.
  if coalesce(public.staff_role_of(p_admin_id), '') not in ('admin', 'financeiro') then
    raise exception 'ADMIN_REQUIRED' using errcode = 'P0001';
  end if;

  if p_booking_id is null then
    raise exception 'BOOKING_ID_REQUIRED' using errcode = 'P0001';
  end if;

  if p_method is null or p_method not in ('stripe','pix','boleto','dinheiro','transferencia','outro') then
    raise exception 'INVALID_METHOD' using errcode = 'P0001';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_booking.status in ('cancelled','expired') then
    raise exception 'BOOKING_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if v_booking.payment_status = 'paid' then
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;

  -- Pix emitido = cobranca viva na Stripe. Marcar "pago" no painel agora cria
  -- duas cobrancas validas para a mesma reserva: a do painel e a que o cliente
  -- ainda pode pagar pelo codigo. Se ele pagou por fora, o caminho e esperar o
  -- codigo vencer ou cancelar a cobranca na Stripe.
  --
  -- 'requires_review' NAO entra aqui de proposito: e exatamente o estado em que
  -- alguem precisa entrar e resolver na mao.
  if v_booking.payment_status = 'processing' then
    raise exception 'STRIPE_PAYMENT_PENDING' using errcode = 'P0001';
  end if;

  v_amount := coalesce(p_amount, v_booking.total_amount);
  if v_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  insert into public.payments (
    booking_id, user_id, amount, currency, status, provider, method,
    paid_at, confirmed_by, notes
  )
  values (
    v_booking.id, v_booking.user_id, v_amount, 'BRL', 'paid', 'manual', p_method,
    now(), p_admin_id, nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_payment_id;

  update public.bookings
  set payment_status = 'paid',
      status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, now())
  where id = v_booking.id;

  insert into public.system_logs (user_id, action, entity, entity_id, metadata)
  values (
    p_admin_id, 'admin_confirm_manual_payment', 'bookings', v_booking.id,
    jsonb_build_object(
      'payment_id', v_payment_id,
      'amount', v_amount,
      'method', p_method,
      'previous_payment_status', v_booking.payment_status,
      'previous_status', v_booking.status
    )
  );

  return query select v_payment_id, v_booking.id, 'paid'::text, 'confirmed'::text;
end;
$$;

revoke all on function public.admin_confirm_manual_payment(uuid, uuid, numeric, text, text) from public;
grant execute on function public.admin_confirm_manual_payment(uuid, uuid, numeric, text, text) to service_role;
