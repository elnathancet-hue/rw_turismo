import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import {
  deleteAdminProductDate,
  searchAdminProductDates,
  type ProductDateWithProduct,
} from "../../../lib/admin/client";

const PAGE_SIZE = 25;

const AdminProductDates = () => {
  const [dates, setDates] = useState<ProductDateWithProduct[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const loadDates = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      const result = await searchAdminProductDates({ page, limit: PAGE_SIZE });
      setDates(result.items);
      setCount(result.count);
      setLoadStatus("ready");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar as datas."
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    loadDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remover esta data?")) return;

    await deleteAdminProductDate(id);
    await loadDates();
  };

  return (
    <AdminGuard>
      <AdminLayout
        action={
          <Link
            className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            href="/admin/product-dates/new"
          >
            Nova data
          </Link>
        }
        title="Datas de saída"
        description="Cada data é uma turma do produto, com suas próprias vagas e preço. O cliente reserva sempre numa data — e no dia da viagem você a opera em Operação → Saídas."
      >
        <AdminListState
          emptyHint="Cadastre uma janela de datas para permitir reservas."
          emptyTitle="Nenhuma data cadastrada ainda"
          error={error}
          isEmpty={dates.length === 0}
          onRetry={loadDates}
          status={loadStatus}
        >
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Vagas</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dates.map((date) => (
                  <tr key={date.id}>
                    <td className="px-4 py-3 font-medium">
                      {date.products?.title ?? date.product_id}
                    </td>
                    <td className="px-4 py-3">
                      {date.start_date} até {date.end_date}
                    </td>
                    <td className="px-4 py-3">{date.available_slots}</td>
                    <td className="px-4 py-3">
                      {date.active ? "Ativa" : "Inativa"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="font-semibold text-orange-600 hover:text-orange-700"
                        href={`/admin/product-dates/${date.id}`}
                      >
                        Editar
                      </Link>
                      <button
                        className="ml-4 font-semibold text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(date.id)}
                        type="button"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Página {page} de {totalPages} · {count}{" "}
              {count === 1 ? "data" : "datas"}
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

export default AdminProductDates;
