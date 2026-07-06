import { useRouter } from "next/router";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import PageForm from "../../../components/admin/PageForm";

const NewPage = () => {
  const router = useRouter();

  return (
    <AdminGuard>
      <AdminLayout title="Nova página">
        <PageForm
          onSaved={(page) => void router.push(`/admin/pages/${page.id}`)}
        />
      </AdminLayout>
    </AdminGuard>
  );
};

export default NewPage;
