-- Fase 1 (operação): perfil do cliente enriquecido, check-in de passageiros,
-- fornecedores e lista de espera. Idempotente: seguro rodar em banco existente.

-- Cliente: nascimento (aniversariantes) e documento.
alter table public.users_profiles
  add column if not exists birth_date date,
  add column if not exists document text;

-- Check-in de embarque por passageiro.
alter table public.passengers
  add column if not exists checked_in_at timestamptz;

-- Fornecedores (hotéis, transporte, guias...) — usados por transfers e despesas.
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'outro',
  contact_name text,
  phone text,
  email text,
  city text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_category_check check (
    category in ('hotel', 'transporte', 'guia', 'restaurante', 'passeio', 'outro')
  )
);

create index if not exists suppliers_active_idx on public.suppliers(active);
create index if not exists suppliers_category_idx on public.suppliers(category);

drop trigger if exists set_suppliers_updated_at on public.suppliers;
create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_admin_all" on public.suppliers;
create policy "suppliers_admin_all" on public.suppliers
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Lista de espera: interessados quando a saída está lotada.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  product_date_id uuid references public.product_dates(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  travelers_count integer not null default 1,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waitlist_status_check check (
    status in ('pending', 'contacted', 'converted', 'cancelled')
  ),
  constraint waitlist_email_lowercase_check check (email = lower(email)),
  constraint waitlist_travelers_positive_check check (travelers_count > 0)
);

create index if not exists waitlist_product_date_idx on public.waitlist(product_date_id);
create index if not exists waitlist_status_idx on public.waitlist(status);

drop trigger if exists set_waitlist_updated_at on public.waitlist;
create trigger set_waitlist_updated_at
before update on public.waitlist
for each row execute function public.set_updated_at();

alter table public.waitlist enable row level security;

-- Qualquer visitante pode entrar na fila (como a newsletter); só admin lê/gerencia.
drop policy if exists "waitlist_public_insert" on public.waitlist;
create policy "waitlist_public_insert" on public.waitlist
for insert to anon, authenticated
with check (status = 'pending');

drop policy if exists "waitlist_select_own_or_admin" on public.waitlist;
create policy "waitlist_select_own_or_admin" on public.waitlist
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "waitlist_admin_update" on public.waitlist;
create policy "waitlist_admin_update" on public.waitlist
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "waitlist_admin_delete" on public.waitlist;
create policy "waitlist_admin_delete" on public.waitlist
for delete to authenticated
using (public.is_admin());
