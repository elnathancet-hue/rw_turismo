import { describe, expect, it } from "vitest";
import {
  ageOnDate,
  isValidDateString,
  passengerTypeForAge,
  passengerTypeOnDeparture,
} from "./passengerAge";

describe("ageOnDate", () => {
  it("conta o aniversário já feito", () => {
    expect(ageOnDate("1990-03-10", "2026-08-03")).toBe(36);
  });

  it("não conta o aniversário que ainda não chegou no ano", () => {
    expect(ageOnDate("1990-12-10", "2026-08-03")).toBe(35);
  });

  it("conta o ano no dia exato do aniversário", () => {
    expect(ageOnDate("2014-08-03", "2026-08-03")).toBe(12);
  });

  it("não conta um dia antes do aniversário", () => {
    expect(ageOnDate("2014-08-04", "2026-08-03")).toBe(11);
  });

  it("recém-nascido tem zero", () => {
    expect(ageOnDate("2026-08-01", "2026-08-03")).toBe(0);
  });

  // A regra global do projeto: new Date("2026-02-23") é meia-noite UTC e volta
  // um dia em fuso brasileiro. O cálculo é feito só com os números da string
  // justamente para a virada do dia não trocar a faixa de ninguém.
  it("não sofre com fuso na virada do dia", () => {
    expect(ageOnDate("2012-01-01", "2026-01-01")).toBe(14);
    expect(ageOnDate("2012-12-31", "2026-12-31")).toBe(14);
  });
});

describe("passengerTypeForAge", () => {
  it("0 e 1 ano são bebê de colo", () => {
    expect(passengerTypeForAge(0)).toBe("infant");
    expect(passengerTypeForAge(1)).toBe("infant");
  });

  it("de 2 a 11 é criança", () => {
    expect(passengerTypeForAge(2)).toBe("child");
    expect(passengerTypeForAge(11)).toBe("child");
  });

  it("12 em diante é adulto", () => {
    expect(passengerTypeForAge(12)).toBe("adult");
    expect(passengerTypeForAge(40)).toBe("adult");
  });
});

describe("passengerTypeOnDeparture", () => {
  // O ponto central: a idade que vale é a da VIAGEM, não a da compra.
  it("quem faz 12 anos entre a compra e a saída embarca como adulto", () => {
    const birth = "2014-10-20";
    // Na compra (agosto) ainda tem 11; na saída (dezembro) já tem 12.
    expect(passengerTypeOnDeparture(birth, "2026-08-03")).toBe("child");
    expect(passengerTypeOnDeparture(birth, "2026-12-15")).toBe("adult");
  });

  it("quem faz 2 anos antes da saída deixa de ser colo", () => {
    const birth = "2024-09-30";
    expect(passengerTypeOnDeparture(birth, "2026-09-29")).toBe("infant");
    expect(passengerTypeOnDeparture(birth, "2026-09-30")).toBe("child");
  });
});

describe("isValidDateString", () => {
  it("aceita data real no formato do banco", () => {
    expect(isValidDateString("2026-08-03")).toBe(true);
    expect(isValidDateString("2024-02-29")).toBe(true);
  });

  it("recusa dia que não existe no mês", () => {
    expect(isValidDateString("2026-02-31")).toBe(false);
    expect(isValidDateString("2025-02-29")).toBe(false);
    expect(isValidDateString("2026-04-31")).toBe(false);
  });

  it("recusa formato fora do padrão", () => {
    expect(isValidDateString("03/08/2026")).toBe(false);
    expect(isValidDateString("2026-8-3")).toBe(false);
    expect(isValidDateString("")).toBe(false);
    expect(isValidDateString("ontem")).toBe(false);
  });
});
