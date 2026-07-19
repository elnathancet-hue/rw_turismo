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
