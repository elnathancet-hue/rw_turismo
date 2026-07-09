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
