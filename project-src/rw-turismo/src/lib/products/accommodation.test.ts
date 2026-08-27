import { describe, expect, it } from "vitest";
import {
  availableAccommodations,
  describeRooms,
  findAccommodation,
  fitsTravelers,
  normalizeAccommodations,
  roomsNeeded,
  type Accommodation,
} from "./accommodation";

const acc = (
  code: string,
  capacity: number,
  extra: Partial<Accommodation> = {}
): Accommodation => ({
  code,
  name: code,
  capacity,
  price: 100,
  ...extra,
});

const CATALOGO: Accommodation[] = [
  acc("individual", 1, { name: "Individual", price: 1200 }),
  acc("compartilhado", 1, { name: "Compartilhado", price: 850, shared: true }),
  acc("duplo", 2, { name: "Duplo", price: 900 }),
  acc("triplo", 3, { name: "Triplo", price: 800 }),
  acc("quadruplo", 4, { name: "Quádruplo", price: 750 }),
];

const codes = (list: Accommodation[]) => list.map((item) => item.code);

// Os quatro exemplos que a especificação lista na Etapa 3.
describe("combinações que a especificação descreve", () => {
  it("1 pessoa: compartilhado ou individual", () => {
    expect(codes(availableAccommodations(CATALOGO, 1))).toEqual([
      "individual",
      "compartilhado",
    ]);
  });

  it("2 pessoas: duplo (e individual em 2 quartos), nunca triplo", () => {
    const disponiveis = codes(availableAccommodations(CATALOGO, 2));
    expect(disponiveis).toContain("duplo");
    expect(disponiveis).toContain("individual");
    expect(disponiveis).not.toContain("triplo");
  });

  it("3 pessoas: triplo, nunca duplo", () => {
    const disponiveis = codes(availableAccommodations(CATALOGO, 3));
    expect(disponiveis).toContain("triplo");
    expect(disponiveis).not.toContain("duplo");
    expect(disponiveis).not.toContain("quadruplo");
  });

  it("4 pessoas: quádruplo ou 2 duplos, nunca triplo", () => {
    const disponiveis = codes(availableAccommodations(CATALOGO, 4));
    expect(disponiveis).toContain("quadruplo");
    expect(disponiveis).toContain("duplo");
    expect(disponiveis).not.toContain("triplo");
  });
});

describe("fitsTravelers", () => {
  it("só serve quando o grupo se divide exatamente", () => {
    expect(fitsTravelers(acc("duplo", 2), 2)).toBe(true);
    expect(fitsTravelers(acc("duplo", 2), 6)).toBe(true);
    expect(fitsTravelers(acc("duplo", 2), 3)).toBe(false);
  });

  it("zero viajantes não serve para nada", () => {
    expect(fitsTravelers(acc("duplo", 2), 0)).toBe(false);
  });
});

describe("roomsNeeded", () => {
  it("divide o grupo pela capacidade", () => {
    expect(roomsNeeded(acc("duplo", 2), 4)).toBe(2);
    expect(roomsNeeded(acc("triplo", 3), 3)).toBe(1);
    expect(roomsNeeded(acc("individual", 1), 3)).toBe(3);
  });
});

describe("availableAccommodations", () => {
  it("esconde acomodação desativada mesmo que caiba", () => {
    const lista = [...CATALOGO, acc("suite", 2, { active: false })];
    expect(codes(availableAccommodations(lista, 2))).not.toContain("suite");
  });
});

describe("normalizeAccommodations", () => {
  it("descarta entrada sem capacidade ou sem preço", () => {
    const bruto = [
      { code: "duplo", name: "Duplo", capacity: 2, price: 900 },
      { code: "sem-capacidade", name: "X", price: 100 },
      { code: "sem-preco", name: "Y", capacity: 2 },
      { code: "capacidade-zero", name: "Z", capacity: 0, price: 100 },
      { code: "preco-zero", name: "W", capacity: 2, price: 0 },
      "lixo",
      null,
    ];
    expect(codes(normalizeAccommodations(bruto))).toEqual(["duplo"]);
  });

  it("devolve lista vazia para jsonb que não é array", () => {
    expect(normalizeAccommodations(null)).toEqual([]);
    expect(normalizeAccommodations({})).toEqual([]);
    expect(normalizeAccommodations("duplo")).toEqual([]);
  });

  it("capacidade fracionada não passa", () => {
    expect(
      normalizeAccommodations([
        { code: "meio", name: "Meio", capacity: 1.5, price: 100 },
      ])
    ).toEqual([]);
  });
});

describe("findAccommodation", () => {
  it("acha pelo código e devolve null para código desconhecido", () => {
    expect(findAccommodation(CATALOGO, "duplo")?.name).toBe("Duplo");
    expect(findAccommodation(CATALOGO, "inexistente")).toBeNull();
    expect(findAccommodation(CATALOGO, null)).toBeNull();
  });
});

describe("describeRooms", () => {
  it("conta os quartos no plural certo", () => {
    expect(describeRooms(CATALOGO[2]!, 2)).toBe("1 quarto duplo");
    expect(describeRooms(CATALOGO[2]!, 4)).toBe("2 quartos duplo");
  });

  it("compartilhado fala de vaga, não de quarto", () => {
    expect(describeRooms(CATALOGO[1]!, 1)).toBe("vaga em quarto compartilhado");
  });
});
