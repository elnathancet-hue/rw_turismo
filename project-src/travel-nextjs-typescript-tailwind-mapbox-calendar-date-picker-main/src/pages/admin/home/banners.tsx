import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import ConfirmButton from "../../../components/admin/ConfirmButton";
import ImageUpload from "../../../components/admin/ImageUpload";
import Button from "../../../components/ui/Button";
import { Field, Input } from "../../../components/ui/form";
import {
  deleteAdminBanner,
  listAdminBanners,
  saveAdminBanner,
} from "../../../lib/content/client";
import type { HomeBanner } from "../../../lib/content/types";

const empty: Partial<HomeBanner> = {
  title: "",
  subtitle: "",
  image_url: "",
  mobile_image_url: "",
  button_text: "",
  button_url: "",
  overlay_strength: 0.35,
  active: true,
  display_order: 0,
  starts_at: null,
  ends_at: null,
};

const textFields: {
  key: "title" | "subtitle" | "button_text" | "button_url";
  label: string;
}[] = [
  { key: "title", label: "Título" },
  { key: "subtitle", label: "Subtítulo" },
  { key: "button_text", label: "Texto do botão" },
  { key: "button_url", label: "Link do botão" },
];

// ISO -> value for <input type="datetime-local"> in local time, so editing a
// scheduled banner keeps its dates instead of clearing them.
const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const AdminBanners = () => {
  const [items, setItems] = useState<HomeBanner[]>([]);
  const [value, setValue] = useState<Partial<HomeBanner>>(empty);
  const [error, setError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setLoadError(null);
    try {
      setItems(await listAdminBanners());
      setLoadStatus("ready");
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar os banners."
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
      await saveAdminBanner(value);
      setValue(empty);
      await load();
    } catch {
      setError("Não foi possível salvar o banner.");
    }
  };

  return (
    <AdminGuard>
      <AdminLayout title="Banners da home">
        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <form
            className="space-y-4 rounded-xl border bg-white p-5"
            onSubmit={submit}
          >
            <h2 className="font-semibold">
              {value.id ? "Editar banner" : "Novo banner"}
            </h2>
            {textFields.map(({ key, label }) => (
              <Field key={key} label={label}>
                <Input
                  onChange={(event) =>
                    setValue({ ...value, [key]: event.target.value })
                  }
                  value={(value[key] as string) ?? ""}
                />
              </Field>
            ))}
            <div className="text-sm font-medium text-gray-700">
              Imagem desktop
              <ImageUpload
                bucket="site-assets"
                onChange={(url) => setValue({ ...value, image_url: url })}
                value={value.image_url}
              />
            </div>
            <div className="text-sm font-medium text-gray-700">
              Imagem mobile
              <ImageUpload
                bucket="site-assets"
                onChange={(url) => setValue({ ...value, mobile_image_url: url })}
                value={value.mobile_image_url}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início">
                <Input
                  onChange={(event) =>
                    setValue({
                      ...value,
                      starts_at: event.target.value
                        ? new Date(event.target.value).toISOString()
                        : null,
                    })
                  }
                  type="datetime-local"
                  value={toLocalInput(value.starts_at)}
                />
              </Field>
              <Field label="Fim">
                <Input
                  onChange={(event) =>
                    setValue({
                      ...value,
                      ends_at: event.target.value
                        ? new Date(event.target.value).toISOString()
                        : null,
                    })
                  }
                  type="datetime-local"
                  value={toLocalInput(value.ends_at)}
                />
              </Field>
              <Field label="Ordem">
                <Input
                  onChange={(event) =>
                    setValue({
                      ...value,
                      display_order: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={value.display_order ?? 0}
                />
              </Field>
              <Field label="Overlay">
                <Input
                  max="1"
                  min="0"
                  onChange={(event) =>
                    setValue({
                      ...value,
                      overlay_strength: Number(event.target.value),
                    })
                  }
                  step=".05"
                  type="number"
                  value={value.overlay_strength ?? 0.35}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={value.active ?? true}
                onChange={(event) =>
                  setValue({ ...value, active: event.target.checked })
                }
                type="checkbox"
              />
              Ativo
            </label>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <Button type="submit">Salvar</Button>
              {value.id && (
                <Button
                  onClick={() => setValue(empty)}
                  type="button"
                  variant="secondary"
                >
                  Novo
                </Button>
              )}
            </div>
          </form>

          <AdminListState
            emptyHint="Crie um banner no formulário ao lado."
            emptyTitle="Nenhum banner ainda"
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
                      {item.title || "Sem título"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Ordem {item.display_order} ·{" "}
                      {item.active ? "Ativo" : "Inativo"}
                    </p>
                  </div>
                  <div>
                    <button
                      className="font-semibold text-orange-600 hover:text-orange-700"
                      onClick={() => setValue(item)}
                      type="button"
                    >
                      Editar
                    </button>
                    <ConfirmButton
                      className="ml-4 text-red-600 hover:text-red-700"
                      confirmLabel="Excluir banner"
                      message={`Excluir o banner "${item.title || "sem título"}"? Esta ação não pode ser desfeita.`}
                      onConfirm={() => deleteAdminBanner(item.id)}
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

export default AdminBanners;
