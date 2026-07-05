import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import ConfirmButton from "../../../components/admin/ConfirmButton";
import Button from "../../../components/ui/Button";
import {
  deleteAdminBlogTag,
  listAdminBlogTags,
  saveAdminBlogTag,
} from "../../../lib/content/client";
import type { BlogTag } from "../../../lib/content/types";

const Tags = () => {
  const [items, setItems] = useState<BlogTag[]>([]);
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
      setItems(await listAdminBlogTags());
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar as tags."
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await saveAdminBlogTag({ name, slug });
    setName("");
    setSlug("");
    await load();
  };

  return (
    <AdminGuard>
      <AdminLayout title="Tags do blog">
        <form
          className="mb-6 flex max-w-2xl flex-wrap items-center gap-3"
          onSubmit={submit}
        >
          <input
            aria-label="Nome da tag"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome"
            required
            value={name}
          />
          <input
            aria-label="Slug da tag"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
            onChange={(event) => setSlug(event.target.value)}
            placeholder="slug"
            required
            value={slug}
          />
          <Button type="submit">Adicionar</Button>
        </form>
        <AdminListState
          emptyTitle="Nenhuma tag ainda"
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
                  confirmLabel="Excluir tag"
                  message={`Excluir a tag "${item.name}"? Esta ação não pode ser desfeita.`}
                  onConfirm={() => deleteAdminBlogTag(item.id)}
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

export default Tags;
