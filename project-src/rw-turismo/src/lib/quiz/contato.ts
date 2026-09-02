// Nome e telefone de quem responde um quiz.
//
// Saiu de lib/quiz/feriado.ts quando o quiz deixou de ser um só: as regras não
// têm nada de específico daquele quiz, e o renderizador genérico precisa das
// mesmas. feriado.ts reexporta daqui, então os testes dele seguem valendo.

/** Dígitos do telefone, já sem o código do país quando ele veio junto. */
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

/** DDD de 2 dígitos + 8 ou 9 dígitos de número. */
export const telefoneValido = (valor: string): boolean => {
  const d = digitosDoTelefone(valor);
  return d.length === 10 || d.length === 11;
};
