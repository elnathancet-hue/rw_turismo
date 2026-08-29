import { normalizarCabecalho, pareceLinhaDeTotal, type PlanilhaLida } from "./csv";
import { paraDataISO } from "./valores";

// Importação de clientes por planilha.
//
// A CHAVE É O E-MAIL, e não por escolha de estilo: é a única com garantia do
// banco (`users_profiles_email_key`, único, mais o check que recusa maiúscula).
// O documento não serve — é texto puro, sem unique e sem formato, e boa parte
// da base legada tem CPF com e sem pontuação, ou nenhum.
//
// E-mail também é o que permite a pessoa existir: todo cliente precisa de uma
// conta de autenticação, e ela é criada a partir do e-mail. Linha sem e-mail
// não vira cliente — vira erro, com a linha listada para o operador completar.

export const COLUNAS_CLIENTES = [
  { campo: "email", titulo: "E-mail", obrigatoria: true, sinonimos: ["e-mail", "email", "e mail", "endereco de e-mail"] },
  { campo: "nome", titulo: "Nome", obrigatoria: true, sinonimos: ["nome", "nome completo", "cliente", "nome do cliente"] },
  { campo: "telefone", titulo: "Telefone", obrigatoria: false, sinonimos: ["telefone", "celular", "whatsapp", "contato", "fone"] },
  { campo: "nascimento", titulo: "Nascimento", obrigatoria: false, sinonimos: ["nascimento", "data de nascimento", "aniversario", "dn"] },
  { campo: "documento", titulo: "Documento", obrigatoria: false, sinonimos: ["documento", "cpf", "rg", "doc"] },
] as const;

export type CampoCliente = (typeof COLUNAS_CLIENTES)[number]["campo"];

export const adivinharMapeamentoDeClientes = (
  cabecalho: string[]
): Partial<Record<CampoCliente, number>> => {
  const mapa: Partial<Record<CampoCliente, number>> = {};
  const normalizado = cabecalho.map(normalizarCabecalho);

  for (const coluna of COLUNAS_CLIENTES) {
    const indice = normalizado.findIndex((titulo) =>
      (coluna.sinonimos as readonly string[]).includes(titulo)
    );
    if (indice >= 0) mapa[coluna.campo] = indice;
  }

  return mapa;
};

export type ClienteConhecido = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  birth_date: string | null;
  document: string | null;
};

export type ValoresDoCliente = {
  email: string;
  name: string;
  phone: string | null;
  birth_date: string | null;
  document: string | null;
};

export type ClassificacaoDeCliente = "novo" | "existente" | "erro" | "ignorada";

export type LinhaDeCliente = {
  numeroNoArquivo: number;
  classificacao: ClassificacaoDeCliente;
  valores?: ValoresDoCliente;
  idAlvo?: string;
  // O que mudaria se o operador escolher atualizar. Só os campos que a planilha
  // traz preenchidos e que estão diferentes do que já está gravado.
  mudancas?: { campo: string; de: string; para: string }[];
  erros: string[];
};

// Regra proposital de deixar passar: validar e-mail com precisão é impossível, e
// um padrão apertado demais recusaria endereço legítimo. Aqui só barra o que
// certamente não é e-mail — o resto o banco e a criação da conta resolvem.
const pareceEmail = (valor: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);

const soDigitos = (valor: string): string => valor.replace(/\D/g, "");

const celula = (linha: string[], indice: number | undefined): string =>
  indice === undefined ? "" : (linha[indice] ?? "").trim();

export const classificarClientes = (
  planilha: PlanilhaLida,
  mapa: Partial<Record<CampoCliente, number>>,
  conhecidos: ClienteConhecido[]
): LinhaDeCliente[] => {
  const porEmail = new Map<string, ClienteConhecido>();
  for (const cliente of conhecidos) {
    if (cliente.email) porEmail.set(cliente.email.toLowerCase(), cliente);
  }

  // Mesmo e-mail duas vezes no arquivo: a segunda linha sobrescreveria a
  // primeira sem ninguém ver. Melhor apontar antes.
  const vistosNoArquivo = new Set<string>();

  return planilha.linhas.map((linha, posicao) => {
    const numeroNoArquivo = planilha.numeroNoArquivo[posicao] ?? posicao + 2;
    const erros: string[] = [];

    if (pareceLinhaDeTotal(linha)) {
      return { numeroNoArquivo, classificacao: "ignorada", erros: [] };
    }

    // O banco recusa e-mail com maiúscula (users_profiles_email_lowercase_check),
    // então normalizar aqui não é gosto: sem isso o insert falha.
    const email = celula(linha, mapa.email).toLowerCase();
    const nome = celula(linha, mapa.nome);

    if (!email) {
      erros.push("falta o e-mail — sem ele não dá para criar o cliente");
    } else if (!pareceEmail(email)) {
      erros.push(`e-mail inválido: "${email}"`);
    }

    if (!nome) erros.push("falta o nome");
    else if (nome.length < 2) erros.push("nome muito curto");

    let nascimento: string | null = null;
    const nascimentoCelula = celula(linha, mapa.nascimento);
    if (nascimentoCelula) {
      const convertida = paraDataISO(nascimentoCelula);
      if (!convertida.ok) erros.push(`nascimento: ${convertida.erro}`);
      else if (convertida.valor > new Date().toISOString().slice(0, 10)) {
        erros.push("nascimento está no futuro");
      } else nascimento = convertida.valor;
    }

    const telefoneCelula = celula(linha, mapa.telefone);
    const telefone = telefoneCelula ? soDigitos(telefoneCelula) || null : null;

    const documentoCelula = celula(linha, mapa.documento);
    const documento = documentoCelula || null;

    if (erros.length > 0) {
      return { numeroNoArquivo, classificacao: "erro", erros };
    }

    if (vistosNoArquivo.has(email)) {
      return {
        numeroNoArquivo,
        classificacao: "erro",
        erros: [`o e-mail ${email} aparece mais de uma vez nesta planilha`],
      };
    }
    vistosNoArquivo.add(email);

    const valores: ValoresDoCliente = {
      email,
      name: nome,
      phone: telefone,
      birth_date: nascimento,
      document: documento,
    };

    const existente = porEmail.get(email);
    if (!existente) {
      return { numeroNoArquivo, classificacao: "novo", valores, erros: [] };
    }

    // Só conta como mudança o campo que a planilha traz PREENCHIDO e que está
    // diferente. Célula vazia nunca apaga dado bom que já está no sistema — é
    // o erro mais caro de uma importação de cadastro.
    const mudancas: { campo: string; de: string; para: string }[] = [];
    const comparar = (
      campo: string,
      atual: string | null,
      novo: string | null
    ) => {
      if (!novo) return;
      if ((atual ?? "") === novo) return;
      mudancas.push({ campo, de: atual ?? "—", para: novo });
    };

    comparar("Nome", existente.name, valores.name);
    comparar("Telefone", existente.phone, valores.phone);
    comparar("Nascimento", existente.birth_date, valores.birth_date);
    comparar("Documento", existente.document, valores.document);

    return {
      numeroNoArquivo,
      classificacao: "existente",
      valores,
      idAlvo: existente.id,
      mudancas,
      erros: [],
    };
  });
};

export const contarClientes = (
  linhas: LinhaDeCliente[]
): Record<ClassificacaoDeCliente, number> => {
  const contagem: Record<ClassificacaoDeCliente, number> = {
    novo: 0,
    existente: 0,
    erro: 0,
    ignorada: 0,
  };
  for (const linha of linhas) contagem[linha.classificacao] += 1;
  return contagem;
};
