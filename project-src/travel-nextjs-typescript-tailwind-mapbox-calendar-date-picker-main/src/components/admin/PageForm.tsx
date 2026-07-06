import { FormEvent, useState } from "react";
import { saveAdminPage } from "../../lib/content/client";
import type { Page } from "../../lib/content/types";
import { pageTemplates, type PageTemplate } from "../../lib/content/page-templates";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { Field, Input, Select } from "../ui/form";
import PageBlocks from "../PageBlocks";
import PageBlocksEditor, { blockId } from "./PageBlocksEditor";

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const PageForm = ({
  page,
  onSaved,
}: {
  page?: Page | null;
  onSaved: (page: Page) => void;
}) => {
  const [value, setValue] = useState<Partial<Page>>({
    title: page?.title ?? "",
    slug: page?.slug ?? "",
    content: page?.content ?? "",
    status: page?.status ?? "draft",
    seo_title: page?.seo_title ?? "",
    seo_description: page?.seo_description ?? "",
    blocks: page?.blocks?.length
      ? page.blocks
      : page?.content
      ? [{ id: blockId(), type: "text" as const, markdown: page.content }]
      : [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const set = <K extends keyof Page>(key: K, val: Page[K]) =>
    setValue((current) => ({ ...current, [key]: val }));

  const applyTemplate = (template: PageTemplate) => {
    if (
      (value.blocks?.length ?? 0) > 0 &&
      !window.confirm(
        `Aplicar o modelo "${template.label}"? Isso substitui os blocos atuais.`
      )
    ) {
      return;
    }
    set("blocks", template.build());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);
    try {
      const saved = await saveAdminPage({ ...value, id: page?.id });
      setMessage({ tone: "ok", text: "Página salva." });
      onSaved(saved);
    } catch {
      setMessage({ tone: "error", text: "Não foi possível salvar a página." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <form className="grid gap-6" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Título">
            <Input
              onChange={(event) => {
                set("title", event.target.value);
                if (!page) set("slug", slugify(event.target.value));
              }}
              required
              value={value.title ?? ""}
            />
          </Field>
          <Field hint="A página fica em /paginas/{slug}." label="Slug">
            <Input
              onChange={(event) => set("slug", slugify(event.target.value))}
              required
              value={value.slug ?? ""}
            />
          </Field>
          <Field label="Status">
            <Select
              onChange={(event) =>
                set("status", event.target.value as Page["status"])
              }
              value={value.status}
            >
              <option value="draft">Rascunho</option>
              <option value="published">Publicada</option>
            </Select>
          </Field>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">Conteúdo da página</p>
          <p className="mt-1 text-xs text-gray-500">
            Comece de um modelo pronto (é só trocar textos e fotos) ou monte do
            zero. Arraste os blocos ou use ↑ ↓ para ordenar.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pageTemplates.map((template) => (
              <button
                className="w-56 rounded-lg border p-3 text-left transition hover:border-orange-500 hover:bg-orange-50"
                key={template.key}
                onClick={() => applyTemplate(template)}
                type="button"
              >
                <span className="block text-sm font-semibold">
                  {template.label}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {template.description}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <PageBlocksEditor
              blocks={value.blocks ?? []}
              onChange={(blocks) => set("blocks", blocks)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            hint="Aparece na aba do navegador e no Google."
            label="Título SEO"
          >
            <Input
              onChange={(event) => set("seo_title", event.target.value)}
              value={value.seo_title ?? ""}
            />
          </Field>
          <Field label="Meta descrição SEO">
            <Input
              onChange={(event) => set("seo_description", event.target.value)}
              value={value.seo_description ?? ""}
            />
          </Field>
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
        <div className="flex flex-wrap gap-3">
          <Button className="w-fit" loading={isSaving} type="submit">
            {isSaving ? "Salvando…" : "Salvar página"}
          </Button>
          <Button
            onClick={() => setShowPreview(true)}
            type="button"
            variant="secondary"
          >
            Pré-visualizar página
          </Button>
        </div>
      </form>

      {showPreview && (
        <div
          className="fixed inset-0 z-[100] flex bg-black/50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-semibold">
                Pré-visualização{value.title ? ` — ${value.title}` : ""}
              </h2>
              <Button
                onClick={() => setShowPreview(false)}
                size="sm"
                variant="secondary"
              >
                Fechar
              </Button>
            </div>
            <div className="overflow-auto px-6 py-8">
              {value.title && (
                <h1 className="text-4xl font-bold">{value.title}</h1>
              )}
              <div className="mt-8">
                <PageBlocks blocks={value.blocks ?? []} />
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default PageForm;
