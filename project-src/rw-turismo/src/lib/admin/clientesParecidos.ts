import type { AdminClient } from "./client";

// Quais dados servem para procurar ficha repetida antes de cadastrar alguém.
//
// Vive fora da tela porque tem decisão de verdade: nem todo campo identifica
// uma pessoa, e um termo curto demais devolve meio mundo em vez de ajudar.
//
// O NOME FICA DE FORA de propósito. Homônimo é comum — "Maria Silva" acusaria
// dezenas de falsos parecidos, e um aviso que sempre aparece é um aviso que
// ninguém lê. Telefone, CPF e e-mail identificam; nome sugere.

const MINIMO = 4;

/**
 * Termos que valem uma consulta. Descarta o que é curto demais para
 * identificar alguém e o que se repete (o operador pode digitar o mesmo número
 * em dois campos).
 */
export const termosParaProcurar = (dados: {
  phone?: string | null;
  document?: string | null;
  email?: string | null;
}): string[] => {
  const candidatos = [dados.phone, dados.document, dados.email]
    .map((valor) => (valor ?? "").trim())
    .filter((valor) => valor.length >= MINIMO);

  return Array.from(new Set(candidatos));
};

/**
 * Junta o resultado de várias buscas sem repetir ficha: a mesma pessoa costuma
 * casar por telefone E por CPF, e apareceria duas vezes no aviso.
 */
export const juntarParecidos = (listas: AdminClient[][]): AdminClient[] => {
  const porId = new Map<string, AdminClient>();

  for (const lista of listas) {
    for (const cliente of lista) porId.set(cliente.id, cliente);
  }

  return Array.from(porId.values());
};
