-- Tarifa infantil: o preço deixa de ser "unitário x quantidade" e passa a ser a
-- SOMA POR PASSAGEIRO, com desconto por faixa etária. Rodar no SQL Editor.
--
-- A especificação pede faixa etária configurável por pacote e idade calculada a
-- partir da data de nascimento. A idade que vale é a da DATA DA SAÍDA, não a da
-- compra: quem faz 12 anos entre comprar e viajar embarca pagando adulto.
--
-- Compatibilidade: os percentuais padrão são 100%, ou seja, um pacote sem regra
-- configurada continua cobrando exatamente como antes.
--
-- Os passageiros passam a ser gravados DENTRO da transação da reserva. Antes
-- eram inseridos depois, pelo TypeScript; agora que o preço depende deles, uma
-- reserva com desconto de criança e sem a criança gravada seria inconsistente.

-- =====================================================================
-- 1) Regras de tarifa por pacote
-- =====================================================================
alter table public.products
  add column if not exists fare_rules jsonb not null default '{}'::jsonb;

alter table public.products drop constraint if exists products_fare_rules_object_check;
alter table public.products add constraint products_fare_rules_object_check
  check (jsonb_typeof(fare_rules) = 'object');

comment on column public.products.fare_rules is
  'Faixas e percentuais da tarifa por idade. Chaves: infant_max_age, child_max_age, infant_percent, child_percent. Ausente = sem desconto (100%).';

-- =====================================================================
-- 2) Classificação por idade
-- =====================================================================
create or replace function public.passenger_type_on_departure(
  p_birth_date date,
  p_departure_date date,
  p_infant_max_age integer default 1,
  p_child_max_age integer default 11
)
returns text
language sql
immutable
as $$
  select case
    when p_birth_date is null then 'adult'
    -- age() devolve intervalo; extract(year) dá os anos COMPLETOS, que é
    -- exatamente "quantos aniversários já passaram" na data da viagem.
    when extract(year from age(p_departure_date, p_birth_date)) <= p_infant_max_age
      then 'infant'
    when extract(year from age(p_departure_date, p_birth_date)) <= p_child_max_age
      then 'child'
    else 'adult'
  end;
$$;

revoke all on function public.passenger_type_on_departure(date, date, integer, integer) from public;
grant execute on function public.passenger_type_on_departure(date, date, integer, integer) to authenticated;
grant execute on function public.passenger_type_on_departure(date, date, integer, integer) to service_role;

-- =====================================================================
-- 3) Cotação somando por passageiro
-- =====================================================================
drop function if exists public.quote_booking(uuid, uuid, integer, text, text);

create or replace function public.quote_booking(
  p_product_id uuid,
  p_product_date_id uuid,
  p_travelers_count integer,
  p_coupon_code text default null,
  p_accommodation_code text default null,
  -- [{ "birth_date": "2016-04-02" }, ...]. Nulo/vazio = todos adultos, que é o
  -- preço mais alto: enquanto a pessoa não digita as datas, o valor mostrado
  -- nunca sobe depois — só pode cair.
  p_passengers jsonb default null
)
returns table (
  unit_amount numeric(12,2),
  -- Total ANTES do cupom. Sem ele a tela nao consegue separar o abatimento da
  -- tarifa infantil do abatimento do cupom, e mostraria os dois somados como se
  -- fossem desconto de cupom.
  subtotal_amount numeric(12,2),
  total_amount numeric(12,2),
  coupon_id uuid,
  accommodation_code text,
  accommodation_name text,
  adults_count integer,
  children_count integer,
  infants_count integer
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
  v_subtotal_amount numeric(12,2);
  v_coupon public.coupons%rowtype;
  v_coupon_id uuid := null;
  v_coupon_code text;
  v_accommodation jsonb;
  v_accommodation_count integer := 0;
  v_capacity integer;
  v_accommodation_code text := null;
  v_accommodation_name text := null;
  v_infant_max integer;
  v_child_max integer;
  v_infant_percent numeric;
  v_child_percent numeric;
  v_adults integer := 0;
  v_children integer := 0;
  v_infants integer := 0;
  v_passenger jsonb;
  v_type text;
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
    raise exception 'ACCOMMODATION_REQUIRED' using errcode = 'P0001';
  else
    v_unit_amount := coalesce(
      v_product_date.price_override,
      v_product.promotional_price,
      v_product.price
    );
  end if;

  -- Regras de faixa etária. Ausentes = 100%, ou seja, sem desconto: pacote sem
  -- regra configurada cobra exatamente como cobrava antes desta migration.
  v_infant_max := coalesce((v_product.fare_rules->>'infant_max_age')::integer, 1);
  v_child_max := coalesce((v_product.fare_rules->>'child_max_age')::integer, 11);
  v_infant_percent := coalesce((v_product.fare_rules->>'infant_percent')::numeric, 100);
  v_child_percent := coalesce((v_product.fare_rules->>'child_percent')::numeric, 100);

  if jsonb_typeof(p_passengers) = 'array' and jsonb_array_length(p_passengers) > 0 then
    v_total_amount := 0;
    for v_passenger in select * from jsonb_array_elements(p_passengers)
    loop
      v_type := public.passenger_type_on_departure(
        nullif(v_passenger->>'birth_date', '')::date,
        v_product_date.start_date,
        v_infant_max,
        v_child_max
      );

      if v_type = 'infant' then
        v_infants := v_infants + 1;
        v_total_amount := v_total_amount + round(v_unit_amount * v_infant_percent / 100.0, 2);
      elsif v_type = 'child' then
        v_children := v_children + 1;
        v_total_amount := v_total_amount + round(v_unit_amount * v_child_percent / 100.0, 2);
      else
        v_adults := v_adults + 1;
        v_total_amount := v_total_amount + v_unit_amount;
      end if;
    end loop;
  else
    -- Sem lista de passageiros ainda: cobra todo mundo como adulto.
    v_adults := p_travelers_count;
    v_total_amount := round(v_unit_amount * p_travelers_count, 2);
  end if;

  v_subtotal_amount := v_total_amount;

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

    v_coupon_id := v_coupon.id;
  end if;

  -- Piso de 1 centavo: bookings.total_amount tem check (> 0), e uma reserva só
  -- de bebês com tarifa zerada cairia em zero e quebraria a inserção.
  if v_total_amount < 0.01 then
    v_total_amount := 0.01;
  end if;

  return query select
    v_unit_amount,
    v_subtotal_amount,
    v_total_amount,
    v_coupon_id,
    v_accommodation_code,
    v_accommodation_name,
    v_adults,
    v_children,
    v_infants;
end;
$$;

revoke all on function public.quote_booking(uuid, uuid, integer, text, text, jsonb) from public;
grant execute on function public.quote_booking(uuid, uuid, integer, text, text, jsonb) to service_role;

-- =====================================================================
-- 4) Reserva: preço por passageiro e gravação atômica dos viajantes
-- =====================================================================
drop function if exists public.create_pending_booking_transaction(
  uuid, uuid, uuid, text, text, text, integer, text, text
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
  -- [{ "full_name": "...", "birth_date": "YYYY-MM-DD" }, ...]
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

  -- Se veio lista, ela precisa bater com a quantidade: o preço é somado por
  -- passageiro, então divergência aqui cobraria errado.
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

  -- Preço, acomodação e composição vêm de quote_booking: é a MESMA função que a
  -- tela de revisão chama, então o valor mostrado e o cobrado não divergem.
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

  -- Passageiros na MESMA transação: se falhar aqui, a reserva inteira volta
  -- atrás e a vaga não fica retida por uma compra pela metade.
  if jsonb_typeof(p_passengers) = 'array' and jsonb_array_length(p_passengers) > 0 then
    v_infant_max := coalesce((v_product.fare_rules->>'infant_max_age')::integer, 1);
    v_child_max := coalesce((v_product.fare_rules->>'child_max_age')::integer, 11);

    insert into public.passengers (booking_id, full_name, birth_date, type)
    select
      v_booking_id,
      trim(item->>'full_name'),
      nullif(item->>'birth_date', '')::date,
      public.passenger_type_on_departure(
        nullif(item->>'birth_date', '')::date,
        v_product_date.start_date,
        v_infant_max,
        v_child_max
      )
    from jsonb_array_elements(p_passengers) as item
    where length(trim(coalesce(item->>'full_name', ''))) > 0;
  end if;

  return query select v_booking_id, v_total_amount, v_expires_at;
end;
$$;

revoke all on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer, text, text, jsonb) from public;
grant execute on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer, text, text, jsonb) to service_role;
