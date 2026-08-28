// Gera src/lib/quiz/feriado.ts a partir do quiz-feriado.html ja auditado.
// A copy nao e redigitada em lugar nenhum: e extraida do arquivo que passou
// pela auditoria de fidelidade. Rodar de novo depois de qualquer mudanca de
// copy no standalone mantem as duas versoes iguais.
const fs = require('fs');

const ORIGEM = 'c:/sistema_rwturismo/quiz-feriado.html';
const DESTINO = 'c:/sistema_rwturismo/project-src/rw-turismo/src/lib/quiz/feriado.ts';

const html = fs.readFileSync(ORIGEM, 'utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function bloco(nome) {
  const i = js.indexOf('var ' + nome + ' =');
  if (i < 0) throw new Error('nao achei ' + nome);
  const start = js.indexOf('=', i) + 1;
  let k = start, dep = 0;
  while (k < js.length) {
    const c = js[k];
    if (c === '[' || c === '{') dep++;
    else if (c === ']' || c === '}') { dep--; if (dep === 0) { k++; break; } }
    k++;
  }
  return eval('(' + js.slice(start, k) + ')');
}

const PERGUNTAS = bloco('PERGUNTAS');
const LEITURAS = bloco('LEITURAS');
const PERFIL_TEXTO = bloco('PERFIL_TEXTO');
const FOTOS = bloco('FOTOS');
const FOTOS_POR_PERFIL = bloco('FOTOS_POR_PERFIL');

const MOLDE = eval(
  js.slice(js.indexOf('var MOLDE'), js.indexOf(';', js.indexOf('como fica o pagamento')))
    .replace('var MOLDE =', '')
);
const WHATSAPP = js.match(/var WHATSAPP = '(\d+)'/)[1];

// ---- conferencias antes de emitir ----
const esperado = [
  { R: 2, A: 2 }, { R: 1, A: 1 }, { R: 2, A: 2, 'R+A': 1 },
  { R: 1, A: 1, 'R+A': 1 }, { R: 1, A: 1, 'R+A': 1, neutra: 1 }, { R: 2, A: 1 },
];
if (PERGUNTAS.length !== 6) throw new Error('esperava 6 perguntas, achei ' + PERGUNTAS.length);
PERGUNTAS.forEach((p, i) => {
  const c = {};
  p.opcoes.forEach((o) => { c[o[1]] = (c[o[1]] || 0) + 1; });
  const a = JSON.stringify(Object.entries(c).sort());
  const b = JSON.stringify(Object.entries(esperado[i]).sort());
  if (a !== b) throw new Error('P' + (i + 1) + ' tem pesos ' + a + ', a espec pede ' + b);
});
for (const k of ['relaxar-dominante', 'aventura-dominante', 'equilibrio']) {
  if (!LEITURAS[k] || !PERFIL_TEXTO[k] || !FOTOS_POR_PERFIL[k]) throw new Error('faltou ' + k);
}
if (/R\$\s*435|quatrocentos/i.test(MOLDE)) throw new Error('valor proibido no molde');
if (/rw\s*turismo/i.test(JSON.stringify([PERGUNTAS, LEITURAS, MOLDE]))) {
  throw new Error('nome da marca vazou para os dados');
}

const j = (v) => JSON.stringify(v);

const perguntasTs = PERGUNTAS.map((p) =>
  '  {\n' +
  '    texto: ' + j(p.texto) + ',\n' +
  '    opcoes: [\n' +
  p.opcoes.map((o) => '      { texto: ' + j(o[0]) + ', peso: ' + j(o[1]) + ' },').join('\n') +
  '\n    ],\n  },'
).join('\n');

const saida = `// GERADO por scripts/gerar-modulo-quiz.js a partir de quiz-feriado.html.
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
${perguntasTs}
];

export const LEITURAS: Record<Perfil, string> = ${JSON.stringify(LEITURAS, null, 2)};

// Texto que entra na variavel {perfil} da mensagem de WhatsApp.
export const PERFIL_TEXTO: Record<Perfil, string> = ${JSON.stringify(PERFIL_TEXTO, null, 2)};

// As 4 fotos previstas. Enquanto os arquivos reais nao chegam, cada slot fica
// como placeholder cinza com a propria descricao dentro.
export const FOTOS: Record<LetraFoto, string> = ${JSON.stringify(FOTOS, null, 2)};

export const FOTOS_POR_PERFIL: Record<Perfil, LetraFoto[]> = ${JSON.stringify(FOTOS_POR_PERFIL, null, 2)};

export const WHATSAPP_NUMERO = ${j(WHATSAPP)};

export const MOLDE_WHATSAPP =
  ${j(MOLDE)};

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
 * segundo argumento interpreta \\$&, \\$' e \\$\` (um nome como "Ana \\$' Silva"
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
    /\\{perfil\\}|\\{nome\\}|\\{cidade\\}/g,
    (chave) => valores[chave] ?? chave
  );
};

export const montarLinkWhatsApp = (
  perfil: Perfil,
  nome: string,
  cidade: string
): string =>
  \`https://wa.me/\${WHATSAPP_NUMERO}?text=\${encodeURIComponent(
    montarMensagem(perfil, nome, cidade)
  )}\`;

/** Digitos do telefone, ja sem o codigo do pais quando ele veio junto. */
export const digitosDoTelefone = (valor: string): string => {
  let digitos = (valor || "").replace(/\\D/g, "");
  // Quem digita +55 86 99920-7088 nao pode ser barrado por causa do pais.
  if (digitos.length > 11 && digitos.startsWith("55")) digitos = digitos.slice(2);
  return digitos;
};

export const mascararTelefone = (valor: string): string => {
  const d = digitosDoTelefone(valor).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return \`(\${d}\`;
  if (d.length <= 6) return \`(\${d.slice(0, 2)}) \${d.slice(2)}\`;
  if (d.length <= 10) return \`(\${d.slice(0, 2)}) \${d.slice(2, 6)}-\${d.slice(6)}\`;
  return \`(\${d.slice(0, 2)}) \${d.slice(2, 7)}-\${d.slice(7)}\`;
};

/** Nome + sobrenome: pelo menos duas partes preenchidas. */
export const nomeValido = (valor: string): boolean =>
  String(valor || "").trim().split(/\\s+/).filter(Boolean).length >= 2;

/** DDD de 2 digitos + 8 ou 9 digitos de numero. */
export const telefoneValido = (valor: string): boolean => {
  const d = digitosDoTelefone(valor);
  return d.length === 10 || d.length === 11;
};
`;

fs.mkdirSync(DESTINO.slice(0, DESTINO.lastIndexOf('/')), { recursive: true });
fs.writeFileSync(DESTINO, saida, 'utf8');
console.log('gerado: ' + DESTINO + ' (' + Buffer.byteLength(saida) + ' bytes)');
console.log('perguntas=' + PERGUNTAS.length + '  perfis=' + Object.keys(LEITURAS).length + '  fotos=' + Object.keys(FOTOS).length);
console.log('todas as conferencias de peso passaram');
