import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import ConfirmButton from "../../../components/admin/ConfirmButton";
import { deleteAdminPage, listAdminPages } from "../../../lib/content/client";
import type { Page } from "../../../lib/content/types";

const statusLabels: Record<Page["status"], string> = {
  draft: "Rascunho",
  published: "Publicada",
};

const AdminPages = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      setPages(await listAdminPages());
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar as páginas."
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <AdminGuard>
      <AdminLayout
        action={
          <Link
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            href="/admin/pages/new"
          >
            Nova página
          </Link>
        }
        description="Crie e edite páginas do site (institucionais, legais, etc.)."
        title="Páginas"
      >
        <AdminListState
          emptyHint="Crie a primeira página (ex.: Termos, Sobre nós)."
          emptyTitle="Nenhuma página ainda"
          error={error}
          isEmpty={pages.length === 0}
          onRetry={load}
          status={loadStatus}
        >
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-4">Título</th>
                  <th className="p-4">Endereço</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pages.map((page) => (
                  <tr key={page.id}>
                    <td className="p-4 font-medium">{page.title}</td>
                    <td className="p-4 font-mono text-xs text-gray-500">
                      /paginas/{page.slug}
                    </td>
                    <td className="p-4">{statusLabels[page.status]}</td>
                    <td className="p-4 text-right">
                      <Link
                        className="font-semibold text-orange-600 hover:text-orange-700"
                        href={`/admin/pages/${page.id}`}
                      >
                        Editar
                      </Link>
                      <ConfirmButton
                        className="ml-4 font-semibold text-red-600 hover:text-red-700"
                        confirmLabel="Excluir página"
                        message={`Excluir a página "${page.title}"? Esta ação não pode ser desfeita.`}
                        onConfirm={() => deleteAdminPage(page.id)}
                        onDone={load}
                      >
                        Excluir
                      </ConfirmButton>
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

export default AdminPages;
