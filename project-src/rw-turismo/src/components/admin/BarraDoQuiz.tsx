import type { Quiz } from "../../lib/quiz/types";

// Barra fixa do editor de quiz: onde estou, o que falta, e como salvar.
//
// POR QUE EXISTE: o formulário tem ~900 linhas num rolar único. Editando o
// quinto resultado, a tela não dizia em que quiz a pessoa estava, em que seção,
// se havia trabalho por salvar nem onde estava o botão Salvar — ela rolava tudo
// de volta para gravar, e o "Salvo." aparecia lá em cima, fora da tela. O
// reflexo é clicar em Salvar de novo achando que não pegou.
//
// Fica no editor, e não no AdminLayout, de propósito: pôr `sticky` no cabeçalho
// compartilhado mexeria em todas as telas do painel, inclusive as de tabela
// larga e as de impressão. Aqui o risco é zero.

export type Pendencia = { texto: string; ancora: string };

/**
 * O que impede o quiz de funcionar. Só o que QUEBRA — campo de texto opcional
 * em branco não entra, porque aviso demais vira ruído e a pessoa para de ler.
 *
 * Cada pendência diz a CONSEQUÊNCIA, não a regra: quem monta o quiz não tem de
 * saber o que é "peso órfão", tem de saber que o quiz vai dar sempre a mesma
 * resposta.
 */
export const pendenciasDoQuiz = (quiz: Quiz): Pendencia[] => {
  const p: Pendencia[] = [];
  const eixos = quiz.eixos ?? [];
  const perguntas = quiz.perguntas ?? [];
  const resultados = quiz.resultados ?? [];

  const semNome = eixos.filter((e) => !e.trim()).length;
  if (semNome > 0) {
    p.push({
      texto: `${semNome} eixo sem nome. Eixo sem nome nunca recebe resultado.`,
      ancora: "#eixos",
    });
  }

  if (perguntas.length === 0) {
    p.push({ texto: "O quiz não tem nenhuma pergunta.", ancora: "#perguntas" });
  }

  // Pergunta em que NENHUMA opção soma ponto não muda o resultado — ela só
  // alonga o quiz. É invisível hoje: não dá erro em lugar nenhum.
  const mudas = perguntas
    .map((pergunta, i) => ({ i, pergunta }))
    .filter(({ pergunta }) =>
      (pergunta.opcoes ?? []).every(
        (o) => Object.keys(o.pesos ?? {}).length === 0
      )
    );
  for (const { i } of mudas) {
    p.push({
      texto: `A pergunta ${i + 1} não muda o resultado: nenhuma opção dela soma pontos.`,
      ancora: "#perguntas",
    });
  }

  const semResultado = eixos.filter(
    (e) => e.trim() && !resultados.some((r) => r.eixo === e)
  );
  for (const eixo of semResultado) {
    p.push({
      texto: `Não há resultado para "${eixo}". Quem cair nele recebe o primeiro da lista.`,
      ancora: "#resultados",
    });
  }

  if (resultados.length > 0 && !resultados.some((r) => !r.eixo)) {
    p.push({
      texto: "Falta o resultado de empate.",
      ancora: "#resultados",
    });
  }

  // Dois resultados para o mesmo eixo: o segundo nunca aparece, porque a
  // pontuação pega o primeiro que casa.
  const vistos = new Set<string>();
  resultados.forEach((r, i) => {
    const chave = r.eixo ?? "(empate)";
    if (vistos.has(chave)) {
      p.push({
        texto: `O resultado ${i + 1} nunca vai aparecer: já existe um para ${
          r.eixo ? `"${r.eixo}"` : "empate"
        }.`,
        ancora: "#resultados",
      });
    }
    vistos.add(chave);
  });

  return p;
};

const SECOES = [
  { id: "o-quiz", nome: "O quiz" },
  { id: "eixos", nome: "Eixos" },
  { id: "perguntas", nome: "Perguntas" },
  { id: "resultados", nome: "Resultados" },
  { id: "moldura", nome: "Moldura" },
  { id: "whatsapp", nome: "WhatsApp" },
] as const;

const BarraDoQuiz = ({
  quiz,
  sujo,
  pendencias,
}: {
  quiz: Quiz;
  sujo: boolean;
  pendencias: Pendencia[];
}) => {
  const contagem: Record<string, number | undefined> = {
    eixos: quiz.eixos?.length,
    perguntas: quiz.perguntas?.length,
    resultados: quiz.resultados?.length,
  };
  const comProblema = new Set(pendencias.map((p) => p.ancora.replace("#", "")));

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 border-b bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            quiz.status === "published"
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {quiz.status === "published" ? "Publicado" : "Rascunho"}
        </span>
        <span
          className={`text-xs font-semibold ${
            sujo ? "text-amber-700" : "text-gray-400"
          }`}
        >
          {sujo ? "• não salvo" : "tudo salvo"}
        </span>

        <nav className="flex flex-wrap items-center gap-1">
          {SECOES.map((s) => (
            <a
              className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              href={`#${s.id}`}
              key={s.id}
            >
              {s.nome}
              {contagem[s.id] !== undefined && (
                <span className="ml-1 text-gray-400">{contagem[s.id]}</span>
              )}
              {/* O ponto leva o problema para onde a pessoa está olhando. Antes
                  o aviso de eixo órfão vivia dentro de Resultados, trezentas
                  linhas abaixo da seção Eixos, onde o problema nasce. */}
              {comProblema.has(s.id) && (
                <span aria-label="tem pendência" className="ml-1 text-red-600">
                  •
                </span>
              )}
            </a>
          ))}
        </nav>
      </div>

      {pendencias.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-semibold text-amber-800">
            {pendencias.length} coisa{pendencias.length > 1 ? "s" : ""} para
            resolver antes de publicar
          </summary>
          <ul className="mt-1 space-y-0.5 pb-1">
            {pendencias.map((p, i) => (
              <li className="text-xs text-amber-900" key={i}>
                <a className="hover:underline" href={p.ancora}>
                  {p.texto}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

export default BarraDoQuiz;
