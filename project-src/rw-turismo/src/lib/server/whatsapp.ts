import { getSecrets } from "./secrets";

// Envio de WhatsApp via UAZAPI — versão enxuta portada do crm-persia-v2
// (packages/shared/src/providers/uazapi-client.ts), mantendo os fixes de
// produção: auth via header `token`, timeout, e guard de SSRF na base URL.

export type SendResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

const TIMEOUT_MS = 15_000;

const validateProviderUrl = (raw: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`URL inválida para o provedor UAZAPI: "${raw}"`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error("O provedor UAZAPI deve usar HTTPS.");
  }
  const host = parsed.hostname.toLowerCase();
  const PRIVATE = [
    /^localhost$/,
    /^127\./,
    /^0\.0\.0\.0/,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
  ];
  if (PRIVATE.some((r) => r.test(host))) {
    throw new Error("URL do provedor aponta para rede privada.");
  }
};

// Números BR de 10/11 dígitos ganham o DDI 55.
export const normalizePhone = (raw: string): string | null => {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
};

export const isWhatsAppConfigured = async (): Promise<boolean> => {
  const secrets = await getSecrets(["uazapi_base_url", "uazapi_token"]);
  return Boolean(secrets.uazapi_base_url && secrets.uazapi_token);
};

export const sendWhatsAppText = async (
  phoneRaw: string,
  text: string
): Promise<SendResult> => {
  const secrets = await getSecrets(["uazapi_base_url", "uazapi_token"]);
  if (!secrets.uazapi_base_url || !secrets.uazapi_token) {
    return { ok: false, skipped: true, error: "WhatsApp não configurado" };
  }

  const number = normalizePhone(phoneRaw);
  if (!number) {
    return { ok: false, skipped: true, error: "Telefone inválido" };
  }

  try {
    validateProviderUrl(secrets.uazapi_base_url);
    const response = await fetch(
      `${secrets.uazapi_base_url.replace(/\/$/, "")}/send/text`,
      {
        method: "POST",
        headers: {
          token: secrets.uazapi_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ number, text }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        error: `UAZAPI ${response.status}: ${detail.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha no envio",
    };
  }
};

// Ping simples para o botão "testar" do painel de integrações.
export const testWhatsAppConnection = async (): Promise<SendResult> => {
  const secrets = await getSecrets(["uazapi_base_url", "uazapi_token"]);
  if (!secrets.uazapi_base_url || !secrets.uazapi_token) {
    return { ok: false, skipped: true, error: "Preencha URL e token." };
  }
  try {
    validateProviderUrl(secrets.uazapi_base_url);
    const response = await fetch(
      `${secrets.uazapi_base_url.replace(/\/$/, "")}/instance/status`,
      {
        headers: { token: secrets.uazapi_token },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    if (!response.ok) {
      return { ok: false, error: `UAZAPI respondeu ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha na conexão",
    };
  }
};
