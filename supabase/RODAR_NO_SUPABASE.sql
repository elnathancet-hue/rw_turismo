-- ============================================================================
-- RW TURISMO — TODAS AS MIGRATIONS PENDENTES (cole este arquivo inteiro no
-- SQL Editor do Supabase e execute UMA vez). Tudo é idempotente.
-- Atualizado em 2026-08-30 (inclui as correções da auditoria de segurança).
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
