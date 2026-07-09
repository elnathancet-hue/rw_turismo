-- Fase 2 (logística da saída): assentos, quartos (rooming) e transfers.
-- Idempotente: seguro rodar em banco existente. Requer a migration da Fase 1.

-- Assento e quarto por passageiro.
alter table public.passengers
  add column if not exists seat_number text,
  add column if not exists room_label text;

-- Total de assentos do veículo da saída (para o mapa de assentos).
alter table public.product_dates
  add column if not exists total_seats integer;

alter table public.product_dates
  drop constraint if exists product_dates_total_seats_positive_check;
alter table public.product_dates
  add constraint product_dates_total_seats_positive_check
  check (total_seats is null or total_seats > 0);

-- Transfers da saída (traslados): motorista, horário e ponto de encontro.
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  product_date_id uuid not null references public.product_dates(id) on delete cascade,
  title text not null,
  transfer_date date,
  transfer_time text,
  meeting_point text,
  driver_name text,
  driver_phone text,
  vehicle text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  capacity integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfers_capacity_positive_check check (capacity is null or capacity > 0)
);

create index if not exists transfers_product_date_idx on public.transfers(product_date_id);
create index if not exists transfers_supplier_idx on public.transfers(supplier_id);

drop trigger if exists set_transfers_updated_at on public.transfers;
create trigger set_transfers_updated_at
before update on public.transfers
for each row execute function public.set_updated_at();

alter table public.transfers enable row level security;

drop policy if exists "transfers_admin_all" on public.transfers;
create policy "transfers_admin_all" on public.transfers
for all to authenticated
using (public.is_admin()) with check (public.is_admin());
