import { useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import StatusPill from "../../components/StatusPill";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { Field, Input, Textarea } from "../../components/ui/form";
import {
  defaultWhatsAppWidget,
  getWhatsAppWidget,
  saveWhatsAppWidget,
  type ProductCtaMode,
  type WhatsAppWidget,
} from "../../lib/content/whatsapp";

const CTA_MODES: { id: ProductCtaMode; label: string; hint: string }[] = [
  {
    id: "both",
    label: "Reserva + WhatsApp (empilhados)",
    hint: "Mostra o botão de WhatsApp acima do botão de reserva.",
  },
  {
    id: "whatsapp",
    label: "Só WhatsApp",
    hint: "Só o botão de WhatsApp — a venda acontece pela conversa.",
  },
  {
    id: "reserva",
    label: "Só Reserva",
    hint: "Só o botão de reserva no site, sem WhatsApp no pacote.",
  },
];

const AdminAppearance = () => {
  const [widget, setWidget] = useState<WhatsAppWidget>(defaultWhatsAppWidget);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setLoadError(null);
    try {
      setWidget(await getWhatsAppWidget());
      setLoadStatus("ready");
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar as configurações."
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const set = <K extends keyof WhatsAppWidget>(
    key: K,
    value: WhatsAppWidget[K]
  ) => setWidget((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      setWidget(await saveWhatsAppWidget(widget));
      setMessage({ tone: "ok", text: "Configurações salvas." });
    } catch {
      setMessage({ tone: "error", text: "Não foi possível salvar." });
    } finally {
      setIsSaving(false);
    }
  };

  const floatActive = widget.enabled && !!widget.phone.trim();
  const needsPhone =
    (widget.productCta === "both" || widget.productCta === "whatsapp") &&
    !widget.phone.trim();

  return (
    <AdminGuard>
      <AdminLayout
        description="Botão flutuante de WhatsApp e os botões da página do pacote."
        title="Aparência do site"
      >
        {loadStatus === "loading" ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : loadStatus === "error" ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
            <button
              className="ml-3 font-semibold underline"
              onClick={load}
              type="button"
            >
              Tentar de novo
            </button>
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">Ícone flutuante do WhatsApp</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Botão verde no canto inferior direito de todas as páginas do
                    site.
                  </p>
                </div>
                <StatusPill
                  label={floatActive ? "Ativo" : "Desativado"}
                  tone={floatActive ? "success" : "neutral"}
                />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field
                  hint="Com DDD. Ex.: (86) 99999-9999"
                  label="Número do WhatsApp"
                >
                  <Input
                    onChange={(event) => set("phone", event.target.value)}
                    placeholder="(86) 9…"
                    value={widget.phone}
                  />
                </Field>
                <Field hint="Texto do botão flutuante." label="Chamada (CTA)">
                  <Input
                    onChange={(event) => set("cta", event.target.value)}
                    value={widget.cta}
                  />
                </Field>
                <Field
                  hint="Mensagem pré-preenchida na conversa."
                  label="Mensagem inicial"
                >
                  <Textarea
                    className="min-h-[42px]"
                    onChange={(event) => set("message", event.target.value)}
                    value={widget.message}
                  />
                </Field>
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  checked={widget.enabled}
                  onChange={(event) => set("enabled", event.target.checked)}
                  type="checkbox"
                />
                Exibir o ícone flutuante no site
              </label>
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold">Botões na página do pacote</h2>
              <p className="mt-1 text-xs text-gray-500">
                Como aparecem os botões na área de compra de cada viagem. O
                WhatsApp usa o mesmo número acima.
              </p>
              <div className="mt-4 space-y-2">
                {CTA_MODES.map((mode) => {
                  const selected = widget.productCta === mode.id;
                  return (
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                        selected
                          ? "border-orange-400 bg-orange-50"
                          : "hover:bg-gray-50"
                      }`}
                      key={mode.id}
                    >
                      <input
                        checked={selected}
                        className="mt-1"
                        name="productCta"
                        onChange={() => set("productCta", mode.id)}
                        type="radio"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-gray-800">
                          {mode.label}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {mode.hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {needsPhone && (
                <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  Preencha o número do WhatsApp acima para o botão aparecer na
                  página do pacote.
                </p>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold">Botões nos cards</h2>
              <p className="mt-1 text-xs text-gray-500">
                Mostra o botão &ldquo;{widget.cardButtonLabel || "Ver pacote"}
                &rdquo; + WhatsApp em cada card das vitrines e da busca. O card
                continua clicável mesmo com os botões desligados.
              </p>
              <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  checked={widget.cardButtons}
                  onChange={(event) =>
                    set("cardButtons", event.target.checked)
                  }
                  type="checkbox"
                />
                Mostrar botões nos cards
              </label>
              {widget.cardButtons && (
                <div className="mt-4 max-w-xs">
                  <Field label="Texto do botão de pacote">
                    <Input
                      onChange={(event) =>
                        set("cardButtonLabel", event.target.value)
                      }
                      placeholder="Ver pacote"
                      value={widget.cardButtonLabel}
                    />
                  </Field>
                  {!widget.phone.trim() && (
                    <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      O botão de WhatsApp no card só aparece com o número
                      preenchido acima.
                    </p>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold">Sugestões de viagens</h2>
              <p className="mt-1 text-xs text-gray-500">
                Vitrine com outros pacotes no fim da página de cada viagem.
              </p>
              <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  checked={widget.suggestions}
                  onChange={(event) =>
                    set("suggestions", event.target.checked)
                  }
                  type="checkbox"
                />
                Mostrar sugestões na página do pacote
              </label>
              {widget.suggestions && (
                <div className="mt-4 max-w-[13rem]">
                  <Field label="Quantas sugestões (1 a 8)">
                    <Input
                      max={8}
                      min={1}
                      onChange={(event) =>
                        set(
                          "suggestionsCount",
                          Math.min(
                            Math.max(Number(event.target.value) || 4, 1),
                            8
                          )
                        )
                      }
                      type="number"
                      value={widget.suggestionsCount}
                    />
                  </Field>
                </div>
              )}
            </Card>

            <div className="flex items-center gap-3">
              <Button loading={isSaving} onClick={save} type="button">
                {isSaving ? "Salvando…" : "Salvar"}
              </Button>
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
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminAppearance;
