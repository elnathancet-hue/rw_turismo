import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { Input } from "../../../components/ui/form";
import {
  getFinanceSummaryRange,
  getMonthlyFinanceSeries,
  type FinanceSummary,
  type MonthlyFinancePoint,
} from "../../../lib/admin/finance";
import { downloadCsv } from "../../../lib/csv";
import { formatBRL, formatDateRangeBR } from "../../../lib/format";

const monthStart = () => new Date().toISOString().slice(0, 8) + "01";
const todayIso = () => new Date().toISOString().slice(0, 10);

// dia seguinte a `iso` (fim exclusivo do intervalo).
const dayAfter = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const Delta = ({ current, previous }: { current: number; previous: number }) => {
  const diff = current - previous;
  if (Math.abs(diff) < 0.005) {
    return <span className="text-gray-400">estável vs anterior</span>;
  }
  const up = diff > 0;
  return (
    <span className={up ? "text-green-600" : "text-red-600"}>
      {up ? "▲" : "▼"} {formatBRL(Math.abs(diff))} vs anterior
    </span>
  );
};

const Kpi = ({
  label,
  value,
  tone = "default",
  hint,
  delta,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad" | "warn";
  hint?: string;
  delta?: { current: number; previous: number };
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
    {delta && (
      <p className="mt-0.5 text-xs">
        <Delta current={delta.current} previous={delta.previous} />
      </p>
    )}
    {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
  </Card>
);

const AdminFinance = () => {
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(todayIso);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [previous, setPrevious] = useState<FinanceSummary | null>(null);
  const [series, setSeries] = useState<MonthlyFinancePoint[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    setLoadStatus("loading");
    setError(null);

    const start = dateFrom;
    const endExcl = dayAfter(dateTo);
    // Período anterior de mesmo tamanho, imediatamente antes.
    const lengthMs =
      new Date(`${endExcl}T00:00:00Z`).getTime() -
      new Date(`${start}T00:00:00Z`).getTime();
    const prevStart = new Date(
      new Date(`${start}T00:00:00Z`).getTime() - lengthMs
    )
      .toISOString()
      .slice(0, 10);

    Promise.all([
      getFinanceSummaryRange(start, endExcl),
      getFinanceSummaryRange(prevStart, start),
      getMonthlyFinanceSeries(12),
    ])
      .then(([current, prev, monthly]) => {
        setSummary(current);
        setPrevious(prev);
        setSeries(monthly);
        setLoadStatus("ready");
      })
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar o resumo."
        );
        setLoadStatus("error");
      });
  }, [dateFrom, dateTo]);

  const chartMax = useMemo(
    () =>
      Math.max(
        1,
        ...series.flatMap((point) => [point.received, point.expenses])
      ),
    [series]
  );

  const exportDepartures = () => {
    if (!summary) return;
    downloadCsv(`financeiro-${dateFrom}_a_${dateTo}.csv`, [
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
        description="Fluxo de caixa por período, comparativo e margem real por saída."
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm font-medium text-gray-700">
            De
            <Input
              className="mt-1 w-40"
              onChange={(event) => setDateFrom(event.target.value)}
              type="date"
              value={dateFrom}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Até
            <Input
              className="mt-1 w-40"
              onChange={(event) => setDateTo(event.target.value)}
              type="date"
              value={dateTo}
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
                label="Recebido no período"
                tone="good"
                value={formatBRL(summary.totalReceived)}
                delta={
                  previous
                    ? {
                        current: summary.totalReceived,
                        previous: previous.totalReceived,
                      }
                    : undefined
                }
                hint={`Site: ${formatBRL(summary.stripeReceived)} · Manual: ${formatBRL(summary.manualReceived)}`}
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
                label="Despesas pagas"
                tone="bad"
                value={formatBRL(summary.expensesPaid)}
                delta={
                  previous
                    ? {
                        current: summary.expensesPaid,
                        previous: previous.expensesPaid,
                      }
                    : undefined
                }
                hint={`A pagar: ${formatBRL(summary.expensesOpen)}`}
              />
              <Kpi
                label="Saldo do período"
                tone={summary.balance >= 0 ? "good" : "bad"}
                value={formatBRL(summary.balance)}
                delta={
                  previous
                    ? { current: summary.balance, previous: previous.balance }
                    : undefined
                }
                hint="recebido − despesas pagas"
              />
            </section>

            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Receita × despesa (12 meses)</h2>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-green-500" />
                    Recebido
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-red-400" />
                    Despesas
                  </span>
                </div>
              </div>
              <Card className="mt-3 p-5">
                <div className="flex h-44 items-end gap-2">
                  {series.map((point) => (
                    <div
                      className="flex flex-1 flex-col items-center gap-1"
                      key={point.month}
                    >
                      <div className="flex h-36 w-full items-end justify-center gap-0.5">
                        <div
                          className="w-2.5 rounded-t bg-green-500"
                          style={{
                            height: `${(point.received / chartMax) * 100}%`,
                          }}
                          title={`Recebido: ${formatBRL(point.received)}`}
                        />
                        <div
                          className="w-2.5 rounded-t bg-red-400"
                          style={{
                            height: `${(point.expenses / chartMax) * 100}%`,
                          }}
                          title={`Despesas: ${formatBRL(point.expenses)}`}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {point.month.slice(5)}/{point.month.slice(2, 4)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
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
                  Nenhuma saída começando neste período.
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
            </section>
          </>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminFinance;
