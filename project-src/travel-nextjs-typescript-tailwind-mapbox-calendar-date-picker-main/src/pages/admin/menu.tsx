import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/form";
import { invalidateSiteMenu } from "../../hooks/useSiteMenu";
import { listAdminPages } from "../../lib/content/client";
import {
  getSiteMenu,
  menuItemId,
  saveSiteMenu,
  type MenuItem,
} from "../../lib/content/menu";
import type { Page } from "../../lib/content/types";

const AdminMenu = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      getSiteMenu().catch(() => ({ items: [] as MenuItem[] })),
      listAdminPages().catch(() => [] as Page[]),
    ])
      .then(([menu, adminPages]) => {
        setItems(menu.items);
        setPages(adminPages.filter((page) => page.status === "published"));
      })
      .finally(() => setStatus("ready"));
  }, []);

  // Published pages that are not in the menu yet (linked items are tracked
  // by page_id, so renaming the label/URL doesn't re-offer the page).
  const availablePages = pages.filter(
    (page) => !items.some((item) => item.page_id === page.id)
  );

  const setItem = (index: number, patch: Partial<MenuItem>) =>
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const moveItem = (index: number, direction: -1 | 1) =>
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const current = next[index];
      next[index] = next[target];
      next[target] = current;
      return next;
    });

  const addCustomLink = () =>
    setItems((prev) => [
      ...prev,
      { id: menuItemId(), label: "", url: "", page_id: null },
    ]);

  const addPage = (pageId: string) => {
    if (!pageId) return;
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    setItems((prev) => [
      ...prev,
      {
        id: menuItemId(),
        label: page.title,
        url: `/paginas/${page.slug}`,
        page_id: page.id,
      },
    ]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);
    try {
      const saved = await saveSiteMenu({ items });
      setItems(saved.items);
      invalidateSiteMenu();
      setMessage({ tone: "ok", text: "Menu salvo com sucesso." });
    } catch {
      setMessage({ tone: "error", text: "Não foi possível salvar o menu." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminGuard>
      <AdminLayout
        description="Os links aparecem no topo do site e no menu mobile."
        title="Menu do site"
      >
        {status === "loading" ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : (
          <form className="space-y-6" onSubmit={submit}>
            <Card className="space-y-3 p-5">
              {items.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhum link no menu ainda. Adicione um link ou uma página
                  publicada.
                </p>
              ) : (
                items.map((item, index) => (
                  <div className="flex flex-wrap items-end gap-2" key={item.id}>
                    <div className="min-w-[10rem] flex-1">
                      <Field label="Rótulo">
                        <Input
                          onChange={(e) =>
                            setItem(index, { label: e.target.value })
                          }
                          value={item.label}
                        />
                      </Field>
                    </div>
                    <div className="min-w-[14rem] flex-[2]">
                      <Field label="Link (URL)">
                        <Input
                          onChange={(e) =>
                            setItem(index, { url: e.target.value })
                          }
                          placeholder="/pagina ou https://..."
                          value={item.url}
                        />
                      </Field>
                    </div>
                    {item.page_id && (
                      <span className="mb-2.5 shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                        Página
                      </span>
                    )}
                    <div className="flex shrink-0 gap-1">
                      <Button
                        aria-label="Mover para cima"
                        disabled={index === 0}
                        onClick={() => moveItem(index, -1)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        ↑
                      </Button>
                      <Button
                        aria-label="Mover para baixo"
                        disabled={index === items.length - 1}
                        onClick={() => moveItem(index, 1)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        ↓
                      </Button>
                      <Button
                        aria-label="Remover link"
                        onClick={() => removeItem(index)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </Card>

            <div className="flex flex-wrap items-end gap-3">
              <Button onClick={addCustomLink} type="button" variant="secondary">
                + Adicionar link
              </Button>
              <div className="w-full max-w-xs">
                <Field label="+ Adicionar página">
                  <Select
                    disabled={availablePages.length === 0}
                    onChange={(e) => addPage(e.target.value)}
                    value=""
                  >
                    <option value="">
                      {availablePages.length
                        ? "Escolha uma página publicada…"
                        : "Nenhuma página publicada disponível"}
                    </option>
                    {availablePages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            {message && (
              <p
                className={`text-sm ${
                  message.tone === "ok" ? "text-green-700" : "text-red-600"
                }`}
                role="alert"
              >
                {message.text}
              </p>
            )}

            <Button loading={isSaving} type="submit">
              {isSaving ? "Salvando…" : "Salvar menu"}
            </Button>
          </form>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminMenu;
