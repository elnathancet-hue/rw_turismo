-- Documento do passageiro: bucket PRIVADO, URL assinada e bloqueio do pagamento
-- enquanto faltar documento obrigatório. Rodar no SQL Editor. Idempotente.
--
-- POR QUE UM BUCKET NOVO, E NÃO OS QUE JÁ EXISTEM:
-- site-assets, product-images e blog-images são todos `public = true`, com
-- policy `for select to public`, e o uploadImage.ts devolve getPublicUrl().
-- Documento de passageiro — ainda mais de menor de idade — publicado numa URL
-- pública e permanente é vazamento de dado pessoal sem revogação possível.
-- Aqui o bucket nasce privado e o acesso é sempre por URL assinada de curta
-- duração, emitida pelo servidor depois de conferir quem está pedindo.
--
-- O caminho do arquivo é {booking_id}/{passenger_id}/{arquivo}: é isso que
-- permite a policy escopar "só o dono desta reserva". Caminho plano, como o dos
-- buckets de imagem, tornaria impossível escrever essa regra.

-- =====================================================================
-- 1) Cast de uuid que não explode
-- =====================================================================
-- As policies precisam ler o booking_id da PRIMEIRA pasta do caminho. Um
-- arquivo solto com nome que não é uuid faria o cast lançar exceção e derrubar
-- a consulta inteira — não só negar a linha.
create or replace function public.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_value::uuid;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.safe_uuid(text) from public;
grant execute on function public.safe_uuid(text) to authenticated;
grant execute on function public.safe_uuid(text) to service_role;

-- =====================================================================
-- 2) Colunas do documento
-- =====================================================================
alter table public.passengers
  add column if not exists document_path text,
  add column if not exists document_status text not null default 'not_required',
  add column if not exists document_uploaded_at timestamptz,
  add column if not exists document_verified_at timestamptz;

alter table public.passengers drop constraint if exists passengers_document_status_check;
alter table public.passengers add constraint passengers_document_status_check
  check (document_status in (
    'not_required', -- não há exigência para este passageiro
    'pending',      -- exigido e ainda não enviado (trava o pagamento)
    'uploaded',     -- enviado, aguardando conferência humana
    'verified',     -- conferido e aceito
    'resend',       -- conferido e recusado; precisa reenviar
    'purged'        -- arquivo apagado pela retenção; a exigência existiu
  ));

create index if not exists passengers_document_status_idx
  on public.passengers(document_status)
  where document_status in ('pending', 'uploaded');

comment on column public.passengers.document_path is
  'Caminho no bucket privado booking-documents. Nunca é URL pública: o acesso sai de createSignedUrl com validade curta.';

-- =====================================================================
-- 3) Bucket privado
-- =====================================================================
-- public = false é o ponto inteiro desta migration. Aceita PDF, que nenhum dos
-- buckets de imagem aceita.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-documents',
  'booking-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Operação e Admin leem para conferir o documento. Financeiro e Conteúdo NÃO
-- entram: nenhuma tarefa deles precisa do documento de uma criança.
drop policy if exists "booking_documents_staff_read" on storage.objects;
create policy "booking_documents_staff_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'booking-documents'
  and (public.is_admin() or public.has_staff_role(array['operacoes']))
);

-- O titular da reserva lê o que enviou. Escrita NÃO passa por aqui: o upload é
-- feito com URL assinada emitida pelo servidor, porque na compra sem cadastro o
-- cliente não tem sessão para o RLS avaliar.
drop policy if exists "booking_documents_owner_read" on storage.objects;
create policy "booking_documents_owner_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'booking-documents'
  and exists (
    select 1
    from public.bookings b
    where b.id = public.safe_uuid((storage.foldername(name))[1])
      and b.user_id = auth.uid()
  )
);

-- =====================================================================
-- 4) Regra de idade que exige documento
-- =====================================================================
comment on column public.products.fare_rules is
  'Faixas e percentuais da tarifa por idade + exigência de documento. Chaves: infant_max_age, child_max_age, infant_percent, child_percent, document_required_max_age. Ausente = sem desconto (100%) e sem exigência.';

-- Status inicial do documento de um passageiro, pela idade na data da saída.
create or replace function public.initial_document_status(
  p_birth_date date,
  p_departure_date date,
  p_document_required_max_age integer
)
returns text
language sql
immutable
as $$
  select case
    when p_document_required_max_age is null then 'not_required'
    when p_birth_date is null then 'not_required'
    when extract(year from age(p_departure_date, p_birth_date)) <= p_document_required_max_age
      then 'pending'
    else 'not_required'
  end;
$$;

revoke all on function public.initial_document_status(date, date, integer) from public;
grant execute on function public.initial_document_status(date, date, integer) to service_role;

-- =====================================================================
-- 5) Reserva: marca quem precisa de documento
-- =====================================================================
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

  if jsonb_typeof(p_passengers) = 'array'
     and jsonb_array_length(p_passengers) <> p_travelers_count then
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

  if jsonb_typeof(p_passengers) = 'array' and jsonb_array_length(p_passengers) > 0 then
    v_infant_max := coalesce((v_product.fare_rules->>'infant_max_age')::integer, 1);
    v_child_max := coalesce((v_product.fare_rules->>'child_max_age')::integer, 11);
    v_document_max_age := (v_product.fare_rules->>'document_required_max_age')::integer;

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
  end if;

  return query select v_booking_id, v_total_amount, v_expires_at;
end;
$$;

revoke all on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer, text, text, jsonb) from public;
grant execute on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer, text, text, jsonb) to service_role;

-- =====================================================================
-- 6) Retenção: expurgo depois da viagem
-- =====================================================================
-- Marca para exclusão os documentos de viagens já encerradas há mais de N dias.
-- O arquivo em si é apagado pelo cron (a remoção no Storage é chamada de API,
-- não SQL); esta função devolve os caminhos e limpa as colunas.
create or replace function public.expire_booking_documents(p_days integer default 90)
returns table (passenger_id uuid, document_path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with vencidos as (
    select p.id, p.document_path
    from public.passengers p
    join public.bookings b on b.id = p.booking_id
    join public.product_dates d on d.id = b.product_date_id
    where p.document_path is not null
      and d.end_date < current_date - p_days
    limit 200
  ),
  limpos as (
    update public.passengers p
    set document_path = null,
        -- 'purged' e nao 'not_required': o documento FOI exigido e enviado; o que
        -- mudou e que o arquivo nao existe mais. Marcar como nao exigido apagaria
        -- o registro de que a regra valeu para este passageiro.
        document_status = 'purged',
        document_uploaded_at = null,
        document_verified_at = null
    from vencidos v
    where p.id = v.id
    returning v.id, v.document_path
  )
  select limpos.id, limpos.document_path from limpos;
end;
$$;

revoke all on function public.expire_booking_documents(integer) from public;
grant execute on function public.expire_booking_documents(integer) to service_role;
