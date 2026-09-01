import { describe, expect, it } from "vitest";
import type { AdminClient } from "./client";
import { juntarParecidos, termosParaProcurar } from "./clientesParecidos";

const ficha = (id: string, name: string): AdminClient =>
  ({ id, name } as AdminClient);

describe("termosParaProcurar", () => {
  it("usa telefone, CPF e e-mail", () => {
    expect(
      termosParaProcurar({
        phone: "11988887777",
        document: "07207423314",
        email: "ana@email.com",
      })
    ).toEqual(["11988887777", "07207423314", "ana@email.com"]);
  });

  // Sem piso, um "11" digitado no telefone traria meio cadastro de volta.
  it("descarta o que é curto demais para identificar alguém", () => {
    expect(termosParaProcurar({ phone: "11", document: "072" })).toEqual([]);
    expect(termosParaProcurar({ phone: "1198" })).toEqual(["1198"]);
  });

  it("não repete o mesmo termo digitado em dois campos", () => {
    expect(
      termosParaProcurar({ phone: "11988887777", document: "11988887777" })
    ).toEqual(["11988887777"]);
  });

  it("campo vazio, só espaço ou nulo não vira busca", () => {
    expect(termosParaProcurar({})).toEqual([]);
    expect(termosParaProcurar({ phone: "", document: null, email: "   " }))
      .toEqual([]);
  });

  // O nome não entra: homônimo acusaria falso parecido o tempo todo, e aviso
  // que sempre aparece é aviso que ninguém lê.
  it("ignora o nome mesmo quando ele é longo", () => {
    expect(
      termosParaProcurar({ phone: null } as never as { phone: string })
    ).toEqual([]);
  });
});

describe("juntarParecidos", () => {
  // A mesma pessoa costuma casar por telefone E por CPF — apareceria duas
  // vezes no aviso, sugerindo duas fichas onde há uma.
  it("não repete a ficha que apareceu em mais de uma busca", () => {
    const ana = ficha("a", "Ana");
    const jose = ficha("b", "Jose");

    expect(juntarParecidos([[ana, jose], [ana]])).toEqual([ana, jose]);
  });

  it("lista vazia e buscas sem resultado devolvem nada", () => {
    expect(juntarParecidos([])).toEqual([]);
    expect(juntarParecidos([[], []])).toEqual([]);
  });

  it("preserva a ordem em que as fichas apareceram", () => {
    const a = ficha("1", "A");
    const b = ficha("2", "B");
    const c = ficha("3", "C");

    expect(juntarParecidos([[b], [a], [c, b]])).toEqual([b, a, c]);
  });
});
