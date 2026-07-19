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
