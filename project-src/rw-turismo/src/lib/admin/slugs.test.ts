import { describe, expect, it } from "vitest";
import { slugify } from "./slugs";

// slugify decide o ENDEREÇO público de página, post e quiz. Um slug com acento
// ou espaço vira URL quebrada, e trocar depois quebra link já compartilhado —
// então vale prender o comportamento.

describe("slugify", () => {
  it("tira acento do português", () => {
    expect(slugify("Que feriado combina com você?")).toBe(
      "que-feriado-combina-com-voce"
    );
    expect(slugify("Lençóis Maranhenses")).toBe("lencois-maranhenses");
    expect(slugify("Ação e Coração")).toBe("acao-e-coracao");
  });

  it("junta espaço e pontuação num hífen só", () => {
    expect(slugify("praia   x   montanha")).toBe("praia-x-montanha");
    expect(slugify("quiz: o teste!")).toBe("quiz-o-teste");
  });

  it("não deixa hífen sobrando na ponta", () => {
    expect(slugify("  viagem  ")).toBe("viagem");
    expect(slugify("---quiz---")).toBe("quiz");
    expect(slugify("!?")).toBe("");
  });

  it("é idempotente: passar de novo não muda", () => {
    const uma = slugify("Bonito — Ecoturismo");
    expect(slugify(uma)).toBe(uma);
  });

  it("preserva número, que é o que separa quiz de mesmo nome", () => {
    expect(slugify("Quiz 2026")).toBe("quiz-2026");
  });
});
