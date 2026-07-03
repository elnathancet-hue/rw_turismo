import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import {
  deleteAdminProductDate,
  listAdminProductDates,
  type ProductDateWithProduct,
} from "../../../lib/admin/client";

const AdminProductDates = () => {
  const [dates, setDates] = useState<ProductDateWithProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAdminProductDates()
      .then(setDates)
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nao foi possivel carregar datas."
        )
      );
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remover esta data?")) return;

    await deleteAdminProductDate(id);
    setDates((current) => current.filter((item) => item.id !== id));
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
        title="Datas disponiveis"
        description="Configure disponibilidade e preco por produto."
      >
        {error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3">Vagas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dates.map((date) => (
                <tr key={date.id}>
                  <td className="px-4 py-3 font-medium">
                    {date.products?.title ?? date.product_id}
                  </td>
                  <td className="px-4 py-3">
                    {date.start_date} ate {date.end_date}
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
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminProductDates;
