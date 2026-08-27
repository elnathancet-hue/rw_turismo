import { describe, expect, it } from "vitest";
import {
  DEFAULT_FARE_RULES,
  hasFareDiscount,
  normalizeFareRules,
  toFareRulesJson,
} from "./fareRules";

describe("normalizeFareRules", () => {
  // O ponto mais importante: pacote sem regra tem que cobrar como cobrava antes
  // da tarifa infantil existir. Percentual padrão 100 = sem desconto.
  it("sem regra cadastrada, ninguém paga menos", () => {
    expect(normalizeFareRules(null)).toEqual(DEFAULT_FARE_RULES);
    expect(normalizeFareRules({})).toEqual(DEFAULT_FARE_RULES);
    expect(DEFAULT_FARE_RULES.childPercent).toBe(100);
    expect(DEFAULT_FARE_RULES.infantPercent).toBe(100);
  });

  it("lê a regra do pacote", () => {
    expect(
      normalizeFareRules({
        infant_max_age: 2,
        child_max_age: 10,
        infant_percent: 0,
        child_percent: 70,
      })
    ).toEqual({
      infantMaxAge: 2,
      childMaxAge: 10,
      infantPercent: 0,
      childPercent: 70,
    });
  });

  it("prende o percentual entre 0 e 100", () => {
    const acima = normalizeFareRules({ child_percent: 150 });
    expect(acima.childPercent).toBe(100);

    const abaixo = normalizeFareRules({ infant_percent: -20 });
    expect(abaixo.infantPercent).toBe(0);
  });

  // Faixa de criança menor que a de bebê deixaria idades sem classificação
  // nenhuma — e o preço cairia num ramo que ninguém previu.
  it("impede criança terminar antes de bebê", () => {
    const rules = normalizeFareRules({ infant_max_age: 5, child_max_age: 2 });
    expect(rules.childMaxAge).toBeGreaterThanOrEqual(rules.infantMaxAge);
  });

  it("ignora lixo e cai no padrão", () => {
    expect(normalizeFareRules("regra")).toEqual(DEFAULT_FARE_RULES);
    expect(normalizeFareRules([1, 2])).toEqual(DEFAULT_FARE_RULES);
    expect(normalizeFareRules({ child_percent: "setenta" }).childPercent).toBe(
      100
    );
  });

  it("trunca idade fracionada", () => {
    expect(normalizeFareRules({ child_max_age: 11.9 }).childMaxAge).toBe(11);
  });
});

describe("toFareRulesJson", () => {
  it("volta para o formato do banco sem perder nada", () => {
    const rules = normalizeFareRules({
      infant_max_age: 1,
      child_max_age: 11,
      infant_percent: 0,
      child_percent: 60,
    });
    expect(toFareRulesJson(rules)).toEqual({
      infant_max_age: 1,
      child_max_age: 11,
      infant_percent: 0,
      child_percent: 60,
    });
    // Ida e volta não pode mudar o valor.
    expect(normalizeFareRules(toFareRulesJson(rules))).toEqual(rules);
  });
});

describe("hasFareDiscount", () => {
  it("só é verdade quando alguma faixa paga menos que o cheio", () => {
    expect(hasFareDiscount(DEFAULT_FARE_RULES)).toBe(false);
    expect(
      hasFareDiscount(normalizeFareRules({ child_percent: 70 }))
    ).toBe(true);
    expect(
      hasFareDiscount(normalizeFareRules({ infant_percent: 0 }))
    ).toBe(true);
  });
});
