import { createSupabaseBrowserClient } from "../supabase/browser";
import { formatDateRangeBR } from "../format";

const db = () => createSupabaseBrowserClient() as any;
const throwIfError = (error: unknown) => {
  if (error) throw error;
};

// ---------------------------------------------------------------------------
// Etapas do pipeline (guardadas em site_settings.crm_stages, como o menu).
// ---------------------------------------------------------------------------

export type CrmStage = { id: string; label: string };

export const defaultStages: CrmStage[] = [
  { id: "new", label: "Novo lead" },
  { id: "talking", label: "Em conversa" },
  { id: "proposal", label: "Proposta enviada" },
  { id: "won", label: "Ganhou" },
  { id: "lost", label: "Perdeu" },
];

export const stageId = () =>
  `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const normalizeStages = (value: unknown): CrmStage[] => {
  const stages = (value as { stages?: unknown } | null)?.stages;
  if (!Array.isArray(stages)) return defaultStages;
  const cleaned = stages.filter(
    (stage): stage is CrmStage =>
      !!stage &&
      typeof (stage as CrmStage).id === "string" &&
      typeof (stage as CrmStage).label === "string" &&
      (stage as CrmStage).label.trim().length > 0
  );
  return cleaned.length > 0 ? cleaned : defaultStages;
};

export const getCrmStages = async (): Promise<CrmStage[]> => {
  const { data, error } = await db()
    .from("site_settings")
    .select("value")
    .eq("setting_key", "crm_stages")
    .maybeSingle();
  throwIfError(error);
  return normalizeStages(data?.value);
};

export const saveCrmStages = async (stages: CrmStage[]): Promise<CrmStage[]> => {
  const { data, error } = await db()
    .from("site_settings")
    .upsert(
      { setting_key: "crm_stages", value: { stages } },
      { onConflict: "setting_key" }
    )
    .select("value")
    .single();
  throwIfError(error);
  return normalizeStages(data?.value);
};

// ---------------------------------------------------------------------------
// Leads.
// ---------------------------------------------------------------------------

export type LeadSource =
  | "manual"
  | "waitlist"
  | "site_form"
  | "whatsapp"
  | "ads";

export const sourceLabels: Record<string, string> = {
  manual: "Manual",
  waitlist: "Lista de espera",
  site_form: "Formulário do site",
  whatsapp: "WhatsApp",
  ads: "Tráfego pago",
};

export type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  interest: string | null;
  source: string;
  utm: Record<string, string>;
  stage_id: string;
  position: number;
  waitlist_id: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadFormValues = {
  name: string;
  email: string;
  phone: string;
  interest: string;
  source: string;
};

export const listLeads = async (): Promise<Lead[]> => {
  const { data, error } = await db()
    .from("leads")
    .select("*")
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as Lead[];
};

export const createLead = async (
  values: LeadFormValues,
  stageIdValue: string
): Promise<Lead> => {
  const { data, error } = await db()
    .from("leads")
    .insert({
      name: values.name.trim(),
      email: values.email.trim().toLowerCase() || null,
      phone: values.phone.trim() || null,
      interest: values.interest.trim() || null,
      source: values.source,
      stage_id: stageIdValue,
      position: Date.now(),
    })
    .select("*")
    .single();
  throwIfError(error);
  return data as Lead;
};

export const updateLead = async (
  id: string,
  values: Partial<{
    name: string;
    email: string | null;
    phone: string | null;
    interest: string | null;
    source: string;
    stage_id: string;
    position: number;
  }>
): Promise<Lead> => {
  const { data, error } = await db()
    .from("leads")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();
  throwIfError(error);
  return data as Lead;
};

// Soft delete (Fase 5.4): some do kanban mas continua restaurável na lixeira.
export const deleteLead = async (id: string): Promise<void> => {
  const { error } = await db()
    .from("leads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  throwIfError(error);
};

export const restoreLead = async (id: string): Promise<void> => {
  const { error } = await db()
    .from("leads")
    .update({ deleted_at: null })
    .eq("id", id);
  throwIfError(error);
};

export type DeletedLead = Lead & { deleted_at: string };

export const listDeletedLeads = async (): Promise<DeletedLead[]> => {
  const { data, error } = await db()
    .from("leads")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as DeletedLead[];
};

// ---------------------------------------------------------------------------
// Histórico de contato.
// ---------------------------------------------------------------------------

export type LeadActivity = {
  id: string;
  lead_id: string;
  note: string;
  created_at: string;
};

export const listLeadActivities = async (
  leadId: string
): Promise<LeadActivity[]> => {
  const { data, error } = await db()
    .from("lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as LeadActivity[];
};

export const addLeadActivity = async (
  leadId: string,
  note: string
): Promise<LeadActivity> => {
  const { data, error } = await db()
    .from("lead_activities")
    .insert({ lead_id: leadId, note: note.trim() })
    .select("*")
    .single();
  throwIfError(error);
  return data as LeadActivity;
};

// ---------------------------------------------------------------------------
// Importação da lista de espera (cada interessado vira lead uma única vez).
// ---------------------------------------------------------------------------

export const importWaitlistLeads = async (
  firstStageId: string
): Promise<number> => {
  const [{ data: pending, error: pendingError }, { data: existing, error: existingError }] =
    await Promise.all([
      db()
        .from("waitlist")
        .select("*, products(title), product_dates(start_date, end_date)")
        .eq("status", "pending"),
      db().from("leads").select("waitlist_id").not("waitlist_id", "is", null),
    ]);
  throwIfError(pendingError);
  throwIfError(existingError);

  const imported = new Set(
    ((existing ?? []) as { waitlist_id: string }[]).map((row) => row.waitlist_id)
  );

  const rows = ((pending ?? []) as any[])
    .filter((entry) => !imported.has(entry.id))
    .map((entry, index) => ({
      name: entry.name,
      email: entry.email ?? null,
      phone: entry.phone ?? null,
      interest: [
        entry.products?.title,
        entry.product_dates
          ? formatDateRangeBR(
              entry.product_dates.start_date,
              entry.product_dates.end_date
            )
          : null,
        `${entry.travelers_count} pax`,
      ]
        .filter(Boolean)
        .join(" · "),
      source: "waitlist",
      utm: entry.utm ?? {},
      stage_id: firstStageId,
      position: Date.now() + index,
      waitlist_id: entry.id,
      user_id: entry.user_id ?? null,
    }));

  if (rows.length === 0) return 0;

  const { error } = await db().from("leads").insert(rows);
  throwIfError(error);
  return rows.length;
};
