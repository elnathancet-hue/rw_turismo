import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import {
  countQuizResponses,
  deleteAdminQuiz,
  listAdminQuizzes,
  saveAdminQuiz,
  type QuizResumo,
} from "../../../lib/quiz/client";
import { formatDateBR } from "../../../lib/format";

const AdminQuizzes = () => {
  const [quizzes, setQuizzes] = useState<QuizResumo[]>([]);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [estado, setEstado] = useState<"loading" | "ready" | "error">("loading");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setEstado("loading");
    try {
      const lista = await listAdminQuizzes();
      setQuizzes(lista);
      // A contagem é enfeite útil: se falhar, a lista continua servindo.
      setRespostas(await countQuizResponses().catch(() => ({})));
      setEstado("ready");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar.");
      setEstado("error");
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const criar = async () => {
    setErro(null);
    try {
      // Nasce como rascunho e com o mínimo para o editor abrir. Publicar é um
      // ato à parte — quiz vazio no ar não serve a ninguém.
      const novo = await saveAdminQuiz({
        title: "Quiz sem título",
        slug: `quiz-${Date.now()}`,
        status: "draft",
        eixos: ["a", "b"],
        perguntas: [],
        resultados: [],
      });
      window.location.href = `/admin/quizzes/${novo.id}`;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar.");
    }
  };

  const apagar = async (quiz: QuizResumo) => {
    const respondido = respostas[quiz.id] ?? 0;
    const aviso = respondido
      ? `"${quiz.title}" tem ${respondido} resposta(s). Apagar leva as respostas junto. Continuar?`
      : `Apagar "${quiz.title}"?`;
    if (!window.confirm(aviso)) return;

    try {
      await deleteAdminQuiz(quiz.id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao apagar.");
    }
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Quizzes"
        description="Quiz de captação: a pessoa responde, cai num resultado e vira contato."
        action={
          <button
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            onClick={criar}
            type="button"
          >
            + Novo quiz
          </button>
        }
      >
        {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}

        <AdminListState
          emptyHint="Crie o primeiro e ele nasce como rascunho."
          emptyTitle="Nenhum quiz ainda"
          error={erro}
          isEmpty={quizzes.length === 0}
          onRetry={() => void carregar()}
          status={estado}
        >
          <div className="divide-y rounded-lg border bg-white shadow-sm">
            {quizzes.map((quiz) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 p-4"
                key={quiz.id}
              >
                <div className="min-w-0">
                  <p className="font-medium">{quiz.title}</p>
                  <p className="text-sm text-gray-500">
                    /quiz/{quiz.slug} · {respostas[quiz.id] ?? 0} resposta
                    {(respostas[quiz.id] ?? 0) === 1 ? "" : "s"} · atualizado em{" "}
                    {formatDateBR(quiz.updated_at)}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <span
                    className={
                      quiz.status === "published"
                        ? "rounded-full bg-green-100 px-3 py-1 font-semibold text-green-800"
                        : "rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600"
                    }
                  >
                    {quiz.status === "published" ? "Publicado" : "Rascunho"}
                  </span>

                  {quiz.status === "published" && (
                    <a
                      className="font-semibold text-gray-600 hover:underline"
                      href={`/quiz/${quiz.slug}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Ver
                    </a>
                  )}

                  <Link
                    className="font-semibold text-gray-600 hover:underline"
                    href={`/admin/quizzes/${quiz.id}/respostas`}
                  >
                    Respostas
                  </Link>

                  <Link
                    className="font-semibold text-brand-600 hover:underline"
                    href={`/admin/quizzes/${quiz.id}`}
                  >
                    Editar
                  </Link>

                  <button
                    className="font-semibold text-red-600 hover:underline"
                    onClick={() => apagar(quiz)}
                    type="button"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminQuizzes;
