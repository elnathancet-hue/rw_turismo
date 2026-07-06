import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import PageForm from "../../../components/admin/PageForm";
import { getAdminPage } from "../../../lib/content/client";
import type { Page } from "../../../lib/content/types";

const EditPage = () => {
  const router = useRouter();
  const [page, setPage] = useState<Page | null | undefined>();

  useEffect(() => {
    if (router.query.id) {
      void getAdminPage(String(router.query.id)).then(setPage);
    }
  }, [router.query.id]);

  return (
    <AdminGuard>
      <AdminLayout title="Editar página">
        {page === undefined ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : page ? (
          <PageForm onSaved={setPage} page={page} />
        ) : (
          <p className="text-sm text-gray-500">Página não encontrada.</p>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default EditPage;
