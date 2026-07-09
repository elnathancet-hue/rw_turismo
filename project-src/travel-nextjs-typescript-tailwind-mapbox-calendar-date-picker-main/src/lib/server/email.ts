import { getSecrets } from "./secrets";
import type { SendResult } from "./whatsapp";

// E-mail transacional via Resend (REST puro — sem SDK).
const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 15_000;

export const isEmailConfigured = async (): Promise<boolean> => {
  const secrets = await getSecrets(["resend_api_key"]);
  return Boolean(secrets.resend_api_key);
};

export const sendEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<SendResult> => {
  const secrets = await getSecrets(["resend_api_key", "resend_from"]);
  if (!secrets.resend_api_key) {
    return { ok: false, skipped: true, error: "E-mail não configurado" };
  }

  const from = secrets.resend_from || "RW Turismo <onboarding@resend.dev>";

  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secrets.resend_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Resend ${response.status}: ${detail.slice(0, 200)}`,
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

export const testEmailConnection = async (): Promise<SendResult> => {
  const secrets = await getSecrets(["resend_api_key"]);
  if (!secrets.resend_api_key) {
    return { ok: false, skipped: true, error: "Preencha a chave do Resend." };
  }
  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${secrets.resend_api_key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, error: `Resend respondeu ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha na conexão",
    };
  }
};
