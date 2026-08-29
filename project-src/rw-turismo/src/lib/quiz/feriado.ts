// GERADO por scripts/gerar-modulo-quiz.js a partir de quiz-feriado.html.
// Nao editar a copy aqui na mao: edite o standalone e rode o gerador de novo,
// senao as duas versoes do quiz divergem.
//
// Modulo puro de proposito — sem React, sem Supabase, sem window. E o que
// permite testar a pontuacao sem montar a pagina inteira.

export type Peso = "R" | "A" | "R+A" | "neutra";
export type Perfil = "relaxar-dominante" | "aventura-dominante" | "equilibrio";
export type LetraFoto = "A" | "B" | "C" | "D";

export type Opcao = { texto: string; peso: Peso };
export type Pergunta = { texto: string; opcoes: Opcao[] };

export const PERGUNTAS: Pergunta[] = [
  {
    texto: "Que cenário vem à sua mente quando você tem vontade de \"sumir\" da rotina por alguns dias?",
    opcoes: [
      { texto: "Uma rede balançando, silêncio com a natureza e uma vista incrível", peso: "R" },
      { texto: "Uma aventura com lugares históricos e atividades radicais", peso: "A" },
      { texto: "Água fria de piscina natural, bons restaurantes pra comer bem", peso: "R" },
      { texto: "Trilha, atividades e uma programação para se movimentar", peso: "A" },
    ],
  },
  {
    texto: "No feriado, seu corpo pede:",
    opcoes: [
      { texto: "Descansar até o despertador perder a função", peso: "R" },
      { texto: "Gastar muita energia e descansar a mente", peso: "A" },
    ],
  },
  {
    texto: "Se alguém te perguntasse: o que você mais precisa AGORA, o que seria?",
    opcoes: [
      { texto: "Silêncio", peso: "R" },
      { texto: "Adrenalina, nem que seja pouca", peso: "A" },
      { texto: "Parar de olhar pro celular", peso: "R" },
      { texto: "Sentir o coração acelerar de novo", peso: "A" },
      { texto: "Sinceramente, um pouco de tudo.", peso: "R+A" },
    ],
  },
  {
    texto: "Pensa numa foto que você postaria desse feriado. Ela mostra você:",
    opcoes: [
      { texto: "Parada, olhando a paisagem, sem pressa de tirar o celular do bolso", peso: "R" },
      { texto: "No meio do movimento: subindo, atravessando, se equilibrando", peso: "A" },
      { texto: "Nas duas cenas, numa sequência de stories", peso: "R+A" },
    ],
  },
  {
    texto: "Nesse feriado eu pretendo:",
    opcoes: [
      { texto: "Viajar só, pra curtir um tempo comigo ou conhecer pessoas novas", peso: "neutra" },
      { texto: "Viajar com meu amor, ter nosso feriado juntos sem preocupações", peso: "neutra" },
      { texto: "Viajar com minha família, onde meus filhos possam aproveitar bastante", peso: "neutra" },
      { texto: "Ainda não decidi quem vem comigo, mas sei que desejo muito viajar", peso: "neutra" },
    ],
  },
  {
    texto: "Se o feriado inteiro tivesse só UM momento de verdade, qual seria:",
    opcoes: [
      { texto: "Descansar bem, aproveitar cada segundo relaxando", peso: "R" },
      { texto: "Estar em lugares lindos para renovar as energias (e as fotos do Instagram)", peso: "R+A" },
      { texto: "Muita diversão e emoção, me movimentando bastante", peso: "A" },
    ],
  },
];

// Onde a pessoa cai na régua Descanso ←→ Aventura, em porcentagem da largura.
// É a personalização visível do resultado: o texto abaixo é o mesmo para todo
// mundo, e o que muda de pessoa para pessoa é o nome no título e este ponto.
export const POSICAO_NA_REGUA: Record<Perfil, number> = {
  "relaxar-dominante": 18,
  equilibrio: 50,
  "aventura-dominante": 82,
};

export const ROTULO_DA_REGUA: Record<Perfil, string> = {
  "relaxar-dominante": "Mais descanso",
  equilibrio: "Descanso e aventura, na mesma medida",
  "aventura-dominante": "Mais aventura",
};

// O parágrafo de abertura do resultado. Igual para os três perfis: o que
// personaliza é o nome e a posição na régua.
export const LEITURA_PADRAO =
  "Você quer sair da rotina e aproveitar o feriado de verdade, mas sem voltar precisando descansar do feriado. Este é um destino que mistura natureza, descanso e experiências diferentes, com movimento na medida certa.";

// Os quatro motivos do bloco "Por que essa viagem combina com você?".
export const MOTIVOS: string[] = [
  "Paisagens, serra e experiências ao ar livre para realmente mudar de cenário.",
  "Aventura na medida: teleférico, mirantes e passeios que deixam o feriado interessante.",
  "Tempo para desacelerar: são 2 dias e 1 noite para sair da rotina sem precisar tirar vários dias de folga.",
  "Pouca preocupação com organização: transporte, hospedagem e acompanhamento já fazem parte da viagem.",
];

// O que a viagem inclui, na ordem em que o cliente lê.
export const A_VIAGEM: string[] = [
  "Saída sábado, 5 de setembro",
  "Retorno segunda, 7 de setembro",
  "Transporte em ônibus categoria turística, com ar e WC",
  "Hospedagem e transporte inclusos no pacote",
  "Guia exclusivo acompanhando o grupo",
];

// Texto que entra na variavel {perfil} da mensagem de WhatsApp.
export const PERFIL_TEXTO: Record<Perfil, string> = {
  "relaxar-dominante": "silêncio",
  "aventura-dominante": "adrenalina",
  "equilibrio": "os dois, sem escolher só um"
};

// As 4 fotos previstas. Enquanto os arquivos reais nao chegam, cada slot fica
// como placeholder cinza com a propria descricao dentro.
export const FOTOS: Record<LetraFoto, string> = {
  "A": "Balanço/mirante com vista para a serra",
  "B": "Restaurante/deck ao entardecer, com vista panorâmica da serra",
  "C": "Piscina natural de pedra com queda d'água",
  "D": "Teleférico sobre a mata"
};

export const FOTOS_POR_PERFIL: Record<Perfil, LetraFoto[]> = {
  "relaxar-dominante": [
    "C",
    "B"
  ],
  "aventura-dominante": [
    "D",
    "A"
  ],
  "equilibrio": [
    "C",
    "D"
  ]
};

export const WHATSAPP_NUMERO = "5586999207088";

export const MOLDE_WHATSAPP =
  "Oi! Fiz o quiz do feriado de 7 de setembro e minha leitura pediu mais {perfil}. Meu resultado foi a Serra da Ibiapaba, Sítio do Bosco, Lapa e Ubajara, saída dia 5 de setembro. Meu nome é {nome} e embarco em {cidade}. Me conta como garanto minha poltrona e como fica o pagamento?";

export const CIDADE_PADRAO = "a confirmar";

/**
 * Soma os pesos das 6 respostas e devolve o perfil.
 *
 * R = 1 ponto para Relaxar; A = 1 para Aventura; "R+A" = 0,5 para cada;
 * "neutra" nao soma nada. Diferenca de 0,5 ponto ou mais define o dominante;
 * abaixo disso, inclusive no empate exato, cai em equilibrio.
 */
export const calcularPerfil = (pesos: Peso[]): Perfil => {
  let totalRelaxar = 0;
  let totalAventura = 0;

  for (const peso of pesos) {
    if (peso === "R") totalRelaxar += 1;
    else if (peso === "A") totalAventura += 1;
    else if (peso === "R+A") {
      totalRelaxar += 0.5;
      totalAventura += 0.5;
    }
  }

  const diferenca = totalRelaxar - totalAventura;

  if (diferenca >= 0.5) return "relaxar-dominante";
  if (diferenca <= -0.5) return "aventura-dominante";
  return "equilibrio";
};

/**
 * Monta a mensagem do WhatsApp numa passada so.
 *
 * Encadear .replace() com string de substituicao quebrava de duas formas: o
 * segundo argumento interpreta \$&, \$' e \$` (um nome como "Ana \$' Silva"
 * duplicava o fim do texto), e cada .replace troca so a primeira ocorrencia,
 * entao um nome contendo "{cidade}" consumia o lugar do campo seguinte e o
 * placeholder real ia literal para o WhatsApp. A funcao devolve texto cru e o
 * /g resolve tudo antes de qualquer valor digitado ser reprocessado.
 */
export const montarMensagem = (
  perfil: Perfil,
  nome: string,
  cidade: string
): string => {
  const valores: Record<string, string> = {
    "{perfil}": PERFIL_TEXTO[perfil],
    "{nome}": nome,
    "{cidade}": cidade.trim() || CIDADE_PADRAO,
  };
  return MOLDE_WHATSAPP.replace(
    /\{perfil\}|\{nome\}|\{cidade\}/g,
    (chave) => valores[chave] ?? chave
  );
};

export const montarLinkWhatsApp = (
  perfil: Perfil,
  nome: string,
  cidade: string
): string =>
  `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
    montarMensagem(perfil, nome, cidade)
  )}`;

/** Digitos do telefone, ja sem o codigo do pais quando ele veio junto. */
export const digitosDoTelefone = (valor: string): string => {
  let digitos = (valor || "").replace(/\D/g, "");
  // Quem digita +55 86 99920-7088 nao pode ser barrado por causa do pais.
  if (digitos.length > 11 && digitos.startsWith("55")) digitos = digitos.slice(2);
  return digitos;
};

export const mascararTelefone = (valor: string): string => {
  const d = digitosDoTelefone(valor).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/** Nome + sobrenome: pelo menos duas partes preenchidas. */
export const nomeValido = (valor: string): boolean =>
  String(valor || "").trim().split(/\s+/).filter(Boolean).length >= 2;

/** DDD de 2 digitos + 8 ou 9 digitos de numero. */
export const telefoneValido = (valor: string): boolean => {
  const d = digitosDoTelefone(valor);
  return d.length === 10 || d.length === 11;
};
