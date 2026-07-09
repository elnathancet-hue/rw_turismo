-- ============================================================================
-- RW TURISMO — TODAS AS MIGRATIONS PENDENTES (cole este arquivo inteiro no
-- SQL Editor do Supabase e execute UMA vez). Tudo é idempotente.
-- Atualizado em 2026-07-09 (inclui Fase 5: financeiro).
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
  position integer not null default 0,
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
