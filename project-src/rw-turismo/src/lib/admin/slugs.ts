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

// Texto → slug. Vive aqui, junto de isSlugTaken, porque os dois andam sempre
// juntos: quem gera um slug precisa saber se ele já está em uso.
//
// Existem duas cópias privadas disto (BlogPostForm e PageBuilder). Não as
// mexi para não ampliar o escopo, mas deixar a versão pública aqui evita que
// a terceira nasça.
export const slugify = (valor: string): string =>
  valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
