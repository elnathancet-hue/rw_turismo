import { useState } from "react";
import TelaResultado from "../../quiz/TelaResultado";
import { TelaAbertura, TelaPergunta, Topo } from "../../quiz/TelasPublicas";
import type { Quiz } from "../../../lib/quiz/types";

// Prévia contextual: mostra a tela que corresponde ao que está sendo editado.
//
// REUSA OS COMPONENTES DA PÁGINA PÚBLICA (TelaAbertura, TelaPergunta,
// TelaResultado). Reescrever o markup aqui criaria duas verdades, e a prévia
// começaria a mentir na primeira mudança feita só de um lado.
//
// NADA AQUI TOCA DADO REAL: não há fetch, não há chamada à RPC, não há lead.
// O `pointer-events-none` no palco impede que um clique de curiosidade dispare
// qualquer coisa, e o nome é fictício e rotulado como exemplo.

/** Nome de exemplo. Rotulado na tela para ninguém achar que é um lead real. */
const NOME_EXEMPLO = "Maria";

export type FocoDaPrevia =
  | { tela: "abertura" }
  | { tela: "pergunta"; indice: number }
  | { tela: "resultado"; indice: number };

const LARGURAS = {
  desktop: "w-full",
  mobile: "w-[380px]",
} as const;

const PreviaDoQuiz = ({
  quiz,
  foco,
  onFechar,
}: {
  quiz: Quiz;
  foco: FocoDaPrevia;
  onFechar?: () => void;
}) => {
  const [dispositivo, setDispositivo] = useState<"desktop" | "mobile">("desktop");

  const pergunta =
    foco.tela === "pergunta" ? quiz.perguntas?.[foco.indice] : undefined;
  const resultado =
    foco.tela === "resultado" ? quiz.resultados?.[foco.indice] : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Prévia
        </span>

        {/* Estado marcado por texto, e não só por cor: quem não distingue as
            duas cores continua sabendo qual está ativo. */}
        <div className="ml-auto flex rounded-lg border p-0.5">
          {(["desktop", "mobile"] as const).map((d) => (
            <button
              aria-pressed={dispositivo === d}
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                dispositivo === d
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-500 hover:text-gray-800"
              }`}
              key={d}
              onClick={() => setDispositivo(d)}
              type="button"
            >
              {d === "desktop" ? "Computador" : "Celular"}
            </button>
          ))}
        </div>

        {onFechar && (
          <button
            className="rounded px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            onClick={onFechar}
            type="button"
          >
            Recolher
          </button>
        )}
      </div>

      <p className="border-b bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
        Exemplo. Nada respondido aqui é gravado, e nenhum lead é criado.
      </p>

      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div
          className={`mx-auto overflow-hidden rounded-lg border bg-white ${LARGURAS[dispositivo]}`}
        >
          {/* pointer-events-none: a prévia é para ver, não para responder. */}
          <div className="pointer-events-none">
            <Topo />
            {foco.tela === "abertura" && (
              <TelaAbertura
                desabilitado={(quiz.perguntas?.length ?? 0) === 0}
                quiz={quiz}
              />
            )}
            {foco.tela === "pergunta" &&
              (pergunta ? (
                <TelaPergunta
                  indice={foco.indice}
                  pergunta={pergunta}
                  total={quiz.perguntas?.length ?? 0}
                />
              ) : (
                <p className="p-6 text-sm text-gray-500">
                  Selecione uma pergunta para vê-la aqui.
                </p>
              ))}
            {foco.tela === "resultado" &&
              (resultado ? (
                <TelaResultado
                  linkCta={null}
                  nome={NOME_EXEMPLO}
                  quiz={quiz}
                  resultado={resultado}
                />
              ) : (
                <p className="p-6 text-sm text-gray-500">
                  Selecione um resultado para vê-lo aqui.
                </p>
              ))}
          </div>
        </div>

        {foco.tela === "resultado" && resultado && (
          <p className="mx-auto mt-2 max-w-prose text-center text-xs text-gray-500">
            O nome “{NOME_EXEMPLO}” é de exemplo — no site entra o nome de quem
            respondeu, quando o quiz pede contato.
          </p>
        )}
      </div>
    </div>
  );
};

export default PreviaDoQuiz;
