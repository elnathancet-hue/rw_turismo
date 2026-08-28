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
    texto: "Bate a vontade de sumir da rotina por uns dias. O que aparece primeiro na sua cabeça?",
    opcoes: [
      { texto: "Uma rede balançando, silêncio grosso, ninguém te chamando", peso: "R" },
      { texto: "Um teleférico subindo a serra, o vento batendo no rosto", peso: "A" },
      { texto: "Água fria de piscina natural, pés na pedra, tempo andando devagar", peso: "R" },
      { texto: "Uma trilha te esperando, com uma vista que só existe pra quem sobe até ela", peso: "A" },
    ],
  },
  {
    texto: "No feriado, seu corpo pede:",
    opcoes: [
      { texto: "Descansar até o despertador perder a função", peso: "R" },
      { texto: "Se cansar de um jeito bom", peso: "A" },
    ],
  },
  {
    texto: "Se alguém te perguntasse o que você mais precisa agora, o que sairia primeiro?",
    opcoes: [
      { texto: "Silêncio", peso: "R" },
      { texto: "Adrenalina, nem que seja pouca", peso: "A" },
      { texto: "Parar de olhar pro celular", peso: "R" },
      { texto: "Sentir o coração acelerar de novo", peso: "A" },
      { texto: "Um pouco dos dois, sinceramente", peso: "R+A" },
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
    texto: "Quem te acompanha nesse feriado também entra na conta. Juntos, vocês combinam mais com:",
    opcoes: [
      { texto: "Ficar parados no mesmo lugar até alguém ter coragem de levantar", peso: "R" },
      { texto: "Ir atrás de cada trilha e mirante que aparecer pela frente", peso: "A" },
      { texto: "Alternar: uma hora parado, outra se mexendo", peso: "R+A" },
      { texto: "Ainda não decidi quem vem comigo, mas já sei o que eu quero sentir", peso: "neutra" },
    ],
  },
  {
    texto: "Se o feriado inteiro tivesse só UM momento de verdade, qual seria:",
    opcoes: [
      { texto: "A água fria da piscina natural batendo na pele, sem pressa de sair", peso: "R" },
      { texto: "O balanço solto no mirante, os pés soltando do chão por um segundo", peso: "A" },
      { texto: "O sol caindo atrás da serra, vendo tudo de uma vez, quieta", peso: "R" },
    ],
  },
];

export const LEITURAS: Record<Perfil, string> = {
  "relaxar-dominante": "Suas respostas pediram mais silêncio do que movimento. E essa serra tem exatamente isso: piscina natural de pedra pra ficar parada até decidir sair, e um deck de frente pro entardecer pra não fazer mais nada além de olhar.",
  "aventura-dominante": "Suas respostas pediram mais movimento do que pausa. E essa serra tem exatamente isso: teleférico cortando a mata, mirante com balanço solto no ar, um jeito de se cansar que não cansa.",
  "equilibrio": "Suas respostas dividiram quase igual entre parar e se mexer. Essa serra foi feita pra isso: piscina natural numa parte do dia, teleférico e mirante na outra, sem forçar escolha."
};

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
