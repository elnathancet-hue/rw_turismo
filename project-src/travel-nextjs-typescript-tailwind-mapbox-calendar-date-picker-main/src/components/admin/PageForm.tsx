import { FormEvent, useState } from "react";
import { saveAdminPage } from "../../lib/content/client";
import type { Page } from "../../lib/content/types";
import MarkdownContent from "../MarkdownContent";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { Field, Input, Select, Textarea } from "../ui/form";

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
      <form className="grid gap-5" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
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

        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            hint="Use # Título, ## Subtítulo, - listas, **negrito**, [texto](/link)."
            label="Conteúdo (Markdown)"
          >
            <Textarea
              className="min-h-[360px] font-mono text-sm"
              onChange={(event) => set("content", event.target.value)}
              value={value.content ?? ""}
            />
          </Field>
          <div className="min-h-[360px] overflow-auto rounded-lg border bg-gray-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Pré-visualização
            </p>
            <MarkdownContent
              className="prose prose-sm max-w-none prose-a:text-orange-600"
              content={value.content ?? ""}
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
