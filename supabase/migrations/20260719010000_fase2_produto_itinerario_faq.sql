-- Fase 2 — Itinerário e FAQ por produto (itens 2.2 e 2.3 do PLANO)
-- Adiciona products.itinerary e products.faq como jsonb array (mesmo padrão de
-- products.gallery). Rodar no SQL Editor do Supabase. Idempotente.

alter table public.products
  add column if not exists itinerary jsonb not null default '[]'::jsonb;
alter table public.products
  drop constraint if exists products_itinerary_array_check;
alter table public.products
  add constraint products_itinerary_array_check
  check (jsonb_typeof(itinerary) = 'array');

alter table public.products
  add column if not exists faq jsonb not null default '[]'::jsonb;
alter table public.products
  drop constraint if exists products_faq_array_check;
alter table public.products
  add constraint products_faq_array_check
  check (jsonb_typeof(faq) = 'array');
