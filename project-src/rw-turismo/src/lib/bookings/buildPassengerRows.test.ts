import { describe, expect, it } from "vitest";
import {
  buildPassengerRows,
  PendingBookingError,
} from "./createPendingBooking";

const DEPARTURE = "2026-12-15";

const passenger = (full_name: string, birth_date: string) => ({
  full_name,
  birth_date,
});

describe("buildPassengerRows", () => {
  it("devolve apenas nome e nascimento", () => {
    const rows = buildPassengerRows(
      [
        passenger("Ana Souza", "1990-04-02"),
        passenger("Beto Souza", "2016-01-10"),
      ],
      2,
      DEPARTURE
    );

    expect(rows).toEqual([
      { full_name: "Ana Souza", birth_date: "1990-04-02" },
      { full_name: "Beto Souza", birth_date: "2016-01-10" },
    ]);
  });

  // Decisão deliberada: adulto/criança/bebê é classificado no banco, pela mesma
  // função que calcula o preço (public.passenger_type_on_departure, com as
  // faixas do pacote). Se o TypeScript também classificasse, mudar a faixa no
  // admin alteraria o valor cobrado sem alterar o rótulo mostrado na tela.
  it("NÃO classifica a faixa etária — quem faz isso é o banco", () => {
    const rows = buildPassengerRows(
      [passenger("Cauã Souza", "2025-06-01")],
      1,
      DEPARTURE
    );

    expect(Object.keys(rows[0]!).sort()).toEqual(["birth_date", "full_name"]);
    expect(rows[0]).not.toHaveProperty("type");
  });

  it("limpa espaços do nome", () => {
    const rows = buildPassengerRows(
      [passenger("  Ana Souza  ", "1990-04-02")],
      1,
      DEPARTURE
    );
    expect(rows[0]!.full_name).toBe("Ana Souza");
  });

  it("recusa quantidade diferente do número de viajantes", () => {
    expect(() =>
      buildPassengerRows([passenger("Ana Souza", "1990-04-02")], 3, DEPARTURE)
    ).toThrow(PendingBookingError);

    expect(() => buildPassengerRows([], 1, DEPARTURE)).toThrow(
      /1 viajante/
    );
  });

  it("recusa nome vazio ou curto demais, dizendo qual viajante", () => {
    expect(() =>
      buildPassengerRows(
        [passenger("Ana Souza", "1990-04-02"), passenger("A", "2000-01-01")],
        2,
        DEPARTURE
      )
    ).toThrow(/2º viajante/);
  });

  it("recusa data de nascimento inválida", () => {
    expect(() =>
      buildPassengerRows([passenger("Ana Souza", "2026-02-31")], 1, DEPARTURE)
    ).toThrow(/data de nascimento inválida/);

    expect(() =>
      buildPassengerRows([passenger("Ana Souza", "02/04/1990")], 1, DEPARTURE)
    ).toThrow(/data de nascimento inválida/);
  });

  it("recusa quem nasceria depois da viagem", () => {
    expect(() =>
      buildPassengerRows([passenger("Ana Souza", "2027-01-05")], 1, DEPARTURE)
    ).toThrow(/depois da viagem/);
  });

  it("erro de validação vira 400, não 500", () => {
    try {
      buildPassengerRows([], 2, DEPARTURE);
      throw new Error("deveria ter lançado");
    } catch (error) {
      expect(error).toBeInstanceOf(PendingBookingError);
      expect((error as PendingBookingError).statusCode).toBe(400);
    }
  });
});
