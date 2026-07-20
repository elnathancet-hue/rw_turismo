-- Fase catálogo real — horário de saída/retorno nas datas + tiers de suíte.
-- Rodar no SQL Editor do Supabase. Idempotente. Não mexe em RLS nem em RPC.

-- Horário de saída/retorno (opcional) por data de saída.
alter table public.product_dates add column if not exists departure_time time;
alter table public.product_dates add column if not exists return_time time;

-- Tiers de suíte (informativo): [{ "name": "Master", "price": 580 }, ...].
alter table public.products add column if not exists tiers jsonb not null default '[]'::jsonb;
alter table public.products drop constraint if exists products_tiers_array_check;
alter table public.products add constraint products_tiers_array_check check (jsonb_typeof(tiers) = 'array');
