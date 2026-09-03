import type { PlanilhaLida } from "./csv";
import { inflar, navegadorLeZip } from "./zip";

// Leitura de .xlsx, entregando exatamente a mesma forma do CSV (PlanilhaLida).
//
// POR QUE SEM BIBLIOTECA: um .xlsx é um ZIP com XML dentro, e o navegador já
// sabe fazer as duas partes — DecompressionStream desinfla, DOMParser lê o XML.
// A alternativa era `xlsx` (SheetJS), cuja versão publicada no npm está parada
// com avisos de segurança em aberto, ou `exceljs`, que traz mais de 1 MB para o
// pacote do painel para ler duas colunas. O projeto já escreve o próprio leitor
// de CSV pela mesma razão.
//
// RODA NO NAVEGADOR, como o CSV: o arquivo não sobe para lugar nenhum. Os
// buckets do projeto aceitam só imagem e PDF, e planilha grande não cabe no
// corpo de requisição da plataforma.
//
// O QUE ELE NÃO FAZ: fórmula não é calculada (lê o último valor que o Excel
// gravou, que é o que a pessoa viu na tela), e só a PRIMEIRA aba é lida — a
// mesma coisa que acontece quando alguém exporta CSV de uma pasta com abas.

// ---------------------------------------------------------------- o ZIP

const u16 = (v: DataView, p: number) => v.getUint16(p, true);
const u32 = (v: DataView, p: number) => v.getUint32(p, true);

/**
 * Abre o ZIP e devolve o texto dos arquivos pedidos.
 *
 * Lê pelo DIRETÓRIO CENTRAL, no fim do arquivo, e não varrendo do começo: é
 * onde o ZIP declara oficialmente o que tem dentro, e é assim que ele sobrevive
 * a arquivos que foram acrescentados ou removidos depois.
 */
export const abrirZip = async (
  bytes: ArrayBuffer,
  querido: (nome: string) => boolean
): Promise<Map<string, string>> => {
  const todos = new Uint8Array(bytes);
  const v = new DataView(bytes);

  // O fim do diretório central tem assinatura 0x06054b50 e vem no fim, depois
  // de um comentário de tamanho variável — daí a busca de trás para frente.
  let fim = -1;
  for (let p = todos.length - 22; p >= 0 && p > todos.length - 66_000; p -= 1) {
    if (u32(v, p) === 0x06054b50) {
      fim = p;
      break;
    }
  }
  if (fim < 0) throw new Error("Este arquivo não parece uma planilha do Excel.");

  const quantidade = u16(v, fim + 10);
  let p = u32(v, fim + 16);
  const saida = new Map<string, string>();
  const decodificador = new TextDecoder("utf-8");

  for (let i = 0; i < quantidade; i += 1) {
    if (u32(v, p) !== 0x02014b50) break;
    const metodo = u16(v, p + 10);
    const comprimido = u32(v, p + 20);
    const tamanhoNome = u16(v, p + 28);
    const tamanhoExtra = u16(v, p + 30);
    const tamanhoComentario = u16(v, p + 32);
    const inicioLocal = u32(v, p + 42);
    const nome = decodificador.decode(
      todos.subarray(p + 46, p + 46 + tamanhoNome)
    );

    if (querido(nome)) {
      // O cabeçalho local repete nome e extra, com tamanhos PRÓPRIOS: usar os
      // do diretório central aqui erra o começo dos dados.
      const nomeLocal = u16(v, inicioLocal + 26);
      const extraLocal = u16(v, inicioLocal + 28);
      const inicio = inicioLocal + 30 + nomeLocal + extraLocal;
      const cru = todos.subarray(inicio, inicio + comprimido);
      // 0 = guardado sem compressão; 8 = deflate. O Excel usa os dois.
      if (metodo !== 0 && metodo !== 8) {
        throw new Error("Planilha com compressão que não sei ler.");
      }
      const conteudo = metodo === 0 ? cru : await inflar(cru);
      saida.set(nome, decodificador.decode(conteudo));
    }

    p += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }

  return saida;
};

// ---------------------------------------------------------------- as células

/** "BC" → 54. A coluna vem na referência da célula (r="BC7"). */
export const colunaDaReferencia = (ref: string): number => {
  let n = 0;
  for (const c of ref) {
    const codigo = c.charCodeAt(0);
    if (codigo < 65 || codigo > 90) break;
    n = n * 26 + (codigo - 64);
  }
  return n - 1;
};

/**
 * Número de série do Excel → aaaa-mm-dd.
 *
 * A época é 30/12/1899, e não 01/01/1900, por causa do bug histórico do Lotus
 * 1-2-3: o Excel acredita que 1900 foi bissexto. Copiar o bug é o que faz a
 * conta bater com o que o Excel mostra na tela.
 */
export const serialParaData = (serial: number): string => {
  const ms = Math.round(serial * 86_400_000);
  const d = new Date(Date.UTC(1899, 11, 30) + ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};

/**
 * Quais estilos são data.
 *
 * O Excel não marca a célula como "data": ele guarda um número e um formato.
 * Sem consultar o formato, 05/09/2026 chegaria como "46270" na importação — e o
 * pior é que 46270 é um número válido, então nada acusaria erro.
 */
const estilosDeData = (styles: Document): Set<number> => {
  const deData = new Set<number>();

  // Formatos embutidos do Excel que são data ou hora.
  const embutidos = new Set([
    14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57,
  ]);
  for (const fmt of Array.from(styles.getElementsByTagName("numFmt"))) {
    const codigo = fmt.getAttribute("formatCode") ?? "";
    // Formato personalizado: se fala de dia, mês e ano, é data. `m` sozinho é
    // ambíguo (minuto), então exige `d` ou `y` junto.
    if (/[dy]/i.test(codigo) && /[dmy]/i.test(codigo) && !/^[#0.,%\s]*$/.test(codigo)) {
      embutidos.add(Number(fmt.getAttribute("numFmtId")));
    }
  }

  const cellXfs = styles.getElementsByTagName("cellXfs")[0];
  const xfs = cellXfs ? Array.from(cellXfs.getElementsByTagName("xf")) : [];
  xfs.forEach((xf, indice) => {
    if (embutidos.has(Number(xf.getAttribute("numFmtId")))) deData.add(indice);
  });

  return deData;
};

const textoDe = (no: Element | undefined): string => {
  if (!no) return "";
  // <t> pode estar solto ou dentro de vários <r> (texto com formatação mista).
  const ts = Array.from(no.getElementsByTagName("t"));
  if (ts.length > 0) return ts.map((t) => t.textContent ?? "").join("");
  return no.textContent ?? "";
};

// ---------------------------------------------------------------- a leitura

const NECESSARIOS = [
  "xl/workbook.xml",
  "xl/_rels/workbook.xml.rels",
  "xl/sharedStrings.xml",
  "xl/styles.xml",
];

export const lerPlanilhaXlsx = async (
  bytes: ArrayBuffer
): Promise<PlanilhaLida> => {
  if (!navegadorLeZip()) {
    throw new Error(
      "Este navegador não consegue abrir arquivos do Excel. Use o Chrome ou o Edge, ou salve a planilha como .csv."
    );
  }

  const arquivos = await abrirZip(
    bytes,
    (nome) => NECESSARIOS.includes(nome) || nome.startsWith("xl/worksheets/")
  );

  const xml = (texto: string | undefined): Document =>
    new DOMParser().parseFromString(texto ?? "<x/>", "application/xml");

  // Qual arquivo é a primeira aba. O workbook lista as abas em ordem e aponta
  // para elas por r:id; o .rels traduz o id para o caminho. Chutar "sheet1.xml"
  // erra quando alguém apaga a primeira aba e cria outra.
  const workbook = xml(arquivos.get("xl/workbook.xml"));
  const rels = xml(arquivos.get("xl/_rels/workbook.xml.rels"));
  const primeira = workbook.getElementsByTagName("sheet")[0];
  const rid = primeira?.getAttribute("r:id") ?? primeira?.getAttribute("id");
  let alvo = "";
  for (const rel of Array.from(rels.getElementsByTagName("Relationship"))) {
    if (rel.getAttribute("Id") === rid) {
      alvo = `xl/${(rel.getAttribute("Target") ?? "").replace(/^\/?xl\//, "")}`;
    }
  }
  const sheet = xml(
    arquivos.get(alvo) ??
      arquivos.get("xl/worksheets/sheet1.xml") ??
      Array.from(arquivos.entries()).find(([n]) =>
        n.startsWith("xl/worksheets/")
      )?.[1]
  );

  const compartilhadas = Array.from(
    xml(arquivos.get("xl/sharedStrings.xml")).getElementsByTagName("si")
  ).map((si) => textoDe(si));
  const datas = estilosDeData(xml(arquivos.get("xl/styles.xml")));

  const grade: string[][] = [];
  for (const linha of Array.from(sheet.getElementsByTagName("row"))) {
    const celulas: string[] = [];
    for (const c of Array.from(linha.getElementsByTagName("c"))) {
      const coluna = colunaDaReferencia(c.getAttribute("r") ?? "");
      const tipo = c.getAttribute("t");
      const estilo = Number(c.getAttribute("s") ?? "-1");
      const v = c.getElementsByTagName("v")[0];
      const bruto = v?.textContent ?? "";

      let valor: string;
      if (tipo === "s") {
        valor = compartilhadas[Number(bruto)] ?? "";
      } else if (tipo === "inlineStr") {
        valor = textoDe(c.getElementsByTagName("is")[0]);
      } else if (tipo === "b") {
        valor = bruto === "1" ? "VERDADEIRO" : "FALSO";
      } else if (bruto !== "" && datas.has(estilo) && Number.isFinite(Number(bruto))) {
        valor = serialParaData(Number(bruto));
      } else {
        valor = bruto;
      }

      // Célula vazia no meio da linha não aparece no XML: sem preencher o
      // buraco, todas as colunas seguintes deslizariam uma casa para a
      // esquerda — o mesmo estrago que dividir CSV por caractere causa.
      if (coluna >= 0) {
        while (celulas.length < coluna) celulas.push("");
        celulas[coluna] = valor;
      } else {
        celulas.push(valor);
      }
    }
    grade.push(celulas);
  }

  // Linha totalmente vazia no começo é comum em planilha com título solto.
  while (grade.length > 0 && grade[0]!.every((c) => !c.trim())) grade.shift();

  const cabecalho = (grade[0] ?? []).map((c) => c.trim());
  const linhas: string[][] = [];
  const numeroNoArquivo: number[] = [];
  grade.slice(1).forEach((linha, i) => {
    if (linha.every((c) => !String(c ?? "").trim())) return;
    // Iguala o comprimento ao cabeçalho: linha curta atrapalha quem indexa por
    // posição de coluna.
    const completa = Array.from(
      { length: cabecalho.length },
      (_, j) => linha[j] ?? ""
    );
    linhas.push(completa);
    numeroNoArquivo.push(i + 2);
  });

  return {
    cabecalho,
    linhas,
    separador: "",
    codificacao: "utf-8",
    numeroNoArquivo,
  };
};
