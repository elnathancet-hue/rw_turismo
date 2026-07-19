-- Fase 2.5 — Cupons de desconto (item 2.5 do PLANO)
-- Tabela coupons + bookings.coupon_id + validação/aplicação DENTRO da RPC de
-- criação de reserva (nunca confia no valor do client). O checkout Stripe já
-- cobra booking.total_amount (já descontado). used_count só incrementa no
-- webhook (pagamento confirmado). Rodar no SQL Editor do Supabase. Idempotente.

-- =====================================================================
-- 1) Tabela coupons
-- =====================================================================
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

-- RLS: só admin gerencia. A validação em reserva usa a RPC (security definer),
-- então o público nunca lê a tabela diretamente.
alter table public.coupons enable row level security;
drop policy if exists "coupons_admin_all" on public.coupons;
create policy "coupons_admin_all" on public.coupons
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =====================================================================
-- 2) bookings.coupon_id
-- =====================================================================
alter table public.bookings
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null;
create index if not exists bookings_coupon_id_idx on public.bookings(coupon_id);

-- =====================================================================
-- 3) RPC create_pending_booking_transaction — agora com cupom opcional
--    (a assinatura muda: dropa a versão de 7 args antes de recriar).
-- =====================================================================
drop function if exists public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer);

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

-- =====================================================================
-- 4) Incremento atômico de uso do cupom (chamado pelo webhook ao confirmar).
-- =====================================================================
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
