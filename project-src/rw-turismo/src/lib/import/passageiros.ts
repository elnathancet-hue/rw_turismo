import { normalizarCabecalho } from "./csv";
import { paraDataISO } from "./valores";

// Leitura da lista de passageiros que a agência já usa: a tabela do ônibus, com
// Nº | Nome do passageiro | Documento | Local de Embarque | Contato.
//
// A lista real é bem menos arrumada do que uma planilha: o nome carrega
// observação entre parênteses ("(pg 04/09)", pedido de poltrona), a célula do
// documento traz "CPF " na frente e às vezes com a pontuação errada, e uma
// mesma linha pode ter duas pessoas — o adulto e a criança, uma embaixo da
// outra, com a data de nascimento colada no nome.
//
// Nada disso é descartado em silêncio: o que não vira campo vira observação,
// e o que está estranho aparece na conferência antes de gravar.

export type PassageiroLido = {
  numero: string;
  nome: string;
  documento: string | null;
  nascimento: string | null;
  observacoes: string[];
  embarque: string | null;
  telefone: string | null;
  avisos: string[];
};

const CABECALHOS = {
  numero: ["n", "no", "n°", "num", "numero", "nº"],
  nome: ["nome do passageiro", "nome", "passageiro"],
  documento: ["documento", "cpf", "rg", "doc"],
  embarque: ["local de embarque", "embarque", "local"],
  contato: ["contato", "telefone", "celular", "whatsapp"],
};

export type MapaDaLista = Partial<
  Record<"numero" | "nome" | "documento" | "embarque" | "contato", number>
>;

// Acha a linha de cabeçalho e o índice de cada coluna. A lista costuma ter uma
// linha de título antes ("DESTINO: ... DATA: ..."), então não dá para assumir
// que a tabela começa na primeira linha.
export const acharCabecalho = (
  linhas: string[][]
): { indice: number; mapa: MapaDaLista } | null => {
  for (let i = 0; i < Math.min(linhas.length, 10); i += 1) {
    const celulas = (linhas[i] ?? []).map(normalizarCabecalho);
    const mapa: MapaDaLista = {};

    for (const [campo, nomes] of Object.entries(CABECALHOS)) {
      const indice = celulas.findIndex((celula) => nomes.includes(celula));
      if (indice >= 0) mapa[campo as keyof MapaDaLista] = indice;
    }

    // Nome é o mínimo indispensável: sem ele não há passageiro.
    if (mapa.nome !== undefined) return { indice: i, mapa };
  }

  return null;
};

// "CPF 428.554.973-53" → "428.554.973-53"; e conserta o ponto no lugar do
// traço, que aparece na lista de verdade ("053.192.033.06").
const limparDocumento = (
  bruto: string
): { documento: string | null; aviso: string | null } => {
  const semRotulo = bruto.replace(/^\s*(cpf|rg|doc(umento)?)[\s:.]*/i, "").trim();
  if (!semRotulo) return { documento: null, aviso: null };

  const digitos = semRotulo.replace(/\D/g, "");

  if (digitos.length === 11) {
    const formatado = `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
    return {
      documento: formatado,
      aviso:
        formatado === semRotulo ? null : `documento reformatado de "${semRotulo}"`,
    };
  }

  // Não é CPF: pode ser RG ou passaporte. Guarda como veio e avisa.
  return {
    documento: semRotulo,
    aviso:
      digitos.length > 0 && digitos.length !== 11
        ? `documento com ${digitos.length} dígitos — confira`
        : null,
  };
};

// Telefone brasileiro. Celular tem 11 dígitos com DDD; 10 é fixo ou celular
// antigo sem o nono dígito, o que a lista tem em várias linhas.
const limparTelefone = (
  bruto: string
): { telefone: string | null; aviso: string | null } => {
  const digitos = bruto.replace(/\D/g, "");
  if (!digitos) return { telefone: null, aviso: null };

  // "DD 90000-0000" é preenchimento de gabarito, não telefone.
  if (/^0+$/.test(digitos.replace(/^9/, "")) || digitos === "900000000") {
    return { telefone: null, aviso: "telefone parece preenchimento de modelo" };
  }

  if (digitos.length === 11) return { telefone: digitos, aviso: null };

  if (digitos.length === 10) {
    return {
      telefone: digitos,
      aviso: "telefone com 10 dígitos — pode faltar o 9",
    };
  }

  return { telefone: digitos, aviso: `telefone com ${digitos.length} dígitos` };
};

// Tira o que está entre parênteses e devolve como observação. É onde a lista
// guarda pedido de poltrona, aviso de pagamento e nota sobre acompanhante —
// informação que a operação usa e que não pode virar parte do nome.
const separarObservacoes = (
  bruto: string
): { nome: string; observacoes: string[] } => {
  const observacoes: string[] = [];

  const nome = bruto
    .replace(/\(([^)]*)\)/g, (_, dentro: string) => {
      const texto = dentro.trim();
      if (texto) observacoes.push(texto);
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  return { nome, observacoes };
};

// "DN10/09/2025" ou "DN 10/09/2025" colado no nome é a data de nascimento —
// é assim que a lista marca criança de colo.
const separarNascimento = (
  bruto: string
): { nome: string; nascimento: string | null; aviso: string | null } => {
  const combina = bruto.match(/\bDN\s*:?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i);
  if (!combina) return { nome: bruto, nascimento: null, aviso: null };

  const convertida = paraDataISO(combina[1]!);
  const nome = bruto.replace(combina[0], " ").replace(/\s+/g, " ").trim();

  if (!convertida.ok) {
    return { nome, nascimento: null, aviso: `nascimento: ${convertida.erro}` };
  }

  return { nome, nascimento: convertida.valor, aviso: null };
};

const celula = (linha: string[], indice: number | undefined): string =>
  indice === undefined ? "" : (linha[indice] ?? "").trim();

export const lerPassageiros = (
  linhas: string[][],
  cabecalho: { indice: number; mapa: MapaDaLista }
): PassageiroLido[] => {
  const passageiros: PassageiroLido[] = [];
  const { mapa } = cabecalho;

  for (let i = cabecalho.indice + 1; i < linhas.length; i += 1) {
    const linha = linhas[i] ?? [];
    const numero = celula(linha, mapa.numero);
    const nomeBruto = celula(linha, mapa.nome);

    // Linha do gabarito do ônibus: tem o número do assento e mais nada. São 16
    // delas na lista real, e virariam 16 passageiros sem nome.
    if (!nomeBruto) continue;

    const documentosDaCelula = celula(linha, mapa.documento).split("\n");
    const embarque = celula(linha, mapa.embarque) || null;
    const contatoBruto = celula(linha, mapa.contato);

    // Uma célula com mais de um parágrafo é mais de uma pessoa: o adulto e a
    // criança na mesma reserva. Cada uma vira um passageiro.
    const pessoas = nomeBruto
      .split("\n")
      .map((parte) => parte.trim())
      .filter(Boolean);

    pessoas.forEach((pessoaBruta, posicao) => {
      const avisos: string[] = [];

      const comNascimento = separarNascimento(pessoaBruta);
      if (comNascimento.aviso) avisos.push(comNascimento.aviso);

      const { nome, observacoes } = separarObservacoes(comNascimento.nome);

      if (!nome) return;

      const documentoBruto = (documentosDaCelula[posicao] ?? "").trim();
      const { documento, aviso: avisoDoc } = limparDocumento(documentoBruto);
      if (avisoDoc) avisos.push(avisoDoc);

      // Telefone e local de embarque valem para a linha inteira: são de quem
      // comprou, não de cada pessoa.
      const { telefone, aviso: avisoTel } =
        posicao === 0
          ? limparTelefone(contatoBruto)
          : { telefone: null, aviso: null };
      if (avisoTel) avisos.push(avisoTel);

      passageiros.push({
        numero: posicao === 0 ? numero : `${numero}.${posicao + 1}`,
        nome,
        documento,
        nascimento: comNascimento.nascimento,
        observacoes,
        embarque: posicao === 0 ? embarque : embarque,
        telefone,
        avisos,
      });
    });
  }

  return passageiros;
};

// Documento repetido é quase sempre erro de digitação na lista — na lista real
// duas pessoas diferentes aparecem com o mesmo CPF. Não impede a importação,
// mas precisa aparecer antes de gravar.
export const acharDocumentosRepetidos = (
  passageiros: PassageiroLido[]
): Map<string, string[]> => {
  const porDocumento = new Map<string, string[]>();

  for (const passageiro of passageiros) {
    if (!passageiro.documento) continue;
    const chave = passageiro.documento.replace(/\D/g, "");
    if (!chave) continue;
    porDocumento.set(chave, [...(porDocumento.get(chave) ?? []), passageiro.nome]);
  }

  const repetidos = new Map<string, string[]>();
  porDocumento.forEach((nomes, documento) => {
    if (nomes.length > 1) repetidos.set(documento, nomes);
  });

  return repetidos;
};
