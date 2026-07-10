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
