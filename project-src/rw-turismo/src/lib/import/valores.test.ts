import { describe, expect, it } from "vitest";
import { dataParaTela, paraDataISO, paraHora, paraInteiro, paraNumero, paraSlug } from "./valores";

describe("paraDataISO", () => {
  it("lê o formato que a agência digita", () => {
    expect(paraDataISO("05/09/2026")).toEqual({ ok: true, valor: "2026-09-05" });
    expect(paraDataISO("5/9/2026")).toEqual({ ok: true, valor: "2026-09-05" });
    expect(paraDataISO("05-09-2026")).toEqual({ ok: true, valor: "2026-09-05" });
  });

  it("aceita ISO também", () => {
    expect(paraDataISO("2026-09-05")).toEqual({ ok: true, valor: "2026-09-05" });
  });

  // O erro clássico: 05/09 é 5 de setembro no Brasil e 9 de maio nos EUA.
  // Ler pelo lado errado grava a saída no mês errado sem nenhum aviso.
  it("dd/mm, nunca mm/dd", () => {
    const resultado = paraDataISO("05/09/2026");
    expect(resultado.ok && resultado.valor).toBe("2026-09-05");
  });

  it("recusa data que não existe", () => {
    expect(paraDataISO("31/02/2026").ok).toBe(false);
    expect(paraDataISO("32/01/2026").ok).toBe(false);
    expect(paraDataISO("05/13/2026").ok).toBe(false);
  });

  it("recusa o que não reconhece, em vez de chutar", () => {
    expect(paraDataISO("").ok).toBe(false);
    expect(paraDataISO("setembro").ok).toBe(false);
    expect(paraDataISO("5 de setembro").ok).toBe(false);
  });

  // new Date('2026-09-05') é meia-noite UTC e volta um dia em fuso brasileiro:
  // a saída do dia 5 apareceria como 4 na tela.
  it("mostra o mesmo dia que está no arquivo", () => {
    expect(dataParaTela("2026-09-05")).toBe("05/09/2026");
    expect(dataParaTela("2026-01-01")).toBe("01/01/2026");
  });
});

describe("paraNumero", () => {
  it("lê o formato brasileiro", () => {
    expect(paraNumero("1.234,56")).toEqual({ ok: true, valor: 1234.56 });
    expect(paraNumero("R$ 1.234,56")).toEqual({ ok: true, valor: 1234.56 });
    expect(paraNumero("512,10")).toEqual({ ok: true, valor: 512.1 });
    expect(paraNumero("0,01")).toEqual({ ok: true, valor: 0.01 });
  });

  it("lê o formato com ponto decimal", () => {
    expect(paraNumero("1234.56")).toEqual({ ok: true, valor: 1234.56 });
    expect(paraNumero("50")).toEqual({ ok: true, valor: 50 });
  });

  it("lê milhar sem decimal", () => {
    expect(paraNumero("1.234.567")).toEqual({ ok: true, valor: 1234567 });
  });

  // "1.234" é genuinamente ambíguo: mil duzentos e trinta e quatro, ou um
  // ponto duzentos e trinta e quatro? Chutar errado multiplica por mil.
  it("recusa o ambíguo em vez de chutar", () => {
    const resultado = paraNumero("1.234");
    expect(resultado.ok).toBe(false);
    expect(!resultado.ok && resultado.erro).toContain("1234");
  });

  it("recusa texto", () => {
    expect(paraNumero("").ok).toBe(false);
    expect(paraNumero("grátis").ok).toBe(false);
    expect(paraNumero("a combinar").ok).toBe(false);
  });
});

describe("paraInteiro", () => {
  it("aceita inteiro e recusa fração", () => {
    expect(paraInteiro("46")).toEqual({ ok: true, valor: 46 });
    expect(paraInteiro("46,5").ok).toBe(false);
  });
});

describe("paraHora", () => {
  it("lê HH:MM e corta os segundos que o Excel inventa", () => {
    expect(paraHora("22:30")).toEqual({ ok: true, valor: "22:30" });
    expect(paraHora("22:30:00")).toEqual({ ok: true, valor: "22:30" });
    expect(paraHora("7:05")).toEqual({ ok: true, valor: "07:05" });
  });

  it("recusa hora impossível", () => {
    expect(paraHora("25:00").ok).toBe(false);
    expect(paraHora("22:70").ok).toBe(false);
    expect(paraHora("22h30").ok).toBe(false);
  });
});

describe("paraSlug", () => {
  it("normaliza título para comparação", () => {
    expect(paraSlug("Serra da Ibiapaba")).toBe("serra-da-ibiapaba");
    expect(paraSlug("  Chapada  das   Mesas ")).toBe("chapada-das-mesas");
    expect(paraSlug("Réveillon 2027!")).toBe("reveillon-2027");
  });
});
