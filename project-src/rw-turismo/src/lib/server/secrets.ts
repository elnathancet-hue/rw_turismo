import { createSupabaseAdminClient } from "../supabase/admin";

// Chaves de integração coladas no /admin/integracoes (tabela admin-only).
// Fallback opcional para variáveis de ambiente, para não quebrar setups antigos.
export type SecretKey =
  | "uazapi_base_url"
  | "uazapi_token"
  | "resend_api_key"
  | "resend_from"
  | "stripe_secret_key"
  | "stripe_publishable_key"
  | "stripe_webhook_secret";

const envFallback: Partial<Record<SecretKey, string | undefined>> = {
  stripe_secret_key: process.env.STRIPE_SECRET_KEY,
  stripe_webhook_secret: process.env.STRIPE_INTERNAL_WEBHOOK_SECRET,
  uazapi_base_url: process.env.UAZAPI_BASE_URL,
  uazapi_token: process.env.UAZAPI_TOKEN,
  resend_api_key: process.env.RESEND_API_KEY,
  resend_from: process.env.RESEND_FROM,
};

export const isServiceRoleConfigured = (): boolean =>
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export const getSecrets = async (
  keys: SecretKey[]
): Promise<Partial<Record<SecretKey, string>>> => {
  const result: Partial<Record<SecretKey, string>> = {};

  if (isServiceRoleConfigured()) {
    try {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase
        .from("integration_secrets")
        .select("key, value")
        .in("key", keys);
      if (!error) {
        for (const row of (data ?? []) as { key: SecretKey; value: string }[]) {
          if (row.value?.trim()) result[row.key] = row.value.trim();
        }
      }
    } catch {
      // Tabela ausente ou banco indisponível — cai no fallback de env.
    }
  }

  for (const key of keys) {
    if (!result[key] && envFallback[key]) {
      result[key] = envFallback[key];
    }
  }

  return result;
};

export const getSecret = async (key: SecretKey): Promise<string | null> =>
  (await getSecrets([key]))[key] ?? null;
