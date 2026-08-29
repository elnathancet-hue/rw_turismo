import Head from "next/head";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { submitSiteLead } from "../lib/leads/client";
import {
  CIDADE_PADRAO,
  calcularPerfil,
  FOTOS,
  FOTOS_POR_PERFIL,
  A_VIAGEM,
  LEITURA_PADRAO,
  MOTIVOS,
  POSICAO_NA_REGUA,
  ROTULO_DA_REGUA,
  mascararTelefone,
  montarLinkWhatsApp,
  nomeValido,
  PERFIL_TEXTO,
  PERGUNTAS,
  telefoneValido,
  type Perfil,
  type Peso,
} from "../lib/quiz/feriado";
import CenaSimulada, {
  CenaAbertura,
  type LetraFoto,
} from "../components/quiz/CenaSimulada";
import estilos from "../styles/quiz-feriado.module.css";

// Quiz de captação para o feriado de 7 de setembro.
//
// A página usa a identidade do sistema: fundo cinza, cartão branco, tipografia
// e botões iguais aos do resto do app. A primeira versão era uma landing escura
// com céu animado e duas fontes próprias — bonita, mas não parecia do site.
//
// A logo assina o topo, e é só ela: sem Header e sem Footer de propósito.
// Menu numa página de captação é porta de saída antes de a pessoa virar lead —
// cada link ali compete com o quiz. Pelo mesmo motivo o WhatsAppFloat segue
// suprimido nesta rota (ver WhatsAppFloat.tsx).
//
// A copy e a regra de pontuação moram em lib/quiz/feriado.ts, gerado a partir
// do quiz-feriado.html na raiz do repositório. Não reescrever copy aqui.

type Etapa = "abertura" | "quiz" | "transicao" | "captura" | "resultado";

const POLO_COR: Record<Perfil, string> = {
  "relaxar-dominante": "var(--azul)",
  "aventura-dominante": "var(--marca)",
  equilibrio: "var(--borda-forte)",
};

const Seta = () => (
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

// As 4 fotos da agência ainda não existem. No lugar dos retângulos tracejados
// que estavam aqui, entra uma cena desenhada — dá para julgar layout e ritmo
// sem esperar a produção das fotos. A legenda continua dizendo qual foto vai
// naquele lugar, e o selo "simulação" impede que alguém confunda com a real.
const Fotos = ({ letras, larga }: { letras: readonly LetraFoto[]; larga?: boolean }) => (
  <div className={`${estilos.fotos}${larga ? ` ${estilos.fotosLarga}` : ""}`}>
    {letras.map((letra) => (
      <figure className={estilos.foto} key={letra}>
        <CenaSimulada letra={letra} />
        <span className={estilos.fotoSelo}>Simulação</span>
        <figcaption className={estilos.fotoLegenda}>{FOTOS[letra]}</figcaption>
      </figure>
    ))}
  </div>
);

// A abertura mostra PARA ONDE se vai, antes de a pessoa saber o que tem lá —
// por isso a serra inteira, e não uma das quatro atrações.
const Abertura = () => (
  <figure className={`${estilos.foto} ${estilos.fotoAbertura}`}>
    <CenaAbertura />
    <span className={estilos.fotoSelo}>Simulação</span>
    <figcaption className={estilos.fotoLegenda}>
      Piscina com vista da Serra da Ibiapaba, no fim da tarde
    </figcaption>
  </figure>
);

// Só a logo, sem navegação. Ver o comentário no topo do arquivo.
const Topo = () => (
  <header className={estilos.topo}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt="RW Turismo" src="/rw-turismo-logo.png" />
  </header>
);

const Assinatura = () => <p className={estilos.assinatura}>@rwturismo.pi</p>;

const QuizFeriado = () => {
  const [etapa, setEtapa] = useState<Etapa>("abertura");
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<Peso[]>([]);
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [travado, setTravado] = useState(false);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [linhaAtiva, setLinhaAtiva] = useState(0);
  const [semMovimento, setSemMovimento] = useState(false);

  const [nome, setNome] = useState("");
  const [fone, setFone] = useState("");
  const [cidade, setCidade] = useState("");
  const [erroNome, setErroNome] = useState("");
  const [erroFone, setErroFone] = useState("");

  const refPergunta = useRef<HTMLHeadingElement>(null);
  const refCaptura = useRef<HTMLHeadingElement>(null);
  const refResultado = useRef<HTMLHeadingElement>(null);
  const refNome = useRef<HTMLInputElement>(null);
  const refFone = useRef<HTMLInputElement>(null);
  const caretFone = useRef<number | null>(null);

  // Num input controlado cujo valor é reescrito pela máscara, o React repinta e
  // o cursor vai parar no fim. Digitar em sequência não sofre (o cursor já está
  // no fim), mas quem volta pra corrigir um dígito no meio vê o cursor pular —
  // e o campo é o do WhatsApp, o dado que a venda inteira depende.
  useLayoutEffect(() => {
    if (caretFone.current === null || !refFone.current) return;
    refFone.current.setSelectionRange(caretFone.current, caretFone.current);
    caretFone.current = null;
  }, [fone]);

  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSemMovimento(consulta.matches);
    const aoMudar = (evento: MediaQueryListEvent) => setSemMovimento(evento.matches);
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  // O fundo do app é claro. Sem pintar o body, o excesso de rolagem no celular
  // mostra uma faixa branca por baixo da página escura.
  useEffect(() => {
    const anterior = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#0F172A";
    return () => {
      document.body.style.backgroundColor = anterior;
    };
  }, []);

  // Sequência da tela de transição: três linhas, uma de cada vez, dentro da
  // janela de 2 a 3 segundos que a espec pede.
  useEffect(() => {
    if (etapa !== "transicao") return undefined;

    const marcas: number[] = [
      window.setTimeout(() => setLinhaAtiva(1), 40),
      window.setTimeout(() => setLinhaAtiva(0), 900),
      window.setTimeout(() => setLinhaAtiva(2), 950),
      window.setTimeout(() => setLinhaAtiva(0), 1810),
      window.setTimeout(() => setLinhaAtiva(3), 1860),
      window.setTimeout(() => setEtapa("captura"), 2750),
    ];

    return () => marcas.forEach((marca) => window.clearTimeout(marca));
  }, [etapa]);

  useEffect(() => {
    if (etapa === "quiz") refPergunta.current?.focus({ preventScroll: true });
    if (etapa === "captura") refCaptura.current?.focus({ preventScroll: true });
    if (etapa === "resultado") refResultado.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [etapa, indice]);

  const responder = useCallback(
    (peso: Peso, posicao: number) => {
      if (travado) return;
      setTravado(true);
      setEscolhida(posicao);
      setRespostas((anteriores) => {
        const proximas = [...anteriores];
        proximas[indice] = peso;
        return proximas;
      });

      // Avanço automático: sem botão de "próxima". A pausa curta existe só
      // para a marca de seleção terminar de desenhar.
      window.setTimeout(
        () => {
          setTravado(false);
          setEscolhida(null);
          if (indice + 1 < PERGUNTAS.length) setIndice(indice + 1);
          else setEtapa("transicao");
        },
        semMovimento ? 60 : 330
      );
    },
    [indice, semMovimento, travado]
  );

  const aoEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    const okNome = nomeValido(nome);
    const okFone = telefoneValido(fone);

    setErroNome(okNome ? "" : "Escreva seu nome e o sobrenome.");
    setErroFone(okFone ? "" : "Digite o DDD e o número, como em (86) 99920-7088.");

    if (!okNome) {
      refNome.current?.focus();
      return;
    }
    if (!okFone) {
      refFone.current?.focus();
      return;
    }

    const calculado = calcularPerfil(respostas);
    setPerfil(calculado);

    // O lead entra no CRM AQUI, e não no clique do WhatsApp: quem responde as 6
    // perguntas e entrega o contato já é lead, mesmo que feche a aba sem tocar
    // no botão. A UTM da campanha vem junto (captureUtmFromUrl roda no _app).
    //
    // Deliberadamente sem await e sem travar a tela: falha de rede não pode
    // segurar a revelação. O link do WhatsApp continua sendo o caminho
    // garantido, então uma falha aqui custa o registro, nunca a venda.
    void submitSiteLead({
      name: nome.trim(),
      phone: fone.trim(),
      interest: "Quiz Feriado 7 de Setembro",
      message: `Perfil: ${PERFIL_TEXTO[calculado]} · Embarque: ${
        cidade.trim() || CIDADE_PADRAO
      }`,
    }).catch((erro: unknown) => {
      // Não interrompe nada, mas também não some: sem este aviso, uma falha de
      // insert (a coluna position estourando o integer, por exemplo) seria
      // indistinguível de "ninguém preencheu o formulário".
      console.warn("quiz-feriado: lead não foi gravado no CRM", erro);
    });

    setEtapa("resultado");
  };

  const pergunta = PERGUNTAS[indice];

  // Só o primeiro nome no título: "Maria, suas respostas..." soa como conversa;
  // o nome completo soaria como cadastro.
  const primeiroNome = nome.trim().split(" ").filter(Boolean)[0] ?? "";

  return (
    <>
      <Head>
        <title>Silêncio ou Adrenalina</title>
        <meta
          content="São 6 perguntas rápidas sobre o seu jeito de aproveitar, não sobre destino. No fim, a gente te mostra a serra que já tem saída certa pra esse feriado."
          name="description"
        />
        <meta content="noindex" name="robots" />
        {/* Sem viewport-fit=cover os env(safe-area-inset-*) do CSS resolvem
            para 0 e o enquadramento no iPhone difere do standalone. */}
        <meta
          content="width=device-width, initial-scale=1, viewport-fit=cover"
          name="viewport"
        />
        {/* O CTA joga a pessoa no WhatsApp e o link acaba colado em conversa:
            a prévia precisa ser a mesma que o standalone entregava. */}
        <meta content="website" property="og:type" />
        <meta
          content="Descubra se o seu feriado pede silêncio ou adrenalina"
          property="og:title"
        />
        <meta
          content="6 perguntas rápidas sobre o seu jeito de aproveitar. No fim, a serra que já tem saída certa pro feriado de 7 de setembro."
          property="og:description"
        />
        {/* Sem sobrescrever favicon nem theme-color: a página passou a assumir
            a marca, então os do _app servem. E sem fonte externa — o site não
            carrega nenhuma, e é essa a tipografia que se quer aqui. */}
      </Head>

      <main className={estilos.pagina} data-tela={etapa}>
        <Topo />

        {etapa === "abertura" && (
          <section className={estilos.tela}>
            <div className={`${estilos.col} ${estilos.entra}`}>
              <p className={estilos.olho}>
                Feriado de 7 de setembro &middot; Saída já confirmada
              </p>
              <h1>
                Qual destino combina com você e com seu bolso no feriado 7 de
                setembro?
              </h1>
              <p className={estilos.sub}>
                Responda essas perguntas rápidas e descubra qual experiência você
                ainda pode viver sem preocupações neste feriadão.
              </p>
              <Abertura />
              <button
                className={estilos.acao}
                onClick={() => {
                  setIndice(0);
                  setRespostas([]);
                  setEtapa("quiz");
                }}
                type="button"
              >
                Começar o teste
                <Seta />
              </button>
              <p className={estilos.micro}>
                Leva menos de 2 minutos. Sem e-mail, sem pegadinha, sem ninguém ligando
                sem avisar.
              </p>
            </div>
          </section>
        )}

        {etapa === "quiz" && pergunta && (
          <section className={estilos.tela}>
            <div className={estilos.col}>
              <div className={estilos.passo}>
                <div className={estilos.passoTopo}>
                  <span>
                    Pergunta <b>{indice + 1}</b> de 6
                  </span>
                </div>
                <div aria-hidden="true" className={estilos.trilho}>
                  {PERGUNTAS.map((_, posicao) => (
                    <span
                      className={posicao <= indice ? estilos.trilhoFeito : undefined}
                      key={posicao}
                    />
                  ))}
                </div>
              </div>

              <h2 className={estilos.pergunta} ref={refPergunta} tabIndex={-1}>
                {pergunta.texto}
              </h2>

              <ul className={estilos.opcoes}>
                {pergunta.opcoes.map((opcao, posicao) => (
                  <li key={`${indice}-${posicao}`}>
                    <button
                      className={`${estilos.opcao}${
                        escolhida === posicao ? ` ${estilos.escolhida}` : ""
                      }`}
                      disabled={travado}
                      onClick={() => responder(opcao.peso, posicao)}
                      style={{
                        animationDelay: semMovimento ? "0s" : `${0.05 + posicao * 0.05}s`,
                      }}
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
              {`Pergunta ${indice + 1} de 6. ${pergunta.texto}`}
            </p>
          </section>
        )}

        {etapa === "transicao" && (
          <section aria-label="Calculando o resultado" className={estilos.tela}>
            <div className={estilos.col}>
              <div className={estilos.calculando}>
                <div className={estilos.linhas}>
                  <p className={linhaAtiva === 1 ? estilos.linhaVisivel : undefined}>
                    Somando o que pesou mais nas suas respostas
                  </p>
                  <p className={linhaAtiva === 2 ? estilos.linhaVisivel : undefined}>
                    Conferindo a saída de 5 de setembro
                  </p>
                  <p className={linhaAtiva === 3 ? estilos.linhaVisivel : undefined}>
                    Sua leitura está pronta, bora ver
                  </p>
                </div>
                <div className={`${estilos.barra} ${estilos.barraCorrendo}`}>
                  <i />
                </div>
              </div>
            </div>
          </section>
        )}

        {etapa === "captura" && (
          <section className={estilos.tela}>
            <div className={`${estilos.col} ${estilos.entra}`}>
              <h2 ref={refCaptura} tabIndex={-1}>
                Sua leitura já está pronta. Falta só um passo pra ver
              </h2>

              <form className={estilos.form} noValidate onSubmit={aoEnviar}>
                <div
                  className={`${estilos.campo}${erroNome ? ` ${estilos.campoErro}` : ""}`}
                >
                  <label htmlFor="quiz-nome">Seu nome completo</label>
                  <input
                    aria-describedby="quiz-nome-erro"
                    aria-invalid={erroNome ? true : undefined}
                    autoComplete="name"
                    id="quiz-nome"
                    onChange={(evento) => {
                      setNome(evento.target.value);
                      if (erroNome && nomeValido(evento.target.value)) setErroNome("");
                    }}
                    placeholder="Nome e sobrenome"
                    ref={refNome}
                    required
                    type="text"
                    value={nome}
                  />
                  <p className={estilos.erro} id="quiz-nome-erro" role="alert">
                    {erroNome}
                  </p>
                </div>

                <div
                  className={`${estilos.campo}${erroFone ? ` ${estilos.campoErro}` : ""}`}
                >
                  <label htmlFor="quiz-fone">Seu WhatsApp, com DDD</label>
                  {/* Sem maxLength de propósito: o navegador cortaria antes do
                      handler, e colar "+55 86 99920-7088" viraria um número
                      errado que passa na validação. A máscara já limita. */}
                  <input
                    aria-describedby="quiz-fone-erro"
                    aria-invalid={erroFone ? true : undefined}
                    autoComplete="tel-national"
                    id="quiz-fone"
                    inputMode="numeric"
                    onChange={(evento) => {
                      const bruto = evento.target.value;
                      const posicao = evento.target.selectionStart;
                      const mascarado = mascararTelefone(bruto);
                      // Só guarda a posição quando a edição foi no meio: no fim
                      // do campo o comportamento padrão já está certo.
                      if (posicao !== null && posicao < bruto.length) {
                        caretFone.current = Math.max(
                          0,
                          posicao + (mascarado.length - bruto.length)
                        );
                      }
                      setFone(mascarado);
                      if (erroFone && telefoneValido(mascarado)) setErroFone("");
                    }}
                    placeholder="(86) 99999-9999"
                    ref={refFone}
                    required
                    type="tel"
                    value={fone}
                  />
                  <p className={estilos.erro} id="quiz-fone-erro" role="alert">
                    {erroFone}
                  </p>
                </div>

                <div className={estilos.campo}>
                  <label htmlFor="quiz-cidade">
                    Sua cidade de embarque{" "}
                    <span className={estilos.opcional}>
                      (ajuda a confirmar o ponto mais perto de você)
                    </span>
                  </label>
                  <input
                    autoComplete="address-level2"
                    id="quiz-cidade"
                    onChange={(evento) => setCidade(evento.target.value)}
                    placeholder="Opcional"
                    type="text"
                    value={cidade}
                  />
                </div>

                <button className={estilos.acao} type="submit">
                  Revelar meu feriado
                  <Seta />
                </button>
              </form>

              <p className={estilos.micro}>
                Sem spam, sem venda por telefone sem avisar. Só a confirmação da sua vaga
                por onde você já usa: o WhatsApp.
              </p>
            </div>
          </section>
        )}

        {etapa === "resultado" && perfil && (
          <section className={`${estilos.tela} ${estilos.telaLonga}`}>
            <div className={`${estilos.revelacao} ${estilos.entra}`}>
              <p className={estilos.olho}>Sua leitura</p>
              <h2 ref={refResultado} tabIndex={-1}>
                {primeiroNome ? `${primeiroNome}, suas` : "Suas"} respostas mostram
                que a Serra da Ibiapaba combina com o feriado que você quer viver.
              </h2>

              <p className={estilos.sub}>{LEITURA_PADRAO}</p>

              {/* A régua é o que personaliza o resultado visualmente: o texto
                  acima é o mesmo para todo mundo, e o ponto abaixo é o que muda
                  conforme as respostas. */}
              <div className={estilos.regua}>
                <div className={estilos.reguaTrilho}>
                  <span
                    className={estilos.reguaMarca}
                    style={{ left: `${POSICAO_NA_REGUA[perfil]}%` }}
                  >
                    <span aria-hidden="true">😍</span>
                  </span>
                </div>
                <div className={estilos.reguaPontas}>
                  <span>Descanso</span>
                  <span>Aventura</span>
                </div>
                <p aria-live="polite" className={estilos.reguaRotulo}>
                  {ROTULO_DA_REGUA[perfil]}
                </p>
              </div>

              <div className={estilos.bloco}>
                <h3>Por que essa viagem combina com você?</h3>
                <ul className={estilos.motivos}>
                  {MOTIVOS.map((motivo) => (
                    <li key={motivo}>{motivo}</li>
                  ))}
                </ul>
              </div>

              <Fotos letras={FOTOS_POR_PERFIL[perfil]} />

              <div className={estilos.bloco}>
                <h3>Seu destino</h3>
                <p className={estilos.destino}>Serra da Ibiapaba</p>
                <p className={estilos.destinoSub}>
                  Sítio do Bosco + Lapa + Ubajara
                </p>
                <ul className={estilos.itens}>
                  {A_VIAGEM.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <p className={estilos.selo}>
                Mais de 25 anos de estrada, Cadastur, loja física em Teresina, guia
                acompanhando o grupo do começo ao fim.
              </p>

              <div className={estilos.apoio}>
                <a
                  className={estilos.acao}
                  href={montarLinkWhatsApp(perfil, nome.trim(), cidade.trim())}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  QUERO conhecer a viagem
                  <Seta />
                </a>
                <p className={estilos.micro}>
                  Você cai direto no WhatsApp, com a mensagem já escrita. É só conferir e
                  mandar.
                </p>
                <p className={estilos.micro}>
                  Ou chama direto no <span className={estilos.fone}>86 99920-7088</span>.
                  Viajar é preciso.
                </p>
              </div>

              <Assinatura />
            </div>
          </section>
        )}

      </main>
    </>
  );
};

export default QuizFeriado;
