import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AdminGuard from "../../../../components/admin/AdminGuard";
import AdminLayout from "../../../../components/admin/AdminLayout";
import AdminListState from "../../../../components/admin/AdminListState";
import {
  getAdminQuiz,
  listQuizResponses,
  type RespostaDoQuiz,
} from "../../../../lib/quiz/client";
import type { Quiz } from "../../../../lib/quiz/types";
import { downloadCsv } from "../../../../lib/csv";
import { formatDateTimeBR } from "../../../../lib/format";

// Relatório de respostas.
//
// A pergunta que ele responde não é "quantos fizeram", é "em que as pessoas
// caem" — porque é isso que diz se o quiz está separando gente de verdade ou
// empurrando todo mundo para o mesmo lado. Um quiz em que 95% cai no mesmo
// resultado não está medindo nada.

const AdminQuizRespostas = () => {
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [respostas, setRespostas] = useState<RespostaDoQuiz[]>([]);
  const [estado, setEstado] = useState<"loading" | "ready" | "error">("loading");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async (id: string) => {
    setEstado("loading");
    try {
      const [q, r] = await Promise.all([
        getAdminQuiz(id),
        listQuizResponses(id),
      ]);
      setQuiz(q);
      setRespostas(r);
      setEstado("ready");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar.");
      setEstado("error");
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    const id = router.query.id;
    if (typeof id === "string") void carregar(id);
  }, [router.isReady, router.query.id]);

  const total = respostas.length;

  // Conta por resultado, e usa o rótulo que o quiz definiu — a chave é
  // identificador técnico e não diz nada para quem lê.
  const porResultado = quiz
    ? quiz.resultados.map((r) => {
        const n = respostas.filter((x) => x.resultado === r.chave).length;
        return {
          rotulo: r.rotulo || r.chave,
          n,
          pct: total > 0 ? Math.round((n / total) * 100) : 0,
        };
      })
    : [];

  const comContato = respostas.filter((r) => r.name && r.phone).length;

  const baixarCsv = () =>
    downloadCsv(`respostas-${quiz?.slug ?? "quiz"}.csv`, [
      ["Quando", "Resultado", "Nome", "Telefone"],
      ...respostas.map((r) => [
        formatDateTimeBR(r.created_at),
        quiz?.resultados.find((x) => x.chave === r.resultado)?.rotulo ??
          r.resultado,
        r.name ?? "",
        r.phone ?? "",
      ]),
    ]);

  return (
    <AdminGuard>
      <AdminLayout
        title={quiz ? `Respostas — ${quiz.title}` : "Respostas"}
        description="Em que resultado as pessoas caem, e quem deixou contato."
        action={
          <div className="flex gap-2">
            <Link
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href={`/admin/quizzes/${router.query.id}`}
            >
              Editar quiz
            </Link>
            {total > 0 && (
              <button
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                onClick={baixarCsv}
                type="button"
              >
                Baixar CSV
              </button>
            )}
          </div>
        }
      >
        <AdminListState
          emptyHint="Assim que alguém responder, o resultado aparece aqui."
          emptyTitle="Ninguém respondeu ainda"
          error={erro}
          isEmpty={total === 0}
          onRetry={() =>
            typeof router.query.id === "string" && void carregar(router.query.id)
          }
          status={estado}
        >
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Respostas</p>
                <p className="mt-1 text-3xl font-semibold">{total}</p>
              </div>
              <div className="rounded-lg border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Deixaram contato</p>
                <p className="mt-1 text-3xl font-semibold">{comContato}</p>
              </div>
              <div className="rounded-lg border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Viraram lead</p>
                <p className="mt-1 text-3xl font-semibold">
                  {total > 0 ? Math.round((comContato / total) * 100) : 0}%
                </p>
              </div>
            </section>

            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Onde as pessoas caem</h2>
              <div className="mt-4 space-y-3">
                {porResultado.map((r) => (
                  <div key={r.rotulo}>
                    <div className="flex justify-between text-sm">
                      <span>{r.rotulo}</span>
                      <span className="text-gray-500">
                        {r.n} · {r.pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-brand-500"
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border bg-white shadow-sm">
              <h2 className="border-b p-5 font-semibold">
                Últimas respostas
                {respostas.length >= 200 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    (mostrando as 200 mais recentes)
                  </span>
                )}
              </h2>
              <div className="divide-y">
                {respostas.map((r) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
                    key={r.id}
                  >
                    <div>
                      <p className="font-medium">
                        {quiz?.resultados.find((x) => x.chave === r.resultado)
                          ?.rotulo ?? r.resultado}
                      </p>
                      <p className="text-gray-500">
                        {r.name ? `${r.name} · ${r.phone}` : "Sem contato"}
                      </p>
                    </div>
                    <span className="text-gray-500">
                      {formatDateTimeBR(r.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminQuizRespostas;
