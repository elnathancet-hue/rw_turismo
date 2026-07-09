import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { Input } from "../../../components/ui/form";
import {
  getFinanceSummary,
  type FinanceSummary,
} from "../../../lib/admin/finance";
import { downloadCsv } from "../../../lib/csv";
import { formatBRL, formatDateRangeBR } from "../../../lib/format";

const currentMonth = () => new Date().toISOString().slice(0, 7);

const Kpi = ({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad" | "warn";
  hint?: string;
}) => (
  <Card className="p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {label}
    </p>
    <p
      className={`mt-1 text-2xl font-bold ${
        tone === "good"
          ? "text-green-700"
          : tone === "bad"
            ? "text-red-600"
            : tone === "warn"
              ? "text-amber-700"
              : ""
      }`}
    >
      {value}
    </p>
    {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
  </Card>
);

const AdminFinance = () => {
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadStatus("loading");
    setError(null);
    getFinanceSummary(month)
      .then((data) => {
        setSummary(data);
        setLoadStatus("ready");
      })
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar o resumo. A migration da Fase 5 já rodou?"
        );
        setLoadStatus("error");
      });
  }, [month]);

  const exportDepartures = () => {
    if (!summary) return;
    downloadCsv(`margem-por-saida-${month}.csv`, [
      ["Saída", "Período", "Pax", "Receita", "Despesas", "Margem"],
      ...summary.departures.map((d) => [
        d.title,
        formatDateRangeBR(d.period.start, d.period.end),
        d.pax,
        d.revenue.toFixed(2).replace(".", ","),
        d.expenses.toFixed(2).replace(".", ","),
        d.margin.toFixed(2).replace(".", ","),
      ]),
    ]);
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Financeiro"
        description="Fluxo de caixa do mês e margem real por saída."
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm font-medium text-gray-700">
            Mês
            <Input
              className="mt-1 w-44"
              onChange={(event) => setMonth(event.target.value)}
              type="month"
              value={month}
            />
          </label>
          <Link
            className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            href="/admin/finance/expenses"
          >
            Lançar despesa →
          </Link>
          <Link
            className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            href="/admin/finance/receivables"
          >
            Contas a receber →
          </Link>
        </div>

        {loadStatus === "loading" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                className="h-24 animate-pulse rounded-lg border bg-white"
                key={index}
              />
            ))}
          </div>
        )}

        {loadStatus === "error" && (
          <p
            className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {loadStatus === "ready" && summary && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Kpi
                label="Recebido no mês"
                tone="good"
                value={formatBRL(summary.totalReceived)}
                hint={`Site (Stripe): ${formatBRL(summary.stripeReceived)} · Manual: ${formatBRL(summary.manualReceived)}`}
              />
              <Kpi
                label="A receber (aberto)"
                tone={summary.overdueReceivables > 0 ? "warn" : "default"}
                value={formatBRL(summary.openReceivables)}
                hint={
                  summary.overdueReceivables > 0
                    ? `${formatBRL(summary.overdueReceivables)} vencido`
                    : "nada vencido"
                }
              />
              <Kpi
                label="Despesas pagas no mês"
                tone="bad"
                value={formatBRL(summary.expensesPaid)}
                hint={`A pagar: ${formatBRL(summary.expensesOpen)}`}
              />
              <Kpi
                label="Saldo do mês"
                tone={summary.balance >= 0 ? "good" : "bad"}
                value={formatBRL(summary.balance)}
                hint="recebido − despesas pagas"
              />
            </section>

            <section className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">
                  Margem por saída ({summary.departures.length})
                </h2>
                {summary.departures.length > 0 && (
                  <Button
                    onClick={exportDepartures}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Exportar CSV
                  </Button>
                )}
              </div>
              {summary.departures.length === 0 ? (
                <Card className="mt-3 p-6 text-sm text-gray-500">
                  Nenhuma saída começando neste mês.
                </Card>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-lg border bg-white shadow-sm">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Saída</th>
                        <th className="px-4 py-3">Período</th>
                        <th className="px-4 py-3">Pax</th>
                        <th className="px-4 py-3">Receita</th>
                        <th className="px-4 py-3">Despesas</th>
                        <th className="px-4 py-3">Margem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {summary.departures.map((departure) => (
                        <tr key={departure.productDateId}>
                          <td className="px-4 py-3 font-medium">
                            <Link
                              className="hover:text-orange-600"
                              href={`/admin/departures/${departure.productDateId}`}
                            >
                              {departure.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            {formatDateRangeBR(
                              departure.period.start,
                              departure.period.end
                            )}
                          </td>
                          <td className="px-4 py-3">{departure.pax}</td>
                          <td className="px-4 py-3 text-green-700">
                            {formatBRL(departure.revenue)}
                          </td>
                          <td className="px-4 py-3 text-red-600">
                            {formatBRL(departure.expenses)}
                          </td>
                          <td
                            className={`px-4 py-3 font-semibold ${
                              departure.margin >= 0
                                ? "text-green-700"
                                : "text-red-600"
                            }`}
                          >
                            {formatBRL(departure.margin)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Receita = reservas confirmadas da saída · Despesas = lançamentos
                vinculados à saída no mês. Lance despesas em Financeiro →
                Despesas para a margem ficar real.
              </p>
            </section>
          </>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminFinance;
