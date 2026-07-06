-- Structured content blocks for pages (text, image, gallery, banner, cta).
-- Idempotent: safe to run on an existing database (requires the pages table).

alter table public.pages
  add column if not exists blocks jsonb not null default '[]'::jsonb;
