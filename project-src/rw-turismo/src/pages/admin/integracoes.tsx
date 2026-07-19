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
  type WhatsAppWidget,
} from "../../lib/content/whatsapp";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { formatDateTimeBR } from "../../lib/format";

type SecretRow = { key: string; value: string; updated_at: string };
type TestResult = { ok: boolean; skipped?: boolean; error?: string };

type GroupDef = {
  id: "whatsapp" | "email" | "stripe";
  title: string;
  description: string;
  fields: { key: string; label: string; secret: boolean; hint?: string }[];
};

const groups: GroupDef[] = [
  {
    id: "whatsapp",
    title: "WhatsApp (UAZAPI)",
    description:
      "Notificações de reserva, lembretes e aniversários via WhatsApp.",
    fields: [
      {
        key: "uazapi_base_url",
        label: "URL da instância",
        secret: false,
        hint: "Ex.: https://sua-instancia.uazapi.com",
      },
      { key: "uazapi_token", label: "Token da instância", secret: true },
    ],
  },
  {
    id: "email",
    title: "E-mail (Resend)",
    description: "Confirmações e avisos também por e-mail.",
    fields: [
      { key: "resend_api_key", label: "Chave da API", secret: true },
      {
        key: "resend_from",
        label: "Remetente",
        secret: false,
        hint: 'Ex.: RW Turismo <contato@seudominio.com.br>',
      },
    ],
  },
  {
    id: "stripe",
    title: "Pagamentos (Stripe)",
    description: "Checkout, PIX/boleto e confirmação automática das reservas.",
    fields: [
      { key: "stripe_secret_key", label: "Chave secreta (sk_…)", secret: true },
      {
        key: "stripe_publishable_key",
        label: "Chave publicável (pk_…)",
        secret: false,
      },
      {
        key: "stripe_webhook_secret",
        label: "Segredo do webhook (whsec_…)",
        secret: true,
        hint: "Crie o webhook no Stripe apontando para a URL mostrada abaixo.",
      },
    ],
  },
];

type LogRow = {
  id: string;
  event: string;
  channel: string;
  recipient: string | null;
  status: string;
  error: string | null;
  created_at: string;
};

const AdminIntegracoes = () => {
  const [saved, setSaved] = useState<Record<string, SecretRow>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{
    serviceRole: boolean;
    cronSecret: boolean;
    siteUrl: string | null;
  } | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [testingGroup, setTestingGroup] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [whatsWidget, setWhatsWidget] = useState<WhatsAppWidget>(
    defaultWhatsAppWidget
  );
  const [isSavingWidget, setIsSavingWidget] = useState(false);

  const load = async () => {
    setLoadError(null);
    const supabase = createSupabaseBrowserClient() as any;
    try {
      const { data, error } = await supabase
        .from("integration_secrets")
        .select("key, value, updated_at");
      if (error) throw error;
      const map: Record<string, SecretRow> = {};
      for (const row of (data ?? []) as SecretRow[]) map[row.key] = row;
      setSaved(map);
    } catch (caught) {
      setLoadError(
        "Não foi possível carregar as integrações. A migration da Fase 0 já rodou no banco?"
      );
    }
    try {
      const { data } = await supabase
        .from("notification_log")
        .select("id, event, channel, recipient, status, error, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      setLogs((data ?? []) as LogRow[]);
    } catch {
      // tabela ausente — ignora
    }
    try {
      const response = await fetch("/api/admin/integration-status");
      if (response.ok) setStatus(await response.json());
    } catch {
      // status indisponível — ignora
    }
    try {
      setWhatsWidget(await getWhatsAppWidget());
    } catch {
      // configuração ausente — usa o padrão
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const groupConfigured = (group: GroupDef) =>
    group.fields.every((field) => !field.secret || saved[field.key]) &&
    group.fields.some((field) => saved[field.key]);

  const saveGroup = async (group: GroupDef) => {
    setSavingGroup(group.id);
    setMessage(null);
    const supabase = createSupabaseBrowserClient() as any;
    try {
      const rows = group.fields
        .map((field) => ({
          key: field.key,
          value: (drafts[field.key] ?? "").trim(),
        }))
        .filter((row) => row.value.length > 0);
      if (rows.length === 0) {
        setMessage("Preencha pelo menos um campo para salvar.");
        return;
      }
      const { error } = await supabase
        .from("integration_secrets")
        .upsert(rows, { onConflict: "key" });
      if (error) throw error;
      setDrafts((current) => {
        const next = { ...current };
        for (const row of rows) delete next[row.key];
        return next;
      });
      setMessage(`${group.title}: salvo.`);
      await load();
    } catch {
      setMessage(
        "Não foi possível salvar. Verifique se a migration da Fase 0 rodou e se você é admin."
      );
    } finally {
      setSavingGroup(null);
    }
  };

  const testGroup = async (group: GroupDef) => {
    setTestingGroup(group.id);
    try {
      const response = await fetch("/api/admin/integration-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: group.id }),
      });
      const result = (await response.json()) as TestResult;
      setResults((current) => ({ ...current, [group.id]: result }));
    } catch {
      setResults((current) => ({
        ...current,
        [group.id]: { ok: false, error: "Falha ao testar." },
      }));
    } finally {
      setTestingGroup(null);
    }
  };

  const mask = (row?: SecretRow) =>
    row ? `••••${row.value.slice(-4)}` : null;

  return (
    <AdminGuard>
      <AdminLayout
        title="Integrações"
        description="Cole aqui as chaves dos serviços — sem mexer em servidor. Os valores ficam guardados com acesso restrito a administradores."
      >
        {loadError && (
          <p
            className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            role="alert"
          >
            {loadError}
          </p>
        )}
        {message && (
          <p
            className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800"
            role="status"
          >
            {message}
          </p>
        )}

        {/* Pré-requisitos de infraestrutura */}
        <Card className="mb-5 p-5">
          <h2 className="font-semibold">Infraestrutura</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusPill
              label={
                status?.serviceRole
                  ? "Chave de servidor ✓"
                  : "Chave de servidor pendente"
              }
              tone={status?.serviceRole ? "success" : "warning"}
            />
            <StatusPill
              label={
                status?.cronSecret
                  ? "Agendador protegido ✓"
                  : "Agendador sem segredo (opcional)"
              }
              tone={status?.cronSecret ? "success" : "neutral"}
            />
          </div>
          {!status?.serviceRole && (
            <p className="mt-3 text-sm text-gray-600">
              Falta a <b>SUPABASE_SERVICE_ROLE_KEY</b> na Vercel (configuração
              única do desenvolvedor). Sem ela, reservas e notificações ficam
              desativadas — as chaves abaixo já podem ser coladas mesmo assim.
            </p>
          )}
          {status?.siteUrl && (
            <p className="mt-3 text-sm text-gray-600">
              Webhook do Stripe:{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                {status.siteUrl}/api/payments/webhook
              </code>{" "}
              (eventos: checkout.session.completed, checkout.session.expired,
              payment_intent.payment_failed)
            </p>
          )}
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          {groups.map((group) => {
            const configured = groupConfigured(group);
            const result = results[group.id];
            return (
              <Card className="p-5" key={group.id}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{group.title}</h2>
                  <StatusPill
                    label={configured ? "Configurado" : "Pendente"}
                    tone={configured ? "success" : "warning"}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {group.description}
                </p>
                <div className="mt-4 space-y-3">
                  {group.fields.map((field) => {
                    const current = saved[field.key];
                    return (
                      <Field
                        hint={
                          current
                            ? `Salvo (${mask(current)}) em ${formatDateTimeBR(current.updated_at)} — preencha para substituir.`
                            : field.hint
                        }
                        key={field.key}
                        label={field.label}
                      >
                        <Input
                          autoComplete="off"
                          onChange={(event) =>
                            setDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [field.key]: event.target.value,
                            }))
                          }
                          placeholder={current ? "••••••••" : ""}
                          type={field.secret ? "password" : "text"}
                          value={drafts[field.key] ?? ""}
                        />
                      </Field>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    loading={savingGroup === group.id}
                    onClick={() => saveGroup(group)}
                    size="sm"
                    type="button"
                  >
                    Salvar
                  </Button>
                  <Button
                    loading={testingGroup === group.id}
                    onClick={() => testGroup(group)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Testar conexão
                  </Button>
                  {result && (
                    <StatusPill
                      label={
                        result.ok
                          ? "Conectado ✓"
                          : result.error ?? "Falhou"
                      }
                      tone={result.ok ? "success" : "danger"}
                    />
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Botão de WhatsApp no site (não é segredo — fica em site_settings) */}
        <Card className="mt-6 p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">Botão de WhatsApp no site</h2>
              <p className="mt-1 text-xs text-gray-500">
                Botão flutuante no canto direito de todas as páginas + botão
                &ldquo;Tirar dúvida&rdquo; acima do botão de compra no pacote.
              </p>
            </div>
            <StatusPill
              label={
                whatsWidget.enabled && whatsWidget.phone
                  ? "Ativo"
                  : "Desativado"
              }
              tone={
                whatsWidget.enabled && whatsWidget.phone
                  ? "success"
                  : "neutral"
              }
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field
              hint="Com DDD. Ex.: (86) 99999-9999"
              label="Número do WhatsApp"
            >
              <Input
                onChange={(event) =>
                  setWhatsWidget((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="(86) 9…"
                value={whatsWidget.phone}
              />
            </Field>
            <Field
              hint="Texto do botão flutuante."
              label="Chamada (CTA)"
            >
              <Input
                onChange={(event) =>
                  setWhatsWidget((current) => ({
                    ...current,
                    cta: event.target.value,
                  }))
                }
                value={whatsWidget.cta}
              />
            </Field>
            <Field
              hint="Mensagem que chega pré-preenchida na conversa."
              label="Mensagem inicial"
            >
              <Textarea
                className="min-h-[42px]"
                onChange={(event) =>
                  setWhatsWidget((current) => ({
                    ...current,
                    message: event.target.value,
                  }))
                }
                value={whatsWidget.message}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                checked={whatsWidget.enabled}
                onChange={(event) =>
                  setWhatsWidget((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              Exibir no site
            </label>
            <Button
              loading={isSavingWidget}
              onClick={async () => {
                setIsSavingWidget(true);
                setMessage(null);
                try {
                  setWhatsWidget(await saveWhatsAppWidget(whatsWidget));
                  setMessage("Botão de WhatsApp salvo.");
                } catch {
                  setMessage(
                    "Não foi possível salvar o botão de WhatsApp."
                  );
                } finally {
                  setIsSavingWidget(false);
                }
              }}
              size="sm"
              type="button"
            >
              Salvar
            </Button>
          </div>
        </Card>

        <Card className="mt-6 p-5">
          <h2 className="font-semibold">Últimas notificações</h2>
          <p className="mt-1 text-xs text-gray-500">
            Envios automáticos (reserva, aniversário, lembretes) — os 10 mais
            recentes.
          </p>
          {logs.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              Nenhum envio registrado ainda.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">Quando</th>
                    <th className="py-2 pr-3">Evento</th>
                    <th className="py-2 pr-3">Canal</th>
                    <th className="py-2 pr-3">Destinatário</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-3">
                        {formatDateTimeBR(row.created_at)}
                      </td>
                      <td className="py-2 pr-3">{row.event}</td>
                      <td className="py-2 pr-3">
                        {row.channel === "whatsapp" ? "WhatsApp" : "E-mail"}
                      </td>
                      <td className="py-2 pr-3">{row.recipient ?? "—"}</td>
                      <td className="py-2">
                        <StatusPill
                          label={
                            row.status === "sent"
                              ? "Enviado"
                              : row.status === "skipped"
                                ? "Pulado"
                                : "Falhou"
                          }
                          tone={
                            row.status === "sent"
                              ? "success"
                              : row.status === "skipped"
                                ? "neutral"
                                : "danger"
                          }
                        />
                        {row.error && (
                          <span className="ml-2 text-xs text-gray-400">
                            {row.error.slice(0, 60)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminIntegracoes;
