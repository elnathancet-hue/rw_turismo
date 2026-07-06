import { FormEvent, useState } from "react";
import { saveAdminPage } from "../../lib/content/client";
import type { Page } from "../../lib/content/types";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { Field, Input, Select } from "../ui/form";
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
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const set = <K extends keyof Page>(key: K, val: Page[K]) =>
    setValue((current) => ({ ...current, [key]: val }));

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
            Monte a página empilhando blocos. Arraste a ordem com as setas.
          </p>
          <div className="mt-3">
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
        <Button className="w-fit" loading={isSaving} type="submit">
          {isSaving ? "Salvando…" : "Salvar página"}
        </Button>
      </form>
    </Card>
  );
};

export default PageForm;
