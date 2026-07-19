import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import ConfirmButton from "../../../components/admin/ConfirmButton";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../../components/ui/form";
import {
  listAdminDepartures,
  listAdminSuppliers,
  type AdminDeparture,
  type Supplier,
} from "../../../lib/admin/client";
import {
  createExpense,
  deleteExpense,
  expenseCategoryLabels,
  listExpenses,
  setExpensePaid,
  updateExpense,
  type Expense,
  type ExpenseFormValues,
} from "../../../lib/admin/finance";
import { downloadCsv } from "../../../lib/csv";
import { formatBRL, formatDateBR, formatDateRangeBR } from "../../../lib/format";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

const emptyValues = (): ExpenseFormValues => ({
  product_date_id: "",
  supplier_id: "",
  category: "outro",
  description: "",
  amount: null,
  expense_date: today(),
  paid: false,
  notes: "",
});

const AdminExpenses = () => {
  const [month, setMonth] = useState(currentMonth);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [departures, setDepartures] = useState<AdminDeparture[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [values, setValues] = useState<ExpenseFormValues>(emptyValues());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      setExpenses(await listExpenses(month));
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar as despesas. A migration da Fase 5 já rodou?"
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    listAdminDepartures(true)
      .then(setDepartures)
      .catch(() => {});
    listAdminSuppliers()
      .then((all) => setSuppliers(all.filter((s) => s.active)))
      .catch(() => {});
  }, []);

  const set = <K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K]
  ) => setValues((current) => ({ ...current, [key]: value }));

  const resetForm = () => {
    setValues(emptyValues());
    setEditingId(null);
  };

  const startEditing = (expense: Expense) => {
    setEditingId(expense.id);
    setValues({
      product_date_id: expense.product_date_id ?? "",
      supplier_id: expense.supplier_id ?? "",
      category: expense.category,
      description: expense.description,
      amount: Number(expense.amount),
      expense_date: expense.expense_date,
      paid: expense.paid,
      notes: expense.notes ?? "",
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.amount || values.amount <= 0) {
      setMessage("Informe um valor maior que zero.");
      return;
    }
    setMessage(null);
    setIsSaving(true);
    try {
      if (editingId) {
        await updateExpense(editingId, values);
      } else {
        await createExpense(values);
      }
      setMessage("Despesa salva.");
      resetForm();
      await load();
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Não foi possível salvar a despesa."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const togglePaid = async (expense: Expense) => {
    try {
      await setExpensePaid(expense.id, !expense.paid);
      setExpenses((current) =>
        current.map((e) =>
          e.id === expense.id ? { ...e, paid: !expense.paid } : e
        )
      );
    } catch {
      setError("Não foi possível atualizar o status.");
    }
  };

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPaid = expenses
    .filter((e) => e.paid)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const exportCsv = () =>
    downloadCsv(`despesas-${month}.csv`, [
      ["Data", "Descrição", "Categoria", "Saída", "Fornecedor", "Valor", "Pago"],
      ...expenses.map((e) => [
        formatDateBR(e.expense_date),
        e.description,
        expenseCategoryLabels[e.category] ?? e.category,
        e.product_dates?.products?.title ?? "",
        e.suppliers?.name ?? "",
        Number(e.amount).toFixed(2).replace(".", ","),
        e.paid ? "Sim" : "Não",
      ]),
    ]);

  return (
    <AdminGuard>
      <AdminLayout
        title="Despesas"
        description="Lançamentos de despesas — vincule à saída para calcular a margem real."
      >
        <Link
          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
          href="/admin/finance"
        >
          ← Voltar para o financeiro
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card className="h-fit p-5">
            <h2 className="text-lg font-semibold">
              {editingId ? "Editar despesa" : "Nova despesa"}
            </h2>
            <form className="mt-4 space-y-4" onSubmit={submit}>
              <Field label="Descrição">
                <Input
                  onChange={(event) => set("description", event.target.value)}
                  placeholder="Ex.: Diesel ida/volta Barreirinhas"
                  required
                  value={values.description}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor (R$)">
                  <Input
                    min={0.01}
                    onChange={(event) =>
                      set(
                        "amount",
                        event.target.value ? Number(event.target.value) : null
                      )
                    }
                    required
                    step="0.01"
                    type="number"
                    value={values.amount ?? ""}
                  />
                </Field>
                <Field label="Data">
                  <Input
                    onChange={(event) =>
                      set("expense_date", event.target.value)
                    }
                    required
                    type="date"
                    value={values.expense_date}
                  />
                </Field>
              </div>
              <Field label="Categoria">
                <Select
                  onChange={(event) => set("category", event.target.value)}
                  value={values.category}
                >
                  {Object.entries(expenseCategoryLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </Select>
              </Field>
              <Field
                hint="Vincule para entrar na margem da saída."
                label="Saída (opcional)"
              >
                <Select
                  onChange={(event) =>
                    set("product_date_id", event.target.value)
                  }
                  value={values.product_date_id}
                >
                  <option value="">Despesa geral</option>
                  {departures.map((departure) => (
                    <option key={departure.id} value={departure.id}>
                      {departure.products?.title} ·{" "}
                      {formatDateBR(departure.start_date)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fornecedor (opcional)">
                <Select
                  onChange={(event) => set("supplier_id", event.target.value)}
                  value={values.supplier_id}
                >
                  <option value="">Sem fornecedor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Observações">
                <Textarea
                  className="min-h-[60px]"
                  onChange={(event) => set("notes", event.target.value)}
                  value={values.notes}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  checked={values.paid}
                  onChange={(event) => set("paid", event.target.checked)}
                  type="checkbox"
                />
                Já foi paga
              </label>
              {message && (
                <p className="text-sm text-gray-700" role="status">
                  {message}
                </p>
              )}
              <div className="flex gap-3">
                <Button loading={isSaving} type="submit">
                  {isSaving ? "Salvando…" : editingId ? "Salvar" : "Lançar"}
                </Button>
                {editingId && (
                  <Button onClick={resetForm} type="button" variant="secondary">
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <label className="block text-sm font-medium text-gray-700">
                Mês
                <Input
                  className="mt-1 w-44"
                  onChange={(event) => setMonth(event.target.value)}
                  type="month"
                  value={month}
                />
              </label>
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-600">
                  Total: <b>{formatBRL(total)}</b> · Pago:{" "}
                  <b className="text-green-700">{formatBRL(totalPaid)}</b>
                </p>
                {expenses.length > 0 && (
                  <Button
                    onClick={exportCsv}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    CSV
                  </Button>
                )}
              </div>
            </div>

            <AdminListState
              emptyHint="Lance a primeira despesa no formulário ao lado."
              emptyTitle="Nenhuma despesa neste mês"
              error={error}
              isEmpty={expenses.length === 0}
              onRetry={load}
              status={loadStatus}
            >
              <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Descrição</th>
                      <th className="px-4 py-3">Saída</th>
                      <th className="px-4 py-3">Valor</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {expenses.map((expense) => (
                      <tr className="hover:bg-gray-50" key={expense.id}>
                        <td className="px-4 py-3">
                          {formatDateBR(expense.expense_date)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{expense.description}</p>
                          <p className="text-xs text-gray-500">
                            {[
                              expenseCategoryLabels[expense.category] ??
                                expense.category,
                              expense.suppliers?.name,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {expense.product_dates
                            ? `${expense.product_dates.products?.title ?? ""} · ${formatDateRangeBR(expense.product_dates.start_date, expense.product_dates.end_date)}`
                            : "Geral"}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {formatBRL(Number(expense.amount))}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              expense.paid
                                ? "border-green-200 bg-green-100 text-green-800"
                                : "border-amber-200 bg-amber-100 text-amber-800"
                            }`}
                            onClick={() => togglePaid(expense)}
                            title="Clique para alternar"
                            type="button"
                          >
                            {expense.paid ? "Paga" : "A pagar"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            className="font-semibold text-orange-600 hover:text-orange-700"
                            onClick={() => startEditing(expense)}
                            type="button"
                          >
                            Editar
                          </button>
                          <ConfirmButton
                            className="ml-4 font-semibold text-red-600 hover:text-red-700"
                            confirmLabel="Excluir despesa"
                            message={`Excluir a despesa "${expense.description}"?`}
                            onConfirm={() => deleteExpense(expense.id)}
                            onDone={load}
                          >
                            Excluir
                          </ConfirmButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminListState>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminExpenses;
