-- Acomodação vendável: o cliente escolhe o tipo de quarto no checkout e o preço
-- muda de verdade. Rodar no SQL Editor. Idempotente.
--
-- Até aqui `products.tiers` existia como "opções de suíte", mas era decorativo:
-- a própria página do pacote dizia "Valor da suíte confirmado no atendimento".
-- `tiers` continua como está (nada quebra); `accommodations` é o campo novo que
-- de fato entra no preço e na reserva.
--
-- ATENÇÃO: as duas RPCs ganham um parâmetro. Em Postgres isso cria SOBRECARGA,
-- não substituição — duas funções de mesmo nome com aridade diferente deixariam
-- a chamada ambígua pelo PostgREST. Por isso as versões antigas são derrubadas
-- explicitamente antes de recriar.

-- =====================================================================
-- 1) Colunas
-- =====================================================================
alter table public.products
  add column if not exists accommodations jsonb not null default '[]'::jsonb;

alter table public.products drop constraint if exists products_accommodations_array_check;
alter table public.products add constraint products_accommodations_array_check
  check (jsonb_typeof(accommodations) = 'array');

-- Guarda o código E o nome: o nome é um retrato do momento da compra, para a
-- operação continuar legível se o pacote for reconfigurado depois.
alter table public.bookings
  add column if not exists accommodation_code text,
  add column if not exists accommodation_name text;

-- =====================================================================
-- 2) Cotação com acomodação
-- =====================================================================
drop function if exists public.quote_booking(uuid, uuid, integer, text);

create or replace function public.quote_booking(
  p_product_id uuid,
  p_product_date_id uuid,
  p_travelers_count integer,
  p_coupon_code text default null,
  p_accommodation_code text default null
)
returns table (
  unit_amount numeric(12,2),
  total_amount numeric(12,2),
  coupon_id uuid,
  accommodation_code text,
  accommodation_name text
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
  v_accommodation jsonb;
  v_accommodation_count integer := 0;
  v_capacity integer;
  v_accommodation_code text := null;
  v_accommodation_name text := null;
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

  -- Quantas acomodações vendáveis o pacote tem. Só conta a que está completa:
  -- sem capacidade ou sem preço não dá para vender nem para calcular.
  select count(*) into v_accommodation_count
  from jsonb_array_elements(coalesce(v_product.accommodations, '[]'::jsonb)) as item
  where coalesce((item->>'active')::boolean, true) = true
    and (item->>'capacity') is not null
    and (item->>'price') is not null;

  if p_accommodation_code is not null and length(trim(p_accommodation_code)) > 0 then
    select item into v_accommodation
    from jsonb_array_elements(coalesce(v_product.accommodations, '[]'::jsonb)) as item
    where item->>'code' = trim(p_accommodation_code)
      and coalesce((item->>'active')::boolean, true) = true
    limit 1;

    if v_accommodation is null then
      raise exception 'ACCOMMODATION_NOT_AVAILABLE' using errcode = 'P0001';
    end if;

    v_capacity := (v_accommodation->>'capacity')::integer;
    if v_capacity is null or v_capacity <= 0 then
      raise exception 'ACCOMMODATION_NOT_AVAILABLE' using errcode = 'P0001';
    end if;

    -- Mesma regra da tela: a acomodação só serve quando o grupo se divide
    -- exatamente nela. Três pessoas num duplo deixaria alguém sem cama.
    if p_travelers_count % v_capacity <> 0 then
      raise exception 'ACCOMMODATION_DOES_NOT_FIT' using errcode = 'P0001';
    end if;

    v_unit_amount := (v_accommodation->>'price')::numeric(12,2);
    if v_unit_amount is null or v_unit_amount <= 0 then
      raise exception 'ACCOMMODATION_NOT_AVAILABLE' using errcode = 'P0001';
    end if;

    v_accommodation_code := v_accommodation->>'code';
    v_accommodation_name := v_accommodation->>'name';
  elsif v_accommodation_count > 0 then
    -- O pacote vende acomodação e ninguém escolheu: não dá para adivinhar o
    -- preço nem para montar o quarto.
    raise exception 'ACCOMMODATION_REQUIRED' using errcode = 'P0001';
  else
    -- Pacote sem acomodação configurada segue exatamente como antes.
    v_unit_amount := coalesce(
      v_product_date.price_override,
      v_product.promotional_price,
      v_product.price
    );
  end if;

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

  return query select
    v_unit_amount,
    v_total_amount,
    v_coupon_id,
    v_accommodation_code,
    v_accommodation_name;
end;
$$;

revoke all on function public.quote_booking(uuid, uuid, integer, text, text) from public;
grant execute on function public.quote_booking(uuid, uuid, integer, text, text) to service_role;

-- =====================================================================
-- 3) Reserva com acomodação
-- =====================================================================
drop function if exists public.create_pending_booking_transaction(
  uuid, uuid, uuid, text, text, text, integer, text
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
  p_accommodation_code text default null
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

  -- Preço e acomodação vêm de quote_booking: é a MESMA função que a tela de
  -- revisão chama, então o valor mostrado e o cobrado não têm como divergir.
  -- As linhas de produto/data/cupom já estão travadas por este bloco (mesma
  -- transação). used_count do cupom continua incrementando só no webhook.
  select q.total_amount, q.coupon_id, q.accommodation_code, q.accommodation_name
    into v_total_amount, v_coupon_id, v_accommodation_code, v_accommodation_name
  from public.quote_booking(
    p_product_id,
    p_product_date_id,
    p_travelers_count,
    p_coupon_code,
    p_accommodation_code
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
    coupon_id,
    accommodation_code,
    accommodation_name
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
    v_coupon_id,
    v_accommodation_code,
    v_accommodation_name
  )
  returning id into v_booking_id;

  return query select v_booking_id, v_total_amount, v_expires_at;
end;
$$;

revoke all on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer, text, text) from public;
grant execute on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer, text, text) to service_role;
