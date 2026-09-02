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
};

export type QuizResultado = {
  chave: string;
  /** Qual eixo dominante leva a este resultado. NULO marca o de empate. */
  eixo: string | null;
  rotulo: string;
  texto?: string | null;
  /** URL da imagem. Vazio renderiza sem imagem, e a tela continua de pé. */
  foto?: string | null;
  /** 0 a 100: onde o resultado cai numa régua, quando o quiz usa uma. */
  posicao?: number | null;
};

export type QuizIntro = {
  titulo?: string | null;
  subtitulo?: string | null;
  texto_botao?: string | null;
};

export type QuizCta = {
  tipo?: "whatsapp" | "nenhum" | null;
  numero?: string | null;
  /** Mensagem pronta; {{resultado}} e {{nome}} são trocados na hora. */
  molde?: string | null;
  texto_botao?: string | null;
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
};

/** O que a pessoa escolheu: índice da pergunta e índice da opção. */
export type RespostaEscolhida = { pergunta: number; opcao: number };

/** O que responder_quiz() devolve. O resultado vem do banco, nunca daqui. */
export type ResultadoDoQuiz = {
  resultado: string;
  pontuacao: Record<string, number>;
  conteudo: QuizResultado | null;
};
