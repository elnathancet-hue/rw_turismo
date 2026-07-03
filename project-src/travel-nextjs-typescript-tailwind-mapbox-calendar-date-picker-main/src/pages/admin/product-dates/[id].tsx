import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import ProductDateForm from "../../../components/admin/ProductDateForm";
import {
  getAdminProductDate,
  updateAdminProductDate,
  type ProductDateFormValues,
} from "../../../lib/admin/client";
import type { ProductDate } from "../../../lib/products/types";

const EditProductDate = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [productDate, setProductDate] = useState<ProductDate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    getAdminProductDate(id)
      .then(setProductDate)
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nao foi possivel carregar data."
        )
      );
  }, [id]);

  const handleSubmit = async (values: ProductDateFormValues) => {
    if (!id) return;

    const updatedDate = await updateAdminProductDate(id, values);
    setProductDate(updatedDate);
  };

  return (
    <AdminGuard>
      <AdminLayout title="Editar data" description="Atualize disponibilidade.">
        {error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {productDate ? (
          <ProductDateForm
            initialDate={productDate}
            onSubmit={handleSubmit}
            submitLabel="Salvar alteracoes"
          />
        ) : (
          <p className="text-sm text-gray-500">Carregando data...</p>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default EditProductDate;
