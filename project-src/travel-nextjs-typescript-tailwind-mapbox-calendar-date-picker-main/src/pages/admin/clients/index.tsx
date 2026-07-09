import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import Button from "../../../components/ui/Button";
import { Input } from "../../../components/ui/form";
import {
  getClientBookingCounts,
  searchAdminClients,
  type AdminClient,
} from "../../../lib/admin/client";
import { formatDateBR } from "../../../lib/format";

const PAGE_SIZE = 25;

const AdminClients = () => {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [count, setCount] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoadStatus("loading");
    setError(null);
    Promise.all([
      searchAdminClients({ search: appliedSearch, page, limit: PAGE_SIZE }),
      getClientBookingCounts(),
    ])
      .then(([result, bookingCounts]) => {
        setClients(result.clients);
        setCount(result.count);
        setCounts(bookingCounts);
        setLoadStatus("ready");
      })
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar os clientes."
        );
        setLoadStatus("error");
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, page]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput);
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <AdminGuard>
      <AdminLayout
        title="Clientes"
        description="Base de clientes: contato, nascimento, documento e histórico de viagens."
      >
        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 shadow-sm"
          onSubmit={submitSearch}
        >
          <label className="min-w-[240px] flex-1 text-sm">
            <span className="mb-1 block font-medium text-gray-600">
              Buscar cliente
            </span>
            <Input
              className="mt-0"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nome ou e-mail…"
              type="search"
              value={searchInput}
            />
          </label>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>

        <AdminListState
          emptyHint="Os clientes aparecem aqui quando criam conta no site."
          emptyTitle="Nenhum cliente encontrado"
          error={error}
          isEmpty={clients.length === 0}
          onRetry={load}
          status={loadStatus}
        >
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">Nascimento</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Viagens</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map((client) => (
                  <tr className="hover:bg-gray-50" key={client.id}>
                    <td className="px-4 py-3 font-medium">
                      {client.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p>{client.email || "—"}</p>
                      <p className="text-xs text-gray-500">
                        {client.phone || "sem telefone"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {client.birth_date
                        ? formatDateBR(client.birth_date)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{client.document || "—"}</td>
                    <td className="px-4 py-3 font-semibold">
                      {counts[client.user_id] ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="font-semibold text-orange-600 hover:text-orange-700"
                        href={`/admin/clients/${client.id}`}
                      >
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Página {page} de {totalPages} · {count}{" "}
              {count === 1 ? "cliente" : "clientes"}
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

export default AdminClients;
