import { createSupabaseBrowserClient } from "../supabase/browser";

// Botão de WhatsApp do site (flutuante + página do pacote), configurado no
// admin e guardado em site_settings (dado público — não é segredo).
export type WhatsAppWidget = {
  enabled: boolean;
  phone: string;
  cta: string;
  message: string;
};

export const WHATSAPP_SETTING_KEY = "whatsapp_widget";

export const defaultWhatsAppWidget: WhatsAppWidget = {
  enabled: false,
  phone: "",
  cta: "Fale com a gente",
  message: "Olá! Vim pelo site da RW Turismo e quero saber mais.",
};

export const normalizeWhatsAppWidget = (value: unknown): WhatsAppWidget => {
  const raw = (value ?? {}) as Partial<WhatsAppWidget>;
  return {
    enabled: raw.enabled === true,
    phone: typeof raw.phone === "string" ? raw.phone : "",
    cta:
      typeof raw.cta === "string" && raw.cta.trim()
        ? raw.cta
        : defaultWhatsAppWidget.cta,
    message:
      typeof raw.message === "string" && raw.message.trim()
        ? raw.message
        : defaultWhatsAppWidget.message,
  };
};

export const buildWaLink = (phone: string, text: string): string | null => {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};

const db = () => createSupabaseBrowserClient() as any;

export const getWhatsAppWidget = async (): Promise<WhatsAppWidget> => {
  const { data, error } = await db()
    .from("site_settings")
    .select("value")
    .eq("setting_key", WHATSAPP_SETTING_KEY)
    .maybeSingle();
  if (error) throw error;
  return normalizeWhatsAppWidget(data?.value);
};

export const saveWhatsAppWidget = async (
  widget: WhatsAppWidget
): Promise<WhatsAppWidget> => {
  const { data, error } = await db()
    .from("site_settings")
    .upsert(
      { setting_key: WHATSAPP_SETTING_KEY, value: widget },
      { onConflict: "setting_key" }
    )
    .select("value")
    .single();
  if (error) throw error;
  return normalizeWhatsAppWidget(data?.value);
};
