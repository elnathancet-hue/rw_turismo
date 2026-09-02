import type { Quiz, QuizFoto, QuizResultado } from "../../lib/quiz/types";
import { hrefSeguro } from "../../lib/security/url";
import estilos from "../../styles/quiz.module.css";

// A tela de resultado de um quiz criado no painel.
//
// POR QUE ESTE ARQUIVO EXISTE: /quiz-feriado foi feito à mão e tem dez
// elementos — olho, título com o nome, parágrafo, régua, lista com check, fotos
// legendadas, bloco de destino, selo, botão e microcopy. O renderizador
// genérico desenhava dois (rótulo e texto) com Tailwind cru, então um quiz
// criado no sistema não se parecia nem de longe com a página real.
//
// Aqui a mesma folha de estilo da página à mão é reusada — ela é toda escopada
// em `.pagina` e nada nela é do feriado. O layout sai igual porque é o MESMO
// CSS, não uma imitação dele.
//
// TODO BLOCO VAZIO SOME. Quiz nasce sem foto, sem destino e sem motivos; meia
// tela desenhada é pior que uma tela curta e inteira.

/** Troca {{nome}} e {{rotulo}}. Sem nome, a frase tem de continuar de pé. */
export const montarTitulo = (
  molde: string,
  nome: string,
  rotulo: string
): string =>
  molde
    // "Elnathan, suas" vira "Suas" quando não há nome: sem isto a frase
    // começaria com vírgula, que é o erro clássico de template com nome.
    .replace(/\{\{nome\}\},\s*/g, nome ? `${nome}, ` : "")
    .replace(/\{\{nome\}\}/g, nome)
    .replace(/\{\{rotulo\}\}/g, rotulo)
    .replace(/\s+/g, " ")
    .trim();

/** Primeiro nome, capitalizado. "elnathan silva" -> "Elnathan". */
export const primeiroNome = (nome: string): string => {
  const bruto = nome.trim().split(/\s+/)[0] ?? "";
  if (!bruto) return "";
  return bruto.charAt(0).toUpperCase() + bruto.slice(1);
};

/**
 * As fotos do resultado, aceitando o modelo antigo (uma `foto` solta) e o novo
 * (`fotos[]`). Sem isto, quiz gravado antes destes campos perderia a imagem que
 * já tinha.
 */
export const fotosDoResultado = (resultado: QuizResultado): QuizFoto[] => {
  const bruta = Array.isArray(resultado.fotos) && resultado.fotos.length
    ? resultado.fotos
    : resultado.foto
      ? [{ url: resultado.foto }]
      : [];
  // hrefSeguro devolve null para javascript: e afins — URL recusada não vira
  // <img src>, e a foto simplesmente não aparece.
  return bruta.filter((f) => f?.url && hrefSeguro(f.url));
};

/**
 * Lista de texto vinda do jsonb. O banco nao promete forma: um `motivos` que
 * chegue como string faria `.filter` estourar, e a tela de resultado e
 * exatamente onde a pessoa nao pode ver erro nenhum.
 */
const lista = (valor: unknown): string[] =>
  Array.isArray(valor)
    ? valor.filter((v): v is string => typeof v === "string" && v.trim() !== "")
    : [];

const TelaResultado = ({
  quiz,
  resultado,
  nome,
  linkCta,
}: {
  quiz: Quiz;
  resultado: QuizResultado;
  nome: string;
  linkCta: string | null;
}) => {
  const layout = quiz.resultado_layout ?? {};
  const fotos = fotosDoResultado(resultado);
  const motivos = lista(resultado.motivos);
  const destino = resultado.destino ?? null;
  const itensDestino = lista(destino?.itens);
  const micro = lista(quiz.cta?.micro);

  // A RÉGUA só faz sentido com DOIS eixos. Com três ou mais, uma barra de uma
  // dimensão colocaria o resultado num ponto que não corresponde a nada — e uma
  // tela que mente é pior que uma tela sem o enfeite.
  const temRegua =
    quiz.eixos.length === 2 &&
    typeof resultado.posicao === "number" &&
    Number.isFinite(resultado.posicao);
  const posicao = Math.min(100, Math.max(0, resultado.posicao ?? 0));

  const titulo = resultado.titulo
    ? montarTitulo(resultado.titulo, primeiroNome(nome), resultado.rotulo)
    : resultado.rotulo;

  return (
    <section className={`${estilos.tela} ${estilos.telaLonga}`}>
      <div className={`${estilos.revelacao} ${estilos.entra}`}>
        {layout.olho && <p className={estilos.olho}>{layout.olho}</p>}

        <h2>{titulo}</h2>

        {resultado.texto && <p className={estilos.sub}>{resultado.texto}</p>}

        {temRegua && (
          <div className={estilos.regua}>
            <div className={estilos.reguaTrilho}>
              <span className={estilos.reguaMarca} style={{ left: `${posicao}%` }}>
                <span aria-hidden="true">😍</span>
              </span>
            </div>
            {/* Os polos da régua SÃO os eixos do quiz. Um quiz "praia vs
                montanha" ganha a régua certa sem ninguém configurar nada. */}
            <div className={estilos.reguaPontas}>
              <span>{quiz.eixos[0]}</span>
              <span>{quiz.eixos[1]}</span>
            </div>
            {resultado.regua_rotulo && (
              <p aria-live="polite" className={estilos.reguaRotulo}>
                {resultado.regua_rotulo}
              </p>
            )}
          </div>
        )}

        {motivos.length > 0 && (
          <div className={estilos.bloco}>
            {layout.titulo_motivos && <h3>{layout.titulo_motivos}</h3>}
            <ul className={estilos.motivos}>
              {motivos.map((motivo, i) => (
                <li key={i}>{motivo}</li>
              ))}
            </ul>
          </div>
        )}

        {fotos.length > 0 && (
          // `.fotos` já vira duas colunas em tela larga. Com UMA foto isso a
          // deixaria com meia largura e um buraco ao lado — `.fotosLarga` volta
          // para uma coluna, que é exatamente o caso de quem pôs só uma imagem.
          <div
            className={`${estilos.fotos}${fotos.length === 1 ? ` ${estilos.fotosLarga}` : ""}`}
          >
            {fotos.map((foto, i) => (
              <figure className={estilos.foto} key={i}>
                <img
                  alt={foto.legenda ?? ""}
                  className={estilos.fotoArte}
                  src={hrefSeguro(foto.url) as string}
                />
                {foto.selo && <span className={estilos.fotoSelo}>{foto.selo}</span>}
                {foto.legenda && (
                  <figcaption className={estilos.fotoLegenda}>
                    {foto.legenda}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}

        {(destino?.nome || itensDestino.length > 0) && (
          <div className={estilos.bloco}>
            {layout.titulo_destino && <h3>{layout.titulo_destino}</h3>}
            {destino?.nome && <p className={estilos.destino}>{destino.nome}</p>}
            {destino?.subtitulo && (
              <p className={estilos.destinoSub}>{destino.subtitulo}</p>
            )}
            {itensDestino.length > 0 && (
              <ul className={estilos.itens}>
                {itensDestino.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {layout.selo && <p className={estilos.selo}>{layout.selo}</p>}

        {(linkCta || micro.length > 0) && (
          <div className={estilos.apoio}>
            {linkCta && (
              <a
                className={estilos.acao}
                href={linkCta}
                rel="noopener noreferrer"
                target="_blank"
              >
                {quiz.cta?.texto_botao || "Falar no WhatsApp"}
              </a>
            )}
            {micro.map((linha, i) => (
              <p className={estilos.micro} key={i}>
                {linha}
              </p>
            ))}
          </div>
        )}

        {layout.assinatura && (
          <p className={estilos.assinatura}>{layout.assinatura}</p>
        )}
      </div>
    </section>
  );
};

export default TelaResultado;
