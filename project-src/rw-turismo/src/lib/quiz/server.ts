import { createSupabaseServerClient } from "../supabase/server";
import type { Quiz } from "./types";

// Carrega o quiz para a rota pública /quiz/[slug].
//
// Usa o cliente com a chave anônima de propósito, e não o service role: a
// policy quizzes_public_read só devolve `status = 'published'`, então rascunho
// não vaza nem por engano. Fosse service role, o filtro teria que ser lembrado
// aqui — e uma linha esquecida publicaria todo rascunho da agência.

const client = () => createSupabaseServerClient() as any;

export const getPublishedQuiz = async (slug: string): Promise<Quiz | null> => {
  if (!slug) return null;

  const { data, error } = await client()
    .from("quizzes")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Os jsonb podem estar vazios num quiz recém-criado. Normalizar aqui evita
  // que a tela tenha que checar cada campo antes de usar.
  return {
    ...data,
    intro: data.intro ?? {},
    eixos: Array.isArray(data.eixos) ? data.eixos : [],
    perguntas: Array.isArray(data.perguntas) ? data.perguntas : [],
    resultados: Array.isArray(data.resultados) ? data.resultados : [],
    cta: data.cta ?? {},
    margem_empate: Number(data.margem_empate ?? 0.5),
    captura_ativa: Boolean(data.captura_ativa),
  } as Quiz;
};

/** Slugs publicados, para o Next pré-gerar as rotas conhecidas. */
export const listPublishedQuizSlugs = async (): Promise<string[]> => {
  const { data, error } = await client()
    .from("quizzes")
    .select("slug")
    .eq("status", "published");

  if (error) throw error;
  return ((data ?? []) as { slug: string }[]).map((q) => q.slug);
};
