import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import PageBuilder from "../../../components/admin/builder/PageBuilder";
import { getAdminPage } from "../../../lib/content/client";
import type { Page } from "../../../lib/content/types";

const EditPage = () => {
  const router = useRouter();
  const [page, setPage] = useState<Page | null | undefined>();

  useEffect(() => {
    if (router.query.id) {
      getAdminPage(String(router.query.id))
        .then(setPage)
        .catch(() => setPage(null));
    }
  }, [router.query.id]);

  return (
    <AdminGuard>
      {page === undefined ? (
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
          <p className="text-sm text-gray-500">Carregando página…</p>
        </div>
      ) : page ? (
        <PageBuilder key={page.id} page={page} />
      ) : (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
          <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
            <p className="font-semibold">Página não encontrada.</p>
            <Link
              className="mt-3 inline-block font-semibold text-orange-600 hover:text-orange-700"
              href="/admin/pages"
            >
              Voltar para páginas
            </Link>
          </div>
        </div>
      )}
    </AdminGuard>
  );
};

export default EditPage;
