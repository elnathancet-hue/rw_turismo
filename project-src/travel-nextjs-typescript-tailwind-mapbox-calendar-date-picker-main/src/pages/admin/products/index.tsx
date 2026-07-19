import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import { deleteAdminProduct, listAdminProducts } from "../../../lib/admin/client";
import type { Product } from "../../../lib/products/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      setProducts(await listAdminProducts());
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
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remover este produto?")) return;

    await deleteAdminProduct(id);
    setProducts((current) => current.filter((product) => product.id !== id));
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
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminProducts;
