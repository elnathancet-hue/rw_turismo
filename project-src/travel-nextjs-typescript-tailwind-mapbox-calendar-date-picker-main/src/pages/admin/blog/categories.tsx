import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import ConfirmButton from "../../../components/admin/ConfirmButton";
import Button from "../../../components/ui/Button";
import {
  deleteAdminBlogCategory,
  listAdminBlogCategories,
  saveAdminBlogCategory,
} from "../../../lib/content/client";
import type { BlogCategory } from "../../../lib/content/types";

const Categories = () => {
  const [items, setItems] = useState<BlogCategory[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      setItems(await listAdminBlogCategories());
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar as categorias."
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await saveAdminBlogCategory({ name, slug, active: true });
    setName("");
    setSlug("");
    await load();
  };

  return (
    <AdminGuard>
      <AdminLayout title="Categorias do blog">
        <form
          className="mb-6 flex max-w-2xl flex-wrap items-center gap-3"
          onSubmit={submit}
        >
          <input
            aria-label="Nome da categoria"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome"
            required
            value={name}
          />
          <input
            aria-label="Slug da categoria"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
            onChange={(event) => setSlug(event.target.value)}
            placeholder="slug"
            required
            value={slug}
          />
          <Button type="submit">Adicionar</Button>
        </form>
        <AdminListState
          emptyTitle="Nenhuma categoria ainda"
          error={error}
          isEmpty={items.length === 0}
          onRetry={load}
          status={loadStatus}
        >
          <div className="space-y-2">
            {items.map((item) => (
              <div
                className="flex items-center justify-between rounded border bg-white p-4"
                key={item.id}
              >
                <span>
                  {item.name} · {item.slug}
                </span>
                <ConfirmButton
                  confirmLabel="Excluir categoria"
                  message={`Excluir a categoria "${item.name}"? Esta ação não pode ser desfeita.`}
                  onConfirm={() => deleteAdminBlogCategory(item.id)}
                  onDone={load}
                >
                  Excluir
                </ConfirmButton>
              </div>
            ))}
          </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default Categories;
