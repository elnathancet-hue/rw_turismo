// Leitura de CSV vindo de planilha brasileira.
//
// POR QUE NÃO É `texto.split(";")`: uma célula entre aspas pode conter o
// separador, aspas escapadas ("") e até quebra de linha no meio. Dividir por
// caractere quebra silenciosamente e desloca todas as colunas da linha — o tipo
// de erro que só aparece semanas depois, num relatório errado.
//
// O arquivo é lido inteiro no navegador e nunca sobe para lugar nenhum. Não é
// preferência de estilo: os buckets do projeto aceitam só imagem e PDF, o teto
// de corpo de requisição da plataforma não comporta planilha grande, e o
// encoding só é resolvível olhando os bytes originais — depois que "José" virou
// "JosÃ©" não tem volta.

export type PlanilhaLida = {
  cabecalho: string[];
  linhas: string[][];
  separador: string;
  codificacao: "utf-8" | "windows-1252";
  // Número da linha no ARQUIVO (1-based, contando o cabeçalho), por linha de
  // dados. É o que o operador procura no Excel quando a tela diz "linha 47".
  numeroNoArquivo: number[];
};

// Excel no Windows ainda salva em windows-1252 por padrão em muitas versões.
// O truque: decodificar em UTF-8 estrito primeiro — se o arquivo não for UTF-8
// válido, o decoder lança, e aí sim caímos para windows-1252. O contrário
// (tentar 1252 primeiro) nunca falha e aceitaria um UTF-8 legítimo, trocando
// todo acento por caractere estranho.
export const decodificar = (
  bytes: ArrayBuffer
): { texto: string; codificacao: "utf-8" | "windows-1252" } => {
  try {
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { texto, codificacao: "utf-8" };
  } catch {
    return {
      texto: new TextDecoder("windows-1252").decode(bytes),
      codificacao: "windows-1252",
    };
  }
};

// O separador é decidido pela PRIMEIRA linha, contando só o que está fora de
// aspas. Contar no arquivo inteiro erraria em planilha com muita vírgula
// decimal dentro de texto.
export const detectarSeparador = (primeiraLinha: string): string => {
  const candidatos = [";", ",", "\t"];
  let melhor = ";";
  let maior = -1;

  for (const separador of candidatos) {
    let contagem = 0;
    let dentroDeAspas = false;

    for (let i = 0; i < primeiraLinha.length; i += 1) {
      const caractere = primeiraLinha[i];
      if (caractere === '"') dentroDeAspas = !dentroDeAspas;
      else if (caractere === separador && !dentroDeAspas) contagem += 1;
    }

    if (contagem > maior) {
      maior = contagem;
      melhor = separador;
    }
  }

  return melhor;
};

// Percorre caractere a caractere, respeitando aspas. É o único jeito de tratar
// célula com separador dentro, aspas duplicadas e quebra de linha no meio.
const percorrer = (texto: string, separador: string): string[][] => {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let dentroDeAspas = false;

  const fecharCelula = () => {
    linha.push(celula);
    celula = "";
  };

  const fecharLinha = () => {
    fecharCelula();
    linhas.push(linha);
    linha = [];
  };

  for (let i = 0; i < texto.length; i += 1) {
    const caractere = texto[i];

    if (dentroDeAspas) {
      if (caractere === '"') {
        // "" dentro de aspas é uma aspa literal, não o fim da célula.
        if (texto[i + 1] === '"') {
          celula += '"';
          i += 1;
        } else {
          dentroDeAspas = false;
        }
      } else {
        celula += caractere;
      }
      continue;
    }

    if (caractere === '"') {
      dentroDeAspas = true;
    } else if (caractere === separador) {
      fecharCelula();
    } else if (caractere === "\r") {
      // CRLF: o \n seguinte fecha a linha.
      if (texto[i + 1] !== "\n") fecharLinha();
    } else if (caractere === "\n") {
      fecharLinha();
    } else {
      celula += caractere;
    }
  }

  // Última linha sem quebra no fim do arquivo.
  if (celula.length > 0 || linha.length > 0) fecharLinha();

  return linhas;
};

// Nome de coluna comparável: sem acento, sem caixa, sem espaço sobrando. É o
// que permite casar "Data de Ida", "data de ida" e "DATA DE IDA".
export const normalizarCabecalho = (valor: string): string =>
  valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const linhaVazia = (linha: string[]): boolean =>
  linha.every((celula) => celula.trim() === "");

export const lerPlanilha = (bytes: ArrayBuffer): PlanilhaLida => {
  const { texto, codificacao } = decodificar(bytes);

  // O BOM entra como caractere invisível na PRIMEIRA célula do cabeçalho e faz
  // "﻿Título" nunca casar com "Título".
  const semBom = texto.replace(/^﻿/, "");

  const primeiraLinha = semBom.split(/\r?\n/, 1)[0] ?? "";
  const separador = detectarSeparador(primeiraLinha);

  const todas = percorrer(semBom, separador);

  // Procura o cabeçalho nas primeiras linhas: planilha de agência costuma ter
  // título, logo ou linha em branco antes da tabela.
  let indiceDoCabecalho = 0;
  for (let i = 0; i < Math.min(todas.length, 10); i += 1) {
    const linha = todas[i]!;
    const preenchidas = linha.filter((c) => c.trim() !== "").length;
    if (preenchidas >= 2) {
      indiceDoCabecalho = i;
      break;
    }
  }

  const cabecalho = (todas[indiceDoCabecalho] ?? []).map((c) => c.trim());
  const linhas: string[][] = [];
  const numeroNoArquivo: number[] = [];

  for (let i = indiceDoCabecalho + 1; i < todas.length; i += 1) {
    const linha = todas[i]!;
    if (linhaVazia(linha)) continue;
    linhas.push(linha);
    numeroNoArquivo.push(i + 1);
  }

  return { cabecalho, linhas, separador, codificacao, numeroNoArquivo };
};

// Linha de fechamento que a agência coloca no fim ("TOTAL: 4.500,00"). Entra
// como linha de dados e viraria um registro absurdo. Reconhecida por ter pouca
// célula preenchida e começar com palavra de somatório.
export const pareceLinhaDeTotal = (linha: string[]): boolean => {
  const preenchidas = linha.filter((c) => c.trim() !== "");
  if (preenchidas.length === 0 || preenchidas.length > 2) return false;

  const primeira = normalizarCabecalho(preenchidas[0] ?? "");
  return /^(total|soma|subtotal|somatorio)\b/.test(primeira);
};

/**
 * CSV ou Excel, decidido pelos BYTES e não pela extensão.
 *
 * Extensão mente: gente renomeia .xlsx para .csv achando que converte, e o
 * Excel salva .csv com nome .xls. Todo .xlsx começa com "PK", a assinatura do
 * ZIP — é isso que dá a resposta certa.
 *
 * A forma de saída é a mesma nos dois casos, então tudo o que vem depois
 * (mapeamento de colunas, prévia, validação) não sabe nem precisa saber de onde
 * a planilha veio.
 */
export const lerArquivoDePlanilha = async (
  bytes: ArrayBuffer
): Promise<PlanilhaLida> => {
  const inicio = new Uint8Array(bytes.slice(0, 4));
  const ehZip =
    inicio[0] === 0x50 && inicio[1] === 0x4b && (inicio[2] === 3 || inicio[2] === 5);

  if (ehZip) {
    // Import dinâmico: quem sobe CSV não precisa carregar o leitor de xlsx.
    const { lerPlanilhaXlsx } = await import("./xlsx");
    return lerPlanilhaXlsx(bytes);
  }
  return lerPlanilha(bytes);
};
