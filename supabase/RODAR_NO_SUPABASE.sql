-- ============================================================================
-- RW TURISMO — TODAS AS MIGRATIONS PENDENTES (cole este arquivo inteiro no
-- SQL Editor do Supabase e execute UMA vez). Tudo é idempotente.
-- Atualizado em 2026-09-02 (auditoria de segurança, quiz, e a tela de resultado).
--
-- ATENÇÃO — ORDEM IMPORTA. Este arquivo carrega, no meio dele, as versões
-- ANTIGAS de tres policies (waitlist_public_insert, leads_public_insert e
-- survey_responses_public_insert). Elas ficam para preservar o historico de
-- quem monta um banco do zero, mas sao REDEFINIDAS no bloco final — que e o que
-- vale, porque a ultima definicao vence.
--
-- Nunca recorte um pedaco deste arquivo: rodar so o miolo REVERTE as correcoes.
-- ============================================================================

-- ---------- 20260704000000_add_product_origin.sql ----------
-- Add the departure city (origin) to products so the package search filter
-- can offer an "Origem" (cidade de saída) dropdown populated by the admin.
-- Idempotent: safe to run on an existing database.

alter table public.products
  add column if not exists origin text;

create index if not exists products_origin_idx on public.products(origin);

-- ---------- 20260705000000_add_pages.sql ----------
-- Custom pages CMS: admin-authored pages rendered at /paginas/<slug>.
-- Idempotent: safe to run on an existing database.

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

alter table public.pages enable row level security;

drop policy if exists "pages_public_read" on public.pages;
create policy "pages_public_read" on public.pages
for select to anon, authenticated
using (status = 'published');

drop policy if exists "pages_admin_all" on public.pages;
create policy "pages_admin_all" on public.pages
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Starter legal pages so the footer links resolve. Edit the content in /admin/pages.
insert into public.pages (title, slug, content, status, seo_title, seo_description)
values
  ('Termos e Condições', 'termos', 'Conteúdo em edição.', 'published', 'Termos e Condições | RW Turismo', 'Termos e condições de uso da RW Turismo.'),
  ('Política de Privacidade', 'privacidade', 'Conteúdo em edição.', 'published', 'Política de Privacidade | RW Turismo', 'Política de privacidade da RW Turismo.')
on conflict (slug) do nothing;

-- ---------- 20260706000000_add_page_blocks.sql ----------
-- Structured content blocks for pages (text, image, gallery, banner, cta).
-- Idempotent: safe to run on an existing database (requires the pages table).

alter table public.pages
  add column if not exists blocks jsonb not null default '[]'::jsonb;

-- ---------- 20260709000000_fase1_operacao.sql ----------
-- Fase 1 (operação): perfil do cliente enriquecido, check-in de passageiros,
-- fornecedores e lista de espera. Idempotente: seguro rodar em banco existente.

-- Cliente: nascimento (aniversariantes) e documento.
alter table public.users_profiles
  add column if not exists birth_date date,
  add column if not exists document text;

-- Check-in de embarque por passageiro.
alter table public.passengers
  add column if not exists checked_in_at timestamptz;

-- Fornecedores (hotéis, transporte, guias...) — usados por transfers e despesas.
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
  constraint suppliers_category_check check (
    category in ('hotel', 'transporte', 'guia', 'restaurante', 'passeio', 'outro')
  )
);

create index if not exists suppliers_active_idx on public.suppliers(active);
create index if not exists suppliers_category_idx on public.suppliers(category);

drop trigger if exists set_suppliers_updated_at on public.suppliers;
create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_admin_all" on public.suppliers;
create policy "suppliers_admin_all" on public.suppliers
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Lista de espera: interessados quando a saída está lotada.
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

alter table public.waitlist enable row level security;

-- Qualquer visitante pode entrar na fila (como a newsletter); só admin lê/gerencia.
drop policy if exists "waitlist_public_insert" on public.waitlist;
create policy "waitlist_public_insert" on public.waitlist
for insert to anon, authenticated
with check (status = 'pending');

drop policy if exists "waitlist_select_own_or_admin" on public.waitlist;
create policy "waitlist_select_own_or_admin" on public.waitlist
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "waitlist_admin_update" on public.waitlist;
create policy "waitlist_admin_update" on public.waitlist
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "waitlist_admin_delete" on public.waitlist;
create policy "waitlist_admin_delete" on public.waitlist
for delete to authenticated
using (public.is_admin());

-- ---------- 20260709010000_fase2_logistica.sql ----------
-- Fase 2 (logística da saída): assentos, quartos (rooming) e transfers.
-- Idempotente: seguro rodar em banco existente. Requer a migration da Fase 1.

-- Assento e quarto por passageiro.
alter table public.passengers
  add column if not exists seat_number text,
  add column if not exists room_label text;

-- Total de assentos do veículo da saída (para o mapa de assentos).
alter table public.product_dates
  add column if not exists total_seats integer;

alter table public.product_dates
  drop constraint if exists product_dates_total_seats_positive_check;
alter table public.product_dates
  add constraint product_dates_total_seats_positive_check
  check (total_seats is null or total_seats > 0);

-- Transfers da saída (traslados): motorista, horário e ponto de encontro.
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

alter table public.transfers enable row level security;

drop policy if exists "transfers_admin_all" on public.transfers;
create policy "transfers_admin_all" on public.transfers
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- ---------- 20260709020000_fase4_crm.sql ----------
-- Fase 4 (CRM): leads com pipeline kanban, histórico de contato e UTM.
-- Idempotente: seguro rodar em banco existente. Requer a migration da Fase 1.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  interest text,
  source text not null default 'manual',
  utm jsonb not null default '{}'::jsonb,
  stage_id text not null default 'new',
  -- bigint, e nao integer: recebe Date.now() em milissegundos (~1,787 trilhao),
  -- que estoura o teto do integer e faz o Postgres recusar o insert inteiro.
  position bigint not null default 0,
  waitlist_id uuid references public.waitlist(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_utm_object_check check (jsonb_typeof(utm) = 'object')
);

create index if not exists leads_stage_idx on public.leads(stage_id, position);
create index if not exists leads_created_idx on public.leads(created_at desc);
create index if not exists leads_waitlist_idx on public.leads(waitlist_id);

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

drop policy if exists "leads_admin_all" on public.leads;
create policy "leads_admin_all" on public.leads
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Histórico de contato/anotações do lead.
create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx on public.lead_activities(lead_id, created_at desc);

alter table public.lead_activities enable row level security;

drop policy if exists "lead_activities_admin_all" on public.lead_activities;
create policy "lead_activities_admin_all" on public.lead_activities
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- UTM de origem também na lista de espera (anúncio → lead).
alter table public.waitlist
  add column if not exists utm jsonb not null default '{}'::jsonb;

-- Etapas padrão do pipeline (editáveis no admin; não sobrescreve se já existir).
insert into public.site_settings (setting_key, value)
values (
  'crm_stages',
  '{"stages":[{"id":"new","label":"Novo lead"},{"id":"talking","label":"Em conversa"},{"id":"proposal","label":"Proposta enviada"},{"id":"won","label":"Ganhou"},{"id":"lost","label":"Perdeu"}]}'::jsonb
)
on conflict (setting_key) do nothing;

-- ---------- 20260709030000_fase0_integracoes.sql ----------
-- Fase 0/3 (integrações + notificações): chaves de integração coladas no
-- painel admin e log de notificações enviadas. Idempotente.

-- Segredos de integração (UAZAPI, Resend, Stripe). NUNCA em site_settings
-- (que tem leitura pública) — esta tabela é admin-only.
create table if not exists public.integration_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_integration_secrets_updated_at on public.integration_secrets;
create trigger set_integration_secrets_updated_at
before update on public.integration_secrets
for each row execute function public.set_updated_at();

alter table public.integration_secrets enable row level security;

drop policy if exists "integration_secrets_admin_all" on public.integration_secrets;
create policy "integration_secrets_admin_all" on public.integration_secrets
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Log de notificações (WhatsApp/e-mail): auditoria + idempotência dos crons.
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

alter table public.notification_log enable row level security;

drop policy if exists "notification_log_admin_read" on public.notification_log;
create policy "notification_log_admin_read" on public.notification_log
for select to authenticated
using (public.is_admin());

-- ---------- 20260709040000_fase5_financeiro.sql ----------
-- Fase 5 (financeiro): despesas de viagem e contas a receber.
-- Idempotente. Requer as migrations das Fases 1/2 (suppliers, product_dates).

-- Despesas (por saída ou gerais), com fornecedor e status de pagamento.
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

alter table public.expenses enable row level security;

drop policy if exists "expenses_admin_all" on public.expenses;
create policy "expenses_admin_all" on public.expenses
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Contas a receber (vendas manuais, parcelas combinadas fora do site).
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

alter table public.receivables enable row level security;

drop policy if exists "receivables_admin_all" on public.receivables;
create policy "receivables_admin_all" on public.receivables
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- ---------- 20260710000000_expiracao_automatica_e_datas_passadas.sql ----------
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

-- ---------- 20260710010000_semana3_form_leads_e_pesquisa.sql ----------
-- Semana 3: bloco de formulário nas páginas (lead público) + pesquisa de
-- satisfação pós-viagem. Idempotente. Requer a migration da Fase 4 (leads).

-- Visitantes podem virar lead pelo formulário do site (o restante da tabela
-- segue admin-only). O insert público é restrito à origem site_form e à
-- etapa inicial.
drop policy if exists "leads_public_insert" on public.leads;
create policy "leads_public_insert" on public.leads
for insert to anon, authenticated
with check (source = 'site_form' and stage_id = 'new');

-- Pesquisa de satisfação: uma resposta por reserva, nota 0-10 (NPS).
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  rating integer not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint survey_responses_rating_check check (rating >= 0 and rating <= 10),
  constraint survey_responses_booking_key unique (booking_id)
);

create index if not exists survey_responses_created_idx on public.survey_responses(created_at desc);

alter table public.survey_responses enable row level security;

-- O link da pesquisa vai por WhatsApp/e-mail com o id da reserva (UUID não
-- adivinhável). Inserção pública; leitura só admin.
drop policy if exists "survey_responses_public_insert" on public.survey_responses;
create policy "survey_responses_public_insert" on public.survey_responses
for insert to anon, authenticated
with check (rating >= 0 and rating <= 10);

drop policy if exists "survey_responses_admin_read" on public.survey_responses;
create policy "survey_responses_admin_read" on public.survey_responses
for select to authenticated
using (public.is_admin());

-- ---------- 20260710020000_paginas_html.sql ----------
-- Modo HTML nas páginas: o admin cola um HTML completo e a página publica
-- exatamente esse HTML (com ou sem o menu/rodapé do site). Idempotente.

alter table public.pages
  add column if not exists custom_html text,
  add column if not exists custom_html_chrome boolean not null default false;

-- ---------- 20260715000000_pagina_aparencia.sql ----------
-- Aparência por página: escolher o topo (menu do site / simples / nenhum) e
-- mostrar/ocultar o rodapé. Idempotente.

alter table public.pages
  add column if not exists header_style text not null default 'simple',
  add column if not exists show_footer boolean not null default true;

alter table public.pages
  drop constraint if exists pages_header_style_check;
alter table public.pages
  add constraint pages_header_style_check
  check (header_style in ('site', 'simple', 'none'));



-- ============================================================================
-- MIGRATIONS DE PRODUTO (20260719 a 20260902)
--
-- Vem ANTES do bloco da auditoria de proposito: a auditoria redefine policies
-- que estes arquivos criam, e quem vale e a ultima definicao.
-- ============================================================================

-- ---------- 20260719000000_fase1_reservas_manuais.sql ----------
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

-- ---------- 20260719010000_fase2_produto_itinerario_faq.sql ----------
-- Fase 2 — Itinerário e FAQ por produto (itens 2.2 e 2.3 do PLANO)
-- Adiciona products.itinerary e products.faq como jsonb array (mesmo padrão de
-- products.gallery). Rodar no SQL Editor do Supabase. Idempotente.

alter table public.products
  add column if not exists itinerary jsonb not null default '[]'::jsonb;
alter table public.products
  drop constraint if exists products_itinerary_array_check;
alter table public.products
  add constraint products_itinerary_array_check
  check (jsonb_typeof(itinerary) = 'array');

alter table public.products
  add column if not exists faq jsonb not null default '[]'::jsonb;
alter table public.products
  drop constraint if exists products_faq_array_check;
alter table public.products
  add constraint products_faq_array_check
  check (jsonb_typeof(faq) = 'array');

-- ---------- 20260719020000_fase2_depoimentos_nps.sql ----------
-- Fase 2.4 — Depoimentos via NPS (item 2.4 do PLANO)
-- Marca respostas de pesquisa aprovadas para exibição no site + nome público
-- opcional. Rodar no SQL Editor do Supabase. Idempotente.

alter table public.survey_responses
  add column if not exists approved boolean not null default false;
alter table public.survey_responses
  add column if not exists display_name text;
create index if not exists survey_responses_approved_idx
  on public.survey_responses(approved);

-- Admin pode aprovar/editar (a leitura já é coberta por survey_responses_admin_read).
drop policy if exists "survey_responses_admin_update" on public.survey_responses;
create policy "survey_responses_admin_update" on public.survey_responses
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- 20260719030000_fase2_cupons.sql ----------
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

-- ---------- 20260719040000_fase5_soft_delete.sql ----------
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

-- ---------- 20260719050000_horario_e_tiers.sql ----------
-- Fase catálogo real — horário de saída/retorno nas datas + tiers de suíte.
-- Rodar no SQL Editor do Supabase. Idempotente. Não mexe em RLS nem em RPC.

-- Horário de saída/retorno (opcional) por data de saída.
alter table public.product_dates add column if not exists departure_time time;
alter table public.product_dates add column if not exists return_time time;

-- Tiers de suíte (informativo): [{ "name": "Master", "price": 580 }, ...].
alter table public.products add column if not exists tiers jsonb not null default '[]'::jsonb;
alter table public.products drop constraint if exists products_tiers_array_check;
alter table public.products add constraint products_tiers_array_check check (jsonb_typeof(tiers) = 'array');

-- ---------- 20260730000000_usuarios_do_sistema.sql ----------
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

-- ---------- 20260803000000_checkout_fase1.sql ----------
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

-- ---------- 20260803010000_acomodacao_vendavel.sql ----------
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

-- ---------- 20260803020000_tarifa_infantil.sql ----------
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

-- ---------- 20260803040000_acesso_reserva_convidado.sql ----------
-- Acesso à reserva sem sessão (compra sem cadastro). Rodar no SQL Editor.
--
-- A compra sem cadastro cria a conta do cliente nos bastidores, mas o navegador
-- dele NÃO fica logado. Como /account/bookings/[id] exige sessão, o convidado
-- criava a reserva e batia num muro de login antes de pagar — a vaga ficava
-- retida por 30 minutos e a venda morria ali.
--
-- A saída é um token de acesso por reserva: um segredo aleatório que vai na URL
-- de retorno e vale só para AQUELA reserva. Não é sessão, não dá acesso a mais
-- nada e não afrouxa nenhuma policy.
--
-- POR QUE NÃO LOGAR O CONVIDADO AUTOMATICAMENTE: seria abrir sessão a partir de
-- um e-mail digitado. Quem soubesse o e-mail de outra pessoa entraria na conta
-- dela. O token resolve o acesso à reserva sem tocar em autenticação.
--
-- POR QUE NÃO CONFIAR SÓ NO id DA RESERVA: o uuid já é difícil de adivinhar,
-- mas ele aparece em log de servidor, histórico de navegador e link
-- compartilhado. Um segredo separado pode ser trocado sem trocar a reserva.

alter table public.bookings
  add column if not exists access_token text;

-- Índice único parcial: reservas antigas ficam com token nulo e não brigam
-- entre si pela unicidade.
create unique index if not exists bookings_access_token_key
  on public.bookings(access_token)
  where access_token is not null;

-- Gerado por trigger, e não dentro da RPC de reserva, de propósito: assim vale
-- também para reserva manual criada pelo admin, e a RPC (que já é longa) não
-- precisa ser reescrita de novo só por causa disto.
create or replace function public.set_booking_access_token()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.access_token is null then
    -- 24 bytes = 48 caracteres hex. Aleatoriedade criptográfica do pgcrypto.
    new.access_token := encode(gen_random_bytes(24), 'hex');
  end if;
  return new;
end;
$$;

drop trigger if exists set_bookings_access_token on public.bookings;
create trigger set_bookings_access_token
before insert on public.bookings
for each row execute function public.set_booking_access_token();

-- Preenche o que já existe, para reservas antigas também poderem receber link.
update public.bookings
set access_token = encode(gen_random_bytes(24), 'hex')
where access_token is null;

comment on column public.bookings.access_token is
  'Segredo por reserva usado no link de acesso do convidado (?t=). Nunca é exposto em listagem: só volta para quem acabou de criar a reserva.';

-- ---------- 20260803050000_documentos_passageiro.sql ----------
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

-- ---------- 20260810000000_pagamento_assincrono.sql ----------
-- Pagamento assíncrono (Pix) + tapa-buracos do documento obrigatório.
-- Rodar no SQL Editor. Idempotente.
--
-- POR QUE ESTA MIGRATION EXISTE, EM UMA FRASE:
-- hoje o sistema confirma a reserva quando a Stripe avisa que a SESSÃO foi
-- concluída. Com cartão isso equivale a "o dinheiro entrou". Com Pix, não:
-- a sessão conclui no instante em que o cliente recebe o QR Code, com o
-- pagamento ainda por acontecer. Ligar o Pix sem o estado intermediário abaixo
-- faria o sistema confirmar reserva não paga e queimar o cupom.

-- =====================================================================
-- 1) Estado intermediário: dinheiro prometido, ainda não recebido
-- =====================================================================
alter table public.bookings
  drop constraint if exists bookings_payment_status_check;
alter table public.bookings
  add constraint bookings_payment_status_check
  check (payment_status in (
    'pending',         -- ninguém iniciou pagamento
    'processing',      -- Pix emitido, aguardando a transferência cair
    'paid',
    'failed',
    'refunded',
    'cancelled',
    'requires_review'
  ));

alter table public.payments
  drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check
  check (status in (
    'pending',
    'processing',
    'paid',
    'failed',
    'refunded',
    'cancelled',
    'requires_review'
  ));

-- =====================================================================
-- 2) Idempotência do webhook por evento, e não só por estado
-- =====================================================================
-- A proteção que existe hoje é "a reserva já está confirmada, ignora". Ela
-- cobre reentrega em sequência e NÃO cobre entrega concorrente: dois processos
-- podem ler o estado antigo ao mesmo tempo e os dois seguirem em frente. Isso
-- importa porque increment_coupon_usage é um `used_count + 1` cego — contaria
-- duas vezes. Com o Pix passam a existir dois tipos de evento distintos
-- escrevendo confirmação no mesmo caminho, então a janela dobra.
create table if not exists public.stripe_events (
  event_id text primary key,
  event_type text,
  received_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;

-- Sem policy nenhuma de propósito: só o service_role (que ignora RLS) escreve
-- aqui. É tabela de controle interno, não tem dono nem leitor no site.

create index if not exists stripe_events_received_idx
  on public.stripe_events(received_at desc);

comment on table public.stripe_events is
  'Eventos da Stripe já processados. O webhook reserva o event_id antes de agir e devolve a reserva se falhar, para a reentrega da Stripe conseguir tentar de novo.';

-- =====================================================================
-- 3) Expiração precisa enxergar o estado intermediário
-- =====================================================================
-- Sessão de checkout só expira enquanto está `open`. No instante em que o QR do
-- Pix é emitido ela vira `complete` e NUNCA mais dispara
-- checkout.session.expired. Ou seja: sem isto, um Pix que ninguém paga segura a
-- vaga para sempre — nem o cron nem a página conseguiriam liberar.
-- expire_pending_booking e recriada na secao 8 deste arquivo, junto das
-- irmas release_expired_holds_for_date e expire_overdue_pending_bookings.

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
      and payment_status in ('pending', 'processing')
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

-- =====================================================================
-- 4) Cast de inteiro que não explode
-- =====================================================================
-- fare_rules é jsonb livre. Um valor digitado errado faria o cast lançar
-- exceção dentro de um trigger e derrubar o insert do passageiro inteiro.
create or replace function public.safe_integer(p_value text)
returns integer
language plpgsql
immutable
as $$
begin
  return p_value::integer;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.safe_integer(text) from public;
grant execute on function public.safe_integer(text) to authenticated;
grant execute on function public.safe_integer(text) to service_role;

-- =====================================================================
-- 5) A exigência de documento passa a valer para TODA origem de reserva
-- =====================================================================
-- Hoje quem calcula o document_status é a RPC da compra online. A venda manual
-- (adminCreateBooking insere passageiros direto pela tabela) não passa por ela,
-- então nasce sempre 'not_required' — a regra do pacote simplesmente não valia
-- para venda por WhatsApp/telefone.
--
-- O lugar certo da regra é o banco, não cada chamador: assim qualquer caminho
-- novo herda a exigência em vez de precisar lembrar dela.
create or replace function public.passengers_set_document_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_departure date;
  v_max_age integer;
begin
  -- Só preenche o que veio no padrão. Quem decidiu explicitamente (a RPC da
  -- compra online) manda — e calcula pela mesma função, então o resultado é o
  -- mesmo de qualquer jeito.
  if new.document_status is distinct from 'not_required' then
    return new;
  end if;

  select d.start_date,
         public.safe_integer(p.fare_rules->>'document_required_max_age')
    into v_departure, v_max_age
  from public.bookings b
  join public.product_dates d on d.id = b.product_date_id
  join public.products p on p.id = b.product_id
  where b.id = new.booking_id;

  if v_departure is null or v_max_age is null then
    return new;
  end if;

  new.document_status := public.initial_document_status(
    new.birth_date,
    v_departure,
    v_max_age
  );

  return new;
end;
$$;

drop trigger if exists passengers_set_document_status_trg on public.passengers;
create trigger passengers_set_document_status_trg
before insert on public.passengers
for each row execute function public.passengers_set_document_status();

-- =====================================================================
-- 6) O cliente não escreve o próprio status de documento
-- =====================================================================
-- A policy passengers_update_own_pending_booking deixa o dono da reserva editar
-- os passageiros enquanto ela está pendente. RLS é por LINHA, não por COLUNA:
-- o mesmo UPDATE que corrige um nome poderia escrever
-- document_status = 'verified' pela chave anônima e passar por cima do portão
-- do pagamento — sem enviar arquivo nenhum.
--
-- Erro alto em vez de ignorar em silêncio: se algum dia o papel privilegiado
-- mudar de nome, eu prefiro uma tela que falha visivelmente a uma que finge que
-- salvou.
-- A funcao e o trigger sao criados na secao 9 deste arquivo, que cobre INSERT
-- alem de UPDATE. Ver o porque la.

-- =====================================================================
-- 7) Compra online sem passageiro deixa de ser possível
-- =====================================================================
-- Sem esta trava, omitir o campo `passengers` na chamada da API criava uma
-- reserva com zero passageiros: a exigência de documento não existia (não há
-- linha para exigir), e Quartos, Assentos, Check-in e o voucher mostravam a
-- saída como se ninguém fosse viajar.
--
-- A contagem é dos nomes PREENCHIDOS, não do tamanho do array: mandar três
-- nomes em branco passava pela checagem antiga e inseria zero linhas.
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
  v_named_passengers integer;
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

  if p_passengers is null or jsonb_typeof(p_passengers) <> 'array' then
    raise exception 'PASSENGERS_REQUIRED' using errcode = 'P0001';
  end if;

  select count(*)
    into v_named_passengers
  from jsonb_array_elements(p_passengers) as item
  where length(trim(coalesce(item->>'full_name', ''))) > 0;

  if v_named_passengers <> p_travelers_count then
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

  v_infant_max := coalesce(public.safe_integer(v_product.fare_rules->>'infant_max_age'), 1);
  v_child_max := coalesce(public.safe_integer(v_product.fare_rules->>'child_max_age'), 11);
  v_document_max_age := public.safe_integer(v_product.fare_rules->>'document_required_max_age');

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

  return query select v_booking_id, v_total_amount, v_expires_at;
end;
$$;

revoke all on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer, text, text, jsonb) from public;
grant execute on function public.create_pending_booking_transaction(uuid, uuid, uuid, text, text, text, integer, text, text, jsonb) to service_role;

-- =====================================================================
-- 8) A varredura precisa enxergar o Pix — e não pode destruir reserva paga
-- =====================================================================
-- release_expired_holds_for_date é a cura sob demanda: quando alguém tenta
-- comprar uma saída "esgotada", ela devolve na hora as vagas de holds vencidos.
-- Ficou cega para 'processing' quando o estado novo entrou, e sem isso um Pix
-- não pago segurava a vaga até a varredura da madrugada.
--
-- Trio que precisa andar junto — mexeu num, confira os outros dois:
--   release_expired_holds_for_date (esta), expire_pending_booking,
--   expire_overdue_pending_bookings.
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
    update public.bookings b
    set status = 'expired',
        -- Pix vencido vira 'requires_review', e não 'cancelled': o sistema
        -- ADMITE não saber se o dinheiro entrou (o aviso da Stripe pode estar
        -- atrasado ou o evento pode não estar assinado). A vaga volta para o
        -- estoque, que é o interesse do negócio, mas o caso fica visível para
        -- alguém conferir em vez de virar um abandono indistinguível.
        payment_status = case
          when b.payment_status = 'processing' then 'requires_review'
          else 'cancelled'
        end,
        cancelled_at = coalesce(b.cancelled_at, now()),
        slots_released = true
    where b.product_date_id = p_product_date_id
      and b.status = 'pending'
      and b.payment_status in ('pending', 'processing')
      and b.expires_at is not null
      and b.expires_at < now()
      and b.slots_released = false
      -- Nunca mexer em reserva com pagamento confirmado, mesmo que o estado da
      -- reserva não tenha acompanhado. É a última rede antes do pior desfecho
      -- possível: cliente pagou e ficou sem lugar.
      and not exists (
        select 1 from public.payments p
        where p.booking_id = b.id and p.status = 'paid'
      )
    returning b.travelers_count
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

-- Mesma regra na expiração de uma reserva específica.
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
  v_final_payment_status text;
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

  -- 'processing' entra junto de 'pending': é reserva cujo dinheiro nunca
  -- chegou. O que NÃO pode ser expirado é reserva paga.
  if v_booking.status <> 'pending'
     or v_booking.payment_status not in ('pending', 'processing') then
    return query select v_booking.id, false, v_booking.slots_released;
    return;
  end if;

  -- Rede final: existe pagamento confirmado nesta reserva? Então o estado da
  -- reserva é que está atrasado, não o contrário. Não expira.
  if exists (
    select 1 from public.payments p
    where p.booking_id = v_booking.id and p.status = 'paid'
  ) then
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

  -- Pix vencido: 'requires_review' em vez de 'cancelled'. Ver o comentário em
  -- release_expired_holds_for_date.
  v_final_payment_status := case
    when v_booking.payment_status = 'processing' then 'requires_review'
    else 'cancelled'
  end;

  update public.bookings
  set status = 'expired',
      payment_status = v_final_payment_status,
      slots_released = v_slots_released
  where id = v_booking.id;

  -- Sem isto a linha de pagamento fica em 'processing' para sempre, e o painel
  -- financeiro mostra "Aguardando Pix" pendurado numa reserva Expirada.
  update public.payments p
  set status = case
        when v_final_payment_status = 'requires_review' then 'requires_review'
        else 'cancelled'
      end
  where p.booking_id = v_booking.id
    and p.status in ('pending', 'processing');

  return query select v_booking.id, true, v_slots_released;
end;
$$;

revoke all on function public.expire_pending_booking(uuid) from public;
grant execute on function public.expire_pending_booking(uuid) to service_role;

-- =====================================================================
-- 9) A trava das colunas de documento vale no INSERT também
-- =====================================================================
-- A policy passengers_insert_own_pending_booking deixa o dono da reserva
-- inserir passageiros, e RLS não recorta coluna: sem isto, bastava inserir o
-- passageiro já com document_status = 'verified' pela chave anônima para
-- atravessar o portão do pagamento sem enviar arquivo nenhum. O trigger de
-- UPDATE não pegava porque a linha já nascia mentindo.
create or replace function public.passengers_protect_document_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Quem insere de fora nunca decide nada de documento: a exigência é
    -- calculada pelo trigger passengers_set_document_status, e o arquivo só
    -- entra pela rota que confere posse e emite URL assinada.
    if new.document_path is not null
       or new.document_uploaded_at is not null
       or new.document_verified_at is not null
       or new.document_status is distinct from 'not_required' then
      raise exception 'DOCUMENT_FIELDS_ARE_SERVER_ONLY' using errcode = 'P0001';
    end if;

    return new;
  end if;

  if new.document_path is distinct from old.document_path
     or new.document_status is distinct from old.document_status
     or new.document_uploaded_at is distinct from old.document_uploaded_at
     or new.document_verified_at is distinct from old.document_verified_at then
    raise exception 'DOCUMENT_FIELDS_ARE_SERVER_ONLY' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists passengers_protect_document_columns_trg on public.passengers;
create trigger passengers_protect_document_columns_trg
before insert or update on public.passengers
for each row execute function public.passengers_protect_document_columns();

-- Ordem alfabética decide qual BEFORE trigger roda primeiro: "passengers_p…"
-- antes de "passengers_s…". A trava recusa o insert malicioso, e só depois o
-- cálculo do status preenche a exigência de verdade.

-- =====================================================================
-- 10) Marca de evento processado
-- =====================================================================
-- Sem isto a trava só sabia dizer "alguém pegou este evento", nunca "alguém
-- terminou". Um processo morto no meio (timeout da Vercel, deploy, falta de
-- memória) deixava o evento marcado para sempre, e a reentrega da Stripe — que
-- é o conserto automático — era descartada como repetida. Com Pix isso vira
-- "cliente pagou e ficou sem reserva".
alter table public.stripe_events
  add column if not exists processed_at timestamptz;

create index if not exists stripe_events_unprocessed_idx
  on public.stripe_events(received_at)
  where processed_at is null;

-- =====================================================================
-- 11) Confirmacao manual nao pode atropelar um Pix em aberto
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

  -- Pix emitido = cobranca viva na Stripe. Marcar "pago" no painel agora cria
  -- duas cobrancas validas para a mesma reserva: a do painel e a que o cliente
  -- ainda pode pagar pelo codigo. Se ele pagou por fora, o caminho e esperar o
  -- codigo vencer ou cancelar a cobranca na Stripe.
  --
  -- 'requires_review' NAO entra aqui de proposito: e exatamente o estado em que
  -- alguem precisa entrar e resolver na mao.
  if v_booking.payment_status = 'processing' then
    raise exception 'STRIPE_PAYMENT_PENDING' using errcode = 'P0001';
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

-- ---------- 20260828000000_leads_position_bigint.sql ----------
-- leads.position precisa caber um timestamp em milissegundos.
-- Rodar no SQL Editor. Idempotente.
--
-- POR QUE ESTA MIGRATION EXISTE, EM UMA FRASE:
-- todo caminho que cria lead grava `position: Date.now()`, e a coluna e
-- `integer` — o valor nao cabe, o Postgres recusa a linha inteira, e o lead
-- some sem deixar rastro na tela.
--
-- A CONTA:
--   Date.now()            ~ 1.787.930.007.235
--   teto de integer (int4)~     2.147.483.647
--   excede em                        ~833 vezes
-- O Postgres devolve 22003 (numeric value out of range) e DESCARTA o insert.
-- Nao e erro parcial: nenhuma linha entra.
--
-- QUEM ESTAVA QUEBRADO (os quatro caminhos que inserem lead):
--   src/lib/leads/client.ts:31   formulario publico do site — o bloco de
--                                formulario das paginas, o NewsletterSignup e
--                                agora o quiz de captacao
--   src/lib/admin/crm.ts:129     lead criado a mao no painel
--   src/lib/admin/crm.ts:267     importacao da lista de espera para o CRM
--
-- POR QUE MEXER NA COLUNA E NAO NOS CHAMADORES:
-- consertar so um dos lados criaria uma ordenacao mentirosa. `position` e o
-- que ordena o kanban; se o formulario do site passasse a gravar segundos
-- (~1,7 bilhao) e o painel continuasse gravando milissegundos (~1,7 trilhao),
-- todo lead criado no painel apareceria eternamente depois de todo lead vindo
-- do site, sem ninguem ter arrastado nada. Um milissegundo em bigint mantem os
-- quatro caminhos na mesma escala e nao pede mudanca de codigo nenhuma.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'position'
      and data_type = 'integer'
  ) then
    alter table public.leads
      alter column position type bigint;

    raise notice 'leads.position convertida de integer para bigint';
  else
    raise notice 'leads.position ja e bigint, nada a fazer';
  end if;
end
$$;

-- O default continua 0 e o not null continua valendo: a conversao de tipo nao
-- mexe em nenhum dos dois, e nao existe linha para reescrever quando a tabela
-- so tem leads criados por caminhos que ja cabiam.

comment on column public.leads.position is
  'Ordem do lead dentro da etapa do kanban. Recebe Date.now() em milissegundos, por isso bigint: em integer o valor estourava e o insert era recusado inteiro.';

-- O indice leads_stage_idx(stage_id, position) e reconstruido sozinho pelo
-- ALTER TYPE. Nao precisa recriar na mao.

-- ---------- 20260829000000_infinitepay.sql ----------
-- InfinitePay como segundo meio de pagamento, ao lado da Stripe.
-- Rodar no SQL Editor. Idempotente. Aditiva: nada muda de comportamento.
--
-- POR QUE UM SEGUNDO PROVEDOR:
-- a Stripe nao entrega, no Brasil, parcelamento oferecido pelo lojista, e o Pix
-- dela e liberado so por convite. A InfinitePay tem Pix direto e ate 12x. O
-- site JA promete "10x de R$ 51,21" na pagina do quiz — promessa que hoje o
-- checkout nao cumpre.
--
-- O QUE MUDA NO MODELO DE CONFIANCA (e o ponto mais importante deste arquivo):
-- o webhook da InfinitePay NAO TEM ASSINATURA. Nem HMAC, nem header de origem,
-- nem segredo compartilhado. O corpo que chega e um JSON anonimo que qualquer
-- pessoa na internet pode postar — e o order_nsu viaja na URL de retorno, entao
-- o proprio cliente conhece o identificador do pedido dele.
--
-- Com a Stripe, `stripe.webhooks.constructEvent` prova a origem. Aqui nao ha
-- equivalente. A prova passa a ser uma chamada que o NOSSO servidor faz:
-- POST /payment_check. O webhook vira apenas um gatilho — "va conferir o
-- pedido X". Nada do corpo recebido decide dinheiro.
--
-- As colunas abaixo existem para sustentar esse desenho: guardar, no momento em
-- que criamos a cobranca, o identificador da fatura, para recusar depois
-- qualquer webhook que aponte para outra.

-- =====================================================================
-- 1) O provedor novo
-- =====================================================================
-- A constraint aparece em DOIS lugares no schema.sql: dentro do CREATE TABLE
-- (no-op em banco que ja existe) e num drop+add mais adiante, que e o valor
-- efetivo hoje. Os dois precisam ficar iguais, senao banco novo e producao
-- divergem.
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check
  check (provider in ('stripe', 'manual', 'infinitepay'));

-- Tira o default silencioso. Hoje um INSERT que esquecesse o campo gravaria
-- 'stripe' numa venda InfinitePay, e o painel mentiria sem ninguem perceber.
-- Com dois provedores, "esqueci de dizer qual" precisa falhar, nao adivinhar.
alter table public.payments alter column provider drop default;

-- capture_method da InfinitePay e 'credit_card' ou 'pix'. 'pix' ja existe;
-- faltava o cartao.
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in (
    'stripe', 'pix', 'boleto', 'dinheiro', 'transferencia', 'cartao', 'outro'
  ));

-- =====================================================================
-- 2) Correlacao com a InfinitePay
-- =====================================================================
-- Colunas proprias, e nao reaproveitamento das colunas da Stripe. Reaproveitar
-- funcionaria tecnicamente e envenenaria a operacao: o painel exibe esses
-- campos com rotulo de Stripe, e o atendente leria um transaction_nsu como se
-- fosse um payment_intent.
alter table public.payments
  add column if not exists infinitepay_invoice_slug text,
  add column if not exists infinitepay_transaction_nsu text,
  add column if not exists checkout_url text,
  add column if not exists receipt_url text;

comment on column public.payments.infinitepay_invoice_slug is
  'Identificador da fatura, gravado na CRIACAO do link. E a amarra contra replay: um webhook que aponte para outra fatura e recusado, mesmo trazendo transaction_nsu de um pagamento real.';
comment on column public.payments.infinitepay_transaction_nsu is
  'Identificador da transacao. Serve de chave de idempotencia — a InfinitePay nao manda id de evento, e order_nsu NAO serve porque e o mesmo nas duas cobrancas de um pagamento em dobro.';

-- Unicos parciais: a mesma transacao nunca pode ser contada em dois pagamentos.
create unique index if not exists payments_infinitepay_slug_key
  on public.payments(infinitepay_invoice_slug)
  where infinitepay_invoice_slug is not null;
create unique index if not exists payments_infinitepay_tx_key
  on public.payments(infinitepay_transaction_nsu)
  where infinitepay_transaction_nsu is not null;

-- =====================================================================
-- 3) A reserva precisa saber QUAL provedor abriu o checkout vivo
-- =====================================================================
-- Sem isto, o codigo que expira a sessao anterior antes de abrir outra chamaria
-- a API da Stripe com um identificador de link da InfinitePay.
--
-- checkout_url na reserva tem um segundo papel, especifico deste provedor: na
-- InfinitePay NAO EXISTE forma de invalidar um link ja criado. Como nao da para
-- matar o anterior, a defesa possivel e nao criar um segundo — devolver o mesmo
-- link enquanto o hold estiver de pe.
alter table public.bookings
  add column if not exists payment_provider text,
  add column if not exists infinitepay_invoice_slug text,
  add column if not exists checkout_url text;

alter table public.bookings drop constraint if exists bookings_payment_provider_check;
alter table public.bookings add constraint bookings_payment_provider_check
  check (payment_provider is null or payment_provider in ('stripe', 'infinitepay'));

create unique index if not exists bookings_infinitepay_slug_key
  on public.bookings(infinitepay_invoice_slug)
  where infinitepay_invoice_slug is not null;

-- =====================================================================
-- 4) A trava de eventos serve aos dois
-- =====================================================================
-- stripe_events tem event_id como chave primaria. Trocar por chave composta
-- exigiria drop de primary key numa tabela de trava de dinheiro — risco
-- desproporcional ao ganho. A chave passa a ser prefixada:
--   Stripe:      "evt_1A2b3C..."          (o event.id, como ja e)
--   InfinitePay: "infinitepay:<transaction_nsu>"
-- Colisao fica impossivel por construcao.
--
-- O nome da tabela passa a mentir sobre o conteudo. Renomear para
-- payment_events e mudanca boa, mas nao pertence ao caminho critico desta
-- entrega — fica registrado como divida.
comment on table public.stripe_events is
  'Eventos de pagamento ja processados, dos DOIS provedores. Stripe grava o event.id; InfinitePay grava "infinitepay:<transaction_nsu>", porque a API dela nao tem id de evento. O nome da tabela e historico: ela nao e mais so da Stripe.';

-- =====================================================================
-- 5) A RPC de pagamento manual precisa aceitar 'cartao'
-- =====================================================================
-- A lista de metodos esta repetida dentro da RPC. Sem atualizar aqui, o
-- operador que escolher "cartao" no painel manual toma INVALID_METHOD — a
-- constraint da tabela aceitaria, a funcao nao.
do $$
declare
  v_fonte text;
begin
  select pg_get_functiondef(p.oid)
    into v_fonte
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_confirm_manual_payment'
  limit 1;

  if v_fonte is null then
    raise notice 'admin_confirm_manual_payment nao existe; nada a fazer';
    return;
  end if;

  if position('''transferencia'',''cartao''' in v_fonte) > 0
     or position('''transferencia'', ''cartao''' in v_fonte) > 0 then
    raise notice 'admin_confirm_manual_payment ja aceita cartao';
    return;
  end if;

  execute replace(
    v_fonte,
    '''stripe'',''pix'',''boleto'',''dinheiro'',''transferencia'',''outro''',
    '''stripe'',''pix'',''boleto'',''dinheiro'',''transferencia'',''cartao'',''outro'''
  );

  raise notice 'admin_confirm_manual_payment passou a aceitar cartao';
end
$$;

-- ---------- 20260830000000_observacao_do_passageiro.sql ----------
-- Observação por passageiro.
-- Rodar no SQL Editor. Idempotente. Aditiva: nada muda de comportamento.
--
-- POR QUE ESTA COLUNA EXISTE:
-- a lista de passageiros que a agência mantém no Word carrega, dentro do nome,
-- pedidos que a operação precisa cumprir no dia: "quer os glampings mais
-- próximos do banheiro", "poltronas 33/34 ou na quarta fileira", "pg 04/09".
--
-- Sem lugar para guardar isso, a importação tinha duas saídas ruins: deixar o
-- pedido colado no nome (e o nome do passageiro vira uma frase) ou descartar em
-- silêncio (e o pedido some entre o Word e o ônibus). A coluna resolve as duas.
--
-- É texto livre de propósito. Padronizar em campos ("assento preferido",
-- "restrição alimentar") seria inventar uma taxonomia antes de saber o que a
-- operação realmente escreve ali.

alter table public.passengers
  add column if not exists notes text;

comment on column public.passengers.notes is
  'Pedido ou aviso sobre este passageiro, para a operação ver no dia: preferência de assento, de quarto, aviso de pagamento. Texto livre. Vem preenchido da importação da lista, quando a lista traz observação entre parênteses.';

-- ---------- 20260831000000_cliente_sem_login.sql ----------
-- Cliente sem login.
-- Rodar no SQL Editor. Idempotente. Aditiva: nenhuma linha existente muda.
--
-- O ERRO DE MODELO QUE ISTO CORRIGE:
-- o sistema tratava "cliente" e "usuário" como a mesma coisa. users_profiles
-- exigia user_id, que aponta para uma conta de autenticação — então cadastrar
-- alguém obrigava a criar um login para essa pessoa, e login exige e-mail.
--
-- Só que a agência tem cliente antigo sem e-mail nenhum, e esse cliente não
-- precisa de login: ele precisa estar na agenda, com telefone, CPF e
-- aniversário, para ser encontrado e reconhecido. Login é o que uma PARTE dos
-- clientes usa, não o que define um cliente.
--
-- A alternativa seria inventar e-mail ("fulano@sememail.local"), o que enche a
-- base de endereço falso que um dia recebe disparo de marketing.
--
-- POR QUE É SEGURO: as policies de users_profiles comparam `user_id =
-- auth.uid()`. Com user_id nulo essa comparação é nula, ou seja, falsa — então
-- um contato sem login fica invisível para qualquer cliente do site e visível
-- só para a equipe (profiles_admin_all e profiles_staff_select), que é
-- exatamente o comportamento desejado. Nenhuma policy precisa mudar.
--
-- O unique de user_id continua valendo: no Postgres, várias linhas com NULL
-- convivem num índice único. O mesmo vale para o unique de email, que é o que
-- permite muitos contatos sem e-mail.
--
-- O QUE ISTO NÃO FAZ: contato sem login não pode ser dono de uma reserva.
-- bookings.user_id continua NOT NULL apontando para auth.users, porque todo o
-- RLS de reserva e pagamento é ancorado nele. Quando esse cliente comprar, aí
-- sim é hora de pedir um e-mail — que é o mesmo momento em que ele precisaria
-- receber o voucher.

alter table public.users_profiles
  alter column user_id drop not null;

comment on column public.users_profiles.user_id is
  'Conta de autenticação, quando existe. NULO para cliente que a agência cadastrou mas que nunca fez login — cliente antigo, venda no balcão, lista de parceiro. Sem conta, a pessoa não enxerga nada no site e não pode ser dona de uma reserva; ela existe para a equipe encontrar, reconhecer e entrar em contato.';

-- Índice para achar contato por documento, que passa a ser a chave prática de
-- quem não tem e-mail. Não é unique de propósito: a base legada tem CPF
-- repetido por erro de digitação (a lista de passageiros real tem um caso), e
-- um unique aqui recusaria a importação inteira por causa de uma linha.
create index if not exists users_profiles_document_idx
  on public.users_profiles(document)
  where document is not null;

create index if not exists users_profiles_phone_idx
  on public.users_profiles(phone)
  where phone is not null;

-- ---------- 20260901000000_consentimento_de_contato.sql ----------
-- Consentimento de contato e origem do cadastro.
-- Rodar no SQL Editor. Idempotente. Aditiva.
--
-- POR QUE ESTA MIGRATION EXISTE:
-- o cron diario manda mensagem de aniversario por WhatsApp e e-mail lendo
-- users_profiles inteira, filtrando so quem tem data de nascimento. Isso sempre
-- funcionou porque a tabela so tinha quem criou conta no site — ou seja, quem
-- aceitou a politica de privacidade.
--
-- A importacao de clientes quebrou essa premissa: passou a entrar gente que
-- nunca pediu nada. E filtrar por "tem login" NAO resolve, porque todo
-- importado COM e-mail ganha conta pelo mesmo caminho do checkout.
--
-- Consentimento precisa ser um dado proprio, e nao inferido de outra coisa.
-- O padrao e FALSE: quem chega por importacao nao recebe disparo nenhum ate
-- alguem marcar que pode.
alter table public.users_profiles
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists contact_origin text;

comment on column public.users_profiles.marketing_opt_in is
  'Se esta pessoa aceitou receber mensagem de marketing (aniversario, ofertas). FALSE por padrao: quem entra por importacao de planilha nunca pediu nada. Quem se cadastra no site ou compra aceita a politica de privacidade e entra como true.';
comment on column public.users_profiles.contact_origin is
  'De onde este cadastro veio: "site", "checkout", ou o texto que o operador escreveu ao importar a planilha. E o que permite responder, depois, por que aquele contato esta na base.';

-- Quem ja estava aqui antes da importacao existir chegou pelo site ou pelo
-- checkout, entao aceitou a politica. Preserva o comportamento de hoje para
-- eles e comeca do zero so para os novos.
update public.users_profiles
   set marketing_opt_in = true,
       contact_origin = coalesce(contact_origin, 'site')
 where user_id is not null
   and marketing_opt_in = false
   and contact_origin is null;

create index if not exists users_profiles_marketing_idx
  on public.users_profiles(marketing_opt_in)
  where marketing_opt_in = true;

-- ---------- 20260902000000_adotar_perfil_sem_login.sql ----------
-- Adoção de perfil sem login.
-- Rodar no SQL Editor. Idempotente.
--
-- O PROBLEMA QUE ISTO RESOLVE:
-- desde que users_profiles.user_id passou a aceitar nulo, existe uma pessoa que
-- a agência cadastrou mas que nunca fez login. Se essa pessoa depois criar
-- conta no site com o mesmo e-mail, o caminho de autenticação tenta INSERIR um
-- perfil novo — e bate no unique de e-mail. O erro chega como uma mensagem
-- genérica, e ela fica travada para fora do site PARA SEMPRE: cada tentativa
-- repete o mesmo insert e o mesmo 23505.
--
-- O que deveria acontecer é o contrário: o perfil que já existe deve ser
-- ADOTADO pela conta nova, e não duplicado.
--
-- POR QUE PRECISA SER UMA FUNÇÃO NO BANCO, E NÃO UM UPDATE DA TELA:
-- duas barreiras impedem o cliente de fazer isso sozinho, e as duas estão
-- certas onde estão.
--   1. A policy profiles_update_own_customer_fields usa
--      `using (user_id = auth.uid())`. Para um perfil órfão isso é nulo, ou
--      seja falso: ele não enxerga a própria linha para atualizar.
--   2. O trigger prevent_customer_profile_identity_changes barra troca de
--      user_id — que é exatamente o campo que precisa mudar aqui.
--
-- SEGURANÇA: a função é security definer, mas não aceita parâmetro nenhum. Ela
-- só age sobre a linha cujo e-mail é IGUAL ao e-mail do token de quem chamou, e
-- só quando aquela linha não tem dono. Não há como pedir a adoção do perfil de
-- outra pessoa: quem decide o alvo é o JWT, não o cliente.
--
-- O `role = 'customer'` no WHERE não é decoração: sem ele, um contato importado
-- com o e-mail de um funcionário permitiria que alguém assumisse um perfil de
-- equipe ao criar conta no site.

create or replace function public.adotar_perfil_sem_login()
returns public.users_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  perfil public.users_profiles;
  meu_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or meu_email = '' then
    return null;
  end if;

  update public.users_profiles
     set user_id = auth.uid()
   where email = meu_email
     and user_id is null
     and role = 'customer'
  returning * into perfil;

  return perfil;
end;
$$;

revoke all on function public.adotar_perfil_sem_login() from public;
grant execute on function public.adotar_perfil_sem_login() to authenticated;

comment on function public.adotar_perfil_sem_login() is
  'Liga a conta recem-criada ao perfil que a agencia ja tinha cadastrado com o mesmo e-mail, quando esse perfil nao tem dono. Sem isto, quem foi importado como contato e depois cria conta no site fica travado no unique de e-mail, para sempre. Nao aceita parametro: o alvo sai do e-mail do proprio token.';

-- =====================================================================
-- Reparo do que ja esta gravado
-- =====================================================================
-- Perfil orfao cujo e-mail ja tem conta: liga os dois. Sao os casos criados
-- entre a importacao de clientes e este conserto.
update public.users_profiles p
   set user_id = u.id
  from auth.users u
 where p.user_id is null
   and p.role = 'customer'
   and p.email is not null
   and lower(u.email) = p.email
   -- Nunca roubar o perfil de quem ja tem um: o unique de user_id recusaria,
   -- mas falhar a migration inteira por causa disso seria pior.
   and not exists (
     select 1 from public.users_profiles outro where outro.user_id = u.id
   );


-- ============================================================================
-- BLOCO FINAL — correções da auditoria de segurança de 2026-08-30.
-- Vem por ULTIMO de proposito: redefine as policies que aparecem acima com as
-- versoes corrigidas. Ver docs/security-audit/relatorio-auditoria-seguranca.md
-- ============================================================================

-- Correções da auditoria de segurança de 2026-08-30.
-- Rodar no SQL Editor. Idempotente. Ver docs/security-audit/relatorio-auditoria-seguranca.md
--
-- Esta migration fecha 11 achados. O fio que liga quase todos é o mesmo:
-- boa parte do /admin grava DIRETO no Supabase pelo navegador
-- (src/lib/admin/*.ts, src/lib/content/client.ts). Nesse caminho não existe
-- servidor no meio — a policy de RLS É o backend. Toda vez que a tela restringe
-- mais do que o banco, a restrição da tela não vale nada.
--
-- Duas técnicas se repetem aqui:
--   1. WITH CHECK amarrando a coluna que decide identidade ou moderação.
--   2. Trigger por COLUNA, quando o RLS não basta — porque RLS no Postgres é
--      linha inteira, não sabe filtrar coluna. O projeto já usava exatamente
--      isso em passengers_protect_document_columns(); aqui o padrão só é
--      estendido para as colunas de dinheiro, preço e HTML.


-- =====================================================================
-- A-01 (CRÍTICA) — Sequestro de reserva por plantio de e-mail
-- =====================================================================
-- O perfil do cliente é criado PELO NAVEGADOR (src/lib/auth/profile.ts:93),
-- então a policy era a única barreira. Ela amarrava user_id e role, mas deixava
-- `email` livre — e o e-mail é a chave de identidade do checkout sem cadastro
-- (src/lib/auth/customerAccount.ts:132 faz `.eq("email", email)` e devolve o
-- dono da linha encontrada).
--
-- O ataque: cria-se conta com e-mail descartável, insere-se um perfil com o
-- e-mail da VÍTIMA, e quando ela compra sem cadastro a reserva nasce em nome do
-- atacante — que passa a ler reserva, pagamentos, access_token e o documento
-- dos passageiros, inclusive de menores.
--
-- A correção amarra o e-mail ao token de quem insere. `email is null` continua
-- aceito: é o contato importado pela agência, que não tem e-mail ainda.
drop policy if exists "profiles_insert_own_customer" on public.users_profiles;
create policy "profiles_insert_own_customer"
on public.users_profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'customer'
  and (email is null or email = lower(auth.jwt() ->> 'email'))
);

-- O trigger de identidade era BEFORE UPDATE — não cobria INSERT, e era
-- exatamente por essa fresta que o perfil plantado entrava. Passa a cobrir os
-- dois comandos. Em INSERT não existe OLD, então a checagem é outra: o e-mail
-- precisa ser o do próprio token.
create or replace function public.prevent_customer_profile_identity_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role. Estas travas existem para conter a EQUIPE
  -- agindo pelo navegador; listar nomes de role aqui quebrava tanto o CI (onde o
  -- dono e "runner") quanto as RPCs internas.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Perfil sem e-mail é o contato que a agência cadastrou e que ainda não
    -- tem endereço nenhum; quem insere com e-mail tem que ser o dono dele.
    if new.email is not null
       and new.email is distinct from lower(coalesce(auth.jwt() ->> 'email', ''))
    then
      raise exception 'profile email must match the authenticated user email';
    end if;

    return new;
  end if;

  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.role is distinct from old.role
    or new.email is distinct from old.email
  then
    raise exception 'customers can update only name, phone and avatar_url';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_customer_profile_identity_changes on public.users_profiles;
create trigger prevent_customer_profile_identity_changes
before insert or update on public.users_profiles
for each row execute function public.prevent_customer_profile_identity_changes();


-- =====================================================================
-- A-07 (ALTA) — pages.custom_html executa JavaScript na origem do site
-- =====================================================================
-- custom_html é servido como HTML CRU na origem do site
-- (src/pages/paginas/[slug].tsx:153) e num iframe srcDoc — que sem `sandbox`
-- herda a origem do pai. Quem escreve a coluna executa script na origem, lê o
-- token de qualquer visitante no localStorage e, se esse visitante for admin,
-- exfiltra integration_secrets (Stripe, Resend, UAZAPI).
--
-- Escrever HTML cru na origem do site é poder de administrador, não de
-- redação. RLS não filtra coluna, então a trava é por trigger — e só dispara
-- quando o valor MUDA, para o papel `conteudo` continuar editando texto, SEO e
-- blocos de uma página que já tenha HTML.
create or replace function public.pages_protect_custom_html()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role. Estas travas existem para conter a EQUIPE
  -- agindo pelo navegador; listar nomes de role aqui quebrava tanto o CI (onde o
  -- dono e "runner") quanto as RPCs internas.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Recusar TODO insert com HTML quebrava a duplicacao de pagina: a tela
    -- copia custom_html da pagina original (src/pages/admin/pages/index.tsx),
    -- entao `conteudo` deixava de conseguir duplicar qualquer landing.
    --
    -- O que precisa ser barrado e HTML NOVO. HTML que ja existe em outra pagina
    -- ja passou por um admin uma vez, entao copiar nao aumenta o poder de
    -- ninguem — e o caminho legitimo volta a funcionar.
    if new.custom_html is not null and btrim(new.custom_html) <> ''
       and not exists (
         select 1 from public.pages p where p.custom_html = new.custom_html
       )
    then
      raise exception 'only admins can publish custom HTML';
    end if;
    return new;
  end if;

  if new.custom_html is distinct from old.custom_html
     or new.custom_html_chrome is distinct from old.custom_html_chrome
  then
    raise exception 'only admins can change custom HTML';
  end if;

  return new;
end;
$$;

drop trigger if exists pages_protect_custom_html on public.pages;
create trigger pages_protect_custom_html
before insert or update on public.pages
for each row execute function public.pages_protect_custom_html();

comment on function public.pages_protect_custom_html() is
  'Reserva a escrita de pages.custom_html ao admin. O HTML e servido cru na origem do site, entao quem escreve a coluna executa script na origem e alcanca a sessao de quem visitar — inclusive a de um admin. So dispara quando o valor muda, para o papel conteudo seguir editando o resto da pagina.';


-- =====================================================================
-- A-08 (ALTA) — operacoes marcava reserva como PAGA direto na tabela
-- =====================================================================
-- bookings_operacoes_all era `for all` sem restrição de coluna. As duas travas
-- que reservam a confirmação de dinheiro ao financeiro
-- (api/admin/bookings/[id]/confirm-payment.ts:23 e o guard interno de
-- admin_confirm_manual_payment) eram contornáveis com um PATCH direto na
-- PostgREST, pelo console do navegador.
--
-- A policy continua existindo — operacoes precisa mesmo trabalhar a reserva.
-- O que muda é que as colunas de dinheiro passam a ser protegidas por trigger.
create or replace function public.bookings_protect_financial_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role. Estas travas existem para conter a EQUIPE
  -- agindo pelo navegador; listar nomes de role aqui quebrava tanto o CI (onde o
  -- dono e "runner") quanto as RPCs internas.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
    or public.has_staff_role(array['financeiro'])
  then
    return new;
  end if;

  -- INSERT tambem, e nao so UPDATE. Sem este ramo, `operacoes` simplesmente
  -- CRIAVA a reserva ja com payment_status='paid' — mesma fraude do UPDATE,
  -- por outra porta. Reserva nasce pendente; confirmar e do financeiro.
  if tg_op = 'INSERT' then
    if new.payment_status is distinct from 'pending'
      or new.status is distinct from 'pending'
    then
      raise exception 'new bookings must start pending; only finance confirms payment';
    end if;

    return new;
  end if;

  if new.payment_status is distinct from old.payment_status
    or new.total_amount is distinct from old.total_amount
    or new.status is distinct from old.status
  then
    raise exception 'only finance can change payment status, booking status or amount';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_protect_financial_columns on public.bookings;
create trigger bookings_protect_financial_columns
before insert or update on public.bookings
for each row execute function public.bookings_protect_financial_columns();

comment on function public.bookings_protect_financial_columns() is
  'Reserva payment_status, status e total_amount ao financeiro/admin e ao service_role. A policy bookings_operacoes_all e FOR ALL, e sem esta trava o papel operacoes confirmava pagamento por um PATCH direto na PostgREST, contornando a rota de API e o guard da RPC.';


-- =====================================================================
-- A-09 (MÉDIA) — product_dates: operacoes reprecificava a saída
-- =====================================================================
-- O comentário da policy prometia "sem poder reprecificar", mas a policy não
-- restringia coluna nenhuma. Na UI o catálogo é de `conteudo`
-- (src/lib/auth/roles.ts:61). A promessa do comentário passa a ser verdade.
--
-- A coluna de preço da SAÍDA é price_override (schema.sql:70) — o preço-base
-- fica em products.price, e essa tabela já é conteudo-only. `operacoes` segue
-- ajustando available_slots, horários e active, que é a logística dele.
create or replace function public.product_dates_protect_price()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role. Estas travas existem para conter a EQUIPE
  -- agindo pelo navegador; listar nomes de role aqui quebrava tanto o CI (onde o
  -- dono e "runner") quanto as RPCs internas.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
    or public.has_staff_role(array['conteudo'])
  then
    return new;
  end if;

  if new.price_override is distinct from old.price_override then
    raise exception 'only content role can change departure prices';
  end if;

  return new;
end;
$$;

drop trigger if exists product_dates_protect_price on public.product_dates;
create trigger product_dates_protect_price
before update on public.product_dates
for each row execute function public.product_dates_protect_price();


-- =====================================================================
-- A-10 (MÉDIA) — conteudo lia a base inteira de clientes
-- =====================================================================
-- is_staff() é "qualquer papel de equipe". /admin/clients é de
-- ["admin","operacoes","financeiro"] (src/lib/auth/roles.ts:52) — `conteudo`
-- não tem a tela, mas tinha a leitura: nome, e-mail, telefone e nascimento de
-- toda a base.
drop policy if exists "profiles_staff_select" on public.users_profiles;
create policy "profiles_staff_select"
on public.users_profiles
for select
to authenticated
using (public.has_staff_role(array['admin', 'operacoes', 'financeiro']));


-- =====================================================================
-- A-11 (BAIXA) — trilha de auditoria era legível por toda a equipe
-- =====================================================================
-- /admin/logs é admin-only na UI (src/lib/auth/roles.ts:82), mas o banco
-- entregava a trilha completa a qualquer papel — inclusive os registros de
-- view_passenger_document, que dizem quem abriu documento de menor.
drop policy if exists "system_logs_staff_select" on public.system_logs;
create policy "system_logs_staff_select"
on public.system_logs
for select to authenticated
using (public.is_admin());


-- =====================================================================
-- A-02 (MÉDIA) — depoimento anônimo entrava já aprovado
-- =====================================================================
-- O WITH CHECK validava só a nota. `approved` ficava livre, e um depoimento com
-- approved = true ia direto para a home (src/lib/content/server.ts:29), sem
-- passar pela moderação que a coluna existe para impor.
drop policy if exists "survey_responses_public_insert" on public.survey_responses;
create policy "survey_responses_public_insert" on public.survey_responses
for insert to anon, authenticated
with check (rating >= 0 and rating <= 10 and approved = false);


-- =====================================================================
-- A-04 (BAIXA) — waitlist e leads: escrita anônima em nome de outro usuário
-- =====================================================================
-- Sem amarrar user_id, um anônimo gravava linha em nome de terceiro. Em
-- waitlist a vítima passava a ver na conta dela (waitlist_select_own_or_admin)
-- uma inscrição que nunca fez. Em leads ficavam livres também as colunas de
-- controle do funil.
drop policy if exists "waitlist_public_insert" on public.waitlist;
create policy "waitlist_public_insert" on public.waitlist
for insert to anon, authenticated
with check (
  status = 'pending'
  and (user_id is null or user_id = auth.uid())
);

-- As duas amarras que já existiam (source e stage_id) FICAM: sem elas, o
-- anônimo escolheria a etapa do funil em que o lead nasce. O que se acrescenta
-- é o vínculo de user_id e o fecho das colunas de controle que o formulário
-- público nunca preenche (src/lib/leads/client.ts:24-34).
-- `position` continua livre de propósito: o cliente envia Date.now() nele.
drop policy if exists "leads_public_insert" on public.leads;
create policy "leads_public_insert" on public.leads
for insert to anon, authenticated
with check (
  source = 'site_form'
  and stage_id = 'new'
  and (user_id is null or user_id = auth.uid())
  and deleted_at is null
  and waitlist_id is null
);


-- =====================================================================
-- A-05 (BAIXA) — newsletter virava oráculo de "este e-mail é assinante?"
-- =====================================================================
-- O insert direto é aberto e a tabela tem unique(email): o código 23505
-- distingue "já existe" de "inserido". Passa a existir uma RPC que responde
-- igual nos dois casos, e o insert direto do anônimo é removido.
create or replace function public.assinar_newsletter(p_email text, p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  email_limpo text := lower(btrim(coalesce(p_email, '')));
begin
  if email_limpo = '' or email_limpo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email';
  end if;

  if coalesce(p_source, '') not in ('home', 'blog') then
    raise exception 'invalid source';
  end if;

  insert into public.newsletter_subscribers (email, source, active)
  values (email_limpo, p_source, true)
  on conflict (email) do nothing;
  -- Sem RETURNING e sem contagem: quem chama não distingue "assinou agora" de
  -- "já era assinante". É essa indistinção que fecha o oráculo.
end;
$$;

revoke all on function public.assinar_newsletter(text, text) from public;
grant execute on function public.assinar_newsletter(text, text) to anon;
grant execute on function public.assinar_newsletter(text, text) to authenticated;

comment on function public.assinar_newsletter(text, text) is
  'Inscreve na newsletter sem revelar se o e-mail ja era assinante. Substitui o insert direto do anonimo, cujo erro 23505 do unique(email) permitia enumerar a base.';

drop policy if exists "newsletter_public_insert" on public.newsletter_subscribers;


-- =====================================================================
-- A-06 (INFORMATIVA) + A-12 (BAIXA) — site_settings
-- =====================================================================
-- A tabela é um key/value genérico lido por anon com using (true). Hoje não
-- vaza segredo, mas o formato é aberto: a primeira pessoa que gravar um token
-- aqui o publica para a internet, sem nenhum aviso. Passa a valer lista branca.
--
-- crm_stages fica DE FORA da lista — é configuração interna do funil. E, de
-- quebra, isso conserta A-12: quem abre /admin/crm é ["admin","operacoes"], mas
-- só `conteudo` tinha escrita na tabela. Sem a policy abaixo, fechar a leitura
-- pública deixaria `operacoes` sem enxergar o próprio funil.
drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read" on public.site_settings
for select to anon, authenticated
using (
  setting_key in (
    'site_identity', 'home_seo', 'contact', 'social_links',
    'footer', 'default_seo', 'menu', 'whatsapp_widget'
  )
);

drop policy if exists "site_settings_operacoes_crm" on public.site_settings;
create policy "site_settings_operacoes_crm" on public.site_settings
for all to authenticated
using (
  setting_key = 'crm_stages'
  and public.has_staff_role(array['admin', 'operacoes'])
)
with check (
  setting_key = 'crm_stages'
  and public.has_staff_role(array['admin', 'operacoes'])
);


-- =====================================================================
-- A-03 (MÉDIA, parcial) — access_token em texto puro no log
-- =====================================================================
-- notification_log.body guarda o texto integral da mensagem, e a mensagem
-- carrega o link com ?t=<access_token>. O log não expira, então o segredo
-- entra em qualquer dump ou backup. Mascarar o que já está gravado e o que vier
-- a ser gravado é barato; tirar a coluna access_token de bookings (o resto
-- deste achado) é refatoração maior e ficou no backlog.
update public.notification_log
   set body = regexp_replace(body, '(\?|&)t=[A-Za-z0-9_-]+', '\1t=REDACTED', 'g')
 where body like '%t=%';


-- =====================================================================
-- A-16 (BAIXA) — chave de integração em claro no navegador do admin
-- =====================================================================
-- A policy integration_secrets_admin_all está CERTA (só is_admin()). O problema
-- é de superfície: /admin/integracoes fazia select("key, value, updated_at")
-- pelo navegador, então stripe_secret_key, resend_api_key e uazapi_token
-- trafegavam inteiros e ficavam no estado do React — visíveis na aba de rede,
-- para qualquer extensão instalada, e para qualquer script rodando na origem.
--
-- E a tela nem precisava do valor: o único uso era mostrar os 4 últimos
-- caracteres. Esta RPC devolve exatamente isso e nada mais.
create or replace function public.listar_integracoes()
returns table (key text, updated_at timestamptz, ultimos4 text)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.key,
    s.updated_at,
    right(s.value, 4) as ultimos4
  from public.integration_secrets s
  -- O security definer passa por cima do RLS, entao o filtro de papel precisa
  -- estar AQUI dentro. Sem esta linha a funcao entregaria os segredos a
  -- qualquer authenticated.
  where public.is_admin();
$$;

revoke all on function public.listar_integracoes() from public;
grant execute on function public.listar_integracoes() to authenticated;

comment on function public.listar_integracoes() is
  'Lista as integracoes configuradas SEM devolver o segredo: so a chave, a data e os 4 ultimos caracteres. Existe para a tela /admin/integracoes parar de trazer stripe_secret_key e afins inteiros para o navegador.';


-- =====================================================================
-- A-08 (parte 2) — `operacoes` apagava a reserva paga, e o pagamento ia junto
-- =====================================================================
-- Encontrado sondando a PROPRIA correcao acima. Travar payment_status por
-- trigger nao bastava: bookings_operacoes_all era `for all`, e `for all` inclui
-- DELETE — que nao passa por trigger BEFORE UPDATE nenhum. Apagar a reserva
-- levava junto `payments` e `passengers` por `on delete cascade`
-- (schema.sql:113 e :133), sem deixar registro em lugar nenhum.
--
-- Apagar reserva ja era para ser poder de admin: `bookings_admin_delete` existe
-- desde sempre, e /admin/trash e admin-only na UI (src/lib/auth/roles.ts:83).
-- Nenhum codigo da aplicacao apaga booking pelo navegador, entao isto nao tira
-- funcao de ninguem — so fecha uma porta que nunca deveria ter ficado aberta.
drop policy if exists "bookings_operacoes_all" on public.bookings;

drop policy if exists "bookings_operacoes_select" on public.bookings;
create policy "bookings_operacoes_select"
on public.bookings
for select to authenticated
using (public.has_staff_role(array['operacoes']));

drop policy if exists "bookings_operacoes_insert" on public.bookings;
create policy "bookings_operacoes_insert"
on public.bookings
for insert to authenticated
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "bookings_operacoes_update" on public.bookings;
create policy "bookings_operacoes_update"
on public.bookings
for update to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));


-- =====================================================================
-- A-11 (ajuste) — fechei mais do que a UI precisava
-- =====================================================================
-- Trocar is_staff() por is_admin() em system_logs deixou o painel "Historico"
-- das telas de reserva e de pagamento VAZIO para operacoes e financeiro — sem
-- erro, sem aviso: a consulta simplesmente volta sem linhas.
--
-- O que a auditoria queria proteger era a trilha COMPLETA (/admin/logs,
-- admin-only), e em especial os registros de view_passenger_document. Nao era
-- esconder o historico da propria reserva de quem trabalha nela.
--
-- Entao: a policy admin-only continua, e esta aqui devolve a fatia por entidade.
drop policy if exists "system_logs_staff_entity_select" on public.system_logs;
create policy "system_logs_staff_entity_select"
on public.system_logs
for select to authenticated
using (
  public.has_staff_role(array['operacoes', 'financeiro'])
  -- Sao os valores que o app grava de fato (src/lib/admin/client.ts e as RPCs):
  -- 'booking' e 'payment'. `passengers` fica DE FORA de proposito: e ali que
  -- mora o registro de view_passenger_document, que diz quem abriu documento de
  -- menor — exatamente o que o A-11 queria manter admin-only.
  and entity in ('booking', 'payment')
);


-- ============================================================================
-- DEPOIS DA AUDITORIA (20260904 e 20260905)
-- ============================================================================

-- ---------- 20260904000000_adocao_de_perfil_sem_depender_do_dono.sql ----------
-- Adoção de perfil órfão: parar de depender do NOME DO DONO da função.
-- Rodar no SQL Editor. Idempotente. Aditiva.
--
-- O QUE ESTA MIGRATION CONSERTA:
-- `adotar_perfil_sem_login()` faz `update users_profiles set user_id = auth.uid()`
-- — e trocar user_id é exatamente o que o trigger
-- prevent_customer_profile_identity_changes existe para barrar.
--
-- Hoje isso funciona por um acidente feliz: a função é SECURITY DEFINER, e
-- dentro dela `current_user` vira o DONO da função. Criada pelo SQL Editor, ela
-- pertence a `postgres`, que é justamente um dos nomes na lista de escape do
-- trigger. Ou seja: a adoção só passa porque o dono se chama `postgres`.
--
-- POR QUE ISSO É RUIM:
--   1. É invisível. Nada no código diz "isto depende do dono da função".
--   2. Quebra em silêncio. Recriar a função por outro caminho (CLI, migration
--      aplicada por outro papel, restore) muda o dono e a adoção passa a
--      falhar — com a mensagem "customers can update only name, phone and
--      avatar_url" aparecendo no login do cliente.
--   3. O estrago é exatamente o bug que a adoção foi escrita para consertar: a
--      pessoa importada que cria conta no site fica TRANCADA PARA FORA.
--   4. Nenhum teste pegava, porque no CI o dono é `runner` — e lá a adoção
--      falhava desde sempre, sem ninguém perceber.
--
-- A CORREÇÃO: em vez de escapar por quem executa, o trigger passa a reconhecer
-- a OPERAÇÃO legítima. Adoção é uma transição muito específica — um perfil sem
-- dono ganhando como dono o próprio usuário logado, sem mexer em mais nada.
-- Descrever isso é mais honesto do que confiar num nome de papel.
--
-- POR QUE CONTINUA SEGURO:
--   - `old.user_id is null` — só perfil SEM dono. Não há como tomar o perfil de
--     alguém que já tem conta.
--   - `new.user_id = auth.uid()` — o novo dono é quem está chamando. Não dá
--     para atribuir o perfil a um terceiro.
--   - id, role e email têm que permanecer IGUAIS. Sem isso, alguém usaria esta
--     porta para se promover a admin ou trocar o e-mail do perfil.
--   - E o caminho direto continua fechado pelo RLS: a policy
--     profiles_update_own_customer_fields usa `using (user_id = auth.uid())`,
--     que para um órfão é NULL — logo o cliente não enxerga a linha para
--     atualizar. Quem alcança a linha é só a RPC, que exige e-mail igual ao do
--     token.

create or replace function public.prevent_customer_profile_identity_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Perfil sem e-mail é o contato que a agência cadastrou e que ainda não
    -- tem endereço nenhum; quem insere com e-mail tem que ser o dono dele.
    if new.email is not null
       and new.email is distinct from lower(coalesce(auth.jwt() ->> 'email', ''))
    then
      raise exception 'profile email must match the authenticated user email';
    end if;

    return new;
  end if;

  -- ADOÇÃO DE PERFIL ÓRFÃO — a exceção que faz adotar_perfil_sem_login()
  -- funcionar sem depender de como o dono da função se chama.
  -- Um perfil SEM dono ganha como dono o PRÓPRIO usuário logado, e nada mais
  -- muda. Qualquer desvio disso cai nas regras normais abaixo.
  if old.user_id is null
     and new.user_id = auth.uid()
     and new.id = old.id
     and new.role = old.role
     and new.email is not distinct from old.email
  then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.role is distinct from old.role
    or new.email is distinct from old.email
  then
    raise exception 'customers can update only name, phone and avatar_url';
  end if;

  return new;
end;
$$;

comment on function public.prevent_customer_profile_identity_changes() is
  'Impede que cliente ou equipe troquem id, user_id, role ou email do perfil, e que alguem insira perfil com e-mail que nao e o do proprio token. Abre UMA excecao explicita: perfil orfao (user_id null) ganhando como dono o proprio usuario logado, que e a adocao feita por adotar_perfil_sem_login().';


-- =====================================================================
-- A invariante que segura a base em transicao: SEM LOGIN => SEM E-MAIL
-- =====================================================================
-- Enquanto a agencia migra a base antiga, existe perfil sem conta de login.
-- Isso e seguro HOJE por um motivo especifico: a importacao so cria orfao
-- QUANDO A LINHA NAO TEM E-MAIL (api/admin/clients/import.ts:169-182). Se a
-- planilha traz e-mail, a conta e criada junto e o perfil ja nasce com dono.
--
-- Essa invariante nunca foi escrita no banco — e apenas um habito do codigo.
-- E ela e o que impede o seguinte: um perfil ORFAO COM E-MAIL pode ser
-- reivindicado por QUALQUER PESSOA que consiga um token com aquele e-mail,
-- porque e assim que adotar_perfil_sem_login() escolhe o alvo. Quem reivindica
-- herda nome, telefone, documento e data de nascimento daquela pessoa.
--
-- Subir cliente por INSERT direto no SQL Editor e exatamente o caminho que
-- quebraria isso sem ninguem notar. A constraint abaixo transforma o habito em
-- regra: o banco passa a recusar a linha em vez de aceitar em silencio.
--
-- NOT VALID de proposito: a constraint vale para tudo que entrar de agora em
-- diante, sem travar a migration caso ja exista alguma linha antiga assim.
-- Rode a consulta do bloco seguinte para saber se existe, e depois valide.
alter table public.users_profiles
  drop constraint if exists users_profiles_orfao_sem_email_check;

alter table public.users_profiles
  add constraint users_profiles_orfao_sem_email_check
  check (user_id is not null or email is null)
  not valid;

comment on constraint users_profiles_orfao_sem_email_check on public.users_profiles is
  'Perfil sem dono nao pode ter e-mail. E-mail e a chave que adotar_perfil_sem_login() usa para escolher quem adota, entao um orfao COM e-mail e reivindicavel por quem provar aquele e-mail. A importacao ja respeita isso; a constraint impede que um INSERT manual quebre.';

-- =====================================================================
-- Existe alguma linha assim hoje? (diagnostico, nao altera nada)
-- =====================================================================
-- Se esta consulta devolver linhas, cada uma e um perfil que pode ser
-- reivindicado por quem provar o e-mail. Decida caso a caso: ou criar a conta
-- para a pessoa (o que a importacao faria), ou limpar o e-mail do perfil.
--
--   select id, name, email, phone
--     from public.users_profiles
--    where user_id is null and email is not null;
--
-- Depois de resolver, valide a constraint para ela passar a valer no passado
-- tambem:
--
--   alter table public.users_profiles
--     validate constraint users_profiles_orfao_sem_email_check;

-- ---------- 20260905000000_achar_cliente_por_telefone_e_documento.sql ----------
-- Achar o cliente por telefone e por CPF, para a reserva parar de duplicar ficha.
-- Rodar no SQL Editor. Idempotente. Aditiva.
--
-- O PROBLEMA:
-- a busca de cliente do /admin procura só por nome e e-mail
-- (src/lib/admin/client.ts:838). Só que o contato da base antiga entra SEM
-- e-mail — o único dado que ele informa por telefone é o telefone. Quem atende
-- digita o número, não acha nada, conclui "não está cadastrado" e preenche a
-- ficha na mão. Nasce a segunda ficha da mesma pessoa, e a antiga — com o
-- histórico e o CPF — fica órfã para sempre.
--
-- A incoerência é interna ao projeto: a IMPORTAÇÃO já trata telefone e
-- documento como identificadores (src/lib/import/clientes.ts:158-161 monta
-- `email || documentoDigitos || telefone`), e a migration 20260831 já criou
-- índice em document e em phone dizendo, no comentário, que o documento "passa
-- a ser a chave prática de quem não tem e-mail". A intenção já estava escrita.
-- Só a busca nunca foi atualizada.
--
-- POR QUE NÃO BASTA ACRESCENTAR phone E document NO ILIKE:
-- os formatos estão misturados, e isso é verificável no código.
--   - A importação grava telefone com soDigitos (clientes.ts:148) mas documento
--     CRU, com a pontuação da planilha (clientes.ts:151).
--   - O checkout não normaliza nenhum dos dois: passa o que o cliente digitou
--     (create-pending.ts:43 -> customerAccount.ts:105).
--   - A tela de reserva sugere "+55 11 90000-0000" (new.tsx:346).
-- Ou seja: "(11) 98888-7777" e "11988887777" são a mesma pessoa e um ilike
-- nunca casaria os dois. Buscar por dígito exige ter o dígito guardado.
--
-- A SOLUÇÃO: duas colunas GERADAS, que o Postgres mantém sozinho a partir de
-- phone e document. Nada no app precisa lembrar de normalizar — nem hoje, nem
-- no próximo lugar que gravar um telefone. É por isso que são geradas, e não
-- preenchidas por trigger ou pelo código.
--
-- NULLIF no fim: telefone vazio ou só com pontuação vira NULL em vez de string
-- vazia, para o índice parcial não guardar lixo e para a busca não casar todo
-- mundo quando alguém procura por "".

alter table public.users_profiles
  add column if not exists phone_digits text
    generated always as (
      nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')
    ) stored;

alter table public.users_profiles
  add column if not exists document_digits text
    generated always as (
      nullif(regexp_replace(coalesce(document, ''), '[^0-9]', '', 'g'), '')
    ) stored;

comment on column public.users_profiles.phone_digits is
  'Telefone so com digitos, mantido pelo proprio Postgres. Existe porque a base tem o mesmo numero gravado em formatos diferentes conforme a origem (planilha grava digitos, checkout grava o que a pessoa digitou), e sem isso a busca do balcao nao acha o cliente — e quem atende cadastra a pessoa de novo.';

comment on column public.users_profiles.document_digits is
  'CPF/RG so com digitos, mantido pelo proprio Postgres. Mesma razao do phone_digits: "072.074.233-14" e "07207423314" sao a mesma pessoa.';

-- Índices parciais, no mesmo estilo dos que a 20260831 criou. Não são unique de
-- propósito, pelo motivo que aquela migration já explicou: a base legada tem
-- CPF repetido por erro de digitação, e um unique recusaria a importação
-- inteira por causa de uma linha.
create index if not exists users_profiles_phone_digits_idx
  on public.users_profiles(phone_digits)
  where phone_digits is not null;

create index if not exists users_profiles_document_digits_idx
  on public.users_profiles(document_digits)
  where document_digits is not null;


-- =====================================================================
-- Diagnóstico: quem já está duplicado hoje (não altera nada)
-- =====================================================================
-- Enquanto a busca não achava por telefone/CPF, cada cliente antigo que ligou
-- ou comprou online virou uma segunda ficha. Estas consultas mostram quais.
--
-- Não existe tela de fundir cliente. O caminho é manual e deliberado: olhar
-- cada par, decidir qual ficha fica, e mover o que interessa. Por isso aqui
-- entra só o diagnóstico — fusão automática por telefone juntaria marido e
-- mulher que dividem o número.
--
--   -- Mesmo telefone, fichas diferentes:
--   select phone_digits,
--          count(*) as fichas,
--          array_agg(id order by created_at) as ids,
--          array_agg(coalesce(name, '(sem nome)') order by created_at) as nomes,
--          array_agg(coalesce(email, '(sem e-mail)') order by created_at) as emails
--     from public.users_profiles
--    where phone_digits is not null
--      and role = 'customer'
--    group by phone_digits
--   having count(*) > 1
--    order by count(*) desc;
--
--   -- Mesmo CPF, fichas diferentes (sinal mais forte que telefone):
--   select document_digits,
--          count(*) as fichas,
--          array_agg(id order by created_at) as ids,
--          array_agg(coalesce(name, '(sem nome)') order by created_at) as nomes
--     from public.users_profiles
--    where document_digits is not null
--      and role = 'customer'
--    group by document_digits
--   having count(*) > 1
--    order by count(*) desc;
--
-- Ao fundir, a ficha que FICA deve ser a que tem user_id (a que tem conta e
-- reservas). Da outra, aproveite o que estiver faltando — telefone, documento,
-- nascimento — e depois apague. Reservas ficam presas ao user_id, então mover
-- reserva entre fichas exige mexer em bookings.user_id, o que não é rotina de
-- atendimento: se aparecer esse caso, trate um a um.


-- ============================================================================
-- SISTEMA DE QUIZ (migrations 20260906 a 20260908)
--
-- Entrou aqui porque ESTE arquivo e o caminho de subida que o cabecalho manda
-- usar. A revisao do sistema de quiz achou que as duas primeiras migrations
-- tinham ficado so em supabase/migrations/ — quem seguisse a instrucao daqui
-- subiria o app com /quiz/[slug] apontando para tabela inexistente.
-- ============================================================================

-- ---------- 20260906000000_quizzes.sql ----------
-- Quiz como entidade própria: criar e editar pelo painel, sem programador.
-- Rodar no SQL Editor. Idempotente. Aditiva. FASE 1 de 4 — só banco, sem tela.
--
-- HOJE existe UM quiz, inteiramente fixo no código (src/lib/quiz/feriado.ts:
-- 231 linhas de dados + 362 de tela). Cada quiz novo é um deploy.
--
-- O MODELO segue `pages`: título, slug único, status draft/published, seo_*,
-- e o conteúdo em jsonb. É a mesma forma que o construtor de páginas já usa e
-- que o site já sabe renderizar.
--
-- A PONTUAÇÃO generaliza o que o quiz atual faz, sem inventar. Hoje ele soma
-- dois contadores (relaxar/aventura) e a diferença de 0,5 decide o perfil.
-- Aqui os eixos passam a ser NOMEADOS PELO QUIZ — um quiz "praia vs montanha"
-- usa o mesmo motor — e a regra vira: ganha o eixo de maior pontuação; se a
-- distância para o segundo for menor que a margem, vale o resultado de empate.
-- Isso cobre o quiz atual exatamente e estende para N eixos de graça.

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  status text not null default 'draft',
  seo_title text,
  seo_description text,

  -- Abertura: o que a pessoa vê antes de começar.
  intro jsonb not null default '{}'::jsonb,

  -- Os eixos de pontuação, nomeados por quem cria: ["relaxar","aventura"].
  eixos jsonb not null default '[]'::jsonb,

  -- [{ texto, opcoes: [{ texto, pesos: { "<eixo>": number } }] }]
  -- `pesos` vazio é a opção neutra, que não pontua para lado nenhum.
  perguntas jsonb not null default '[]'::jsonb,

  -- [{ chave, eixo, rotulo, texto, foto, posicao }]
  -- `eixo` nulo marca o resultado de EMPATE — o "equilíbrio" do quiz atual.
  resultados jsonb not null default '[]'::jsonb,

  -- Distância mínima para um eixo ser considerado dominante. Abaixo dela, o
  -- resultado é o de empate. 0.5 é o valor que o quiz atual usa.
  margem_empate numeric not null default 0.5,

  -- O que acontece no fim: WhatsApp, formulário, ou nada.
  cta jsonb not null default '{}'::jsonb,

  -- Quiz sem captura serve como conteúdo puro. Por isso é opcional, e falso
  -- por padrão: pedir dado pessoal tem que ser decisão explícita de quem cria.
  captura_ativa boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quizzes_status_check check (status in ('draft', 'published'))
);

create index if not exists quizzes_slug_idx on public.quizzes(slug);
create index if not exists quizzes_status_idx on public.quizzes(status);

drop trigger if exists set_quizzes_updated_at on public.quizzes;
create trigger set_quizzes_updated_at
before update on public.quizzes
for each row execute function public.set_updated_at();

comment on table public.quizzes is
  'Quiz de captacao, criado e editado pelo painel. O conteudo fica em jsonb pelo mesmo motivo que pages.blocks: a forma muda com o produto, e uma coluna por campo viraria migration a cada ideia nova.';
comment on column public.quizzes.eixos is
  'Nomes dos eixos de pontuacao deste quiz, ex: ["relaxar","aventura"]. Sao do quiz, e nao do sistema — assim um quiz "praia vs montanha" usa o mesmo motor.';
comment on column public.quizzes.resultados is
  'Um por desfecho. `eixo` diz qual eixo dominante leva a ele; `eixo` NULO marca o resultado de empate.';


-- =====================================================================
-- As respostas
-- =====================================================================
-- Guardar a resposta é o que permite dizer depois "60% caíram em aventura" e
-- por que aquele lead é quente.
create table if not exists public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,

  -- A chave do resultado. CALCULADA NO BANCO — ver responder_quiz() abaixo.
  resultado text not null,
  -- Quanto cada eixo somou, para o relatório não precisar recalcular.
  pontuacao jsonb not null default '{}'::jsonb,
  -- O que a pessoa escolheu: [{ pergunta: 0, opcao: 2 }]
  respostas jsonb not null default '[]'::jsonb,

  -- Só quando o quiz pede, e só o que a pessoa digitou.
  name text,
  phone text,
  email text,

  utm jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quiz_responses_quiz_idx
  on public.quiz_responses(quiz_id, created_at desc);
create index if not exists quiz_responses_resultado_idx
  on public.quiz_responses(quiz_id, resultado);


-- =====================================================================
-- RLS
-- =====================================================================
alter table public.quizzes enable row level security;
alter table public.quiz_responses enable row level security;

-- Leitura pública só do que está publicado — igual a `pages`.
drop policy if exists "quizzes_public_read" on public.quizzes;
create policy "quizzes_public_read" on public.quizzes
for select to anon, authenticated
using (status = 'published');

-- Quem cria quiz é `conteudo`, como paginas e blog. Pode porque NENHUM campo
-- do quiz vira HTML: tudo e texto, renderizado pelo React e portanto escapado.
-- Foi exatamente a falta disso que obrigou a travar pages.custom_html no admin.
drop policy if exists "quizzes_conteudo_all" on public.quizzes;
create policy "quizzes_conteudo_all" on public.quizzes
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "quizzes_admin_all" on public.quizzes;
create policy "quizzes_admin_all" on public.quizzes
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- RESPOSTA NAO TEM POLICY DE INSERT. De proposito.
--
-- Quem grava e a funcao abaixo, que roda como service_role. Se houvesse insert
-- publico, a pessoa mandaria o PROPRIO resultado — e o relatorio viraria
-- ficcao. E o mesmo erro que a auditoria encontrou em survey_responses, onde o
-- anonimo podia gravar `approved = true` e publicar o proprio depoimento.
drop policy if exists "quiz_responses_staff_read" on public.quiz_responses;
create policy "quiz_responses_staff_read" on public.quiz_responses
for select to authenticated
using (public.has_staff_role(array['admin', 'operacoes', 'conteudo']));


-- =====================================================================
-- responder_quiz() — o resultado é decidido AQUI, nunca no navegador
-- =====================================================================
-- Recebe só o que a pessoa escolheu. Soma os eixos, decide o desfecho, grava e
-- devolve. O cliente não tem como dizer em que resultado quer cair.
--
-- Concedida SOMENTE a service_role: quem chama é a rota de API, que aplica
-- limite por IP antes. Assim o quiz não vira mais uma escrita pública sem
-- limite — o projeto já tem quatro delas, e a auditoria registrou isso.
create or replace function public.responder_quiz(
  p_slug text,
  p_respostas jsonb,
  p_nome text default null,
  p_telefone text default null,
  p_email text default null,
  p_utm jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quizzes;
  pontos jsonb := '{}'::jsonb;
  item jsonb;
  pesos jsonb;
  eixo text;
  valor numeric;
  melhor_eixo text;
  melhor numeric;
  segundo numeric;
  chave text;
  resultado_json jsonb;
begin
  select * into q
    from public.quizzes
   where slug = p_slug and status = 'published';

  if not found then
    raise exception 'quiz nao encontrado ou nao publicado';
  end if;

  if jsonb_typeof(p_respostas) is distinct from 'array' then
    raise exception 'respostas invalidas';
  end if;

  -- Todo eixo começa em zero, para o resultado não depender de quem pontuou.
  for eixo in select jsonb_array_elements_text(q.eixos) loop
    pontos := jsonb_set(pontos, array[eixo], to_jsonb(0::numeric));
  end loop;

  for item in select * from jsonb_array_elements(p_respostas) loop
    -- Índice fora da faixa é IGNORADO, e não derruba a resposta inteira: o
    -- quiz pode ter sido editado enquanto a pessoa respondia.
    pesos := q.perguntas
             -> (item ->> 'pergunta')::int
             -> 'opcoes'
             -> (item ->> 'opcao')::int
             -> 'pesos';

    if pesos is null or jsonb_typeof(pesos) is distinct from 'object' then
      continue;
    end if;

    for eixo, valor in
      select chave_peso, (v #>> '{}')::numeric
        from jsonb_each(pesos) as e(chave_peso, v)
    loop
      -- Peso para eixo que o quiz não declarou é descartado.
      if pontos ? eixo then
        pontos := jsonb_set(
          pontos,
          array[eixo],
          to_jsonb(((pontos ->> eixo)::numeric) + coalesce(valor, 0))
        );
      end if;
    end loop;
  end loop;

  select e.chave_peso, (e.v #>> '{}')::numeric
    into melhor_eixo, melhor
    from jsonb_each(pontos) as e(chave_peso, v)
   order by (e.v #>> '{}')::numeric desc, e.chave_peso
   limit 1;

  select (e.v #>> '{}')::numeric
    into segundo
    from jsonb_each(pontos) as e(chave_peso, v)
   order by (e.v #>> '{}')::numeric desc, e.chave_peso
   offset 1 limit 1;

  -- Um eixo só, ou distância suficiente: vence o dominante. Senão, empate.
  if segundo is null or (melhor - segundo) >= q.margem_empate then
    select r ->> 'chave' into chave
      from jsonb_array_elements(q.resultados) r
     where r ->> 'eixo' = melhor_eixo
     limit 1;
  else
    select r ->> 'chave' into chave
      from jsonb_array_elements(q.resultados) r
     where r ->> 'eixo' is null
     limit 1;
  end if;

  -- Quiz mal configurado (sem resultado para o eixo vencedor, ou sem empate
  -- declarado) não pode deixar a pessoa sem resposta na tela.
  if chave is null then
    select r ->> 'chave' into chave
      from jsonb_array_elements(q.resultados) r
     limit 1;
  end if;

  if chave is null then
    raise exception 'quiz sem resultados configurados';
  end if;

  insert into public.quiz_responses (
    quiz_id, resultado, pontuacao, respostas, name, phone, email, utm
  ) values (
    q.id, chave, pontos, p_respostas,
    nullif(btrim(coalesce(p_nome, '')), ''),
    nullif(btrim(coalesce(p_telefone, '')), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    coalesce(p_utm, '{}'::jsonb)
  );

  select r into resultado_json
    from jsonb_array_elements(q.resultados) r
   where r ->> 'chave' = chave
   limit 1;

  return jsonb_build_object(
    'resultado', chave,
    'pontuacao', pontos,
    'conteudo', resultado_json
  );
end;
$$;

revoke all on function public.responder_quiz(text, jsonb, text, text, text, jsonb) from public;
grant execute on function public.responder_quiz(text, jsonb, text, text, text, jsonb) to service_role;

comment on function public.responder_quiz(text, jsonb, text, text, text, jsonb) is
  'Recebe o que a pessoa escolheu, calcula o resultado NO BANCO, grava e devolve. O resultado nunca vem do navegador: se viesse, a pessoa escreveria o proprio desfecho e o relatorio viraria ficcao — o mesmo erro que a auditoria achou em survey_responses.approved. Concedida so a service_role porque quem chama e a rota de API, que aplica limite por IP antes.';

-- ---------- 20260907000000_semente_quiz_feriado.sql ----------
-- O quiz-feriado, agora como DADO. Rodar no SQL Editor. Idempotente.
--
-- POR QUE ESTA SEMENTE EXISTE: é o teste de verdade do modelo da fase 1. Um
-- quiz inventado por mim caberia em qualquer esquema; o que prova o desenho é
-- o quiz que a agência já usa entrar sem perder nada. Se algum campo não
-- coubesse, o lugar de descobrir era aqui — antes do editor existir.
--
-- O QUE ELA NÃO FAZ: não mexe em /quiz-feriado. Aquela página continua no ar,
-- com o código dela, servindo a campanha que estiver rodando. Esta semente cria
-- /quiz/feriado ao lado, alimentada pelo banco. Trocar uma pela outra é decisão
-- de quem toca a campanha, não efeito colateral de uma migration.
--
-- O QUE NÃO VEIO JUNTO, e por quê:
--   - As cenas em SVG (CenaSimulada) são arte PROVISÓRIA — o próprio arquivo
--     diz que sai quando as fotos reais chegarem. Aqui `foto` fica vazio: a
--     tela renderiza o texto e segue de pé. Quando as fotos existirem, é só
--     colar a URL pelo editor.
--   - Os blocos "Por que combina" e "A viagem" são da campanha daquele feriado,
--     não do motor de quiz. Entraram no texto do resultado.

insert into public.quizzes (
  title, slug, status, seo_title, seo_description,
  intro, eixos, margem_empate, captura_ativa, perguntas, resultados, cta
) values (
  'Que feriado combina com você?',
  'feriado',
  'draft',
  'Que feriado combina com você? | RW Turismo',
  'Responda 6 perguntas e descubra se o seu feriado pede descanso, aventura — ou os dois.',
  jsonb_build_object(
    'titulo', 'Que feriado combina com você?',
    'subtitulo', 'Seis perguntas rápidas. No fim, a gente te diz que tipo de feriado o seu corpo está pedindo.',
    'texto_botao', 'Começar'
  ),
  '["relaxar","aventura"]'::jsonb,
  0.5,
  true,
  $perguntas$[
    {
      "texto": "Que cenário vem à sua mente quando você tem vontade de \"sumir\" da rotina por alguns dias?",
      "opcoes": [
        { "texto": "Uma rede balançando, silêncio com a natureza e uma vista incrível", "pesos": { "relaxar": 1 } },
        { "texto": "Uma aventura com lugares históricos e atividades radicais", "pesos": { "aventura": 1 } },
        { "texto": "Água fria de piscina natural, bons restaurantes pra comer bem", "pesos": { "relaxar": 1 } },
        { "texto": "Trilha, atividades e uma programação para se movimentar", "pesos": { "aventura": 1 } }
      ]
    },
    {
      "texto": "No feriado, seu corpo pede:",
      "opcoes": [
        { "texto": "Descansar até o despertador perder a função", "pesos": { "relaxar": 1 } },
        { "texto": "Gastar muita energia e descansar a mente", "pesos": { "aventura": 1 } }
      ]
    },
    {
      "texto": "Se alguém te perguntasse: o que você mais precisa AGORA, o que seria?",
      "opcoes": [
        { "texto": "Silêncio", "pesos": { "relaxar": 1 } },
        { "texto": "Adrenalina, nem que seja pouca", "pesos": { "aventura": 1 } },
        { "texto": "Parar de olhar pro celular", "pesos": { "relaxar": 1 } },
        { "texto": "Sentir o coração acelerar de novo", "pesos": { "aventura": 1 } },
        { "texto": "Sinceramente, um pouco de tudo.", "pesos": { "relaxar": 0.5, "aventura": 0.5 } }
      ]
    },
    {
      "texto": "Pensa numa foto que você postaria desse feriado. Ela mostra você:",
      "opcoes": [
        { "texto": "Parada, olhando a paisagem, sem pressa de tirar o celular do bolso", "pesos": { "relaxar": 1 } },
        { "texto": "No meio do movimento: subindo, atravessando, se equilibrando", "pesos": { "aventura": 1 } },
        { "texto": "Nas duas cenas, numa sequência de stories", "pesos": { "relaxar": 0.5, "aventura": 0.5 } }
      ]
    },
    {
      "texto": "Nesse feriado eu pretendo:",
      "opcoes": [
        { "texto": "Viajar só, pra curtir um tempo comigo ou conhecer pessoas novas", "pesos": {} },
        { "texto": "Viajar com meu amor, ter nosso feriado juntos sem preocupações", "pesos": {} },
        { "texto": "Viajar com minha família, onde meus filhos possam aproveitar bastante", "pesos": {} },
        { "texto": "Ainda não decidi quem vem comigo, mas sei que desejo muito viajar", "pesos": {} }
      ]
    },
    {
      "texto": "Se o feriado inteiro tivesse só UM momento de verdade, qual seria:",
      "opcoes": [
        { "texto": "Descansar bem, aproveitar cada segundo relaxando", "pesos": { "relaxar": 1 } },
        { "texto": "Estar em lugares lindos para renovar as energias (e as fotos do Instagram)", "pesos": { "relaxar": 0.5, "aventura": 0.5 } },
        { "texto": "Muita diversão e emoção, me movimentando bastante", "pesos": { "aventura": 1 } }
      ]
    }
  ]$perguntas$::jsonb,
  $resultados$[
    {
      "chave": "relaxar-dominante",
      "eixo": "relaxar",
      "rotulo": "Mais descanso",
      "posicao": 18,
      "foto": null,
      "texto": "Você quer sair da rotina e aproveitar o feriado de verdade, mas sem voltar precisando descansar do feriado. Este é um destino que mistura natureza, descanso e experiências diferentes, com movimento na medida certa."
    },
    {
      "chave": "aventura-dominante",
      "eixo": "aventura",
      "rotulo": "Mais aventura",
      "posicao": 82,
      "foto": null,
      "texto": "Você quer sair da rotina e aproveitar o feriado de verdade, mas sem voltar precisando descansar do feriado. Este é um destino que mistura natureza, descanso e experiências diferentes, com movimento na medida certa."
    },
    {
      "chave": "equilibrio",
      "eixo": null,
      "rotulo": "Descanso e aventura, na mesma medida",
      "posicao": 50,
      "foto": null,
      "texto": "Você quer sair da rotina e aproveitar o feriado de verdade, mas sem voltar precisando descansar do feriado. Este é um destino que mistura natureza, descanso e experiências diferentes, com movimento na medida certa."
    }
  ]$resultados$::jsonb,
  jsonb_build_object(
    'tipo', 'whatsapp',
    'numero', '5586999207088',
    'texto_botao', 'Quero saber mais',
    'molde', 'Oi! Fiz o quiz do feriado e caí em: {{resultado}}'
  )
)
-- Idempotente pelo slug: rodar de novo não duplica nem sobrescreve o que a
-- equipe já tiver ajustado pelo editor.
on conflict (slug) do nothing;

-- NASCE COMO RASCUNHO de propósito. Publicar é decisão de quem toca a campanha
-- — e enquanto /quiz-feriado estiver no ar, dois quizzes publicados dizendo a
-- mesma coisa só confundiriam quem chega pelo anúncio.

-- ---------- 20260908000000_quiz_valida_a_resposta.sql ----------
-- responder_quiz passa a desconfiar do que vem do navegador.
-- Rodar no SQL Editor. Idempotente. Substitui a função da 20260906.
--
-- A REVISÃO DO SISTEMA DE QUIZ ACHOU QUATRO BURACOS, todos na mesma origem: a
-- função confiava no formato de `p_respostas`. O resultado nunca veio do
-- cliente — isso continua verdade — mas o CAMINHO até ele vinha, e caminho
-- controlado é resultado controlado.
--
--   1. REPETIR A MESMA PERGUNTA SOMAVA N VEZES. Mandando a mesma escolha seis
--      vezes, a pessoa forçava o desfecho que quisesse. E o relatório de "onde
--      as pessoas caem" — que é a razão de existir da tela de respostas —
--      passava a contar uma pontuação que ninguém respondeu.
--   2. {"pergunta":"abc"} DERRUBAVA A RESPOSTA COM ERRO. O comentário da função
--      prometia que índice fora da faixa é ignorado "e não derruba o resto",
--      mas o `::int` estourava antes de qualquer checagem. A promessa valia só
--      para índice numérico.
--   3. ÍNDICE NEGATIVO PONTUAVA. Em jsonb, `-1` conta do fim do array — então
--      -1 escolhia a última opção, que não é o que ninguém quis dizer.
--   4. captura_ativa ERA TRAVA SÓ DO REACT. A função gravava nome e telefone
--      mesmo num quiz configurado para não pedir contato: bastava mandar no
--      corpo. Guardar dado pessoal que a configuração diz não guardar é o tipo
--      de coisa que ninguém descobre até virar problema.

create or replace function public.responder_quiz(
  p_slug text,
  p_respostas jsonb,
  p_nome text default null,
  p_telefone text default null,
  p_email text default null,
  p_utm jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quizzes;
  pontos jsonb := '{}'::jsonb;
  item jsonb;
  pesos jsonb;
  eixo text;
  valor numeric;
  i_pergunta integer;
  i_opcao integer;
  vistas integer[] := '{}';
  total_perguntas integer;
  melhor_eixo text;
  melhor numeric;
  segundo numeric;
  chave text;
  resultado_json jsonb;
begin
  select * into q
    from public.quizzes
   where slug = p_slug and status = 'published';

  if not found then
    raise exception 'quiz nao encontrado ou nao publicado';
  end if;

  if jsonb_typeof(p_respostas) is distinct from 'array' then
    raise exception 'respostas invalidas';
  end if;

  total_perguntas := jsonb_array_length(q.perguntas);

  for eixo in select jsonb_array_elements_text(q.eixos) loop
    pontos := jsonb_set(pontos, array[eixo], to_jsonb(0::numeric));
  end loop;

  for item in select * from jsonb_array_elements(p_respostas) loop
    -- safe_integer devolve NULL em vez de estourar: "abc" vira NULL e a linha
    -- e ignorada, que e o que o comentario sempre prometeu.
    i_pergunta := public.safe_integer(item ->> 'pergunta');
    i_opcao := public.safe_integer(item ->> 'opcao');

    -- Negativo conta do FIM do array em jsonb — `-1` pegaria a ultima opcao.
    -- Fora da faixa de perguntas tambem sai aqui.
    if i_pergunta is null or i_opcao is null
       or i_pergunta < 0 or i_opcao < 0
       or i_pergunta >= total_perguntas
    then
      continue;
    end if;

    -- UMA RESPOSTA POR PERGUNTA. Sem isto, repetir a mesma escolha somava de
    -- novo e o visitante escolhia o proprio desfecho. Vale a PRIMEIRA: e a
    -- que a tela envia na ordem em que a pessoa respondeu.
    if i_pergunta = any(vistas) then
      continue;
    end if;
    vistas := vistas || i_pergunta;

    pesos := q.perguntas -> i_pergunta -> 'opcoes' -> i_opcao -> 'pesos';

    if pesos is null or jsonb_typeof(pesos) is distinct from 'object' then
      continue;
    end if;

    for eixo, valor in
      select chave_peso, (v #>> '{}')::numeric
        from jsonb_each(pesos) as e(chave_peso, v)
    loop
      if pontos ? eixo then
        pontos := jsonb_set(
          pontos,
          array[eixo],
          to_jsonb(((pontos ->> eixo)::numeric) + coalesce(valor, 0))
        );
      end if;
    end loop;
  end loop;

  select e.chave_peso, (e.v #>> '{}')::numeric
    into melhor_eixo, melhor
    from jsonb_each(pontos) as e(chave_peso, v)
   order by (e.v #>> '{}')::numeric desc, e.chave_peso
   limit 1;

  select (e.v #>> '{}')::numeric
    into segundo
    from jsonb_each(pontos) as e(chave_peso, v)
   order by (e.v #>> '{}')::numeric desc, e.chave_peso
   offset 1 limit 1;

  if segundo is null or (melhor - segundo) >= q.margem_empate then
    select r ->> 'chave' into chave
      from jsonb_array_elements(q.resultados) r
     where r ->> 'eixo' = melhor_eixo
     limit 1;
  else
    select r ->> 'chave' into chave
      from jsonb_array_elements(q.resultados) r
     where r ->> 'eixo' is null
     limit 1;
  end if;

  if chave is null then
    select r ->> 'chave' into chave
      from jsonb_array_elements(q.resultados) r
     limit 1;
  end if;

  if chave is null then
    raise exception 'quiz sem resultados configurados';
  end if;

  insert into public.quiz_responses (
    quiz_id, resultado, pontuacao, respostas, name, phone, email, utm
  ) values (
    q.id, chave, pontos, p_respostas,
    -- QUIZ SEM CAPTURA NAO GUARDA CONTATO, venha o que vier no corpo. A
    -- configuracao manda; o cliente nao decide o que a agencia armazena.
    case when q.captura_ativa then nullif(btrim(coalesce(p_nome, '')), '') end,
    case when q.captura_ativa then nullif(btrim(coalesce(p_telefone, '')), '') end,
    case when q.captura_ativa then nullif(lower(btrim(coalesce(p_email, ''))), '') end,
    -- Array tambem e 'object' para o typeof do JavaScript, mas nao para o
    -- jsonb: so objeto entra, senao vira {}.
    case when jsonb_typeof(coalesce(p_utm, '{}'::jsonb)) = 'object'
         then p_utm else '{}'::jsonb end
  );

  select r into resultado_json
    from jsonb_array_elements(q.resultados) r
   where r ->> 'chave' = chave
   limit 1;

  return jsonb_build_object(
    'resultado', chave,
    'pontuacao', pontos,
    'conteudo', resultado_json,
    -- A tela precisa saber se o contato foi guardado, para nao prometer a
    -- quem respondeu algo que nao aconteceu.
    'capturou', q.captura_ativa
  );
end;
$$;

revoke all on function public.responder_quiz(text, jsonb, text, text, text, jsonb) from public;
grant execute on function public.responder_quiz(text, jsonb, text, text, text, jsonb) to service_role;

comment on function public.responder_quiz(text, jsonb, text, text, text, jsonb) is
  'Recebe o que a pessoa escolheu, calcula o resultado NO BANCO, grava e devolve. Desconfia do formato: indice nao numerico ou negativo e ignorado, pergunta repetida so conta uma vez, e contato so e gravado se o quiz pedir. Concedida so a service_role — quem chama e a rota de API, que aplica limite por IP antes.';


-- ---------- 20260909000000_quiz_layout_do_resultado.sql ----------
-- A moldura da tela de resultado vira dado do quiz.
-- Rodar no SQL Editor. Idempotente.
--
-- POR QUE: a tela de resultado do /quiz-feriado tem dez elementos — olho,
-- titulo com o nome, paragrafo, regua entre os dois eixos, lista com check,
-- fotos legendadas, bloco de destino, selo de confianca, botao e microcopy.
-- O quiz criado pelo painel desenhava dois: rotulo e texto. Quem montava um
-- quiz no sistema recebia "uma frase" no lugar da pagina.
--
-- Os campos que VARIAM por desfecho (regua, motivos, fotos, destino) entram em
-- resultados[], que ja e jsonb sem CHECK — nao precisam de coluna.
-- Os que sao IGUAIS para todos os desfechos ficam aqui, para quem edita nao ter
-- de repetir a mesma frase em cada resultado.

alter table public.quizzes
  add column if not exists resultado_layout jsonb not null default '{}'::jsonb;

comment on column public.quizzes.resultado_layout is
  'Rotulos fixos da tela de resultado, iguais para todos os desfechos: olho, titulo_motivos, titulo_destino, selo, assinatura. O que muda por desfecho mora em resultados[].';

-- ---------- 20260910000000_quiz_feriado_com_a_tela_cheia.sql ----------
-- O quiz do feriado ganha a tela de resultado inteira.
-- Rodar no SQL Editor. Idempotente.
--
-- POR QUE: a semente (20260907) gravou perguntas, pesos e resultados, mas cada
-- resultado tinha so `chave`, `eixo`, `rotulo` e `texto`. Renderizado, isso
-- virava "uma frase" — enquanto a pagina feita a mao (/quiz-feriado) mostra
-- olho, titulo com o nome, paragrafo, regua, lista com check, duas fotos
-- legendadas, bloco de destino, selo e microcopy.
--
-- Aqui os campos novos entram como DADO. E o que prova que o modelo consegue
-- expressar a pagina de referencia: se algum elemento nao coubesse, apareceria
-- agora, e nao depois que alguem tentasse montar o proprio quiz.
--
-- POR QUE UPDATE E NAO ALTERAR A SEMENTE: a 20260907 termina em
-- `on conflict (slug) do nothing`. Em banco que ja rodou aquela migration,
-- mexer nela nao tem efeito nenhum — a linha ja existe e o insert e ignorado.
-- Editar a semente so mudaria o resultado de um banco montado do zero, o que
-- deixaria producao e ambiente novo com conteudo diferente.
--
-- O update e por CHAVE, com jsonb_set item a item: substituir o array inteiro
-- apagaria qualquer ajuste que a agencia tenha feito pelo painel desde entao.

do $$
declare
  q_id uuid;
  i integer;
  item jsonb;
  novos jsonb := '[]'::jsonb;
  extras jsonb;
  -- O conteudo por chave de resultado. As chaves saem da semente 20260907.
  conteudo jsonb := jsonb_build_object(
    'relaxar-dominante', jsonb_build_object(
      'posicao', 18,
      'regua_rotulo', 'Mais descanso'
    ),
    'equilibrio', jsonb_build_object(
      'posicao', 50,
      'regua_rotulo', 'Descanso e aventura, na mesma medida'
    ),
    'aventura-dominante', jsonb_build_object(
      'posicao', 82,
      'regua_rotulo', 'Mais aventura'
    )
  );
  -- Iguais nos tres desfechos: a viagem e a mesma, o que muda e a leitura.
  comuns jsonb := jsonb_build_object(
    'titulo',
      '{{nome}}, suas respostas mostram que a Serra da Ibiapaba combina com o feriado que voce quer viver.',
    'motivos', jsonb_build_array(
      'Paisagens, serra e experiencias ao ar livre para realmente mudar de cenario.',
      'Aventura na medida: teleferico, mirantes e passeios que deixam o feriado interessante.',
      'Tempo para desacelerar: sao 2 dias e 1 noite para sair da rotina sem precisar tirar varios dias de folga.',
      'Pouca preocupacao com organizacao: transporte, hospedagem e acompanhamento ja fazem parte da viagem.'
    ),
    'destino', jsonb_build_object(
      'nome', 'Serra da Ibiapaba',
      'subtitulo', 'Sitio do Bosco + Lapa + Ubajara',
      'itens', jsonb_build_array(
        'Saida sabado, 5 de setembro',
        'Retorno segunda, 7 de setembro',
        'Transporte em onibus categoria turistica, com ar e WC',
        'Hospedagem e transporte inclusos no pacote',
        'Guia exclusivo acompanhando o grupo'
      )
    )
  );
begin
  select id into q_id from public.quizzes where slug = 'feriado';
  if q_id is null then
    raise notice 'quiz feriado nao existe neste banco; nada a fazer';
    return;
  end if;

  -- A MOLDURA: os rotulos iguais em todos os desfechos.
  update public.quizzes
     set resultado_layout = jsonb_build_object(
           'olho', 'Sua leitura',
           'titulo_motivos', 'Por que essa viagem combina com voce?',
           'titulo_destino', 'Seu destino',
           'selo', 'Mais de 25 anos de estrada, Cadastur, loja fisica em Teresina, guia acompanhando o grupo do comeco ao fim.',
           'assinatura', '@rwturismo.pi'
         ),
         cta = coalesce(cta, '{}'::jsonb) || jsonb_build_object(
           'texto_botao', 'QUERO conhecer a viagem',
           'micro', jsonb_build_array(
             'Voce cai direto no WhatsApp, com a mensagem ja escrita. E so conferir e mandar.',
             'Ou chama direto no 86 99920-7088. Viajar e preciso.'
           )
         )
   where id = q_id;

  -- OS RESULTADOS, item a item. `||` mescla e as chaves ja existentes ganham o
  -- valor novo; o que o painel tiver acrescentado e que nao esta aqui sobrevive.
  for i in 0 .. jsonb_array_length((select resultados from public.quizzes where id = q_id)) - 1 loop
    item := (select resultados from public.quizzes where id = q_id) -> i;
    extras := coalesce(conteudo -> (item ->> 'chave'), '{}'::jsonb);
    novos := novos || jsonb_build_array(item || comuns || extras);
  end loop;

  update public.quizzes set resultados = novos where id = q_id;
end;
$$;
