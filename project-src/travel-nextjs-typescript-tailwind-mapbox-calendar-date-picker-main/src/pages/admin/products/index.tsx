import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import { deleteAdminProduct, listAdminProducts } from "../../../lib/admin/client";
import type { Product } from "../../../lib/products/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      setProducts(await listAdminProducts());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel carregar produtos."
      );
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
          <Link
            className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            href="/admin/products/new"
          >
            Novo produto
          </Link>
        }
        title="Produtos"
        description="Gerencie a vitrine interna do e-commerce de turismo."
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
                <th className="px-4 py-3">Destino</th>
                <th className="px-4 py-3">Preco</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3 font-medium">{product.title}</td>
                  <td className="px-4 py-3">{product.destination}</td>
                  <td className="px-4 py-3">{formatCurrency(product.price)}</td>
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
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminProducts;
