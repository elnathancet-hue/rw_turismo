-- Fase 1 — Operacao manual de reservas
-- Destrava a venda por WhatsApp/telefone e o recebimento por PIX/boleto/dinheiro
-- fora do Stripe. Adiciona:
--   * bookings.source            ('site' | 'manual')
--   * payments.method            (rail do pagamento) + confirmed_by + notes
--   * payments.provider          passa a aceitar 'manual'
--   * RPCs security-definer chamados SOMENTE pelas rotas admin (service_role):
--       admin_create_booking, admin_confirm_manual_payment,
--       admin_cancel_booking, admin_rebook
--
-- Rodar no SQL Editor do Supabase. Idempotente (pode reexecutar sem erro).
-- Reaproveita a logica de create_pending_booking_transaction (validacao de
-- vagas) e de expire_pending_booking (devolucao de vagas).

-- =====================================================================
-- 1) Colunas novas
-- =====================================================================

-- bookings.source: distingue reserva feita no site x lancada pelo admin.
alter table public.bookings
  add column if not exists source text not null default 'site';

alter table public.bookings
  drop constraint if exists bookings_source_check;
alter table public.bookings
  add constraint bookings_source_check check (source in ('site', 'manual'));

create index if not exists bookings_source_idx on public.bookings(source);

-- payments.method: instrumento real do pagamento manual (o Stripe continua em
-- provider='stripe'/method='stripe'). confirmed_by = admin que registrou.
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

-- provider passa a aceitar pagamentos fora do Stripe.
alter table public.payments
  drop constraint if exists payments_provider_check;
alter table public.payments
  add constraint payments_provider_check check (provider in ('stripe', 'manual'));

-- =====================================================================
-- 2) RPC admin_create_booking
--    Cria reserva manual (confirmed ou pending) com validacao de vagas.
--    Reserva manual nunca expira (expires_at = null) e ja retem as vagas.
--    O cliente precisa de um auth.users id (a rota admin busca/cria antes),
--    para que a reserva apareca em /account/bookings sob o RLS existente.
-- =====================================================================
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
  -- Defesa em profundidade: mesmo rodando como service_role, so admin real opera.
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
  where id = p_product_id and active = true
  for update;

  if not found then
    raise exception 'PRODUCT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  select * into v_product_date
  from public.product_dates
  where id = p_product_date_id and active = true
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

  -- Total: usa override do admin (preco negociado) ou o preco do produto.
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
-- 3) RPC admin_confirm_manual_payment
--    Registra pagamento manual (PIX/boleto/etc.), marca a reserva paga e
--    confirmada. Mesma transicao de estado do webhook Stripe. Nao mexe em
--    vagas (ja foram retidas na criacao).
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

-- =====================================================================
-- 4) RPC admin_cancel_booking
--    Cancela e devolve as vagas (idempotente). Reserva paga vira 'refunded'
--    (sinaliza que o admin precisa/ja devolveu o valor por fora).
-- =====================================================================
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

  -- Idempotente: ja cancelada/expirada nao faz nada.
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

-- =====================================================================
-- 5) RPC admin_rebook
--    Move a reserva para outra data do MESMO produto: valida vagas na nova
--    data, desconta la e devolve as vagas da data antiga. Total inalterado.
-- =====================================================================
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

  -- Devolve as vagas da data antiga (se ainda retidas) e desconta na nova.
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
