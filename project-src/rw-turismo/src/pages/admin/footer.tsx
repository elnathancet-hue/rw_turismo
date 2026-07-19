import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { Field, Input } from "../../components/ui/form";
import { getFooterSettings, saveAdminSetting } from "../../lib/content/client";
import { defaultFooter, type FooterSettings } from "../../lib/content/footer";

const AdminFooter = () => {
  const [footer, setFooter] = useState<FooterSettings>(defaultFooter);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    getFooterSettings()
      .then((data) => {
        if (data?.columns?.length) setFooter(data);
      })
      .catch(() => {})
      .finally(() => setStatus("ready"));
  }, []);

  const addColumn = () =>
    setFooter((f) => ({
      ...f,
      columns: [...f.columns, { title: "", links: [] }],
    }));
  const removeColumn = (ci: number) =>
    setFooter((f) => ({
      ...f,
      columns: f.columns.filter((_, i) => i !== ci),
    }));
  const setColumnTitle = (ci: number, title: string) =>
    setFooter((f) => ({
      ...f,
      columns: f.columns.map((c, i) => (i === ci ? { ...c, title } : c)),
    }));
  const addLink = (ci: number) =>
    setFooter((f) => ({
      ...f,
      columns: f.columns.map((c, i) =>
        i === ci ? { ...c, links: [...c.links, { label: "", url: "" }] } : c
      ),
    }));
  const removeLink = (ci: number, li: number) =>
    setFooter((f) => ({
      ...f,
      columns: f.columns.map((c, i) =>
        i === ci ? { ...c, links: c.links.filter((_, j) => j !== li) } : c
      ),
    }));
  const setLink = (
    ci: number,
    li: number,
    patch: Partial<{ label: string; url: string }>
  ) =>
    setFooter((f) => ({
      ...f,
      columns: f.columns.map((c, i) =>
        i === ci
          ? {
              ...c,
              links: c.links.map((l, j) => (j === li ? { ...l, ...patch } : l)),
            }
          : c
      ),
    }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);
    try {
      await saveAdminSetting(
        "footer",
        footer as unknown as Record<string, unknown>
      );
      setMessage({ tone: "ok", text: "Rodapé salvo com sucesso." });
    } catch {
      setMessage({ tone: "error", text: "Não foi possível salvar o rodapé." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Rodapé"
        description="Edite as colunas e os links do rodapé do site."
      >
        {status === "loading" ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : (
          <form className="space-y-6" onSubmit={submit}>
            <div className="grid gap-5 md:grid-cols-2">
              {footer.columns.map((column, ci) => (
                <Card className="space-y-4 p-5" key={ci}>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Field label={`Coluna ${ci + 1} — título`}>
                        <Input
                          onChange={(e) => setColumnTitle(ci, e.target.value)}
                          value={column.title}
                        />
                      </Field>
                    </div>
                    <Button
                      onClick={() => removeColumn(ci)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Remover coluna
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {column.links.map((link, li) => (
                      <div className="flex items-end gap-2" key={li}>
                        <div className="flex-1">
                          <Field label="Texto">
                            <Input
                              onChange={(e) =>
                                setLink(ci, li, { label: e.target.value })
                              }
                              value={link.label}
                            />
                          </Field>
                        </div>
                        <div className="flex-1">
                          <Field label="Link (URL)">
                            <Input
                              onChange={(e) =>
                                setLink(ci, li, { url: e.target.value })
                              }
                              placeholder="/pagina ou https://..."
                              value={link.url}
                            />
                          </Field>
                        </div>
                        <Button
                          aria-label="Remover link"
                          onClick={() => removeLink(ci, li)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                    <Button
                      onClick={() => addLink(ci)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      + Adicionar link
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <Button
              onClick={addColumn}
              type="button"
              variant="secondary"
            >
              + Adicionar coluna
            </Button>

            <Card className="max-w-xl space-y-4 p-5">
              <Field label="Texto de copyright">
                <Input
                  onChange={(e) =>
                    setFooter((f) => ({ ...f, copyright: e.target.value }))
                  }
                  value={footer.copyright ?? ""}
                />
              </Field>
              <Field hint="Opcional — exibido ao lado do copyright." label="CNPJ">
                <Input
                  onChange={(e) =>
                    setFooter((f) => ({ ...f, cnpj: e.target.value }))
                  }
                  value={footer.cnpj ?? ""}
                />
              </Field>
            </Card>

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
              {isSaving ? "Salvando…" : "Salvar rodapé"}
            </Button>
          </form>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminFooter;
