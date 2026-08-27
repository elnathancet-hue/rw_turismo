-- Checkout Fase 1 — libera vaga vencida sob demanda + cotação sem gravar.
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- 1) release_expired_holds_for_date(): devolve ao estoque as reservas vencidas
--    de UMA saída. O cron de expiração roda 1x/dia (vercel.json "0 3 * * *"),
--    então quem criava reserva e nunca abria o checkout travava a vaga até a
--    madrugada seguinte. Chamando isto no início da reserva, uma saída
--    "esgotada" se cura no instante em que alguém tenta comprar.
--
-- 2) quote_booking(): mesma validação e mesmo cálculo da reserva, SEM gravar
--    nada. Existe para a página do pacote mostrar o total já com o cupom antes
--    de criar a reserva — hoje o "Total estimado" ignora o desconto e o valor
--    real só aparece depois. create_pending_booking_transaction passa a CHAMAR
--    esta função, para que revisão e cobrança não possam divergir (é a regra
--    central da especificação: o preço vive no servidor, num lugar só).

-- =====================================================================
-- 1) Liberação sob demanda das reservas vencidas de uma saída
-- =====================================================================
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
    update public.bookings
    set status = 'expired',
        payment_status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, now()),
        slots_released = true
    where product_date_id = p_product_date_id
      and status = 'pending'
      and payment_status = 'pending'
      and expires_at is not null
      and expires_at < now()
      and slots_released = false
    returning travelers_count
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

-- =====================================================================
-- 2) Cotação — mesma regra da reserva, sem gravar
-- =====================================================================
create or replace function public.quote_booking(
  p_product_id uuid,
  p_product_date_id uuid,
  p_travelers_count integer,
  p_coupon_code text default null
)
returns table (
  unit_amount numeric(12,2),
  total_amount numeric(12,2),
  coupon_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_product_date public.product_dates%rowtype;
  v_unit_amount numeric(12,2);
  v_total_amount numeric(12,2);
  v_coupon public.coupons%rowtype;
  v_coupon_id uuid := null;
  v_coupon_code text;
begin
  if p_product_id is null or p_product_date_id is null then
    raise exception 'PRODUCT_AND_DATE_REQUIRED' using errcode = 'P0001';
  end if;

  if p_travelers_count is null or p_travelers_count <= 0 then
    raise exception 'INVALID_TRAVELERS_COUNT' using errcode = 'P0001';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and active = true and deleted_at is null;

  if not found then
    raise exception 'PRODUCT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  select * into v_product_date
  from public.product_dates
  where id = p_product_date_id and active = true and deleted_at is null;

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

  v_unit_amount := coalesce(
    v_product_date.price_override,
    v_product.promotional_price,
    v_product.price
  );
  v_total_amount := round(v_unit_amount * p_travelers_count, 2);

  v_coupon_code := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  if v_coupon_code is not null then
    select * into v_coupon
    from public.coupons
    where upper(code) = v_coupon_code;

    if not found or v_coupon.active = false then
      raise exception 'COUPON_NOT_FOUND' using errcode = 'P0001';
    end if;

    if v_coupon.expires_at is not null and v_coupon.expires_at < current_date then
      raise exception 'COUPON_EXPIRED' using errcode = 'P0001';
    end if;

    if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then
      raise exception 'COUPON_EXHAUSTED' using errcode = 'P0001';
    end if;

    if v_coupon.product_id is not null and v_coupon.product_id <> p_product_id then
      raise exception 'COUPON_WRONG_PRODUCT' using errcode = 'P0001';
    end if;

    if v_coupon.discount_type = 'percent' then
      v_total_amount := round(v_total_amount * (1 - v_coupon.discount_value / 100.0), 2);
    else
      v_total_amount := round(v_total_amount - v_coupon.discount_value, 2);
    end if;

    if v_total_amount < 0.01 then
      v_total_amount := 0.01;
    end if;

    v_coupon_id := v_coupon.id;
  end if;

  return query select v_unit_amount, v_total_amount, v_coupon_id;
end;
$$;

revoke all on function public.quote_booking(uuid, uuid, integer, text) from public;
grant execute on function public.quote_booking(uuid, uuid, integer, text) to service_role;

-- =====================================================================
-- 3) Reserva: libera vencidas antes de conferir vaga e usa quote_booking
--    para o preço. Só isso muda — o resto do corpo é igual ao de
--    20260719040000_fase5_soft_delete.sql.
-- =====================================================================
create or replace function public.create_pending_booking_transaction(
  p_user_id uuid,
  p_product_id uuid,
  p_product_date_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_travelers_count integer,
  p_coupon_code text default null
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

  -- Devolve ao estoque o que venceu nesta saída ANTES de olhar as vagas: sem
  -- isto, uma reserva abandonada segura a vaga até o cron da madrugada.
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

  -- A departure that already left must never be sellable, even if the admin
  -- forgot to deactivate it.
  if v_product_date.start_date < current_date then
    raise exception 'PRODUCT_DATE_IN_PAST' using errcode = 'P0001';
  end if;

  if v_product_date.available_slots < p_travelers_count then
    raise exception 'NOT_ENOUGH_SLOTS' using errcode = 'P0001';
  end if;

  -- Preço vem de quote_booking: é a MESMA função que a tela de revisão chama,
  -- então o valor mostrado e o cobrado não têm como divergir. As linhas de
  -- produto/data/cupom já estão travadas por este bloco (mesma transação).
  -- used_count do cupom continua sendo incrementado só no webhook.
  select q.total_amount, q.coupon_id
    into v_total_amount, v_coupon_id
  from public.quote_booking(
    p_product_id,
    p_product_date_id,
    p_travelers_count,
    p_coupon_code
  ) as q;

  update public.product_dates
  set available_slots = available_slots - p_travelers_count
  where id = p_product_date_id;

  insert into public.bookings (
    user_id,
    product_id,
    product_date_id,
    customer_name,
    customer_email,
    customer_phone,
    travelers_count,
    total_amount,
    status,
    payment_status,
    expires_at,
    slots_released,
    coupon_id
  )
  values (
    p_user_id,
    p_product_id,
    p_product_date_id,
    trim(p_customer_name),
    lower(trim(p_customer_email)),
    nullif(trim(coalesce(p_customer_phone, '')), ''),
    p_travelers_count,
    v_total_amount,
    'pending',
    'pending',
    v_expires_at,
    false,
    v_coupon_id
  )
  returning id into v_booking_id;

  return query select v_booking_id, v_total_amount, v_expires_at;
end;
$$;

revoke all on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer, text) from public;
grant execute on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer, text) to service_role;

-- =====================================================================
-- 4) Privacidade: Financeiro deixa de ler dados de passageiro
--
-- passengers guarda nome, documento e data de nascimento — inclusive de
-- crianças. O papel Financeiro cuida de pagamentos, despesas e recebíveis;
-- não há tarefa dele que precise do documento de um menor.
--
-- RLS é por LINHA, não por coluna: não dá para liberar o nome e esconder o
-- documento. Como o dado sensível é o que pesa mais, a política inteira sai.
-- Efeito visível: ao abrir uma reserva, o Financeiro não vê mais a lista de
-- passageiros (a tela avisa o porquê). Operações e Admin seguem vendo.
-- =====================================================================
drop policy if exists "passengers_financeiro_select" on public.passengers;
