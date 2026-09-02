import { createSupabaseBrowserClient } from "../supabase/browser";
import type { Quiz } from "./types";

// CRUD do quiz pelo painel.
//
// Vai direto ao Supabase, e não por rota de API, porque aqui não há nada que
// exija service role: quem edita quiz é `conteudo` ou `admin`, e as policies
// quizzes_conteudo_all / quizzes_admin_all já dizem exatamente isso. O RLS é o
// backend deste caminho — é o mesmo desenho das páginas e do blog.
//
// O que NÃO passa por aqui é a resposta de quem faz o quiz: aquilo é a RPC
// responder_quiz, atrás de /api/quiz/responder, porque o resultado precisa ser
// calculado no servidor.

const db = () => createSupabaseBrowserClient() as any;

const unwrap = <T,>(r: { data: T; error: any }): T => {
  if (r.error) throw r.error;
  return r.data;
};

export type QuizResumo = Pick<
  Quiz,
  "id" | "title" | "slug" | "status" | "captura_ativa"
> & { created_at: string; updated_at: string; respostas?: number };

export const listAdminQuizzes = async (): Promise<QuizResumo[]> =>
  (unwrap(
    await db().from("quizzes").select("*").order("created_at", { ascending: false })
  ) ?? []) as QuizResumo[];

export const getAdminQuiz = async (id: string): Promise<Quiz | null> =>
  unwrap(
    await db().from("quizzes").select("*").eq("id", id).maybeSingle()
  ) as Quiz | null;

export const saveAdminQuiz = async (
  value: Partial<Quiz> & { id?: string }
): Promise<Quiz> => {
  const { id, ...campos } = value;
  const query = id
    ? db().from("quizzes").update(campos).eq("id", id)
    : db().from("quizzes").insert(campos);

  return unwrap(await query.select().single()) as Quiz;
};

export const deleteAdminQuiz = async (id: string): Promise<void> => {
  unwrap(await db().from("quizzes").delete().eq("id", id));
};

// Quantas pessoas responderam cada quiz. Consulta separada porque a contagem
// vem de outra tabela e a lista continua útil mesmo se ela falhar.
export const countQuizResponses = async (): Promise<Record<string, number>> => {
  const linhas = (unwrap(
    await db().from("quiz_responses").select("quiz_id")
  ) ?? []) as { quiz_id: string }[];

  const contagem: Record<string, number> = {};
  for (const { quiz_id } of linhas) {
    contagem[quiz_id] = (contagem[quiz_id] ?? 0) + 1;
  }
  return contagem;
};
