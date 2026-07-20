-- Supabase schema for the tourism booking platform.
-- Run this file before rls.sql and seed.sql.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  email text,
  phone text,
  role text not null default 'customer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_profiles_user_id_key unique (user_id),
  constraint users_profiles_email_key unique (email),
  constraint users_profiles_role_check check (role in ('customer', 'admin')),
  constraint users_profiles_email_lowercase_check check (email is null or email = lower(email))
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  type text not null,
  destination text not null,
  origin text,
  price numeric(12,2) not null,
  promotional_price numeric(12,2),
  cover_image text,
  gallery jsonb not null default '[]'::jsonb,
  itinerary jsonb not null default '[]'::jsonb,
  faq jsonb not null default '[]'::jsonb,
  tiers jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint products_type_check check (type in ('package', 'hotel', 'flight', 'stay', 'experience')),
  constraint products_price_non_negative_check check (price >= 0),
  constraint products_promotional_price_non_negative_check check (promotional_price is null or promotional_price >= 0),
  constraint products_promotional_price_max_price_check check (promotional_price is null or promotional_price <= price),
  constraint products_gallery_array_check check (jsonb_typeof(gallery) = 'array'),
  constraint products_itinerary_array_check check (jsonb_typeof(itinerary) = 'array'),
  constraint products_faq_array_check check (jsonb_typeof(faq) = 'array'),
  constraint products_tiers_array_check check (jsonb_typeof(tiers) = 'array')
);

create table if not exists public.product_dates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  available_slots integer not null,
  price_override numeric(12,2),
  departure_time time,
  return_time time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint product_dates_product_id_start_date_end_date_key unique (product_id, start_date, end_date),
  constraint product_dates_valid_range_check check (end_date >= start_date),
  constraint product_dates_available_slots_non_negative_check check (available_slots >= 0),
  constraint product_dates_price_override_non_negative_check check (price_override is null or price_override >= 0)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_date_id uuid not null references public.product_dates(id) on delete restrict,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  travelers_count integer not null,
  total_amount numeric(12,2) not null,
  status text not null default 'pending',
  payment_status text not null default 'pending',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  slots_released boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_customer_email_lowercase_check check (customer_email = lower(customer_email)),
  constraint bookings_travelers_count_positive_check check (travelers_count > 0),
  constraint bookings_total_amount_positive_check check (total_amount > 0),
  constraint bookings_status_check check (status in ('pending', 'confirmed', 'cancelled', 'expired')),
  constraint bookings_payment_status_check check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'cancelled', 'requires_review')),
  constraint bookings_product_date_match_key unique (id, product_date_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'BRL',
  status text not null default 'pending',
  provider text not null default 'stripe',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_positive_check check (amount > 0),
  constraint payments_currency_uppercase_check check (currency = upper(currency)),
  constraint payments_currency_check check (currency in ('BRL', 'USD', 'CAD', 'EUR')),
  constraint payments_status_check check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled', 'requires_review')),
  constraint payments_provider_check check (provider in ('stripe'))
);

create table if not exists public.passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  full_name text not null,
  document text,
  birth_date date,
  type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint passengers_type_check check (type in ('adult', 'child', 'infant'))
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_product_id_category_id_key unique (product_id, category_id)
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  external_hotel_id text,
  title text not null,
  destination text,
  image_url text,
  provider text not null default 'internal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint favorites_provider_check check (length(trim(provider)) > 0),
  constraint favorites_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint favorites_product_or_external_check check (product_id is not null or external_hotel_id is not null)
);

create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint system_logs_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index if not exists users_profiles_user_id_idx on public.users_profiles(user_id);
create index if not exists users_profiles_role_idx on public.users_profiles(role);

create index if not exists products_slug_idx on public.products(slug);
create index if not exists products_active_idx on public.products(active);
create index if not exists products_type_idx on public.products(type);
create index if not exists products_destination_idx on public.products(destination);
create index if not exists products_origin_idx on public.products(origin);
create index if not exists products_deleted_at_idx on public.products(deleted_at);

create index if not exists product_dates_product_id_idx on public.product_dates(product_id);
create index if not exists product_dates_active_idx on public.product_dates(active);
create index if not exists product_dates_start_date_idx on public.product_dates(start_date);
create index if not exists product_dates_deleted_at_idx on public.product_dates(deleted_at);

create index if not exists bookings_user_id_idx on public.bookings(user_id);
create index if not exists bookings_product_id_idx on public.bookings(product_id);
create index if not exists bookings_product_date_id_idx on public.bookings(product_date_id);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_payment_status_idx on public.bookings(payment_status);
create index if not exists bookings_expires_at_idx on public.bookings(expires_at);
create unique index if not exists bookings_stripe_checkout_session_id_key
  on public.bookings(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create unique index if not exists bookings_stripe_payment_intent_id_key
  on public.bookings(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.bookings
  add column if not exists slots_released boolean not null default false;

create index if not exists bookings_slots_released_idx on public.bookings(slots_released);

create index if not exists payments_booking_id_idx on public.payments(booking_id);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_status_idx on public.payments(status);
create unique index if not exists payments_stripe_checkout_session_id_key
  on public.payments(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create unique index if not exists payments_stripe_payment_intent_id_key
  on public.payments(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists passengers_booking_id_idx on public.passengers(booking_id);
create index if not exists categories_slug_idx on public.categories(slug);
create index if not exists categories_deleted_at_idx on public.categories(deleted_at);
create index if not exists product_categories_product_id_idx on public.product_categories(product_id);
create index if not exists product_categories_category_id_idx on public.product_categories(category_id);
create index if not exists favorites_user_id_idx on public.favorites(user_id);
create index if not exists favorites_product_id_idx on public.favorites(product_id);
create index if not exists favorites_external_hotel_id_idx on public.favorites(external_hotel_id);
create index if not exists favorites_provider_idx on public.favorites(provider);
create unique index if not exists favorites_user_id_product_id_key
  on public.favorites(user_id, product_id)
  where product_id is not null;
create unique index if not exists favorites_user_id_provider_external_hotel_id_key
  on public.favorites(user_id, provider, external_hotel_id)
  where external_hotel_id is not null;
create index if not exists system_logs_user_id_idx on public.system_logs(user_id);
create index if not exists system_logs_entity_idx on public.system_logs(entity, entity_id);

alter table public.bookings
  drop constraint if exists bookings_payment_status_check;
alter table public.bookings
  add constraint bookings_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'cancelled', 'requires_review'));

alter table public.payments
  drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled', 'requires_review'));

-- Fase 1 — operacao manual de reservas (venda por WhatsApp/telefone, PIX/boleto).
alter table public.bookings
  add column if not exists source text not null default 'site';
alter table public.bookings
  drop constraint if exists bookings_source_check;
alter table public.bookings
  add constraint bookings_source_check check (source in ('site', 'manual'));
create index if not exists bookings_source_idx on public.bookings(source);

alter table public.payments
  add column if not exists method text not null default 'stripe';
alter table public.payments
  drop constraint if exists payments_method_check;
alter table public.payments
  add constraint payments_method_check
  check (method in ('stripe', 'pix', 'boleto', 'dinheiro', 'transferencia', 'outro'));
alter table public.payments
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null;
alter table public.payments
  add column if not exists notes text;
create index if not exists payments_confirmed_by_idx on public.payments(confirmed_by);
alter table public.payments
  drop constraint if exists payments_provider_check;
alter table public.payments
  add constraint payments_provider_check check (provider in ('stripe', 'manual'));

-- Fase 2.5 — Cupons de desconto.
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null,
  discount_value numeric(12,2) not null,
  product_id uuid references public.products(id) on delete cascade,
  max_uses integer,
  used_count integer not null default 0,
  active boolean not null default true,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_discount_type_check check (discount_type in ('percent', 'fixed')),
  constraint coupons_discount_value_positive_check check (discount_value > 0),
  constraint coupons_percent_max_check check (discount_type <> 'percent' or discount_value <= 100),
  constraint coupons_used_count_check check (used_count >= 0),
  constraint coupons_max_uses_check check (max_uses is null or max_uses >= 0)
);
create index if not exists coupons_active_idx on public.coupons(active);
create index if not exists coupons_product_id_idx on public.coupons(product_id);
drop trigger if exists set_coupons_updated_at on public.coupons;
create trigger set_coupons_updated_at
before update on public.coupons
for each row execute function public.set_updated_at();

alter table public.bookings
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null;
create index if not exists bookings_coupon_id_idx on public.bookings(coupon_id);

drop trigger if exists set_users_profiles_updated_at on public.users_profiles;
create trigger set_users_profiles_updated_at
before update on public.users_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_product_dates_updated_at on public.product_dates;
create trigger set_product_dates_updated_at
before update on public.product_dates
for each row execute function public.set_updated_at();

drop trigger if exists set_bookings_updated_at on public.bookings;
create trigger set_bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists set_passengers_updated_at on public.passengers;
create trigger set_passengers_updated_at
before update on public.passengers
for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists set_product_categories_updated_at on public.product_categories;
create trigger set_product_categories_updated_at
before update on public.product_categories
for each row execute function public.set_updated_at();

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

-- Fase 2.5 — incremento atômico de uso do cupom (webhook, ao confirmar pagamento).
create or replace function public.increment_coupon_usage(p_coupon_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons set used_count = used_count + 1 where id = p_coupon_id;
$$;

revoke all on function public.increment_coupon_usage(uuid) from public;
grant execute on function public.increment_coupon_usage(uuid) to service_role;

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

  if v_booking.status <> 'pending' or v_booking.payment_status <> 'pending' then
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

  -- Expired holds cannot proceed to payment, so payment_status is moved to cancelled.
  update public.bookings
  set status = 'expired',
      payment_status = 'cancelled',
      slots_released = v_slots_released
  where id = v_booking.id;

  return query select v_booking.id, true, v_slots_released;
end;
$$;

revoke all on function public.expire_pending_booking(uuid) from public;
grant execute on function public.expire_pending_booking(uuid) to service_role;

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

-- ===================================================================
-- Fase 1 — RPCs de operacao manual de reservas (chamados so pelas rotas
-- admin via service_role). Ver migration 20260719000000_fase1_reservas_manuais.
-- ===================================================================

-- Cria reserva manual (confirmed ou pending) com validacao de vagas. Reserva
-- manual nunca expira (expires_at = null) e ja retem as vagas. O cliente
-- precisa de um auth.users id (a rota admin busca/cria antes) para a reserva
-- aparecer em /account/bookings sob o RLS existente.
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

-- Registra pagamento manual, marca a reserva paga e confirmada (mesma
-- transicao do webhook Stripe). Nao mexe em vagas.
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
  if not exists (
    select 1 from public.users_profiles
    where user_id = p_admin_id and role = 'admin'
  ) then
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

-- Cancela e devolve as vagas (idempotente). Reserva paga vira 'refunded'.
create or replace function public.admin_cancel_booking(
  p_admin_id uuid,
  p_booking_id uuid,
  p_reason text default null
)
returns table (
  booking_id uuid,
  status text,
  slots_released boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_slots_released boolean;
  v_returned_slots boolean := false;
  v_new_payment_status text;
begin
  if not exists (
    select 1 from public.users_profiles
    where user_id = p_admin_id and role = 'admin'
  ) then
    raise exception 'ADMIN_REQUIRED' using errcode = 'P0001';
  end if;

  if p_booking_id is null then
    raise exception 'BOOKING_ID_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_booking.status in ('cancelled','expired') then
    return query select v_booking.id, v_booking.status, v_booking.slots_released;
    return;
  end if;

  v_slots_released := v_booking.slots_released;

  if v_slots_released = false then
    update public.product_dates
    set available_slots = available_slots + v_booking.travelers_count
    where id = v_booking.product_date_id;
    v_slots_released := true;
    v_returned_slots := true;
  end if;

  if v_booking.payment_status = 'paid' then
    v_new_payment_status := 'refunded';
  else
    v_new_payment_status := 'cancelled';
  end if;

  update public.bookings
  set status = 'cancelled',
      payment_status = v_new_payment_status,
      cancelled_at = now(),
      slots_released = v_slots_released
  where id = v_booking.id;

  insert into public.system_logs (user_id, action, entity, entity_id, metadata)
  values (
    p_admin_id, 'admin_cancel_booking', 'bookings', v_booking.id,
    jsonb_build_object(
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'previous_status', v_booking.status,
      'previous_payment_status', v_booking.payment_status,
      'new_payment_status', v_new_payment_status,
      'slots_returned', v_returned_slots
    )
  );

  return query select v_booking.id, 'cancelled'::text, v_slots_released;
end;
$$;

revoke all on function public.admin_cancel_booking(uuid, uuid, text) from public;
grant execute on function public.admin_cancel_booking(uuid, uuid, text) to service_role;

-- Move a reserva para outra data do MESMO produto (valida vagas na nova,
-- devolve na antiga). Total inalterado.
create or replace function public.admin_rebook(
  p_admin_id uuid,
  p_booking_id uuid,
  p_new_product_date_id uuid
)
returns table (
  booking_id uuid,
  old_product_date_id uuid,
  new_product_date_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_new_date public.product_dates%rowtype;
  v_old_date_id uuid;
begin
  if not exists (
    select 1 from public.users_profiles
    where user_id = p_admin_id and role = 'admin'
  ) then
    raise exception 'ADMIN_REQUIRED' using errcode = 'P0001';
  end if;

  if p_booking_id is null or p_new_product_date_id is null then
    raise exception 'BOOKING_AND_DATE_REQUIRED' using errcode = 'P0001';
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

  if p_new_product_date_id = v_booking.product_date_id then
    raise exception 'SAME_DATE' using errcode = 'P0001';
  end if;

  select * into v_new_date
  from public.product_dates
  where id = p_new_product_date_id and active = true
  for update;

  if not found then
    raise exception 'PRODUCT_DATE_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  if v_new_date.product_id <> v_booking.product_id then
    raise exception 'PRODUCT_DATE_MISMATCH' using errcode = 'P0001';
  end if;

  if v_new_date.start_date < current_date then
    raise exception 'PRODUCT_DATE_IN_PAST' using errcode = 'P0001';
  end if;

  if v_new_date.available_slots < v_booking.travelers_count then
    raise exception 'NOT_ENOUGH_SLOTS' using errcode = 'P0001';
  end if;

  v_old_date_id := v_booking.product_date_id;

  if v_booking.slots_released = false then
    update public.product_dates
    set available_slots = available_slots + v_booking.travelers_count
    where id = v_old_date_id;
  end if;

  update public.product_dates
  set available_slots = available_slots - v_booking.travelers_count
  where id = p_new_product_date_id;

  update public.bookings
  set product_date_id = p_new_product_date_id,
      slots_released = false
  where id = v_booking.id;

  insert into public.system_logs (user_id, action, entity, entity_id, metadata)
  values (
    p_admin_id, 'admin_rebook', 'bookings', v_booking.id,
    jsonb_build_object(
      'old_product_date_id', v_old_date_id,
      'new_product_date_id', p_new_product_date_id,
      'travelers_count', v_booking.travelers_count
    )
  );

  return query select v_booking.id, v_old_date_id, p_new_product_date_id;
end;
$$;

revoke all on function public.admin_rebook(uuid, uuid, uuid) from public;
grant execute on function public.admin_rebook(uuid, uuid, uuid) to service_role;

-- Editable home, site settings and blog.
create table if not exists public.home_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  title text,
  subtitle text,
  content jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_sections_content_object_check check (jsonb_typeof(content) = 'object')
);

create table if not exists public.home_banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_url text,
  mobile_image_url text,
  button_text text,
  button_url text,
  overlay_strength numeric(3,2) not null default 0.35,
  active boolean not null default true,
  display_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_banners_overlay_check check (overlay_strength between 0 and 1),
  constraint home_banners_date_range_check check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null default '',
  cover_image text,
  author_id uuid references auth.users(id) on delete set null,
  category_id uuid references public.blog_categories(id) on delete set null,
  status text not null default 'draft',
  published_at timestamptz,
  featured boolean not null default false,
  seo_title text,
  seo_description text,
  canonical_url text,
  og_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_status_check check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

create table if not exists public.blog_post_tags (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  tag_id uuid not null references public.blog_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  active boolean not null default true,
  source text not null default 'home',
  created_at timestamptz not null default now(),
  constraint newsletter_email_lowercase_check check (email = lower(email)),
  constraint newsletter_email_basic_check check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create index if not exists home_sections_active_order_idx on public.home_sections(active, display_order);
create index if not exists home_banners_active_order_idx on public.home_banners(active, display_order);
create index if not exists blog_posts_publication_idx on public.blog_posts(status, published_at desc);
create index if not exists blog_posts_category_idx on public.blog_posts(category_id);
create index if not exists blog_posts_featured_idx on public.blog_posts(featured);
create index if not exists newsletter_subscribers_created_idx on public.newsletter_subscribers(created_at desc);

drop trigger if exists set_home_sections_updated_at on public.home_sections;
create trigger set_home_sections_updated_at before update on public.home_sections
for each row execute function public.set_updated_at();
drop trigger if exists set_home_banners_updated_at on public.home_banners;
create trigger set_home_banners_updated_at before update on public.home_banners
for each row execute function public.set_updated_at();
drop trigger if exists set_blog_categories_updated_at on public.blog_categories;
create trigger set_blog_categories_updated_at before update on public.blog_categories
for each row execute function public.set_updated_at();
drop trigger if exists set_blog_posts_updated_at on public.blog_posts;
create trigger set_blog_posts_updated_at before update on public.blog_posts
for each row execute function public.set_updated_at();

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text not null default '',
  status text not null default 'draft',
  seo_title text,
  seo_description text,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pages_status_check check (status in ('draft', 'published'))
);

create index if not exists pages_slug_idx on public.pages(slug);
create index if not exists pages_status_idx on public.pages(status);

drop trigger if exists set_pages_updated_at on public.pages;
create trigger set_pages_updated_at
before update on public.pages
for each row execute function public.set_updated_at();

-- Fase 1 (operação): perfil enriquecido, check-in, fornecedores e lista de espera.
alter table public.users_profiles
  add column if not exists birth_date date,
  add column if not exists document text;

alter table public.passengers
  add column if not exists checked_in_at timestamptz;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'outro',
  contact_name text,
  phone text,
  email text,
  city text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint suppliers_category_check check (
    category in ('hotel', 'transporte', 'guia', 'restaurante', 'passeio', 'outro')
  )
);

create index if not exists suppliers_active_idx on public.suppliers(active);
create index if not exists suppliers_category_idx on public.suppliers(category);
create index if not exists suppliers_deleted_at_idx on public.suppliers(deleted_at);

drop trigger if exists set_suppliers_updated_at on public.suppliers;
create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  product_date_id uuid references public.product_dates(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  travelers_count integer not null default 1,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waitlist_status_check check (
    status in ('pending', 'contacted', 'converted', 'cancelled')
  ),
  constraint waitlist_email_lowercase_check check (email = lower(email)),
  constraint waitlist_travelers_positive_check check (travelers_count > 0)
);

create index if not exists waitlist_product_date_idx on public.waitlist(product_date_id);
create index if not exists waitlist_status_idx on public.waitlist(status);

drop trigger if exists set_waitlist_updated_at on public.waitlist;
create trigger set_waitlist_updated_at
before update on public.waitlist
for each row execute function public.set_updated_at();

-- Fase 2 (logística): assentos, quartos e transfers.
alter table public.passengers
  add column if not exists seat_number text,
  add column if not exists room_label text;

alter table public.product_dates
  add column if not exists total_seats integer;

alter table public.product_dates
  drop constraint if exists product_dates_total_seats_positive_check;
alter table public.product_dates
  add constraint product_dates_total_seats_positive_check
  check (total_seats is null or total_seats > 0);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  product_date_id uuid not null references public.product_dates(id) on delete cascade,
  title text not null,
  transfer_date date,
  transfer_time text,
  meeting_point text,
  driver_name text,
  driver_phone text,
  vehicle text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  capacity integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfers_capacity_positive_check check (capacity is null or capacity > 0)
);

create index if not exists transfers_product_date_idx on public.transfers(product_date_id);
create index if not exists transfers_supplier_idx on public.transfers(supplier_id);

drop trigger if exists set_transfers_updated_at on public.transfers;
create trigger set_transfers_updated_at
before update on public.transfers
for each row execute function public.set_updated_at();

-- Fase 4 (CRM): leads, atividades e UTM na lista de espera.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  interest text,
  source text not null default 'manual',
  utm jsonb not null default '{}'::jsonb,
  stage_id text not null default 'new',
  position integer not null default 0,
  waitlist_id uuid references public.waitlist(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint leads_utm_object_check check (jsonb_typeof(utm) = 'object')
);

create index if not exists leads_stage_idx on public.leads(stage_id, position);
create index if not exists leads_created_idx on public.leads(created_at desc);
create index if not exists leads_deleted_at_idx on public.leads(deleted_at);
create index if not exists leads_waitlist_idx on public.leads(waitlist_id);

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx on public.lead_activities(lead_id, created_at desc);

alter table public.waitlist
  add column if not exists utm jsonb not null default '{}'::jsonb;

-- Fase 0/3 (integrações + notificações).
create table if not exists public.integration_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_integration_secrets_updated_at on public.integration_secrets;
create trigger set_integration_secrets_updated_at
before update on public.integration_secrets
for each row execute function public.set_updated_at();

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  channel text not null,
  recipient text,
  subject text,
  body text,
  status text not null,
  error text,
  ref text,
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint notification_log_channel_check check (channel in ('whatsapp', 'email')),
  constraint notification_log_status_check check (status in ('sent', 'skipped', 'failed'))
);

create index if not exists notification_log_event_ref_idx on public.notification_log(event, ref);
create index if not exists notification_log_created_idx on public.notification_log(created_at desc);

-- Fase 5 (financeiro): despesas e contas a receber.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  product_date_id uuid references public.product_dates(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  category text not null default 'outro',
  description text not null,
  amount numeric(12,2) not null,
  expense_date date not null default current_date,
  paid boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_amount_positive_check check (amount > 0),
  constraint expenses_category_check check (
    category in ('combustivel', 'hospedagem', 'alimentacao', 'transporte', 'guia', 'ingresso', 'taxa', 'marketing', 'outro')
  )
);

create index if not exists expenses_date_idx on public.expenses(expense_date desc);
create index if not exists expenses_product_date_idx on public.expenses(product_date_id);

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  description text not null,
  customer_name text,
  amount numeric(12,2) not null,
  due_date date not null default current_date,
  status text not null default 'pending',
  method text,
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivables_amount_positive_check check (amount > 0),
  constraint receivables_status_check check (status in ('pending', 'received', 'cancelled')),
  constraint receivables_method_check check (
    method is null or method in ('pix', 'boleto', 'cartao', 'dinheiro', 'transferencia', 'outro')
  )
);

create index if not exists receivables_due_idx on public.receivables(due_date);
create index if not exists receivables_status_idx on public.receivables(status);

drop trigger if exists set_receivables_updated_at on public.receivables;
create trigger set_receivables_updated_at
before update on public.receivables
for each row execute function public.set_updated_at();

-- Aparência por página (topo e rodapé).
alter table public.pages
  add column if not exists header_style text not null default 'simple',
  add column if not exists show_footer boolean not null default true;

alter table public.pages
  drop constraint if exists pages_header_style_check;
alter table public.pages
  add constraint pages_header_style_check
  check (header_style in ('site', 'simple', 'none'));

-- Modo HTML nas páginas (colar HTML completo).
alter table public.pages
  add column if not exists custom_html text,
  add column if not exists custom_html_chrome boolean not null default false;

-- Semana 3: pesquisa de satisfação pós-viagem.
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  rating integer not null,
  comment text,
  approved boolean not null default false,
  display_name text,
  created_at timestamptz not null default now(),
  constraint survey_responses_rating_check check (rating >= 0 and rating <= 10),
  constraint survey_responses_booking_key unique (booking_id)
);

create index if not exists survey_responses_created_idx on public.survey_responses(created_at desc);
create index if not exists survey_responses_approved_idx on public.survey_responses(approved);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('site-assets', 'site-assets', true, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml','image/x-icon']),
  ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('blog-images', 'blog-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
