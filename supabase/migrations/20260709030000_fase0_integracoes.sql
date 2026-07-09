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
