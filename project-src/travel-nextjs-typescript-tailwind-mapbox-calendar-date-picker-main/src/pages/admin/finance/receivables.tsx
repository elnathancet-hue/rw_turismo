import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import ConfirmButton from "../../../components/admin/ConfirmButton";
import StatusPill from "../../../components/StatusPill";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../../components/ui/form";
import {
  createReceivable,
  deleteReceivable,
  listReceivables,
  methodLabels,
  setReceivableStatus,
  type Receivable,
  type ReceivableFormValues,
} from "../../../lib/admin/finance";
import { downloadCsv } from "../../../lib/csv";
import { formatBRL, formatDateBR } from "../../../lib/format";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

const emptyValues = (): ReceivableFormValues => ({
  description: "",
  customer_name: "",
  amount: null,
  due_date: today(),
  method: "",
  notes: "",
});

const AdminReceivables = () => {
  const [month, setMonth] = useState(currentMonth);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "received" | "cancelled"
  >("all");
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [values, setValues] = useState<ReceivableFormValues>(emptyValues());
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      setReceivables(await listReceivables(month, statusFilter));
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar. A migration da Fase 5 já rodou?"
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, statusFilter]);

  const set = <K extends keyof ReceivableFormValues>(
    key: K,
    value: ReceivableFormValues[K]
  ) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.amount || values.amount <= 0) {
      setMessage("Informe um valor maior que zero.");
      return;
    }
    setMessage(null);
    setIsSaving(true);
    try {
      await createReceivable(values);
      setMessage("Conta a receber criada.");
      setValues(emptyValues());
      await load();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Não foi possível salvar."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const changeStatus = async (
    row: Receivable,
    status: "pending" | "received" | "cancelled"
  ) => {
    setSavingId(row.id);
    try {
      await setReceivableStatus(row.id, status);
      await load();
    } catch {
      setError("Não foi possível atualizar o status.");
    } finally {
      setSavingId(null);
    }
  };

  const isOverdue = (row: Receivable) =>
    row.status === "pending" && row.due_date < today();

  const totalOpen = receivables
    .filter((r) => r.status === "pending")
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const totalReceived = receivables
    .filter((r) => r.status === "received")
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const exportCsv = () =>
    downloadCsv(`recebiveis-${month}.csv`, [
      ["Vencimento", "Descrição", "Cliente", "Valor", "Forma", "Status"],
      ...receivables.map((r) => [
        formatDateBR(r.due_date),
        r.description,
        r.customer_name,
        Number(r.amount).toFixed(2).replace(".", ","),
        r.method ? methodLabels[r.method] ?? r.method : "",
        r.status === "received"
          ? "Recebido"
          : r.status === "cancelled"
            ? "Cancelado"
            : isOverdue(r)
              ? "Vencido"
              : "Em aberto",
      ]),
    ]);

  return (
    <AdminGuard>
      <AdminLayout
        title="Contas a receber"
        description="Parcelas e vendas combinadas fora do site — controle vencimentos e recebimentos."
      >
        <Link
          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
          href="/admin/finance"
        >
          ← Voltar para o financeiro
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card className="h-fit p-5">
            <h2 className="text-lg font-semibold">Nova conta a receber</h2>
            <form className="mt-4 space-y-4" onSubmit={submit}>
              <Field label="Descrição">
                <Input
                  onChange={(event) => set("description", event.target.value)}
                  placeholder="Ex.: 2ª parcela — Lençóis setembro"
                  required
                  value={values.description}
                />
              </Field>
              <Field label="Cliente">
                <Input
                  onChange={(event) =>
                    set("customer_name", event.target.value)
                  }
                  value={values.customer_name}
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
                <Field label="Vencimento">
                  <Input
                    onChange={(event) => set("due_date", event.target.value)}
                    required
                    type="date"
                    value={values.due_date}
                  />
                </Field>
              </div>
              <Field label="Forma de pagamento">
                <Select
                  onChange={(event) => set("method", event.target.value)}
                  value={values.method}
                >
                  <option value="">Não definida</option>
                  {Object.entries(methodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
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
              {message && (
                <p className="text-sm text-gray-700" role="status">
                  {message}
                </p>
              )}
              <Button loading={isSaving} type="submit">
                {isSaving ? "Salvando…" : "Criar"}
              </Button>
            </form>
          </Card>

          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Mês (vencimento)
                  <Input
                    className="mt-1 w-44"
                    onChange={(event) => setMonth(event.target.value)}
                    type="month"
                    value={month}
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Status
                  <Select
                    className="mt-1 w-40"
                    onChange={(event) =>
                      setStatusFilter(event.target.value as typeof statusFilter)
                    }
                    value={statusFilter}
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Em aberto</option>
                    <option value="received">Recebidos</option>
                    <option value="cancelled">Cancelados</option>
                  </Select>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-600">
                  Aberto: <b className="text-amber-700">{formatBRL(totalOpen)}</b>{" "}
                  · Recebido:{" "}
                  <b className="text-green-700">{formatBRL(totalReceived)}</b>
                </p>
                {receivables.length > 0 && (
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
              emptyHint="Crie a primeira conta a receber no formulário ao lado."
              emptyTitle="Nada com vencimento neste mês"
              error={error}
              isEmpty={receivables.length === 0}
              onRetry={load}
              status={loadStatus}
            >
              <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3">Descrição</th>
                      <th className="px-4 py-3">Valor</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {receivables.map((row) => {
                      const overdue = isOverdue(row);
                      return (
                        <tr
                          className={overdue ? "bg-red-50/60" : "hover:bg-gray-50"}
                          key={row.id}
                        >
                          <td className="px-4 py-3">
                            {formatDateBR(row.due_date)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{row.description}</p>
                            <p className="text-xs text-gray-500">
                              {[
                                row.customer_name,
                                row.method
                                  ? methodLabels[row.method] ?? row.method
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatBRL(Number(row.amount))}
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill
                              label={
                                row.status === "received"
                                  ? "Recebido"
                                  : row.status === "cancelled"
                                    ? "Cancelado"
                                    : overdue
                                      ? "Vencido"
                                      : "Em aberto"
                              }
                              tone={
                                row.status === "received"
                                  ? "success"
                                  : row.status === "cancelled"
                                    ? "neutral"
                                    : overdue
                                      ? "danger"
                                      : "warning"
                              }
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              {row.status === "pending" && (
                                <Button
                                  loading={savingId === row.id}
                                  onClick={() => changeStatus(row, "received")}
                                  size="sm"
                                  type="button"
                                >
                                  Marcar recebido
                                </Button>
                              )}
                              {row.status === "received" && (
                                <Button
                                  loading={savingId === row.id}
                                  onClick={() => changeStatus(row, "pending")}
                                  size="sm"
                                  type="button"
                                  variant="secondary"
                                >
                                  Reabrir
                                </Button>
                              )}
                              {row.status === "pending" && (
                                <Button
                                  loading={savingId === row.id}
                                  onClick={() => changeStatus(row, "cancelled")}
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  Cancelar
                                </Button>
                              )}
                              <ConfirmButton
                                className="ml-1 text-sm font-semibold text-red-600 hover:text-red-700"
                                confirmLabel="Excluir"
                                message={`Excluir "${row.description}"?`}
                                onConfirm={() => deleteReceivable(row.id)}
                                onDone={load}
                              >
                                Excluir
                              </ConfirmButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

export default AdminReceivables;
