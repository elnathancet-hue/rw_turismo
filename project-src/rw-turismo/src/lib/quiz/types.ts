// O quiz como ele vive no banco (tabela `quizzes`, migration 20260906).
//
// Espelha o jsonb, e nada aqui é HTML: todo campo é texto e vai para a tela
// pelo React, portanto escapado. É essa garantia que permite o papel `conteudo`
// criar quiz — foi a falta dela que obrigou a travar pages.custom_html.

/** Quanto uma opção soma em cada eixo. Objeto vazio = opção neutra. */
export type Pesos = Record<string, number>;

export type QuizOpcao = {
  texto: string;
  pesos: Pesos;
};

export type QuizPergunta = {
  texto: string;
  opcoes: QuizOpcao[];
  /**
   * Pergunta que NAO decide o resultado — ela colhe informacao (quantas
   * pessoas viajam, de onde saem) e o desfecho nao depende dela.
   *
   * Existe para o editor poder distinguir "esqueci de pontuar" de "esta e
   * informativa de proposito". Sem isso, a unica saida para calar o aviso seria
   * inventar pesos, o que mudaria o resultado de quem responde.
   *
   * NAO muda a pontuacao: opcao sem peso ja soma zero, e o motor no banco
   * continua igual. E declaracao de intencao, lida so pelo painel.
   */
  informativa?: boolean;
};

/** Uma foto do resultado. Sem `url` o bloco nao renderiza. */
export type QuizFoto = {
  url: string;
  legenda?: string | null;
  /** Selo no canto, ex "SIMULACAO". Vazio nao desenha o selo. */
  selo?: string | null;
};

/** O bloco "Seu destino": nome grande, subtitulo e a lista de itens. */
export type QuizDestino = {
  nome?: string | null;
  subtitulo?: string | null;
  itens?: string[];
};

export type QuizResultado = {
  chave: string;
  /** Qual eixo dominante leva a este resultado. NULO marca o de empate. */
  eixo: string | null;
  rotulo: string;
  /**
   * Titulo da tela de resultado. Aceita {{nome}} e {{rotulo}}.
   * Vazio cai no `rotulo`, que todo resultado tem — assim quiz antigo, feito
   * antes destes campos existirem, continua com uma tela de pe.
   */
  titulo?: string | null;
  texto?: string | null;
  /**
   * Foto unica, do modelo antigo. Fica por causa dos quizzes ja gravados: o
   * renderizador a trata como a primeira de `fotos`. O editor novo grava em
   * `fotos`.
   */
  foto?: string | null;
  fotos?: QuizFoto[];
  /**
   * 0 a 100: onde este resultado cai na regua entre os dois eixos. A regua e o
   * que personaliza a tela visualmente — o texto acima dela costuma ser o mesmo
   * para todo mundo, e o ponto e o que muda conforme as respostas.
   * So desenha em quiz de DOIS eixos: com tres ou mais, uma regua de uma
   * dimensao mentiria sobre o resultado.
   */
  posicao?: number | null;
  /** Frase sob a regua, ex "Mais aventura". */
  regua_rotulo?: string | null;
  /** Lista com check verde: por que este resultado combina com a pessoa. */
  motivos?: string[];
  destino?: QuizDestino | null;
};

export type QuizIntro = {
  titulo?: string | null;
  /** O olho, acima do titulo. */
  subtitulo?: string | null;
  /** Paragrafo de apoio, entre o titulo e a imagem. */
  texto?: string | null;
  texto_botao?: string | null;
  /** Imagem da primeira tela. Vazia, a abertura fica so com o texto. */
  imagem?: string | null;
  /** Legenda sobre a base da imagem. */
  imagem_legenda?: string | null;
  /** Selo no canto da imagem, ex "Simulacao". */
  imagem_selo?: string | null;
  /** Linhas pequenas sob o botao, ex "Leva menos de 2 minutos.". */
  micro?: string[];
};

export type QuizCta = {
  tipo?: "whatsapp" | "nenhum" | null;
  numero?: string | null;
  /** Mensagem pronta; {{resultado}} e {{nome}} são trocados na hora. */
  molde?: string | null;
  texto_botao?: string | null;
  /** Linhas pequenas sob o botao, ex "Voce cai direto no WhatsApp...". */
  micro?: string[];
};

/**
 * A moldura da tela de resultado: os rotulos que sao os MESMOS para todos os
 * resultados do quiz. Ficam aqui, e nao dentro de cada resultado, para quem
 * edita nao ter de repetir a mesma frase em cada desfecho.
 */
export type QuizResultadoLayout = {
  /** O olho acima do titulo, ex "Sua leitura". */
  olho?: string | null;
  /** Cabecalho da lista de motivos, ex "Por que essa viagem combina com voce?" */
  titulo_motivos?: string | null;
  /** Cabecalho do bloco de destino, ex "Seu destino". */
  titulo_destino?: string | null;
  /** Linha de confianca em texto pequeno, abaixo dos blocos. */
  selo?: string | null;
  /** Assinatura no rodape, ex "@rwturismo.pi". */
  assinatura?: string | null;
};

export type Quiz = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  seo_title: string | null;
  seo_description: string | null;
  intro: QuizIntro;
  eixos: string[];
  perguntas: QuizPergunta[];
  resultados: QuizResultado[];
  margem_empate: number;
  cta: QuizCta;
  captura_ativa: boolean;
  resultado_layout?: QuizResultadoLayout;
};

/** O que a pessoa escolheu: índice da pergunta e índice da opção. */
export type RespostaEscolhida = { pergunta: number; opcao: number };

/** O que responder_quiz() devolve. O resultado vem do banco, nunca daqui. */
export type ResultadoDoQuiz = {
  resultado: string;
  pontuacao: Record<string, number>;
  conteudo: QuizResultado | null;
};
