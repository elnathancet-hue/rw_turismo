import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import { useState } from "react";
import TelaResultado from "../../components/quiz/TelaResultado";
import {
  TelaAbertura,
  TelaPergunta,
  Topo,
} from "../../components/quiz/TelasPublicas";
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
import estilos from "../../styles/quiz.module.css";

// Renderizador genérico de quiz: serve qualquer quiz criado no painel.
//
// USA A MESMA FOLHA DE ESTILO da página feita à mão (/quiz-feriado). Ela é toda
// escopada em `.pagina` e nada nela é do feriado — régua, lista com check,
// fotos legendadas, selo, botão. Antes esta tela era Tailwind cru e um quiz
// criado no sistema não se parecia com a página real; agora o layout sai igual
// porque é o MESMO CSS, e não uma imitação dele.
//
// A arte em SVG do /quiz-feriado (CenaSimulada) continua só lá: ela existe para
// avaliar o layout antes das fotos reais chegarem. Aqui a imagem é uma URL que
// quem cria o quiz informa, e sem ela o bloco some.

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
    // Trava de clique repetido. Na última pergunta sem captura, `enviar` é
    // chamado mas a etapa não muda enquanto o servidor responde — a tela fica
    // parada mostrando a mesma pergunta. Quem clicar de novo, achando que não
    // funcionou, gerava uma SEGUNDA resposta e um SEGUNDO lead, e o relatório
    // de "onde as pessoas caem" passava a contar a mesma pessoa duas vezes.
    if (enviando) return;

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

      <main className={estilos.pagina} data-tela={etapa}>
        <Topo />

        {etapa === "abertura" && (
          <TelaAbertura
            desabilitado={total === 0}
            onComecar={() => setEtapa("perguntas")}
            quiz={quiz}
          />
        )}

        {etapa === "perguntas" && pergunta && (
          <TelaPergunta
            indice={indice}
            ocupado={enviando}
            onEscolher={escolher}
            pergunta={pergunta}
            total={total}
          />
        )}

        {etapa === "captura" && (
          <section className={estilos.tela}>
            <div className={estilos.col}>
              <h2>Quase lá</h2>
              <p className={estilos.sub}>
                Deixe seu contato para receber o resultado.
              </p>
              <label className={estilos.campo}>
                <span>Nome completo</span>
                <input
                  onChange={(e) => setNome(e.target.value)}
                  value={nome}
                />
              </label>
              <label className={estilos.campo}>
                <span>WhatsApp</span>
                <input
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  placeholder="(86) 99999-8888"
                  value={telefone}
                />
              </label>
              <button
                className={estilos.acao}
                disabled={!podeEnviarContato || enviando}
                onClick={() => void enviar(respostas)}
                type="button"
              >
                {enviando ? "Calculando…" : "Ver meu resultado"}
              </button>
            </div>
          </section>
        )}

        {etapa === "resultado" && conteudo && (
          <TelaResultado
            linkCta={linkCta}
            nome={nome}
            quiz={quiz}
            resultado={conteudo}
          />
        )}

        {erro && (
          <p className={estilos.micro} role="alert">
            {erro}
          </p>
        )}
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
