-- Add the departure city (origin) to products so the package search filter
-- can offer an "Origem" (cidade de saída) dropdown populated by the admin.
-- Idempotent: safe to run on an existing database.

alter table public.products
  add column if not exists origin text;

create index if not exists products_origin_idx on public.products(origin);
