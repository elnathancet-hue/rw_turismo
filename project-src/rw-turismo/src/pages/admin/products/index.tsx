import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import { deleteAdminProduct, searchAdminProducts } from "../../../lib/admin/client";
import type { Product } from "../../../lib/products/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const PAGE_SIZE = 25;

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      const result = await searchAdminProducts({ page, limit: PAGE_SIZE });
      setProducts(result.items);
      setCount(result.count);
      setLoadStatus("ready");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar os produtos."
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remover este produto?")) return;

    await deleteAdminProduct(id);
    await loadProducts();
  };

  return (
    <AdminGuard>
      <AdminLayout
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="rounded border border-orange-500 px-4 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50"
              href="/admin/home"
              title="Escolha quais viagens aparecem na página inicial"
            >
              Exibir viagens na Home
            </Link>
            <Link
              className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              href="/admin/products/new"
            >
              Novo produto
            </Link>
          </div>
        }
        title="Produtos"
        description="Cadastre as viagens aqui. Para montar as vitrines da página inicial, use “Exibir viagens na Home”."
      >
        <AdminListState
          emptyHint="Cadastre o primeiro pacote para aparecer na vitrine."
          emptyTitle="Nenhum produto cadastrado ainda"
          error={error}
          isEmpty={products.length === 0}
          onRetry={loadProducts}
          status={loadStatus}
        >
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Destino</th>
                  <th className="px-4 py-3">Preço</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-3 font-medium">{product.title}</td>
                    <td className="px-4 py-3">{product.destination}</td>
                    <td className="px-4 py-3">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-4 py-3">
                      {product.active ? "Ativo" : "Inativo"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="font-semibold text-orange-600 hover:text-orange-700"
                        href={`/admin/products/${product.id}`}
                      >
                        Editar
                      </Link>
                      <button
                        className="ml-4 font-semibold text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(product.id)}
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
              {count === 1 ? "produto" : "produtos"}
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

export default AdminProducts;
