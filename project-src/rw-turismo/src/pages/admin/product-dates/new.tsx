import { useRouter } from "next/router";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import ProductDateForm from "../../../components/admin/ProductDateForm";
import {
  createAdminProductDate,
  type ProductDateFormValues,
} from "../../../lib/admin/client";

const NewProductDate = () => {
  const router = useRouter();

  const handleSubmit = async (values: ProductDateFormValues) => {
    const productDate = await createAdminProductDate(values);
    router.push(`/admin/product-dates/${productDate.id}`);
  };

  return (
    <AdminGuard>
      <AdminLayout title="Nova data" description="Cadastre uma janela de venda.">
        <ProductDateForm onSubmit={handleSubmit} submitLabel="Criar data" />
      </AdminLayout>
    </AdminGuard>
  );
};

export default NewProductDate;
