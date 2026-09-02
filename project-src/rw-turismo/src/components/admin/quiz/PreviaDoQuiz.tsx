import { useEffect, useRef, useState } from "react";
import TelaResultado from "../../quiz/TelaResultado";
import { TelaAbertura, TelaPergunta, Topo } from "../../quiz/TelasPublicas";
import type { Quiz } from "../../../lib/quiz/types";
import estilos from "../../../styles/quiz.module.css";

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

// A tela do quiz foi desenhada para ~640px (o cartao tem max-width 40rem).
// Espremer isso numa coluna de 400px nao mostra o layout real: mostra outro
// layout. Entao a previa desenha na largura DE VERDADE e encolhe a imagem
// inteira com transform — o que aparece e proporcional ao que vai ao ar.
const LARGURA_REAL = { desktop: 640, mobile: 390 } as const;

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
  // Numa coluna de 460px o conteudo de 640px cabe a ~67%, que da para conferir
  // o layout mas nao para LER. Ampliar abre a previa em tela cheia, em tamanho
  // real, sem tirar a pessoa da tela em que ela estava editando.
  const [ampliada, setAmpliada] = useState(false);
  const palco = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const [altura, setAltura] = useState(0);

  useEffect(() => {
    if (!ampliada) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAmpliada(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [ampliada]);

  // A escala acompanha a largura disponivel: recolher a previa, mudar de
  // dispositivo ou redimensionar a janela recalcula.
  useEffect(() => {
    const medir = () => {
      const disponivel = (palco.current?.clientWidth ?? 0) - 32; // p-4 dos dois lados
      if (disponivel > 0) {
        setEscala(Math.min(1, disponivel / LARGURA_REAL[dispositivo]));
      }
      setAltura(conteudo.current?.offsetHeight ?? 0);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [dispositivo, quiz, foco, ampliada]);

  const pergunta =
    foco.tela === "pergunta" ? quiz.perguntas?.[foco.indice] : undefined;
  const resultado =
    foco.tela === "resultado" ? quiz.resultados?.[foco.indice] : undefined;

  return (
    <div
      className={
        ampliada
          ? "fixed inset-0 z-50 flex flex-col bg-white"
          : "flex h-full flex-col"
      }
    >
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

        <button
          className="rounded px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          onClick={() => setAmpliada((v) => !v)}
          type="button"
        >
          {ampliada ? "Reduzir" : "Ampliar"}
        </button>

        {onFechar && !ampliada && (
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
        {escala < 0.99 && (
          <span className="ml-1 text-amber-800">
            Reduzida a {Math.round(escala * 100)}% para caber — no site aparece
            em tamanho normal.
          </span>
        )}
      </p>

      <div className="flex-1 overflow-auto bg-gray-100 p-4" ref={palco}>
        <div
          className="mx-auto origin-top overflow-hidden rounded-lg border bg-white"
          style={{
            width: LARGURA_REAL[dispositivo],
            transform: `scale(${escala})`,
            // Sem isto o espaco embaixo continua sendo o da altura original, e
            // sobra um vazio do tamanho do que foi encolhido.
            marginBottom: altura ? -(altura * (1 - escala)) : undefined,
          }}
          ref={conteudo}
        >
          {/* pointer-events-none: a prévia é para ver, não para responder.
              emCaixa desliga os 100dvh de .pagina/.tela, que aqui seriam a
              altura da janela do painel e não a da caixa. */}
          <div className={`pointer-events-none ${estilos.emCaixa}`}>
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
                  // "#" e nao null: com null o TelaResultado nao desenha o
                  // botao, e a previa escondia justamente a peca que mais
                  // importa conferir. Nao e link de wa.me e nao navega — o
                  // palco inteiro e pointer-events-none.
                  linkCta="#"
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
