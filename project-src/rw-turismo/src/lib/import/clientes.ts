import { normalizarCabecalho, pareceLinhaDeTotal, type PlanilhaLida } from "./csv";
import { paraDataISO } from "./valores";

// Importação de clientes por planilha.
//
// CLIENTE NÃO PRECISA DE LOGIN. Quem tem e-mail ganha uma conta e pode
// acompanhar a reserva pelo site; quem não tem entra só na agenda da agência —
// nome, telefone, CPF, aniversário —, que é o que a equipe usa para encontrar e
// reconhecer a pessoa. A base antiga é quase toda assim.
//
// A CHAVE MUDA CONFORME O QUE A LINHA TEM, nesta ordem:
//   1. e-mail   — a única com garantia do banco (unique + check de minúscula)
//   2. documento — só os dígitos, para "072.074.233-14" e "07207423314" serem
//                  a mesma pessoa
//   3. telefone — só os dígitos
//
// Quem não tem nenhum dos três é sempre tratado como novo: sem identificador,
// não há como afirmar que é a mesma pessoa. Nome igual não serve — a base tem
// homônimo, e juntar dois clientes diferentes é pior que ter dois cadastros.

export const COLUNAS_CLIENTES = [
  { campo: "email", titulo: "E-mail", obrigatoria: false, sinonimos: ["e-mail", "email", "e mail", "endereco de e-mail"] },
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
  // Vazio quando a pessoa não tem e-mail: ela entra como contato, sem login.
  email: string | null;
  name: string;
  phone: string | null;
  birth_date: string | null;
  document: string | null;
};

export type ClassificacaoDeCliente = "novo" | "existente" | "erro" | "ignorada";

export type LinhaDeCliente = {
  numeroNoArquivo: number;
  classificacao: ClassificacaoDeCliente;
  // Como esta linha foi identificada — vai para a tela, porque casar por
  // telefone merece um olhar diferente de casar por e-mail.
  chave?: "e-mail" | "documento" | "telefone" | "sem identificador";
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
  // Três índices, porque a chave depende do que a linha tem.
  const porEmail = new Map<string, ClienteConhecido>();
  const porDocumento = new Map<string, ClienteConhecido>();
  const porTelefone = new Map<string, ClienteConhecido>();

  for (const cliente of conhecidos) {
    if (cliente.email) porEmail.set(cliente.email.toLowerCase(), cliente);

    // Só os dígitos: "072.074.233-14" e "07207423314" são a mesma pessoa.
    const documento = cliente.document ? soDigitos(cliente.document) : "";
    if (documento) porDocumento.set(documento, cliente);

    const telefone = cliente.phone ? soDigitos(cliente.phone) : "";
    if (telefone) porTelefone.set(telefone, cliente);
  }

  // O mesmo identificador duas vezes no arquivo: a segunda linha sobrescreveria
  // a primeira sem ninguém ver. Melhor apontar antes.
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

    if (email && !pareceEmail(email)) {
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

    const documentoDigitos = documento ? soDigitos(documento) : "";

    // A ordem importa: e-mail é a única chave com garantia do banco, documento
    // vem depois e telefone por último — telefone de casa é compartilhado por
    // uma família inteira, então casar por ele é o mais frágil dos três.
    const identificador = email || documentoDigitos || telefone || "";

    if (identificador && vistosNoArquivo.has(identificador)) {
      return {
        numeroNoArquivo,
        classificacao: "erro",
        erros: [
          `esta pessoa aparece mais de uma vez na planilha (${identificador})`,
        ],
      };
    }
    if (identificador) vistosNoArquivo.add(identificador);

    const valores: ValoresDoCliente = {
      email: email || null,
      name: nome,
      phone: telefone,
      birth_date: nascimento,
      document: documento,
    };

    const porEmailAchado = email ? porEmail.get(email) : undefined;
    const porDocumentoAchado = documentoDigitos
      ? porDocumento.get(documentoDigitos)
      : undefined;
    const porTelefoneAchado = telefone ? porTelefone.get(telefone) : undefined;

    const existente = porEmailAchado ?? porDocumentoAchado ?? porTelefoneAchado;
    const chave: LinhaDeCliente["chave"] = porEmailAchado
      ? "e-mail"
      : porDocumentoAchado
        ? "documento"
        : porTelefoneAchado
          ? "telefone"
          : identificador
            ? undefined
            : "sem identificador";

    if (!existente) {
      // Sem nenhum identificador, esta pessoa entra sempre como nova: não há
      // como afirmar que é a mesma de um cadastro que já existe. Nome igual não
      // serve — juntar dois clientes diferentes é pior que ter dois cadastros.
      return { numeroNoArquivo, classificacao: "novo", chave, valores, erros: [] };
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

    comparar("E-mail", existente.email, valores.email);

    return {
      numeroNoArquivo,
      classificacao: "existente",
      chave,
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
