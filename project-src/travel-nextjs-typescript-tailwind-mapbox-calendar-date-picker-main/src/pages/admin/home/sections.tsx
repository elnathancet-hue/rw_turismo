import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import ConfirmButton from "../../../components/admin/ConfirmButton";
import Button from "../../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../../components/ui/form";
import {
  deleteAdminHomeSection,
  listAdminHomeSections,
  saveAdminHomeSection,
} from "../../../lib/content/client";
import type { HomeSection } from "../../../lib/content/types";

const sectionKeys = [
  "featured_products",
  "destinations",
  "categories",
  "promotional_banner",
  "benefits",
  "testimonials",
  "latest_blog_posts",
  "newsletter",
  "custom_content",
];

const empty: Partial<HomeSection> & { section_key: string } = {
  section_key: "featured_products",
  title: "",
  subtitle: "",
  content: {},
  active: true,
  display_order: 0,
};

const AdminSections = () => {
  const [items, setItems] = useState<HomeSection[]>([]);
  const [value, setValue] = useState(empty);
  const [json, setJson] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setLoadError(null);
    try {
      setItems(await listAdminHomeSections());
      setLoadStatus("ready");
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar as seções."
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await saveAdminHomeSection({ ...value, content: JSON.parse(json) });
      setValue(empty);
      setJson("{}");
      await load();
    } catch {
      setError("Confira o JSON e os campos informados.");
    }
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Seções da home"
        description="Use tipos predefinidos e conteúdo JSON estruturado."
      >
        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <form
            className="space-y-4 rounded-xl border bg-white p-5"
            onSubmit={submit}
          >
            <Field label="Tipo">
              <Select
                onChange={(event) =>
                  setValue({ ...value, section_key: event.target.value })
                }
                value={value.section_key}
              >
                {sectionKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Título">
              <Input
                onChange={(event) =>
                  setValue({ ...value, title: event.target.value })
                }
                value={value.title ?? ""}
              />
            </Field>
            <Field label="Subtítulo">
              <Input
                onChange={(event) =>
                  setValue({ ...value, subtitle: event.target.value })
                }
                value={value.subtitle ?? ""}
              />
            </Field>
            <Field label="Conteúdo JSON">
              <Textarea
                className="min-h-[180px] font-mono text-xs"
                onChange={(event) => setJson(event.target.value)}
                value={json}
              />
            </Field>
            <Field label="Ordem">
              <Input
                onChange={(event) =>
                  setValue({ ...value, display_order: Number(event.target.value) })
                }
                type="number"
                value={value.display_order ?? 0}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={value.active ?? true}
                onChange={(event) =>
                  setValue({ ...value, active: event.target.checked })
                }
                type="checkbox"
              />
              Ativa
            </label>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <Button type="submit">Salvar</Button>
          </form>

          <AdminListState
            emptyHint="Adicione uma seção no formulário ao lado."
            emptyTitle="Nenhuma seção configurada"
            error={loadError}
            isEmpty={items.length === 0}
            onRetry={load}
            status={loadStatus}
          >
            <div className="space-y-3">
              {items.map((item) => (
                <article
                  className="flex items-center justify-between rounded-xl border bg-white p-4"
                  key={item.id}
                >
                  <div>
                    <h3 className="font-semibold">
                      {item.title || item.section_key}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {item.section_key} · ordem {item.display_order} ·{" "}
                      {item.active ? "ativa" : "inativa"}
                    </p>
                  </div>
                  <div>
                    <button
                      className="font-semibold text-orange-600 hover:text-orange-700"
                      onClick={() => {
                        setValue(item);
                        setJson(JSON.stringify(item.content, null, 2));
                      }}
                      type="button"
                    >
                      Editar
                    </button>
                    <ConfirmButton
                      className="ml-4 text-red-600 hover:text-red-700"
                      confirmLabel="Excluir seção"
                      message={`Excluir a seção "${item.title || item.section_key}"? Esta ação não pode ser desfeita.`}
                      onConfirm={() => deleteAdminHomeSection(item.id)}
                      onDone={load}
                    >
                      Excluir
                    </ConfirmButton>
                  </div>
                </article>
              ))}
            </div>
          </AdminListState>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminSections;
