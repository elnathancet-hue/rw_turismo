import { createSupabaseBrowserClient } from "../supabase/browser";

// Verifica se um slug já existe na tabela (ignorando o próprio registro em
// edição). Usado pela checagem debounced dos formulários (Fase 5.2).
export const isSlugTaken = async (
  table: string,
  slug: string,
  excludeId?: string | null
): Promise<boolean> => {
  const trimmed = slug.trim();
  if (!trimmed) return false;

  let query = (createSupabaseBrowserClient() as any)
    .from(table)
    .select("id")
    .eq("slug", trimmed)
    .limit(1);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown[]).length > 0;
};

// Postgres unique_violation — usado para mensagem amigável no submit.
export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: string }).code === "23505";
