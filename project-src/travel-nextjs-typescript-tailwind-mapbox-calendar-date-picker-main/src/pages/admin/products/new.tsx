import { useRouter } from "next/router";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import ProductForm from "../../../components/admin/ProductForm";
import { createAdminProduct, type ProductFormValues } from "../../../lib/admin/client";

const NewProduct = () => {
  const router = useRouter();

  const handleSubmit = async (values: ProductFormValues) => {
    const product = await createAdminProduct(values);
    router.push(`/admin/products/${product.id}`);
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Novo produto"
        description="Cadastre uma nova oferta para a vitrine."
      >
        <ProductForm onSubmit={handleSubmit} submitLabel="Criar produto" />
      </AdminLayout>
    </AdminGuard>
  );
};

export default NewProduct;
