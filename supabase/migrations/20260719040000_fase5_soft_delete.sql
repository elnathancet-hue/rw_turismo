-- Fase 5.4 — Soft delete (item 5.4 do PLANO)
-- Adiciona deleted_at em products/categories/product_dates/suppliers/leads.
-- Excluir passa a ser um UPDATE (deleted_at = now()); o item some das listas e
-- do site mas continua referenciável pelo histórico de reservas. Endurece as
-- RPCs de reserva e as policies de SELECT público para nunca enxergar um item
-- "excluído". Rodar no SQL Editor do Supabase. Idempotente.

-- =====================================================================
-- 1) Colunas deleted_at + índices
-- =====================================================================
alter table public.products      add column if not exists deleted_at timestamptz;
alter table public.categories    add column if not exists deleted_at timestamptz;
alter table public.product_dates add column if not exists deleted_at timestamptz;
alter table public.suppliers     add column if not exists deleted_at timestamptz;
alter table public.leads         add column if not exists deleted_at timestamptz;

create index if not exists products_deleted_at_idx      on public.products(deleted_at);
create index if not exists categories_deleted_at_idx    on public.categories(deleted_at);
create index if not exists product_dates_deleted_at_idx on public.product_dates(deleted_at);
create index if not exists suppliers_deleted_at_idx     on public.suppliers(deleted_at);
create index if not exists leads_deleted_at_idx         on public.leads(deleted_at);

-- =====================================================================
-- 2) RPCs de reserva: um produto/data "excluído" nunca pode ser vendido.
--    Mesma assinatura das versões atuais — só acrescenta deleted_at is null
--    aos SELECT ... FOR UPDATE de products/product_dates.
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
  v_unit_amount numeric(12,2);
  v_total_amount numeric(12,2);
  v_expires_at timestamptz := now() + interval '30 minutes';
  v_booking_id uuid;
  v_coupon public.coupons%rowtype;
  v_coupon_id uuid := null;
  v_coupon_code text;
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

  v_unit_amount := coalesce(v_product_date.price_override, v_product.promotional_price, v_product.price);
  v_total_amount := round(v_unit_amount * p_travelers_count, 2);

  -- Cupom (opcional): validado no servidor e aplicado ao total. used_count NÃO
  -- incrementa aqui — só quando o pagamento é confirmado (webhook).
  v_coupon_code := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  if v_coupon_code is not null then
    select *
      into v_coupon
    from public.coupons
    where upper(code) = v_coupon_code
    for update;

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

    -- total_amount tem constraint > 0; cupom não pode zerar a reserva.
    if v_total_amount < 0.01 then
      v_total_amount := 0.01;
    end if;

    v_coupon_id := v_coupon.id;
  end if;

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

create or replace function public.admin_create_booking(
  p_admin_id uuid,
  p_user_id uuid,
  p_product_id uuid,
  p_product_date_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_travelers_count integer,
  p_status text default 'confirmed',
  p_total_override numeric default null
)
returns table (
  booking_id uuid,
  total_amount numeric(12,2),
  status text
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
  v_booking_id uuid;
  v_confirmed_at timestamptz;
begin
  if not exists (
    select 1 from public.users_profiles
    where user_id = p_admin_id and role = 'admin'
  ) then
    raise exception 'ADMIN_REQUIRED' using errcode = 'P0001';
  end if;

  if p_user_id is null then
    raise exception 'CUSTOMER_USER_REQUIRED' using errcode = 'P0001';
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

  if p_status is null or p_status not in ('pending', 'confirmed') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and active = true and deleted_at is null
  for update;

  if not found then
    raise exception 'PRODUCT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  select * into v_product_date
  from public.product_dates
  where id = p_product_date_id and active = true and deleted_at is null
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

  if p_total_override is not null then
    if p_total_override <= 0 then
      raise exception 'INVALID_TOTAL' using errcode = 'P0001';
    end if;
    v_total_amount := round(p_total_override, 2);
  else
    v_unit_amount := coalesce(v_product_date.price_override, v_product.promotional_price, v_product.price);
    v_total_amount := round(v_unit_amount * p_travelers_count, 2);
  end if;

  if v_total_amount <= 0 then
    raise exception 'INVALID_TOTAL' using errcode = 'P0001';
  end if;

  update public.product_dates
  set available_slots = available_slots - p_travelers_count
  where id = p_product_date_id;

  if p_status = 'confirmed' then
    v_confirmed_at := now();
  else
    v_confirmed_at := null;
  end if;

  insert into public.bookings (
    user_id, product_id, product_date_id,
    customer_name, customer_email, customer_phone,
    travelers_count, total_amount, status, payment_status,
    confirmed_at, expires_at, slots_released, source
  )
  values (
    p_user_id, p_product_id, p_product_date_id,
    trim(p_customer_name), lower(trim(p_customer_email)),
    nullif(trim(coalesce(p_customer_phone, '')), ''),
    p_travelers_count, v_total_amount, p_status, 'pending',
    v_confirmed_at, null, false, 'manual'
  )
  returning id into v_booking_id;

  insert into public.system_logs (user_id, action, entity, entity_id, metadata)
  values (
    p_admin_id, 'admin_create_booking', 'bookings', v_booking_id,
    jsonb_build_object(
      'status', p_status,
      'total_amount', v_total_amount,
      'travelers_count', p_travelers_count,
      'product_id', p_product_id,
      'product_date_id', p_product_date_id,
      'customer_user_id', p_user_id,
      'price_overridden', (p_total_override is not null)
    )
  );

  return query select v_booking_id, v_total_amount, p_status;
end;
$$;

revoke all on function public.admin_create_booking(uuid, uuid, uuid, uuid, text, text, text, integer, text, numeric) from public;
grant execute on function public.admin_create_booking(uuid, uuid, uuid, uuid, text, text, text, integer, text, numeric) to service_role;

-- =====================================================================
-- 3) RLS: SELECT público nunca enxerga item excluído (defesa no banco).
--    Admin continua vendo tudo pelas policies *_admin_all (is_admin()).
-- =====================================================================
drop policy if exists "products_select_active" on public.products;
create policy "products_select_active"
on public.products
for select
to anon, authenticated
using (active = true and deleted_at is null);

drop policy if exists "product_dates_select_active_products" on public.product_dates;
create policy "product_dates_select_active_products"
on public.product_dates
for select
to anon, authenticated
using (
  active = true
  and deleted_at is null
  and exists (
    select 1
    from public.products
    where products.id = product_dates.product_id
      and products.active = true
      and products.deleted_at is null
  )
);

drop policy if exists "categories_select_active" on public.categories;
create policy "categories_select_active"
on public.categories
for select
to anon, authenticated
using (active = true and deleted_at is null);

drop policy if exists "product_categories_select_active" on public.product_categories;
create policy "product_categories_select_active"
on public.product_categories
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    where products.id = product_categories.product_id
      and products.active = true
      and products.deleted_at is null
  )
  and exists (
    select 1
    from public.categories
    where categories.id = product_categories.category_id
      and categories.active = true
      and categories.deleted_at is null
  )
);
