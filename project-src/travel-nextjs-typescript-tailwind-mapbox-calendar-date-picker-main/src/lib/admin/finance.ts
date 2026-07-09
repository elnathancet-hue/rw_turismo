import { createSupabaseBrowserClient } from "../supabase/browser";

const db = () => createSupabaseBrowserClient() as any;
const throwIfError = (error: unknown) => {
  if (error) throw error;
};

// "2026-07" → intervalo [primeiro dia, primeiro dia do mês seguinte)
const monthRange = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const nextMonth = m === 12 ? `${(year ?? 0) + 1}-01` : `${year}-${String((m ?? 0) + 1).padStart(2, "0")}`;
  const end = `${nextMonth}-01`;
  return { start, end };
};

// ---------------------------------------------------------------------------
// Despesas.
// ---------------------------------------------------------------------------

export const expenseCategoryLabels: Record<string, string> = {
  combustivel: "Combustível",
  hospedagem: "Hospedagem",
  alimentacao: "Alimentação",
  transporte: "Transporte",
  guia: "Guia",
  ingresso: "Ingressos",
  taxa: "Taxas",
  marketing: "Marketing",
  outro: "Outro",
};

export type Expense = {
  id: string;
  product_date_id: string | null;
  supplier_id: string | null;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  paid: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  suppliers?: { name: string } | null;
  product_dates?: {
    start_date: string;
    end_date: string;
    products?: { title: string } | null;
  } | null;
};

export type ExpenseFormValues = {
  product_date_id: string;
  supplier_id: string;
  category: string;
  description: string;
  amount: number | null;
  expense_date: string;
  paid: boolean;
  notes: string;
};

const expensePayload = (values: ExpenseFormValues) => ({
  product_date_id: values.product_date_id || null,
  supplier_id: values.supplier_id || null,
  category: values.category,
  description: values.description.trim(),
  amount: values.amount,
  expense_date: values.expense_date,
  paid: values.paid,
  notes: values.notes.trim() || null,
});

const EXPENSE_SELECT =
  "*, suppliers(name), product_dates(start_date, end_date, products(title))";

export const listExpenses = async (month: string): Promise<Expense[]> => {
  const { start, end } = monthRange(month);
  const { data, error } = await db()
    .from("expenses")
    .select(EXPENSE_SELECT)
    .gte("expense_date", start)
    .lt("expense_date", end)
    .order("expense_date", { ascending: false });
  throwIfError(error);
  return (data ?? []) as Expense[];
};

export const createExpense = async (
  values: ExpenseFormValues
): Promise<Expense> => {
  const { data, error } = await db()
    .from("expenses")
    .insert(expensePayload(values))
    .select(EXPENSE_SELECT)
    .single();
  throwIfError(error);
  return data as Expense;
};

export const updateExpense = async (
  id: string,
  values: ExpenseFormValues
): Promise<Expense> => {
  const { data, error } = await db()
    .from("expenses")
    .update(expensePayload(values))
    .eq("id", id)
    .select(EXPENSE_SELECT)
    .single();
  throwIfError(error);
  return data as Expense;
};

export const setExpensePaid = async (
  id: string,
  paid: boolean
): Promise<void> => {
  const { error } = await db().from("expenses").update({ paid }).eq("id", id);
  throwIfError(error);
};

export const deleteExpense = async (id: string): Promise<void> => {
  const { error } = await db().from("expenses").delete().eq("id", id);
  throwIfError(error);
};

// ---------------------------------------------------------------------------
// Contas a receber.
// ---------------------------------------------------------------------------

export const methodLabels: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  outro: "Outro",
};

export type Receivable = {
  id: string;
  booking_id: string | null;
  description: string;
  customer_name: string | null;
  amount: number;
  due_date: string;
  status: "pending" | "received" | "cancelled";
  method: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
};

export type ReceivableFormValues = {
  description: string;
  customer_name: string;
  amount: number | null;
  due_date: string;
  method: string;
  notes: string;
};

export const listReceivables = async (
  month: string,
  status: "all" | "pending" | "received" | "cancelled"
): Promise<Receivable[]> => {
  const { start, end } = monthRange(month);
  let query = db()
    .from("receivables")
    .select("*")
    .gte("due_date", start)
    .lt("due_date", end)
    .order("due_date", { ascending: true });
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  throwIfError(error);
  return (data ?? []) as Receivable[];
};

export const createReceivable = async (
  values: ReceivableFormValues
): Promise<Receivable> => {
  const { data, error } = await db()
    .from("receivables")
    .insert({
      description: values.description.trim(),
      customer_name: values.customer_name.trim() || null,
      amount: values.amount,
      due_date: values.due_date,
      method: values.method || null,
      notes: values.notes.trim() || null,
      status: "pending",
    })
    .select("*")
    .single();
  throwIfError(error);
  return data as Receivable;
};

export const setReceivableStatus = async (
  id: string,
  status: "pending" | "received" | "cancelled"
): Promise<void> => {
  const { error } = await db()
    .from("receivables")
    .update({
      status,
      received_at: status === "received" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  throwIfError(error);
};

export const deleteReceivable = async (id: string): Promise<void> => {
  const { error } = await db().from("receivables").delete().eq("id", id);
  throwIfError(error);
};

// ---------------------------------------------------------------------------
// Resumo do mês (fluxo de caixa + margem por saída).
// ---------------------------------------------------------------------------

export type DepartureMargin = {
  productDateId: string;
  title: string;
  period: { start: string; end: string };
  revenue: number;
  expenses: number;
  margin: number;
  pax: number;
};

export type FinanceSummary = {
  stripeReceived: number;
  manualReceived: number;
  totalReceived: number;
  openReceivables: number;
  overdueReceivables: number;
  expensesPaid: number;
  expensesOpen: number;
  balance: number;
  departures: DepartureMargin[];
};

export const getFinanceSummary = async (
  month: string
): Promise<FinanceSummary> => {
  const { start, end } = monthRange(month);
  const today = new Date().toISOString().slice(0, 10);

  const [payments, receivables, expenses, departures] = await Promise.all([
    db()
      .from("payments")
      .select("amount, status, paid_at")
      .eq("status", "paid")
      .gte("paid_at", `${start}T00:00:00Z`)
      .lt("paid_at", `${end}T00:00:00Z`),
    db().from("receivables").select("amount, status, due_date, received_at"),
    db()
      .from("expenses")
      .select("amount, paid, expense_date, product_date_id")
      .gte("expense_date", start)
      .lt("expense_date", end),
    db()
      .from("product_dates")
      .select("id, start_date, end_date, products(title)")
      .gte("start_date", start)
      .lt("start_date", end),
  ]);
  throwIfError(payments.error);
  throwIfError(receivables.error);
  throwIfError(expenses.error);
  throwIfError(departures.error);

  const stripeReceived = ((payments.data ?? []) as any[]).reduce(
    (total, row) => total + Number(row.amount),
    0
  );

  let manualReceived = 0;
  let openReceivables = 0;
  let overdueReceivables = 0;
  for (const row of (receivables.data ?? []) as any[]) {
    if (row.status === "received" && row.received_at) {
      const receivedDay = String(row.received_at).slice(0, 10);
      if (receivedDay >= start && receivedDay < end) {
        manualReceived += Number(row.amount);
      }
    }
    if (row.status === "pending") {
      openReceivables += Number(row.amount);
      if (row.due_date < today) overdueReceivables += Number(row.amount);
    }
  }

  let expensesPaid = 0;
  let expensesOpen = 0;
  const expenseByDate: Record<string, number> = {};
  for (const row of (expenses.data ?? []) as any[]) {
    const amount = Number(row.amount);
    if (row.paid) expensesPaid += amount;
    else expensesOpen += amount;
    if (row.product_date_id) {
      expenseByDate[row.product_date_id] =
        (expenseByDate[row.product_date_id] ?? 0) + amount;
    }
  }

  // Margem por saída do mês: receita = reservas confirmadas da saída.
  const departureRows = (departures.data ?? []) as any[];
  const dateIds = departureRows.map((row) => row.id);
  let bookingsRows: any[] = [];
  if (dateIds.length > 0) {
    const { data, error } = await db()
      .from("bookings")
      .select("product_date_id, total_amount, travelers_count, status")
      .in("product_date_id", dateIds)
      .eq("status", "confirmed");
    throwIfError(error);
    bookingsRows = (data ?? []) as any[];
  }

  const departuresSummary: DepartureMargin[] = departureRows.map((row) => {
    const bookings = bookingsRows.filter(
      (b) => b.product_date_id === row.id
    );
    const revenue = bookings.reduce(
      (total, b) => total + Number(b.total_amount),
      0
    );
    const cost = expenseByDate[row.id] ?? 0;
    return {
      productDateId: row.id,
      title: row.products?.title ?? "Saída",
      period: { start: row.start_date, end: row.end_date },
      revenue,
      expenses: cost,
      margin: revenue - cost,
      pax: bookings.reduce((total, b) => total + Number(b.travelers_count), 0),
    };
  });

  const totalReceived = stripeReceived + manualReceived;

  return {
    stripeReceived,
    manualReceived,
    totalReceived,
    openReceivables,
    overdueReceivables,
    expensesPaid,
    expensesOpen,
    balance: totalReceived - expensesPaid,
    departures: departuresSummary,
  };
};
