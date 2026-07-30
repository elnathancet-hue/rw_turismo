-- Usuários do sistema — papéis de equipe (admin / operacoes / financeiro / conteudo).
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Estratégia: as policies de admin já existentes NÃO são alteradas (is_admin()
-- continua significando "role = 'admin'"). Este arquivo apenas ACRESCENTA
-- policies por papel — em Postgres, policies permissivas se somam (OR), então
-- nada do que o admin faz hoje muda de comportamento.
--
-- Quem enxerga o quê (a sidebar em src/lib/auth/roles.ts espelha esta tabela):
--   operacoes  → reservas, passageiros/check-in, saídas, fornecedores,
--                transfers, lista de espera, CRM, clientes. Lê pagamentos.
--   financeiro → pagamentos (confirmar), despesas, recebíveis, cupons.
--                Lê reservas. NÃO mexe no catálogo.
--   conteudo   → catálogo, home, páginas, blog, aparência, avaliações, cupons.
--                NÃO vê caixa nem reservas.

-- =====================================================================
-- 1) users_profiles: novos papéis + ativação/desativação de acesso
-- =====================================================================
alter table public.users_profiles
  add column if not exists active boolean not null default true;

alter table public.users_profiles drop constraint if exists users_profiles_role_check;
alter table public.users_profiles add constraint users_profiles_role_check
  check (role in ('customer', 'admin', 'operacoes', 'financeiro', 'conteudo'));

create index if not exists users_profiles_active_idx on public.users_profiles(active);

-- =====================================================================
-- 2) Helpers de papel
--    staff_role_of() recebe o id explícito (usado pelas RPCs, que rodam como
--    service_role e portanto não têm auth.uid()). staff_role() usa o usuário
--    logado (usado pelas policies).
-- =====================================================================
create or replace function public.staff_role_of(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users_profiles
  where user_id = p_user_id
    and active = true
    and role <> 'customer'
$$;

create or replace function public.staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_role_of(auth.uid())
$$;

-- Qualquer papel de equipe (ativo). Usado nas policies de leitura comum.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_role() is not null
$$;

-- Papel do usuário logado está na lista informada.
create or replace function public.has_staff_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_role() = any(p_roles)
$$;

-- is_admin() passa a exigir conta ativa: desativar um admin tira o acesso na
-- hora, sem precisar apagar o perfil. `active` tem default true, então nenhum
-- usuário existente é afetado.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users_profiles
    where user_id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

revoke all on function public.staff_role_of(uuid) from public;
grant execute on function public.staff_role_of(uuid) to authenticated;
grant execute on function public.staff_role_of(uuid) to service_role;

revoke all on function public.staff_role() from public;
grant execute on function public.staff_role() to authenticated;
grant execute on function public.staff_role() to service_role;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_staff() to service_role;

revoke all on function public.has_staff_role(text[]) from public;
grant execute on function public.has_staff_role(text[]) to authenticated;
grant execute on function public.has_staff_role(text[]) to service_role;

-- =====================================================================
-- 3) Perfis: equipe lê a base de clientes; só admin mexe em papéis
--    O trigger prevent_customer_profile_identity_changes continua bloqueando
--    alteração de role/email por quem não é admin — ou seja, um operador não
--    consegue se promover nem promover ninguém.
-- =====================================================================
drop policy if exists "profiles_staff_select" on public.users_profiles;
create policy "profiles_staff_select"
on public.users_profiles
for select
to authenticated
using (public.is_staff());

-- Operações edita o cadastro do CLIENTE (nome, telefone, documento,
-- nascimento). O filtro role = 'customer' nos dois lados impede que a equipe
-- edite a ficha de outro membro da equipe.
drop policy if exists "profiles_operacoes_update_customers" on public.users_profiles;
create policy "profiles_operacoes_update_customers"
on public.users_profiles
for update
to authenticated
using (public.has_staff_role(array['operacoes']) and role = 'customer')
with check (public.has_staff_role(array['operacoes']) and role = 'customer');

-- =====================================================================
-- 4) Catálogo — conteudo gerencia; operacoes e financeiro só leem
--    (a leitura pública já existente cobre apenas itens ativos; a equipe
--    precisa ver inativos para montar reserva e conferir preço)
-- =====================================================================
drop policy if exists "products_staff_select" on public.products;
create policy "products_staff_select"
on public.products
for select
to authenticated
using (public.is_staff());

drop policy if exists "products_conteudo_all" on public.products;
create policy "products_conteudo_all"
on public.products
for all
to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "product_dates_staff_select" on public.product_dates;
create policy "product_dates_staff_select"
on public.product_dates
for select
to authenticated
using (public.is_staff());

drop policy if exists "product_dates_conteudo_all" on public.product_dates;
create policy "product_dates_conteudo_all"
on public.product_dates
for all
to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

-- Operações ajusta a logística da saída (total de assentos) sem poder criar,
-- apagar ou reprecificar datas.
drop policy if exists "product_dates_operacoes_update" on public.product_dates;
create policy "product_dates_operacoes_update"
on public.product_dates
for update
to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "categories_staff_select" on public.categories;
create policy "categories_staff_select"
on public.categories
for select
to authenticated
using (public.is_staff());

drop policy if exists "categories_conteudo_all" on public.categories;
create policy "categories_conteudo_all"
on public.categories
for all
to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "product_categories_conteudo_all" on public.product_categories;
create policy "product_categories_conteudo_all"
on public.product_categories
for all
to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

-- =====================================================================
-- 5) Reservas e operação — operacoes gerencia; financeiro só lê
-- =====================================================================
drop policy if exists "bookings_operacoes_all" on public.bookings;
create policy "bookings_operacoes_all"
on public.bookings
for all
to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "bookings_financeiro_select" on public.bookings;
create policy "bookings_financeiro_select"
on public.bookings
for select
to authenticated
using (public.has_staff_role(array['financeiro']));

drop policy if exists "passengers_operacoes_all" on public.passengers;
create policy "passengers_operacoes_all"
on public.passengers
for all
to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "passengers_financeiro_select" on public.passengers;
create policy "passengers_financeiro_select"
on public.passengers
for select
to authenticated
using (public.has_staff_role(array['financeiro']));

drop policy if exists "suppliers_operacoes_all" on public.suppliers;
create policy "suppliers_operacoes_all"
on public.suppliers
for all
to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "suppliers_financeiro_select" on public.suppliers;
create policy "suppliers_financeiro_select"
on public.suppliers
for select
to authenticated
using (public.has_staff_role(array['financeiro']));

drop policy if exists "transfers_operacoes_all" on public.transfers;
create policy "transfers_operacoes_all"
on public.transfers
for all
to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "waitlist_operacoes_all" on public.waitlist;
create policy "waitlist_operacoes_all"
on public.waitlist
for all
to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "leads_operacoes_all" on public.leads;
create policy "leads_operacoes_all"
on public.leads
for all
to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "lead_activities_operacoes_all" on public.lead_activities;
create policy "lead_activities_operacoes_all"
on public.lead_activities
for all
to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

-- =====================================================================
-- 6) Caixa — financeiro gerencia; operacoes só lê pagamento
-- =====================================================================
drop policy if exists "payments_financeiro_all" on public.payments;
create policy "payments_financeiro_all"
on public.payments
for all
to authenticated
using (public.has_staff_role(array['financeiro']))
with check (public.has_staff_role(array['financeiro']));

drop policy if exists "payments_operacoes_select" on public.payments;
create policy "payments_operacoes_select"
on public.payments
for select
to authenticated
using (public.has_staff_role(array['operacoes']));

drop policy if exists "expenses_financeiro_all" on public.expenses;
create policy "expenses_financeiro_all"
on public.expenses
for all
to authenticated
using (public.has_staff_role(array['financeiro']))
with check (public.has_staff_role(array['financeiro']));

drop policy if exists "receivables_financeiro_all" on public.receivables;
create policy "receivables_financeiro_all"
on public.receivables
for all
to authenticated
using (public.has_staff_role(array['financeiro']))
with check (public.has_staff_role(array['financeiro']));

-- Cupons: financeiro (impacto no caixa) e conteudo (campanha/marketing).
drop policy if exists "coupons_staff_all" on public.coupons;
create policy "coupons_staff_all"
on public.coupons
for all
to authenticated
using (public.has_staff_role(array['financeiro', 'conteudo']))
with check (public.has_staff_role(array['financeiro', 'conteudo']));

drop policy if exists "coupons_operacoes_select" on public.coupons;
create policy "coupons_operacoes_select"
on public.coupons
for select
to authenticated
using (public.has_staff_role(array['operacoes']));

-- =====================================================================
-- 7) Site e conteúdo editorial — só conteudo (além do admin)
-- =====================================================================
drop policy if exists "home_sections_conteudo_all" on public.home_sections;
create policy "home_sections_conteudo_all" on public.home_sections
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "home_banners_conteudo_all" on public.home_banners;
create policy "home_banners_conteudo_all" on public.home_banners
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "site_settings_conteudo_all" on public.site_settings;
create policy "site_settings_conteudo_all" on public.site_settings
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "pages_conteudo_all" on public.pages;
create policy "pages_conteudo_all" on public.pages
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "blog_posts_conteudo_all" on public.blog_posts;
create policy "blog_posts_conteudo_all" on public.blog_posts
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "blog_categories_conteudo_all" on public.blog_categories;
create policy "blog_categories_conteudo_all" on public.blog_categories
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "blog_tags_conteudo_all" on public.blog_tags;
create policy "blog_tags_conteudo_all" on public.blog_tags
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "blog_post_tags_conteudo_all" on public.blog_post_tags;
create policy "blog_post_tags_conteudo_all" on public.blog_post_tags
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "newsletter_conteudo_read" on public.newsletter_subscribers;
create policy "newsletter_conteudo_read" on public.newsletter_subscribers
for select to authenticated
using (public.has_staff_role(array['conteudo']));

drop policy if exists "newsletter_conteudo_update" on public.newsletter_subscribers;
create policy "newsletter_conteudo_update" on public.newsletter_subscribers
for update to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

-- Avaliações (NPS): conteudo aprova o que vai pro site; operacoes só consulta.
drop policy if exists "survey_responses_conteudo_read" on public.survey_responses;
create policy "survey_responses_conteudo_read" on public.survey_responses
for select to authenticated
using (public.has_staff_role(array['conteudo', 'operacoes']));

drop policy if exists "survey_responses_conteudo_update" on public.survey_responses;
create policy "survey_responses_conteudo_update" on public.survey_responses
for update to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

-- Upload de imagens (banner, capa de produto, blog) é trabalho de conteúdo.
drop policy if exists "conteudo_manage_site_assets" on storage.objects;
create policy "conteudo_manage_site_assets" on storage.objects
for all to authenticated
using (
  bucket_id in ('site-assets', 'product-images', 'blog-images')
  and public.has_staff_role(array['conteudo'])
)
with check (
  bucket_id in ('site-assets', 'product-images', 'blog-images')
  and public.has_staff_role(array['conteudo'])
);

-- =====================================================================
-- 8) Auditoria — toda a equipe consulta os próprios rastros
--    (escrita continua só admin + service_role, como antes)
-- =====================================================================
drop policy if exists "system_logs_staff_select" on public.system_logs;
create policy "system_logs_staff_select"
on public.system_logs
for select
to authenticated
using (public.is_staff());

drop policy if exists "notification_log_staff_read" on public.notification_log;
create policy "notification_log_staff_read"
on public.notification_log
for select
to authenticated
using (public.has_staff_role(array['operacoes', 'financeiro']));

-- =====================================================================
-- 9) RPCs de operação: guard passa a aceitar o papel certo
--    Só o `if not exists (... role = 'admin')` do topo muda — o resto do corpo
--    é idêntico ao de 20260719000000_fase1_reservas_manuais.sql. A exceção
--    continua sendo 'ADMIN_REQUIRED' para não quebrar o mapeamento de erro em
--    src/lib/admin/manualBookings.ts.
--
--    admin_create_booking / admin_cancel_booking / admin_rebook → operacoes
--    admin_confirm_manual_payment                               → financeiro
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
  -- Defesa em profundidade: mesmo rodando como service_role, só quem tem papel
  -- de reservas (admin ou operacoes) opera.
  if coalesce(public.staff_role_of(p_admin_id), '') not in ('admin', 'operacoes') then
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
  if coalesce(public.staff_role_of(p_admin_id), '') not in ('admin', 'operacoes') then
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
  if coalesce(public.staff_role_of(p_admin_id), '') not in ('admin', 'operacoes') then
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
