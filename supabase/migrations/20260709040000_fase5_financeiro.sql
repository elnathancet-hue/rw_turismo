-- Fase 5 (financeiro): despesas de viagem e contas a receber.
-- Idempotente. Requer as migrations das Fases 1/2 (suppliers, product_dates).

-- Despesas (por saída ou gerais), com fornecedor e status de pagamento.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  product_date_id uuid references public.product_dates(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  category text not null default 'outro',
  description text not null,
  amount numeric(12,2) not null,
  expense_date date not null default current_date,
  paid boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_amount_positive_check check (amount > 0),
  constraint expenses_category_check check (
    category in ('combustivel', 'hospedagem', 'alimentacao', 'transporte', 'guia', 'ingresso', 'taxa', 'marketing', 'outro')
  )
);

create index if not exists expenses_date_idx on public.expenses(expense_date desc);
create index if not exists expenses_product_date_idx on public.expenses(product_date_id);

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;

drop policy if exists "expenses_admin_all" on public.expenses;
create policy "expenses_admin_all" on public.expenses
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Contas a receber (vendas manuais, parcelas combinadas fora do site).
create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  description text not null,
  customer_name text,
  amount numeric(12,2) not null,
  due_date date not null default current_date,
  status text not null default 'pending',
  method text,
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivables_amount_positive_check check (amount > 0),
  constraint receivables_status_check check (status in ('pending', 'received', 'cancelled')),
  constraint receivables_method_check check (
    method is null or method in ('pix', 'boleto', 'cartao', 'dinheiro', 'transferencia', 'outro')
  )
);

create index if not exists receivables_due_idx on public.receivables(due_date);
create index if not exists receivables_status_idx on public.receivables(status);

drop trigger if exists set_receivables_updated_at on public.receivables;
create trigger set_receivables_updated_at
before update on public.receivables
for each row execute function public.set_updated_at();

alter table public.receivables enable row level security;

drop policy if exists "receivables_admin_all" on public.receivables;
create policy "receivables_admin_all" on public.receivables
for all to authenticated
using (public.is_admin()) with check (public.is_admin());
