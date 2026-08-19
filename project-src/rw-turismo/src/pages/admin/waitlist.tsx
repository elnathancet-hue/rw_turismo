import { useCallback, useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminListState from "../../components/admin/AdminListState";
import ConfirmButton from "../../components/admin/ConfirmButton";
import { Select } from "../../components/ui/form";
import {
  deleteAdminWaitlist,
  searchAdminWaitlist,
  updateAdminWaitlistStatus,
  type WaitlistEntry,
  type WaitlistStatus,
} from "../../lib/admin/client";
import { formatDateRangeBR, formatDateTimeBR } from "../../lib/format";

// As colunas SÃO os status — por isso não existe mais filtro de status na tela:
// o quadro mostra os quatro de uma vez.
const COLUMNS: { status: WaitlistStatus; label: string; header: string }[] = [
  {
    status: "pending",
    label: "Aguardando",
    header: "bg-amber-50 text-amber-800",
  },
  {
    status: "contacted",
    label: "Contatado",
    header: "bg-blue-50 text-blue-800",
  },
  {
    status: "converted",
    label: "Convertido",
    header: "bg-green-50 text-green-800",
  },
  {
    status: "cancelled",
    label: "Cancelado",
    header: "bg-gray-100 text-gray-600",
  },
];

const STATUS_LABEL: Record<WaitlistStatus, string> = {
  pending: "Aguardando",
  contacted: "Contatado",
  converted: "Convertido",
  cancelled: "Cancelado",
};

// Cada coluna é uma consulta com teto próprio. Carregar a tabela inteira de uma
// vez bateria no max_rows do PostgREST (1000 por padrão) e truncaria o quadro
// em silêncio — com os contadores mentindo junto, porque viriam do array
// truncado em vez do banco.
const COLUMN_PAGE = 25;

type ColumnData = { items: WaitlistEntry[]; count: number };

const emptyColumn: ColumnData = { items: [], count: 0 };

const toWhatsAppLink = (phone: string | null): string | null => {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
};

const AdminWaitlist = () => {
  const [data, setData] = useState<Record<WaitlistStatus, ColumnData>>({
    pending: emptyColumn,
    contacted: emptyColumn,
    converted: emptyColumn,
    cancelled: emptyColumn,
  });
  const [limits, setLimits] = useState<Record<WaitlistStatus, number>>({
    pending: COLUMN_PAGE,
    contacted: COLUMN_PAGE,
    converted: COLUMN_PAGE,
    cancelled: COLUMN_PAGE,
  });
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<WaitlistStatus | null>(null);
  // Cartões com uma alteração em voo. Sem isto, dois cliques rápidos disparam
  // dois UPDATEs concorrentes cuja ordem de chegada no Postgres não é garantida.
  const [movingIds, setMovingIds] = useState<string[]>([]);

  const loadColumn = useCallback(
    async (status: WaitlistStatus, limit: number) => {
      const result = await searchAdminWaitlist({ status, page: 1, limit });
      setData((current) => ({
        ...current,
        [status]: { items: result.items, count: result.count },
      }));
    },
    []
  );

  // Carga inicial (e o "tentar de novo"): as quatro colunas no teto padrão.
  // NÃO depende de `limits` de propósito — se dependesse, aumentar o teto de
  // uma coluna recriaria esta função, o efeito abaixo rodaria de novo e o
  // AdminListState trocaria o quadro INTEIRO pelo esqueleto só porque alguém
  // pediu mais 25 registros numa coluna.
  const loadAll = useCallback(async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      await Promise.all(
        COLUMNS.map((column) => loadColumn(column.status, COLUMN_PAGE))
      );
      setLimits({
        pending: COLUMN_PAGE,
        contacted: COLUMN_PAGE,
        converted: COLUMN_PAGE,
        cancelled: COLUMN_PAGE,
      });
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar a lista de espera. A migration da Fase 1 já rodou?"
      );
      setLoadStatus("error");
    }
  }, [loadColumn]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Busca só a coluna pedida, sem mexer no loadStatus: o resto do quadro
  // continua na tela enquanto esta coluna cresce.
  const showMore = async (status: WaitlistStatus) => {
    const next = limits[status] + COLUMN_PAGE;
    setLimits((current) => ({ ...current, [status]: next }));
    try {
      await loadColumn(status, next);
    } catch {
      setError("Não foi possível carregar mais registros desta coluna.");
    }
  };

  // Move com feedback imediato, mas SEM adivinhar o estado anterior: ao fim,
  // as duas colunas afetadas são relidas do banco. Reverter para um valor
  // capturado no render é o que fazia um movimento que falhou apagar outro que
  // tinha dado certo.
  const moveEntry = async (entry: WaitlistEntry, status: WaitlistStatus) => {
    if (entry.status === status || movingIds.includes(entry.id)) return;
    const from = entry.status;
    setError(null);
    setMovingIds((current) => [...current, entry.id]);

    setData((current) => ({
      ...current,
      [from]: {
        items: current[from].items.filter((item) => item.id !== entry.id),
        count: Math.max(0, current[from].count - 1),
      },
      [status]: {
        items: [{ ...entry, status }, ...current[status].items],
        count: current[status].count + 1,
      },
    }));

    try {
      await updateAdminWaitlistStatus(entry.id, status);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível mover o interessado."
      );
    } finally {
      setMovingIds((current) => current.filter((id) => id !== entry.id));
      // Reconcilia com o banco nos dois casos: no sucesso corrige as contagens,
      // no erro desfaz o movimento otimista com o dado real.
      await Promise.all([
        loadColumn(from, limits[from]).catch(() => {}),
        loadColumn(status, limits[status]).catch(() => {}),
      ]);
    }
  };

  const removeEntry = async (entry: WaitlistEntry) => {
    await deleteAdminWaitlist(entry.id);
    await loadColumn(entry.status, limits[entry.status]);
  };

  const total = COLUMNS.reduce(
    (sum, column) => sum + data[column.status].count,
    0
  );

  return (
    <AdminGuard>
      <AdminLayout
        title="Lista de espera"
        description="Arraste o cartão entre as colunas, ou use o campo “Mover para” — que também funciona no celular."
      >
        {error && loadStatus === "ready" && (
          <p
            className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        <AdminListState
          emptyHint="Quando uma saída lotar, os interessados que entrarem na fila pelo site aparecem aqui."
          emptyTitle="Ninguém na lista de espera"
          error={loadStatus === "error" ? error : null}
          isEmpty={total === 0}
          onRetry={loadAll}
          status={loadStatus}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((column) => {
              const { items, count } = data[column.status];
              const remaining = count - items.length;
              const isOver = overColumn === column.status;

              return (
                <section
                  aria-label={column.label}
                  className="w-72 shrink-0"
                  key={column.status}
                  onDragLeave={() => setOverColumn(null)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (!isOver) setOverColumn(column.status);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setOverColumn(null);
                    const entry = COLUMNS.flatMap(
                      (c) => data[c.status].items
                    ).find((item) => item.id === dragId);
                    if (entry) void moveEntry(entry, column.status);
                    setDragId(null);
                  }}
                >
                  <h2
                    className={`flex items-center justify-between rounded-t-lg border border-b-0 px-3 py-2 ${column.header}`}
                  >
                    <span className="text-sm font-semibold">{column.label}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600">
                      {count}
                    </span>
                  </h2>

                  <div
                    className={`min-h-[300px] space-y-2 rounded-b-lg border p-2 transition ${
                      isOver
                        ? "bg-orange-50 ring-2 ring-inset ring-orange-400"
                        : "bg-gray-100/60"
                    }`}
                  >
                    {items.length === 0 && (
                      <p className="px-1 py-6 text-center text-xs text-gray-400">
                        Solte um cartão aqui
                      </p>
                    )}

                    {items.map((entry) => {
                      const wa = toWhatsAppLink(entry.phone);
                      const isMoving = movingIds.includes(entry.id);
                      return (
                        <article
                          className={`rounded-lg border bg-white p-3 shadow-sm transition ${
                            dragId === entry.id || isMoving
                              ? "opacity-50"
                              : "cursor-grab hover:shadow"
                          }`}
                          draggable={!isMoving}
                          key={entry.id}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverColumn(null);
                          }}
                          onDragStart={() => setDragId(entry.id)}
                        >
                          <p className="truncate text-sm font-semibold">
                            {entry.name}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {entry.email}
                            {entry.phone ? ` · ${entry.phone}` : ""}
                          </p>

                          <p className="mt-2 truncate text-xs text-gray-700">
                            {entry.products?.title ?? entry.product_id}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {entry.product_dates
                              ? formatDateRangeBR(
                                  entry.product_dates.start_date,
                                  entry.product_dates.end_date
                                )
                              : "qualquer data"}{" "}
                            · {entry.travelers_count} pax
                          </p>
                          <p className="mt-1 text-[11px] text-gray-400">
                            entrou em {formatDateTimeBR(entry.created_at)}
                          </p>

                          {wa && (
                            // draggable={false}: sem isto, começar o gesto em
                            // cima do link arrasta o cartão junto e muda o
                            // status sem a pessoa ter pedido.
                            <a
                              className="mt-1 inline-block text-xs font-semibold text-green-700 hover:text-green-800"
                              draggable={false}
                              href={wa}
                              onDragStart={(event) => event.stopPropagation()}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              WhatsApp →
                            </a>
                          )}

                          <div
                            className="mt-2 border-t pt-2"
                            draggable={false}
                            onDragStart={(event) => event.stopPropagation()}
                          >
                            {/* Destino nomeado num único UPDATE. Setas de
                                vizinhança exigiriam passar por "Convertido"
                                para chegar em "Cancelado" — gravando no banco
                                uma conversão que nunca existiu. */}
                            <label className="block text-[11px] font-medium text-gray-500">
                              Mover para
                              <Select
                                aria-label={`Mover ${entry.name} para outra coluna`}
                                className="mt-0.5 py-2 text-xs"
                                disabled={isMoving}
                                onChange={(event) => {
                                  const next = event.target
                                    .value as WaitlistStatus;
                                  if (next !== entry.status) {
                                    void moveEntry(entry, next);
                                  }
                                }}
                                value={entry.status}
                              >
                                {COLUMNS.map((option) => (
                                  <option
                                    key={option.status}
                                    value={option.status}
                                  >
                                    {STATUS_LABEL[option.status]}
                                  </option>
                                ))}
                              </Select>
                            </label>

                            <div className="mt-2 text-right">
                              <ConfirmButton
                                className="text-xs font-semibold text-red-600 hover:text-red-700"
                                confirmLabel="Excluir"
                                message={`Excluir "${entry.name}" da lista de espera?`}
                                onConfirm={() => removeEntry(entry)}
                                title="Confirmar exclusão"
                              >
                                Excluir
                              </ConfirmButton>
                            </div>
                          </div>
                        </article>
                      );
                    })}

                    {remaining > 0 && (
                      // Botão de verdade: como texto, os registros além do teto
                      // ficavam inalcançáveis — sem filtro, sem paginação e sem
                      // como desfazer um arrasto errado.
                      <button
                        className="w-full rounded border border-dashed py-2 text-xs font-semibold text-gray-600 hover:bg-white"
                        onClick={() => void showMore(column.status)}
                        type="button"
                      >
                        Mostrar mais {Math.min(remaining, COLUMN_PAGE)} de{" "}
                        {remaining}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminWaitlist;
