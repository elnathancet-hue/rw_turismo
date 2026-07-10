-- Correções críticas de operação (auditoria 2026-07):
-- 1. create_pending_booking_transaction: bloqueia reserva em data já partida.
-- 2. expire_overdue_pending_bookings(): varredura em lote para o cron —
--    expira toda reserva pendente vencida e devolve as vagas.

create or replace function public.create_pending_booking_transaction(
  p_user_id uuid,
  p_product_id uuid,
  p_product_date_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_travelers_count integer
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
  v_unit_amount numeric(12,2);
  v_total_amount numeric(12,2);
  v_expires_at timestamptz := now() + interval '30 minutes';
  v_booking_id uuid;
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

  select *
    into v_product
  from public.products
  where id = p_product_id
    and active = true
  for update;

  if not found then
    raise exception 'PRODUCT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  select *
    into v_product_date
  from public.product_dates
  where id = p_product_date_id
    and active = true
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

  v_unit_amount := coalesce(v_product_date.price_override, v_product.promotional_price, v_product.price);
  v_total_amount := round(v_unit_amount * p_travelers_count, 2);

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
    slots_released
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
    false
  )
  returning id into v_booking_id;

  return query select v_booking_id, v_total_amount, v_expires_at;
end;
$$;

revoke all on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer) from public;
grant execute on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer) to service_role;

-- Batch sweep for the cron: expires every overdue pending hold and returns
-- the seats to inventory. Reuses expire_pending_booking (row lock + idempotent
-- slot release), so it is safe to run concurrently with page-driven expiry.
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
      and payment_status = 'pending'
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
