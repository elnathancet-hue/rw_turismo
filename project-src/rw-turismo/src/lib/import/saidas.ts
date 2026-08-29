import { normalizarCabecalho, pareceLinhaDeTotal, type PlanilhaLida } from "./csv";
import {
  paraDataISO,
  paraHora,
  paraInteiro,
  paraNumero,
  paraSlug,
} from "./valores";

// Importação de SAÍDAS (as datas de viagem de um pacote).
//
// DUAS TRAVAS QUE VALEM MAIS QUE O RESTO DESTE ARQUIVO:
//
// 1. VAGAS DE SAÍDA EXISTENTE NUNCA SÃO TOCADAS. `available_slots` é estoque
//    vivo: as reservas descontam dele e as expirações devolvem. Se a planilha
//    disser "30 vagas" numa saída que já vendeu 22, gravar 30 faz a saída
//    passar a vender 30 lugares que não existem — overbooking silencioso, sem
//    erro nenhum aparecer. Por isso a atualização de saída existente mexe só em
//    preço e horários.
//
// 2. A BUSCA NO BANCO IGNORA A LIXEIRA — de propósito. O unique do banco
//    (product_id + ida + volta) NÃO filtra registro excluído, mas as listagens
//    do admin filtram. Se a prévia usasse a listagem, uma saída na lixeira
//    apareceria como "nova", o operador aprovaria, e o insert estouraria no
//    meio da importação. Aqui ela aparece num balde próprio.

export const COLUNAS_SAIDAS = [
  { campo: "pacote", titulo: "Pacote", obrigatoria: true, sinonimos: ["pacote", "produto", "viagem", "pacote (endereco no site)", "slug"] },
  { campo: "ida", titulo: "Data de ida", obrigatoria: true, sinonimos: ["data de ida", "ida", "saida", "data de saida", "inicio", "data inicial"] },
  { campo: "volta", titulo: "Data de volta", obrigatoria: true, sinonimos: ["data de volta", "volta", "retorno", "data de retorno", "fim", "data final"] },
  { campo: "vagas", titulo: "Vagas", obrigatoria: true, sinonimos: ["vagas", "lugares", "assentos", "pax", "capacidade"] },
  { campo: "preco", titulo: "Preço da saída", obrigatoria: false, sinonimos: ["preco da saida", "preco", "valor", "preco especial"] },
  { campo: "horaIda", titulo: "Hora de saída", obrigatoria: false, sinonimos: ["hora de saida", "horario de saida", "hora de ida", "embarque"] },
  { campo: "horaVolta", titulo: "Hora de retorno", obrigatoria: false, sinonimos: ["hora de retorno", "horario de retorno", "hora de volta"] },
] as const;

export type CampoSaida = (typeof COLUNAS_SAIDAS)[number]["campo"];

// De-para entre a coluna do arquivo e o campo do sistema. Casado por NOME
// normalizado, e não por posição: planilha com as colunas em outra ordem é o
// caso comum, não a exceção.
export const adivinharMapeamento = (
  cabecalho: string[]
): Partial<Record<CampoSaida, number>> => {
  const mapa: Partial<Record<CampoSaida, number>> = {};
  const normalizado = cabecalho.map(normalizarCabecalho);

  for (const coluna of COLUNAS_SAIDAS) {
    const indice = normalizado.findIndex((titulo) =>
      (coluna.sinonimos as readonly string[]).includes(titulo)
    );
    if (indice >= 0) mapa[coluna.campo] = indice;
  }

  return mapa;
};

export type PacoteConhecido = {
  id: string;
  title: string;
  slug: string;
  deleted_at: string | null;
};

export type SaidaExistente = {
  id: string;
  product_id: string;
  start_date: string;
  end_date: string;
  available_slots: number;
  deleted_at: string | null;
  updated_at: string;
};

export type ValoresDaSaida = {
  product_id: string;
  start_date: string;
  end_date: string;
  available_slots: number;
  price_override: number | null;
  departure_time: string | null;
  return_time: string | null;
};

export type Classificacao = "novo" | "existente" | "lixeira" | "erro" | "ignorada";

export type LinhaClassificada = {
  numeroNoArquivo: number;
  classificacao: Classificacao;
  // Preenchido quando dá para gravar.
  valores?: ValoresDaSaida;
  // Contexto para a tela mostrar sem o operador precisar abrir a planilha.
  pacoteTitulo?: string;
  idAlvo?: string;
  vagasAtuais?: number;
  updatedAtVisto?: string;
  erros: string[];
};

const texto = (linha: string[], indice: number | undefined): string =>
  indice === undefined ? "" : (linha[indice] ?? "").trim();

export const classificarLinhas = (
  planilha: PlanilhaLida,
  mapa: Partial<Record<CampoSaida, number>>,
  pacotes: PacoteConhecido[],
  existentes: SaidaExistente[]
): LinhaClassificada[] => {
  // Índices em memória: uma consulta por linha seria uma requisição por linha.
  const porSlug = new Map<string, PacoteConhecido>();
  const porTitulo = new Map<string, PacoteConhecido[]>();

  for (const pacote of pacotes) {
    porSlug.set(pacote.slug, pacote);
    const chave = paraSlug(pacote.title);
    porTitulo.set(chave, [...(porTitulo.get(chave) ?? []), pacote]);
  }

  const chaveDaSaida = (produto: string, ida: string, volta: string) =>
    `${produto}|${ida}|${volta}`;

  const porChave = new Map<string, SaidaExistente>();
  for (const saida of existentes) {
    porChave.set(
      chaveDaSaida(saida.product_id, saida.start_date, saida.end_date),
      saida
    );
  }

  // Colisão DENTRO do próprio arquivo. Duas linhas com o mesmo pacote e as
  // mesmas datas: a primeira grava e a segunda estoura no unique. Detectar aqui
  // evita a importação morrer no meio.
  const vistasNoArquivo = new Set<string>();

  return planilha.linhas.map((linha, posicao) => {
    const numeroNoArquivo = planilha.numeroNoArquivo[posicao] ?? posicao + 2;
    const erros: string[] = [];

    if (pareceLinhaDeTotal(linha)) {
      return { numeroNoArquivo, classificacao: "ignorada", erros: [] };
    }

    // ---------------------------------------------------------- pacote
    const pacoteCelula = texto(linha, mapa.pacote);
    let pacote: PacoteConhecido | undefined;

    if (!pacoteCelula) {
      erros.push("falta o pacote");
    } else {
      const chave = paraSlug(pacoteCelula);
      pacote = porSlug.get(pacoteCelula) ?? porSlug.get(chave);

      if (!pacote) {
        const porNome = porTitulo.get(chave) ?? [];
        if (porNome.length === 1) {
          pacote = porNome[0];
        } else if (porNome.length > 1) {
          // Dois pacotes com o mesmo título (a mesma viagem em anos
          // diferentes, por exemplo). Escolher um seria adivinhar em qual
          // calendário a saída entra.
          erros.push(
            `existe mais de um pacote chamado "${pacoteCelula}" — use o endereço no site (slug) para dizer qual`
          );
        } else {
          erros.push(`pacote não encontrado: "${pacoteCelula}"`);
        }
      }

      if (pacote?.deleted_at) {
        erros.push(`o pacote "${pacote.title}" está na lixeira`);
      }
    }

    // ---------------------------------------------------------- datas
    const ida = paraDataISO(texto(linha, mapa.ida));
    if (!ida.ok) erros.push(`ida: ${ida.erro}`);

    const volta = paraDataISO(texto(linha, mapa.volta));
    if (!volta.ok) erros.push(`volta: ${volta.erro}`);

    if (ida.ok && volta.ok && volta.valor < ida.valor) {
      erros.push("a volta é antes da ida");
    }

    // ---------------------------------------------------------- vagas
    const vagasCelula = texto(linha, mapa.vagas);
    const vagas = paraInteiro(vagasCelula);
    if (!vagas.ok) erros.push(`vagas: ${vagas.erro}`);
    else if (vagas.valor < 0) erros.push("vagas não pode ser negativo");

    // ---------------------------------------------------------- opcionais
    let precoOverride: number | null = null;
    const precoCelula = texto(linha, mapa.preco);
    if (precoCelula) {
      const preco = paraNumero(precoCelula);
      if (!preco.ok) erros.push(`preço: ${preco.erro}`);
      else if (preco.valor < 0) erros.push("preço não pode ser negativo");
      else precoOverride = preco.valor;
    }

    let horaIda: string | null = null;
    const horaIdaCelula = texto(linha, mapa.horaIda);
    if (horaIdaCelula) {
      const convertida = paraHora(horaIdaCelula);
      if (!convertida.ok) erros.push(`hora de saída: ${convertida.erro}`);
      else horaIda = convertida.valor;
    }

    let horaVolta: string | null = null;
    const horaVoltaCelula = texto(linha, mapa.horaVolta);
    if (horaVoltaCelula) {
      const convertida = paraHora(horaVoltaCelula);
      if (!convertida.ok) erros.push(`hora de retorno: ${convertida.erro}`);
      else horaVolta = convertida.valor;
    }

    if (erros.length > 0 || !pacote || !ida.ok || !volta.ok || !vagas.ok) {
      return {
        numeroNoArquivo,
        classificacao: "erro",
        pacoteTitulo: pacote?.title,
        erros,
      };
    }

    const chave = chaveDaSaida(pacote.id, ida.valor, volta.valor);

    if (vistasNoArquivo.has(chave)) {
      return {
        numeroNoArquivo,
        classificacao: "erro",
        pacoteTitulo: pacote.title,
        erros: ["esta mesma saída aparece duas vezes na planilha"],
      };
    }
    vistasNoArquivo.add(chave);

    const valores: ValoresDaSaida = {
      product_id: pacote.id,
      start_date: ida.valor,
      end_date: volta.valor,
      available_slots: vagas.valor,
      price_override: precoOverride,
      departure_time: horaIda,
      return_time: horaVolta,
    };

    const existente = porChave.get(chave);

    if (!existente) {
      return {
        numeroNoArquivo,
        classificacao: "novo",
        pacoteTitulo: pacote.title,
        valores,
        erros: [],
      };
    }

    return {
      numeroNoArquivo,
      classificacao: existente.deleted_at ? "lixeira" : "existente",
      pacoteTitulo: pacote.title,
      valores,
      idAlvo: existente.id,
      vagasAtuais: existente.available_slots,
      updatedAtVisto: existente.updated_at,
      erros: [],
    };
  });
};

export const contarPorClassificacao = (
  linhas: LinhaClassificada[]
): Record<Classificacao, number> => {
  const contagem: Record<Classificacao, number> = {
    novo: 0,
    existente: 0,
    lixeira: 0,
    erro: 0,
    ignorada: 0,
  };

  for (const linha of linhas) contagem[linha.classificacao] += 1;
  return contagem;
};
