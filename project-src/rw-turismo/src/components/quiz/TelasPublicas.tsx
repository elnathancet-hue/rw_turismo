import type { Quiz, QuizPergunta } from "../../lib/quiz/types";
import { hrefSeguro } from "../../lib/security/url";
import estilos from "../../styles/quiz.module.css";

// As telas de abertura e de pergunta do quiz público, como componentes.
//
// POR QUE SAIRAM DA PÁGINA: a prévia do editor precisa mostrar exatamente o que
// o visitante vai ver. Reescrever o markup no painel criaria duas verdades, e a
// prévia começaria a mentir na primeira mudança que alguém fizesse só de um
// lado. Aqui a página pública e a prévia renderizam o MESMO componente.
//
// São puros: recebem tudo por prop e não sabem nada de fetch, de estado do
// quiz nem de gravação. É isso que os torna seguros de desenhar dentro do
// editor, onde nenhuma resposta pode ser registrada.

/** A seta do botao, igual a da pagina feita a mao. */
export const Seta = () => (
  <svg
    aria-hidden="true"
    className={estilos.seta}
    fill="none"
    height="10"
    viewBox="0 0 15 10"
    width="15"
  >
    <path
      d="M1 5h12M9 1l4 4-4 4"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth="1.6"
    />
  </svg>
);

export const Topo = () => (
  <header className={estilos.topo}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt="RW Turismo" src="/rw-turismo-logo.png" />
  </header>
);

/** O jsonb não promete forma: linha que não seja texto é descartada. */
const micro = (quiz: Quiz): string[] =>
  Array.isArray(quiz.intro?.micro)
    ? quiz.intro.micro.filter(
        (v): v is string => typeof v === "string" && v.trim() !== ""
      )
    : [];

export const TelaAbertura = ({
  quiz,
  onComecar,
  desabilitado,
}: {
  quiz: Quiz;
  onComecar?: () => void;
  desabilitado?: boolean;
}) => (
  <section className={estilos.tela}>
    <div className={estilos.col}>
      {quiz.intro?.subtitulo && (
        <p className={estilos.olho}>{quiz.intro.subtitulo}</p>
      )}
      <h1>{quiz.intro?.titulo || quiz.title}</h1>

      {quiz.intro?.texto && <p className={estilos.sub}>{quiz.intro.texto}</p>}

      {/* Sem imagem a abertura continua de pé: quiz novo nasce sem ela, e um
          quadro quebrado seria pior que nenhum. hrefSeguro recusa javascript:
          e afins — URL negada simplesmente não vira <img>.
          fotoAbertura é o formato panorâmico da página feita à mão. */}
      {quiz.intro?.imagem && hrefSeguro(quiz.intro.imagem) && (
        <figure className={`${estilos.foto} ${estilos.fotoAbertura}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={quiz.intro.imagem_legenda ?? ""}
            className={estilos.fotoArte}
            src={hrefSeguro(quiz.intro.imagem) as string}
          />
          {quiz.intro.imagem_selo && (
            <span className={estilos.fotoSelo}>{quiz.intro.imagem_selo}</span>
          )}
          {quiz.intro.imagem_legenda && (
            <figcaption className={estilos.fotoLegenda}>
              {quiz.intro.imagem_legenda}
            </figcaption>
          )}
        </figure>
      )}

      <button
        className={estilos.acao}
        disabled={desabilitado}
        onClick={onComecar}
        type="button"
      >
        {quiz.intro?.texto_botao || "Começar"}
        <Seta />
      </button>

      {micro(quiz).map((linha, i) => (
        <p className={estilos.micro} key={i}>
          {linha}
        </p>
      ))}

      {desabilitado && (
        <p className={estilos.micro}>Este quiz ainda não tem perguntas.</p>
      )}
    </div>
  </section>
);

export const TelaPergunta = ({
  pergunta,
  indice,
  total,
  onEscolher,
  ocupado,
}: {
  pergunta: QuizPergunta;
  indice: number;
  total: number;
  onEscolher?: (opcao: number) => void;
  ocupado?: boolean;
}) => (
  <section className={estilos.tela}>
    <div className={estilos.col}>
      <div className={estilos.passo}>
        <div className={estilos.passoTopo}>
          <span>
            {/* Sem este sinal a tela fica parada na última pergunta enquanto o
                servidor calcula, e quem respondeu não sabe se funcionou. */}
            {ocupado ? (
              "Calculando…"
            ) : (
              <>
                Pergunta <b>{indice + 1}</b> de {total}
              </>
            )}
          </span>
        </div>
        <div aria-hidden="true" className={estilos.trilho}>
          {Array.from({ length: total }, (_, posicao) => (
            <span
              className={posicao <= indice ? estilos.trilhoFeito : undefined}
              key={posicao}
            />
          ))}
        </div>
      </div>

      <h2 className={estilos.pergunta}>{pergunta.texto}</h2>

      <ul className={estilos.opcoes}>
        {pergunta.opcoes.map((opcao, i) => (
          <li key={`${indice}-${i}`}>
            <button
              className={estilos.opcao}
              disabled={ocupado}
              onClick={() => onEscolher?.(i)}
              type="button"
            >
              <span className={estilos.opcaoTexto}>{opcao.texto}</span>
              <span aria-hidden="true" className={estilos.marca} />
            </button>
          </li>
        ))}
      </ul>
    </div>
    <p aria-live="polite" className={estilos.sr} role="status">
      {`Pergunta ${indice + 1} de ${total}. ${pergunta.texto}`}
    </p>
  </section>
);
