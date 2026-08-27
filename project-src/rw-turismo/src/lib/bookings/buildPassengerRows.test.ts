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
  it("deriva o tipo pela idade na data da saída", () => {
    const rows = buildPassengerRows(
      [
        passenger("Ana Souza", "1990-04-02"),
        passenger("Beto Souza", "2016-01-10"),
        passenger("Cauã Souza", "2025-06-01"),
      ],
      3,
      DEPARTURE
    );

    expect(rows.map((row) => row.type)).toEqual(["adult", "child", "infant"]);
  });

  it("usa a data da VIAGEM, não a de hoje, para decidir a faixa", () => {
    // Faz 12 anos em 10/12/2026, cinco dias antes da saída.
    const rows = buildPassengerRows(
      [passenger("Duda Lima", "2014-12-10")],
      1,
      DEPARTURE
    );
    expect(rows[0]!.type).toBe("adult");

    const antes = buildPassengerRows(
      [passenger("Duda Lima", "2014-12-10")],
      1,
      "2026-12-09"
    );
    expect(antes[0]!.type).toBe("child");
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
