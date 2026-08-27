// Acomodação vendável: tipo de quarto com capacidade e preço por pessoa.
//
// Diferente de `products.tiers`, que continua existindo e é só informativo
// ("Valor da suíte confirmado no atendimento"). Aqui o cliente escolhe no
// checkout e o preço muda de verdade — por isso capacidade é obrigatória.

export type Accommodation = {
  // Código estável gravado na reserva. Renomear o rótulo não pode perder o
  // vínculo com as reservas já vendidas.
  code: string;
  name: string;
  // Pessoas por quarto. É o que decide quais combinações aparecem.
  capacity: number;
  // Preço POR PESSOA nesta acomodação.
  price: number;
  // Vaga em quarto compartilhado: o cliente compra a própria vaga e a RW faz o
  // pareamento depois. Vira "aguardando pareamento" na operação.
  shared?: boolean;
  active?: boolean;
};

export const isSellableAccommodation = (value: unknown): value is Accommodation => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.code === "string" &&
    item.code.trim().length > 0 &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    typeof item.capacity === "number" &&
    Number.isInteger(item.capacity) &&
    item.capacity > 0 &&
    typeof item.price === "number" &&
    item.price > 0
  );
};

// `products.accommodations` é jsonb livre — nunca confiar no formato.
export const normalizeAccommodations = (value: unknown): Accommodation[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isSellableAccommodation).map((item) => ({
    code: item.code.trim(),
    name: item.name.trim(),
    capacity: item.capacity,
    price: item.price,
    shared: Boolean(item.shared),
    active: item.active !== false,
  }));
};

// A regra que a especificação descreve por exemplos:
//   1 pessoa  -> compartilhado ou individual
//   2 pessoas -> duplo (e individual, em 2 quartos)
//   3 pessoas -> triplo (e individual)
//   4 pessoas -> quádruplo ou 2 duplos
//
// Ou seja: a acomodação serve quando o grupo se divide EXATAMENTE nela. Sobrar
// gente num quarto (3 pessoas num duplo) deixaria alguém sem cama, e faltar
// (2 pessoas num triplo) cobraria por lugar que ninguém ocupa.
export const fitsTravelers = (
  accommodation: Accommodation,
  travelersCount: number
): boolean =>
  travelersCount > 0 &&
  accommodation.capacity > 0 &&
  travelersCount % accommodation.capacity === 0;

export const roomsNeeded = (
  accommodation: Accommodation,
  travelersCount: number
): number => Math.ceil(travelersCount / accommodation.capacity);

export const availableAccommodations = (
  accommodations: Accommodation[],
  travelersCount: number
): Accommodation[] =>
  accommodations.filter(
    (item) => item.active !== false && fitsTravelers(item, travelersCount)
  );

export const findAccommodation = (
  accommodations: Accommodation[],
  code: string | null | undefined
): Accommodation | null =>
  (code && accommodations.find((item) => item.code === code)) || null;

// Texto curto para a escolha ficar óbvia: "2 quartos duplos", "1 quarto triplo".
export const describeRooms = (
  accommodation: Accommodation,
  travelersCount: number
): string => {
  if (accommodation.shared) return "vaga em quarto compartilhado";
  const rooms = roomsNeeded(accommodation, travelersCount);
  return rooms === 1
    ? `1 quarto ${accommodation.name.toLowerCase()}`
    : `${rooms} quartos ${accommodation.name.toLowerCase()}`;
};
