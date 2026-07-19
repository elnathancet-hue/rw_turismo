import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import ConfirmButton from "../../../components/admin/ConfirmButton";
import {
  deleteAdminBlogPost,
  listAdminBlogPosts,
} from "../../../lib/content/client";
import type { BlogPost } from "../../../lib/content/types";

const statusLabels: Record<BlogPost["status"], string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

const AdminBlog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      setPosts(await listAdminBlogPosts());
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar os posts."
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
            href="/admin/blog/new"
          >
            Novo post
          </Link>
        }
        description="Gerencie rascunhos e publicações."
        title="Blog"
      >
        <nav className="mb-5 flex gap-4 text-sm font-semibold text-orange-600">
          <Link href="/admin/blog/categories">Categorias</Link>
          <Link href="/admin/blog/tags">Tags</Link>
        </nav>
        <AdminListState
          emptyHint="Crie o primeiro post para o blog."
          emptyTitle="Nenhum post ainda"
          error={error}
          isEmpty={posts.length === 0}
          onRetry={load}
          status={loadStatus}
        >
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-4">Título</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Publicação</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td className="p-4 font-medium">{post.title}</td>
                    <td className="p-4">{statusLabels[post.status]}</td>
                    <td className="p-4">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        className="font-semibold text-orange-600 hover:text-orange-700"
                        href={`/admin/blog/${post.id}`}
                      >
                        Editar
                      </Link>
                      <ConfirmButton
                        className="ml-4 font-semibold text-red-600 hover:text-red-700"
                        confirmLabel="Excluir post"
                        message={`Excluir o post "${post.title}"? Esta ação não pode ser desfeita.`}
                        onConfirm={() => deleteAdminBlogPost(post.id)}
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

export default AdminBlog;
