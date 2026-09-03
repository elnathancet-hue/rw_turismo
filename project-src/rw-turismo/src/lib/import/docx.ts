// Leitura da tabela de um arquivo .docx, no navegador e sem dependência nova.
//
// POR QUE ACEITAR .docx EM VEZ DE PEDIR CSV: a lista de passageiros que a
// agência já usa é um documento do Word, com a tabela do ônibus. Exigir
// conversão para CSV transferiria para o operador um trabalho que o computador
// faz — e é justamente na conversão manual que a linha se desloca e o CPF vai
// parar na coluna do telefone.
//
// COMO FUNCIONA: .docx é um ZIP com XML dentro. Percorremos os cabeçalhos do
// ZIP até achar `word/document.xml`, descomprimimos com DecompressionStream
// (nativo do navegador, sem biblioteca) e lemos a estrutura da tabela:
// <w:tr> é linha, <w:tc> é célula, <w:p> é parágrafo dentro da célula.
//
// Os parágrafos dentro de uma célula importam: é assim que a lista guarda duas
// pessoas na mesma linha, uma embaixo da outra.

import { inflar, navegadorLeZip } from "./zip";

export type LinhaDaTabela = string[];

const assinaturaLocal = 0x04034b50;

const acharDocumentXml = async (
  bytes: ArrayBuffer
): Promise<string | null> => {
  const dados = new Uint8Array(bytes);
  const visao = new DataView(bytes);

  let i = 0;
  while (i < dados.length - 30) {
    if (visao.getUint32(i, true) !== assinaturaLocal) {
      i += 1;
      continue;
    }

    const metodo = visao.getUint16(i + 8, true);
    const tamanhoComprimido = visao.getUint32(i + 18, true);
    const tamanhoNome = visao.getUint16(i + 26, true);
    const tamanhoExtra = visao.getUint16(i + 28, true);

    const nome = new TextDecoder("utf-8").decode(
      dados.slice(i + 30, i + 30 + tamanhoNome)
    );
    const inicio = i + 30 + tamanhoNome + tamanhoExtra;

    if (nome === "word/document.xml" && tamanhoComprimido > 0) {
      const bruto = dados.slice(inicio, inicio + tamanhoComprimido);
      const conteudo = metodo === 8 ? await inflar(bruto) : bruto;
      return new TextDecoder("utf-8").decode(conteudo);
    }

    i = inicio + tamanhoComprimido;
  }

  return null;
};

const semTags = (trecho: string): string =>
  trecho
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .trim();

// Cada célula devolve o texto com "\n" entre parágrafos — é o que permite
// separar duas pessoas escritas uma embaixo da outra na mesma célula.
const lerCelula = (xmlDaCelula: string): string => {
  const paragrafos = xmlDaCelula.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  if (paragrafos.length === 0) return semTags(xmlDaCelula);

  return paragrafos
    .map(semTags)
    .filter((linha) => linha.length > 0)
    .join("\n");
};

export const lerTabelaDoDocx = async (
  bytes: ArrayBuffer
): Promise<LinhaDaTabela[]> => {
  const xml = await acharDocumentXml(bytes);

  if (!xml) {
    throw new Error(
      "Não consegui ler este arquivo do Word. Salve como .docx (não .doc) e tente de novo."
    );
  }

  const linhasXml = xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? [];

  if (linhasXml.length === 0) {
    throw new Error(
      "Não encontrei nenhuma tabela neste documento. A lista precisa estar em formato de tabela do Word."
    );
  }

  return linhasXml.map((linhaXml) => {
    const celulas = linhaXml.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) ?? [];
    return celulas.map(lerCelula);
  });
};

// Mesmo teste do .xlsx: o DecompressionStream não existe em navegador antigo.
export const navegadorLeDocx = navegadorLeZip;
