import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminListState from "../../components/admin/AdminListState";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/form";
import {
  listAdminSystemLogs,
  type AdminSystemLogRow,
} from "../../lib/admin/client";
import { formatDateTimeBR } from "../../lib/format";

const PAGE_SIZE = 25;

const ENTITIES = ["all", "bookings", "payment", "product", "lead", "coupons"];

const AdminLogs = () => {
  const [logs, setLogs] = useState<AdminSystemLogRow[]>([]);
  const [count, setCount] = useState(0);
  const [entity, setEntity] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  const load = () => {
    setLoadStatus("loading");
    setError(null);
    listAdminSystemLogs({
      search: appliedSearch,
      entity,
      dateFrom,
      dateTo,
      page,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        setLogs(result.logs);
        setCount(result.count);
        setLoadStatus("ready");
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os logs."
        );
        setLoadStatus("error");
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, dateFrom, dateTo, appliedSearch, page]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput);
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <AdminGuard>
      <AdminLayout
        title="Logs do sistema"
        description="Auditoria de ações operacionais — pagamentos manuais, cancelamentos, remarcações e eventos de pagamento."
      >
        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 shadow-sm"
          onSubmit={submitSearch}
        >
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-600">Entidade</span>
            <Select
              className="mt-0 w-40"
              onChange={(event) => {
                setPage(1);
                setEntity(event.target.value);
              }}
              value={entity}
            >
              {ENTITIES.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "Todas" : item}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-600">De</span>
            <Input
              className="mt-0"
              onChange={(event) => {
                setPage(1);
                setDateFrom(event.target.value);
              }}
              type="date"
              value={dateFrom}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-600">Até</span>
            <Input
              className="mt-0"
              onChange={(event) => {
                setPage(1);
                setDateTo(event.target.value);
              }}
              type="date"
              value={dateTo}
            />
          </label>
          <label className="min-w-[220px] flex-1 text-sm">
            <span className="mb-1 block font-medium text-gray-600">Buscar</span>
            <Input
              className="mt-0"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Ação ou entidade…"
              type="search"
              value={searchInput}
            />
          </label>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>

        <AdminListState
          emptyTitle="Nenhum log encontrado"
          error={error}
          isEmpty={logs.length === 0}
          onRetry={load}
          status={loadStatus}
        >
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Ação</th>
                  <th className="px-4 py-3">Entidade</th>
                  <th className="px-4 py-3">Autor</th>
                  <th className="px-4 py-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {formatDateTimeBR(log.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">{log.action}</td>
                    <td className="px-4 py-3">
                      {log.entity}
                      {log.entity_id && (
                        <span className="ml-1 font-mono text-xs text-gray-400">
                          {log.entity_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.author_name ?? (
                        <span className="text-gray-400">sistema</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <details>
                          <summary className="cursor-pointer text-orange-600">
                            ver
                          </summary>
                          <pre className="mt-2 max-w-md overflow-x-auto rounded bg-gray-50 p-2 text-xs">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Página {page} de {totalPages} · {count}{" "}
              {count === 1 ? "registro" : "registros"}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                size="sm"
                type="button"
                variant="secondary"
              >
                ‹ Anterior
              </Button>
              <Button
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                size="sm"
                type="button"
                variant="secondary"
              >
                Próxima ›
              </Button>
            </div>
          </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminLogs;
