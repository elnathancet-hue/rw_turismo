import { beforeEach, describe, expect, it, vi } from "vitest";

// O que este teste protege: a busca de cliente do /admin precisa achar por
// TELEFONE e por CPF, não só por nome e e-mail.
//
// Era o furo que criava ficha duplicada: o contato da base antiga entra sem
// e-mail, quem atende digita o telefone, não acha nada, conclui "não está
// cadastrado" e preenche a ficha na mão. Nasce a segunda ficha da mesma pessoa.
//
// A asserção é sobre o FILTRO montado, e não sobre o resultado: é o filtro que
// decide se o Postgres consegue achar a pessoa.

const orCapturado: string[] = [];

const queryFalsa = () => {
  const q: Record<string, unknown> = {};
  for (const metodo of ["select", "eq", "order", "range"]) {
    q[metodo] = vi.fn(() => q);
  }
  q.or = vi.fn((filtro: string) => {
    orCapturado.push(filtro);
    return q;
  });
  // O await no final da cadeia resolve para o formato do supabase-js.
  q.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: [], error: null, count: 0 });
  return q;
};

vi.mock("../supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({ from: () => queryFalsa() }),
}));

// Import estático: o vi.mock acima é içado pelo Vitest antes de qualquer
// import, então não é preciso (nem permitido pelo tsconfig) usar await no topo.
import { searchAdminClients } from "./client";

const filtroDe = async (termo: string) => {
  orCapturado.length = 0;
  await searchAdminClients({ search: termo });
  return orCapturado[0] ?? "";
};

beforeEach(() => {
  orCapturado.length = 0;
});

describe("searchAdminClients — por onde o cliente é encontrado", () => {
  it("procura por nome e e-mail, como sempre fez", async () => {
    const filtro = await filtroDe("Maria");
    expect(filtro).toContain("name.ilike.%Maria%");
    expect(filtro).toContain("email.ilike.%Maria%");
  });

  // O caso que motivou tudo: cliente antigo, sem e-mail, informando o telefone.
  it("procura por TELEFONE quando o termo tem dígitos", async () => {
    const filtro = await filtroDe("11988887777");
    expect(filtro).toContain("phone_digits.ilike.%11988887777%");
  });

  it("procura por CPF", async () => {
    const filtro = await filtroDe("07207423314");
    expect(filtro).toContain("document_digits.ilike.%07207423314%");
  });

  // A pontuação é o ponto: a planilha grava só dígitos, o checkout grava como a
  // pessoa digitou. Sem normalizar os dois lados, "(11) 98888-7777" nunca
  // acharia "11988887777".
  it("normaliza a pontuação que quem atende digita", async () => {
    for (const digitado of [
      "(11) 98888-7777",
      "11 98888 7777",
      "+55 11 98888-7777",
    ]) {
      const filtro = await filtroDe(digitado);
      expect(filtro).toContain("phone_digits.ilike.%");
      // Os dígitos do DDD e do número sobrevivem à limpeza.
      expect(filtro).toContain("988887777");
    }

    const cpf = await filtroDe("072.074.233-14");
    expect(cpf).toContain("document_digits.ilike.%07207423314%");
  });

  // Sem piso, "11" varreria a base inteira e devolveria ruído no lugar de ajuda.
  it("ignora número curto demais para identificar alguém", async () => {
    const filtro = await filtroDe("11");
    expect(filtro).not.toContain("phone_digits");
    expect(filtro).not.toContain("document_digits");
    // Mas segue valendo como nome — "11" pode estar no nome de um grupo.
    expect(filtro).toContain("name.ilike.%11%");
  });

  it("termo sem dígito nenhum não vira busca de telefone", async () => {
    const filtro = await filtroDe("Ana Paula");
    expect(filtro).not.toContain("phone_digits");
  });
});
