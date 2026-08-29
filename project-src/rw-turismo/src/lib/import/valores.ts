// Conversão de célula de planilha brasileira.
//
// Cada função aqui devolve `null` quando não entende, em vez de chutar. Chute
// em importação é o pior desfecho possível: uma data lida ao contrário ou um
// valor com o decimal errado passa por todas as validações do banco e grava
// número errado sem nenhum erro aparecer.

export type Convertido<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: string };

const limpo = (celula: string): string => celula.trim();

// ---------------------------------------------------------------- datas

// dd/mm/aaaa ou aaaa-mm-dd → aaaa-mm-dd.
//
// A conversão é por SPLIT DE STRING, nunca por `new Date(texto)`: essa função
// interpreta "2027-02-23" como meia-noite em UTC, e em fuso brasileiro isso
// volta um dia — a saída do dia 23 apareceria como 22 na tela.
export const paraDataISO = (celula: string): Convertido<string> => {
  const texto = limpo(celula);
  if (!texto) return { ok: false, erro: "data vazia" };

  let ano: number;
  let mes: number;
  let dia: number;

  const brasileira = texto.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (brasileira) {
    dia = Number(brasileira[1]);
    mes = Number(brasileira[2]);
    ano = Number(brasileira[3]);
  } else if (iso) {
    ano = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else {
    return { ok: false, erro: `data não reconhecida: "${texto}"` };
  }

  if (mes < 1 || mes > 12) return { ok: false, erro: `mês inválido: ${mes}` };
  if (dia < 1 || dia > 31) return { ok: false, erro: `dia inválido: ${dia}` };

  // Confere que a data existe de verdade: 31/02 passaria pelos limites acima.
  const conferencia = new Date(ano, mes - 1, dia);
  if (
    conferencia.getFullYear() !== ano ||
    conferencia.getMonth() !== mes - 1 ||
    conferencia.getDate() !== dia
  ) {
    return { ok: false, erro: `data não existe: "${texto}"` };
  }

  const dd = String(dia).padStart(2, "0");
  const mm = String(mes).padStart(2, "0");
  return { ok: true, valor: `${ano}-${mm}-${dd}` };
};

// Para mostrar na prévia. Recebe o ISO já convertido e devolve pt-BR, montando
// a data em horário local pelo mesmo motivo acima.
export const dataParaTela = (iso: string): string => {
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return iso;
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
};

// ---------------------------------------------------------------- dinheiro

// "R$ 1.234,56" | "1234,56" | "1234.56" | "1.234" → número.
//
// A regra que resolve a ambiguidade: se há vírgula, ela é o decimal e o ponto é
// milhar. Sem vírgula, um ponto só é decimal — EXCETO quando é seguido de
// exatamente três dígitos e não há outro ponto, caso em que "1.234" é
// ambíguo de verdade (mil duzentos e trinta e quatro, ou um e vinte e três?).
// Aí a função recusa em vez de chutar: errar aqui multiplica a despesa por mil.
export const paraNumero = (celula: string): Convertido<number> => {
  const texto = limpo(celula).replace(/^R\$\s*/i, "").trim();
  if (!texto) return { ok: false, erro: "valor vazio" };

  const temVirgula = texto.includes(",");
  const pontos = (texto.match(/\./g) ?? []).length;

  let normalizado: string;

  if (temVirgula) {
    normalizado = texto.replace(/\./g, "").replace(",", ".");
  } else if (pontos === 1 && /\.\d{3}$/.test(texto)) {
    return {
      ok: false,
      erro: `"${texto}" pode ser ${texto.replace(".", "")} ou ${texto} — escreva com centavos (ex.: ${texto.replace(".", "")},00)`,
    };
  } else if (pontos > 1) {
    normalizado = texto.replace(/\./g, "");
  } else {
    normalizado = texto;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) {
    return { ok: false, erro: `valor não numérico: "${texto}"` };
  }

  return { ok: true, valor: Number(normalizado) };
};

export const paraInteiro = (celula: string): Convertido<number> => {
  const resultado = paraNumero(celula);
  if (!resultado.ok) return resultado;

  if (!Number.isInteger(resultado.valor)) {
    return { ok: false, erro: `precisa ser número inteiro: "${celula.trim()}"` };
  }

  return resultado;
};

// ---------------------------------------------------------------- hora

export const paraHora = (celula: string): Convertido<string> => {
  const texto = limpo(celula);
  if (!texto) return { ok: false, erro: "hora vazia" };

  // O Excel às vezes entrega "22:30:00"; o banco aceita, mas a tela do admin
  // corta em HH:MM e é o formato que o resto do sistema usa.
  const combina = texto.match(/^(\d{1,2}):(\d{2})(:\d{2})?$/);
  if (!combina) return { ok: false, erro: `hora não reconhecida: "${texto}"` };

  const hora = Number(combina[1]);
  const minuto = Number(combina[2]);

  if (hora > 23) return { ok: false, erro: `hora inválida: ${hora}` };
  if (minuto > 59) return { ok: false, erro: `minuto inválido: ${minuto}` };

  return {
    ok: true,
    valor: `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`,
  };
};

// ---------------------------------------------------------------- texto

// Slug no mesmo formato que o resto do sistema usa.
export const paraSlug = (valor: string): string =>
  valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
