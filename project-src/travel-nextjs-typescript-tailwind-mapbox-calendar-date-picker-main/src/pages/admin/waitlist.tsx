import { useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminListState from "../../components/admin/AdminListState";
import ConfirmButton from "../../components/admin/ConfirmButton";
import StatusPill from "../../components/StatusPill";
import Button from "../../components/ui/Button";
import { Select } from "../../components/ui/form";
import {
  deleteAdminWaitlist,
  searchAdminWaitlist,
  updateAdminWaitlistStatus,
  type WaitlistEntry,
  type WaitlistStatus,
} from "../../lib/admin/client";
import type { StatusTone } from "../../lib/bookings/status";
import { formatDateRangeBR, formatDateTimeBR } from "../../lib/format";

const statusMeta: Record<WaitlistStatus, { label: string; tone: StatusTone }> =
  {
    pending: { label: "Aguardando", tone: "warning" },
    contacted: { label: "Contatado", tone: "info" },
    converted: { label: "Convertido", tone: "success" },
    cancelled: { label: "Cancelado", tone: "neutral" },
  };

const toWhatsAppLink = (phone: string | null): string | null => {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
};

const PAGE_SIZE = 25;

const AdminWaitlist = () => {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<WaitlistStatus | "all">(
    "pending"
  );
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      const result = await searchAdminWaitlist({
        status: statusFilter,
        page,
        limit: PAGE_SIZE,
      });
      setEntries(result.items);
      setCount(result.count);
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar a lista de espera. A migration da Fase 1 já rodou?"
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const setStatus = async (entry: WaitlistEntry, status: WaitlistStatus) => {
    setSavingId(entry.id);
    try {
      await updateAdminWaitlistStatus(entry.id, status);
      await load();
    } catch {
      setError("Não foi possível atualizar o status.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Lista de espera"
        description="Interessados em saídas lotadas — avise quando abrir vaga e converta em reserva."
      >
        <label className="mb-4 block w-fit text-sm font-medium text-gray-700">
          Status
          <Select
            className="mt-1 w-44"
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value as WaitlistStatus | "all");
            }}
            value={statusFilter}
          >
            <option value="all">Todos</option>
            {(Object.keys(statusMeta) as WaitlistStatus[]).map((status) => (
              <option key={status} value={status}>
                {statusMeta[status].label}
              </option>
            ))}
          </Select>
        </label>

        <AdminListState
          emptyHint="Quando uma saída lotar, os interessados que entrarem na fila pelo site aparecem aqui."
          emptyTitle="Ninguém na lista de espera"
          error={error}
          isEmpty={entries.length === 0}
          onRetry={load}
          status={loadStatus}
        >
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Entrou em</th>
                  <th className="px-4 py-3">Interessado</th>
                  <th className="px-4 py-3">Viagem</th>
                  <th className="px-4 py-3">Pax</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry) => {
                  const meta = statusMeta[entry.status];
                  const wa = toWhatsAppLink(entry.phone);
                  return (
                    <tr className="hover:bg-gray-50" key={entry.id}>
                      <td className="px-4 py-3">
                        {formatDateTimeBR(entry.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{entry.name}</p>
                        <p className="text-xs text-gray-500">
                          {entry.email}
                          {entry.phone ? ` · ${entry.phone}` : ""}
                        </p>
                        {wa && (
                          <a
                            className="text-xs font-semibold text-green-700 hover:text-green-800"
                            href={wa}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            WhatsApp →
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p>{entry.products?.title ?? entry.product_id}</p>
                        <p className="text-xs text-gray-500">
                          {entry.product_dates
                            ? formatDateRangeBR(
                                entry.product_dates.start_date,
                                entry.product_dates.end_date
                              )
                            : "qualquer data"}
                        </p>
                      </td>
                      <td className="px-4 py-3">{entry.travelers_count}</td>
                      <td className="px-4 py-3">
                        <StatusPill label={meta.label} tone={meta.tone} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {entry.status === "pending" && (
                            <Button
                              loading={savingId === entry.id}
                              onClick={() => setStatus(entry, "contacted")}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              Marcar contatado
                            </Button>
                          )}
                          {entry.status !== "converted" &&
                            entry.status !== "cancelled" && (
                              <Button
                                loading={savingId === entry.id}
                                onClick={() => setStatus(entry, "converted")}
                                size="sm"
                                type="button"
                              >
                                Convertido
                              </Button>
                            )}
                          {entry.status !== "cancelled" && (
                            <Button
                              loading={savingId === entry.id}
                              onClick={() => setStatus(entry, "cancelled")}
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
                            message={`Excluir "${entry.name}" da lista de espera?`}
                            onConfirm={() => deleteAdminWaitlist(entry.id)}
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Página {page} de {totalPages} · {count}{" "}
              {count === 1 ? "interessado" : "interessados"}
            </p>
            <div className="flex gap-2">
              <button
                className="rounded border px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                type="button"
              >
                ‹ Anterior
              </button>
              <button
                className="rounded border px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Próxima ›
              </button>
            </div>
          </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminWaitlist;
