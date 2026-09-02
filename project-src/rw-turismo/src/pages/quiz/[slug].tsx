import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import { useState } from "react";
import { getPublishedQuiz } from "../../lib/quiz/server";
import {
  mascararTelefone,
  nomeValido,
  telefoneValido,
} from "../../lib/quiz/contato";
import type {
  Quiz,
  RespostaEscolhida,
  ResultadoDoQuiz,
} from "../../lib/quiz/types";
import { hrefSeguro } from "../../lib/security/url";
import { getStoredUtm } from "../../lib/utm";

// Renderizador genérico de quiz: serve qualquer quiz criado no painel.
//
// Não é o /quiz-feriado. Aquele tem arte própria em SVG (CenaSimulada) feita
// para avaliar o layout antes das fotos existirem, e o comentário do próprio
// arquivo diz que a arte sai quando as fotos chegarem. Arrastar aquilo para cá
// prenderia o renderizador genérico a um quiz específico — então aqui a imagem
// do resultado é uma URL, e sem ela a tela renderiza só o texto.

type Etapa = "abertura" | "perguntas" | "captura" | "resultado";

const QuizPublico = ({ quiz }: { quiz: Quiz }) => {
  const [etapa, setEtapa] = useState<Etapa>("abertura");
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<RespostaEscolhida[]>([]);
  const [resultado, setResultado] = useState<ResultadoDoQuiz | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pergunta = quiz.perguntas[indice];
  const total = quiz.perguntas.length;

  // O resultado vem do servidor SEMPRE. A tela não sabe pontuar, e é por isso
  // que ela não pode mentir sobre o desfecho.
  const enviar = async (escolhas: RespostaEscolhida[]) => {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/quiz/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: quiz.slug,
          respostas: escolhas,
          nome: nome || null,
          telefone: telefone || null,
          utm: getStoredUtm(),
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados?.error ?? "Falha ao calcular.");

      setResultado(dados as ResultadoDoQuiz);
      setEtapa("resultado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao calcular.");
    } finally {
      setEnviando(false);
    }
  };

  const escolher = (opcao: number) => {
    const escolhas = [...respostas, { pergunta: indice, opcao }];
    setRespostas(escolhas);

    if (indice + 1 < total) {
      setIndice(indice + 1);
      return;
    }
    // Acabaram as perguntas: pede contato, se o quiz pedir, ou já resolve.
    if (quiz.captura_ativa) {
      setEtapa("captura");
      return;
    }
    void enviar(escolhas);
  };

  const podeEnviarContato = nomeValido(nome) && telefoneValido(telefone);

  const conteudo = resultado?.conteudo ?? null;
  const linkCta =
    quiz.cta?.tipo === "whatsapp" && quiz.cta?.numero
      ? hrefSeguro(
          `https://wa.me/${quiz.cta.numero.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
            (quiz.cta.molde ?? "Oi! Fiz o quiz e caí em: {{resultado}}")
              .replace("{{resultado}}", conteudo?.rotulo ?? "")
              .replace("{{nome}}", nome)
          )}`
        )
      : null;

  return (
    <>
      <Head>
        <title>{quiz.seo_title || quiz.title} | RW Turismo</title>
        {quiz.seo_description && (
          <meta content={quiz.seo_description} name="description" />
        )}
      </Head>

      <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
        {etapa === "abertura" && (
          <section>
            <h1 className="text-4xl font-bold">
              {quiz.intro?.titulo || quiz.title}
            </h1>
            {quiz.intro?.subtitulo && (
              <p className="mt-4 text-lg text-gray-600">
                {quiz.intro.subtitulo}
              </p>
            )}
            <button
              className="mt-8 rounded-full bg-orange-500 px-8 py-3 font-semibold text-white hover:bg-orange-600"
              disabled={total === 0}
              onClick={() => setEtapa("perguntas")}
              type="button"
            >
              {quiz.intro?.texto_botao || "Começar"}
            </button>
            {total === 0 && (
              <p className="mt-4 text-sm text-gray-500">
                Este quiz ainda não tem perguntas.
              </p>
            )}
          </section>
        )}

        {etapa === "perguntas" && pergunta && (
          <section>
            <p className="text-sm font-semibold text-orange-600">
              {indice + 1} de {total}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{pergunta.texto}</h2>
            <div className="mt-6 space-y-3">
              {pergunta.opcoes.map((opcao, i) => (
                <button
                  className="block w-full rounded-xl border border-gray-300 px-5 py-4 text-left hover:border-orange-400 hover:bg-orange-50"
                  key={i}
                  onClick={() => escolher(i)}
                  type="button"
                >
                  {opcao.texto}
                </button>
              ))}
            </div>
          </section>
        )}

        {etapa === "captura" && (
          <section>
            <h2 className="text-2xl font-semibold">Quase lá</h2>
            <p className="mt-2 text-gray-600">
              Deixe seu contato para receber o resultado.
            </p>
            <div className="mt-6 space-y-4">
              <label className="block">
                Nome completo
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  onChange={(e) => setNome(e.target.value)}
                  value={nome}
                />
              </label>
              <label className="block">
                WhatsApp
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  placeholder="(86) 99999-8888"
                  value={telefone}
                />
              </label>
            </div>
            <button
              className="mt-6 rounded-full bg-orange-500 px-8 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              disabled={!podeEnviarContato || enviando}
              onClick={() => void enviar(respostas)}
              type="button"
            >
              {enviando ? "Calculando…" : "Ver meu resultado"}
            </button>
          </section>
        )}

        {etapa === "resultado" && conteudo && (
          <section>
            <p className="text-sm font-semibold text-orange-600">Seu resultado</p>
            <h2 className="mt-2 text-3xl font-bold">{conteudo.rotulo}</h2>
            {/* Sem foto a tela continua de pé: quiz novo costuma nascer sem
                imagem, e um quadro quebrado seria pior que nenhum. */}
            {conteudo.foto && hrefSeguro(conteudo.foto) && (
              <img
                alt={conteudo.rotulo}
                className="mt-6 w-full rounded-xl object-cover"
                src={hrefSeguro(conteudo.foto) as string}
              />
            )}
            {conteudo.texto && (
              <p className="mt-6 whitespace-pre-wrap text-lg text-gray-700">
                {conteudo.texto}
              </p>
            )}
            {linkCta && (
              <a
                className="mt-8 inline-flex rounded-full bg-green-600 px-8 py-3 font-semibold text-white hover:bg-green-700"
                href={linkCta}
                rel="noopener noreferrer"
                target="_blank"
              >
                {quiz.cta?.texto_botao || "Falar no WhatsApp"}
              </a>
            )}
          </section>
        )}

        {erro && <p className="mt-6 text-sm text-red-600">{erro}</p>}
      </main>
    </>
  );
};

export default QuizPublico;

export const getServerSideProps = async ({
  params,
}: GetServerSidePropsContext) => {
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  if (!slug) return { notFound: true };

  try {
    const quiz = await getPublishedQuiz(slug);
    if (!quiz) return { notFound: true };
    return { props: { quiz } };
  } catch {
    return { notFound: true };
  }
};
