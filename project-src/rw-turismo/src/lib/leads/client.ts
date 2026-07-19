import { createSupabaseBrowserClient } from "../supabase/browser";
import { getStoredUtm } from "../utm";

export type SiteLeadInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  // Rótulo definido no bloco do construtor (ex.: nome da landing/pacote) —
  // vira o "interesse" do lead no CRM.
  interest?: string | null;
};

// Formulário público das páginas → lead no CRM. RLS permite insert anônimo
// apenas com source = 'site_form' e etapa inicial.
export const submitSiteLead = async (input: SiteLeadInput): Promise<void> => {
  const supabase = createSupabaseBrowserClient() as any;
  const { data } = await supabase.auth.getUser().catch(() => ({ data: null }));

  const interest = [input.interest?.trim(), input.message?.trim()]
    .filter(Boolean)
    .join(" — ");

  const { error } = await supabase.from("leads").insert({
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    interest: interest || null,
    source: "site_form",
    stage_id: "new",
    position: Date.now(),
    utm: getStoredUtm(),
    user_id: data?.user?.id ?? null,
  });

  if (error) throw error;
};
