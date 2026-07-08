import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import ConfirmButton from "../../../components/admin/ConfirmButton";
import StatusPill from "../../../components/StatusPill";
import Button from "../../../components/ui/Button";
import { Input } from "../../../components/ui/form";
import {
  deleteAdminPage,
  listAdminPages,
  saveAdminPage,
} from "../../../lib/content/client";
import { getSiteMenu } from "../../../lib/content/menu";
import { formatDateBR } from "../../../lib/format";
import type { Page, PageBlock } from "../../../lib/content/types";

const statusLabels: Record<Page["status"], string> = {
  draft: "Rascunho",
  published: "Publicada",
};

// New block id in the same format used by the page builder.
const blockId = () =>
  `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Blocks are plain JSON, so a JSON round-trip is a safe deep copy. Every
// copied block gets a fresh id so the duplicate never shares ids with the
// original page.
const copyBlocks = (blocks: PageBlock[]): PageBlock[] =>
  (JSON.parse(JSON.stringify(blocks)) as PageBlock[]).map((block) => ({
    ...block,
    id: blockId(),
  }));

// "slug-copia", then "slug-copia-2", "slug-copia-3", ... — unique within the
// loaded list (listAdminPages returns all pages).
const uniqueCopySlug = (slug: string, pages: Page[]): string => {
  const taken = new Set(pages.map((page) => page.slug));
  const base = `${slug}-copia`;
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

const AdminPages = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [menuPageIds, setMenuPageIds] = useState<Set<string>>(
    () => new Set<string>()
  );
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    getSiteMenu()
      .then((menu) => {
        if (cancelled) return;
        setMenuPageIds(
          new Set(
            menu.items.flatMap((item) => (item.page_id ? [item.page_id] : []))
          )
        );
      })
      .catch(() => {
        // Menu unavailable: just skip the "No menu" chip.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDuplicate = async (page: Page) => {
    setDuplicatingId(page.id);
    setDuplicateError(null);
    try {
      const payload: Partial<Page> = {
        title: `${page.title} (cópia)`,
        slug: uniqueCopySlug(page.slug, pages),
        content: page.content,
        status: "draft",
        seo_title: page.seo_title,
        seo_description: page.seo_description,
      };
      if (page.blocks) payload.blocks = copyBlocks(page.blocks);
      await saveAdminPage(payload);
      await load();
    } catch (caught) {
      setDuplicateError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível duplicar a página."
      );
    } finally {
      setDuplicatingId(null);
    }
  };

  const query = search.trim().toLowerCase();
  const filtered = query
    ? pages.filter(
        (page) =>
          page.title.toLowerCase().includes(query) ||
          page.slug.toLowerCase().includes(query)
      )
    : pages;
  const totalLabel = `${pages.length} ${
    pages.length === 1 ? "página" : "páginas"
  }`;

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
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full sm:max-w-xs">
                <Input
                  aria-label="Buscar por título ou endereço"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por título ou endereço…"
                  type="search"
                  value={search}
                />
              </div>
              <p className="text-xs text-gray-500">
                {query ? `${filtered.length} de ${totalLabel}` : totalLabel}
              </p>
            </div>

            {duplicateError && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                role="alert"
              >
                {duplicateError}
              </p>
            )}

            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-4">Título</th>
                    <th className="p-4">Endereço</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Atualizada</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 && (
                    <tr>
                      <td className="p-6 text-center text-gray-500" colSpan={5}>
                        Nenhuma página encontrada para a busca.
                      </td>
                    </tr>
                  )}
                  {filtered.map((page) => (
                    <tr className="hover:bg-gray-50" key={page.id}>
                      <td className="p-4 font-medium">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {page.title}
                          {menuPageIds.has(page.id) && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              No menu
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="p-4">
                        {page.status === "published" ? (
                          <a
                            className="font-mono text-xs text-gray-500 underline-offset-2 hover:text-orange-600 hover:underline"
                            href={`/paginas/${page.slug}`}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            /paginas/{page.slug}
                          </a>
                        ) : (
                          <span className="font-mono text-xs text-gray-400">
                            /paginas/{page.slug}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <StatusPill
                          label={statusLabels[page.status]}
                          tone={
                            page.status === "published" ? "success" : "warning"
                          }
                        />
                      </td>
                      <td className="p-4 text-gray-500">
                        {formatDateBR(page.updated_at)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            className="font-semibold text-orange-600 hover:text-orange-700"
                            href={`/admin/pages/${page.id}`}
                          >
                            Editar
                          </Link>
                          {page.status === "published" && (
                            <a
                              className="font-semibold text-gray-600 hover:text-gray-800"
                              href={`/paginas/${page.slug}`}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              Ver
                            </a>
                          )}
                          <Button
                            disabled={duplicatingId !== null}
                            loading={duplicatingId === page.id}
                            onClick={() => void handleDuplicate(page)}
                            size="sm"
                            variant="ghost"
                          >
                            Duplicar
                          </Button>
                          <ConfirmButton
                            className="font-semibold text-red-600 hover:text-red-700"
                            confirmLabel="Excluir página"
                            message={`Excluir a página "${page.title}"? Esta ação não pode ser desfeita.`}
                            onConfirm={() => deleteAdminPage(page.id)}
                            onDone={load}
                          >
                            Excluir
                          </ConfirmButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminPages;
