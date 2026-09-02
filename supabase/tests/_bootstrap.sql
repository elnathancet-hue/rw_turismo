-- Bootstrap para rodar o schema Supabase em Postgres puro (CI/pgTAP).
-- Cria os papéis, o schema auth e um storage mínimo que schema.sql/rls.sql
-- esperam do ambiente Supabase. NÃO é para produção — só para o pg_prove do CI.
-- Aplicar ANTES de schema.sql + rls.sql.

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

-- ----- auth (stub) ---------------------------------------------------------
create schema if not exists auth;

create table if not exists auth.users (
  instance_id uuid,
  id uuid primary key default gen_random_uuid(),
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

-- Sem estes grants o stub não reproduz o Supabase de verdade: lá, `anon` e
-- `authenticated` têm USAGE no schema auth e EXECUTE nessas duas funções — é o
-- que permite uma policy escrever `auth.uid()` direto no USING/WITH CHECK.
--
-- Faltando isso, qualquer policy que chame auth.uid() sem passar por um helper
-- SECURITY DEFINER estoura "permission denied for schema auth", e o insert é
-- recusado pelo motivo ERRADO. O teste ficaria verde acreditando ter provado
-- uma regra de negócio quando só provou uma falta de grant.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;

-- ----- storage (stub) ------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table storage.objects enable row level security;

-- storage.foldername: usada pelas policies do bucket de documentos para ler o
-- booking_id da primeira pasta do caminho. Sem este stub o rls.sql aborta e o
-- pgTAP nunca roda — o job fica "verde" por não ter executado nada.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$ select string_to_array(name, '/') $$;

grant usage on schema storage to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- service_role no Supabase real tem privilégio de tabela em todo o schema
-- public, além do bypassrls. Sem isso aqui, qualquer teste do caminho de
-- servidor (rota de API, RPC, cron) falharia com "permission denied" — e não
-- pela regra que ele quer provar.
--
-- O DEFAULT PRIVILEGES é o que faz valer para tabela criada DEPOIS deste
-- arquivo: schema.sql e as migrations rodam em seguida, e sem ele cada tabela
-- nova nasceria invisível para o service_role.
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
grant usage on schema public to service_role;

-- pgTAP
create extension if not exists pgtap;
