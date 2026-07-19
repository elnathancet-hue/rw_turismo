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
import { useSlugStatus } from "../../../hooks/useSlugStatus";
import { isUniqueViolation } from "../../../lib/admin/slugs";

const Tags = () => {
  const [items, setItems] = useState<BlogTag[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const slugStatus = useSlugStatus("blog_tags", slug);

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
    setSaveError(null);
    try {
      await saveAdminBlogTag({ name, slug });
      setName("");
      setSlug("");
      await load();
    } catch (caught) {
      setSaveError(
        isUniqueViolation(caught)
          ? "Este slug já está em uso. Escolha outro."
          : "Não foi possível salvar a tag."
      );
    }
  };

  return (
    <AdminGuard>
      <AdminLayout title="Tags do blog">
        <form className="mb-6 max-w-2xl" onSubmit={submit}>
          <div className="flex flex-wrap items-center gap-3">
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
            <Button disabled={slugStatus === "taken"} type="submit">
              Adicionar
            </Button>
          </div>
          {slugStatus === "taken" && (
            <p className="mt-2 text-xs text-red-600">
              Este slug já está em uso.
            </p>
          )}
          {slugStatus === "available" && (
            <p className="mt-2 text-xs text-gray-500">Slug disponível ✓</p>
          )}
          {saveError && (
            <p className="mt-2 text-xs text-red-600">{saveError}</p>
          )}
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
