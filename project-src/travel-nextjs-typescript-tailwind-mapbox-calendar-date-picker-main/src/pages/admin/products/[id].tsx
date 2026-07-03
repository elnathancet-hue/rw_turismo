import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import ProductForm from "../../../components/admin/ProductForm";
import {
  getAdminProduct,
  updateAdminProduct,
  type ProductFormValues,
} from "../../../lib/admin/client";
import type { Product } from "../../../lib/products/types";

const EditProduct = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    getAdminProduct(id)
      .then(setProduct)
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nao foi possivel carregar produto."
        )
      );
  }, [id]);

  const handleSubmit = async (values: ProductFormValues) => {
    if (!id) return;

    const updatedProduct = await updateAdminProduct(id, values);
    setProduct(updatedProduct);
  };

  return (
    <AdminGuard>
      <AdminLayout title="Editar produto" description="Atualize dados da oferta.">
        {error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {product ? (
          <ProductForm
            initialProduct={product}
            onSubmit={handleSubmit}
            submitLabel="Salvar alteracoes"
          />
        ) : (
          <p className="text-sm text-gray-500">Carregando produto...</p>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default EditProduct;
