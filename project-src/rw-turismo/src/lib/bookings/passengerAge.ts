import type { PassengerType } from "./types";

// A especificação é explícita: "A idade deve ser calculada a partir da data de
// nascimento, e não escolhida manualmente em uma lista."
//
// A idade que importa é a da DATA DA SAÍDA, não a da compra: quem faz 12 anos
// entre a compra e a viagem embarca como adulto, e é isso que a operação e a
// companhia de transporte conferem no embarque.

// Faixas padrão do mercado de turismo terrestre no Brasil. Viram configuráveis
// por pacote quando a tarifa infantil entrar (fase seguinte); até lá servem de
// regra geral e ficam num lugar só.
export const INFANT_MAX_AGE = 1; // colo: 0 e 1 ano
export const CHILD_MAX_AGE = 11; // criança: 2 a 11 anos

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isValidDateString = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Rejeita 31/02 e afins: recria a data em horário local e confere se bateu.
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

// Idade completa em anos na data de referência.
//
// Feito só com os números da string, sem objeto Date: `new Date("2026-02-23")`
// é meia-noite UTC e volta um dia em fuso brasileiro, o que trocaria a faixa de
// alguém que nasceu exatamente na virada.
export const ageOnDate = (birthDate: string, referenceDate: string): number => {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [refYear, refMonth, refDay] = referenceDate.split("-").map(Number);

  let age = refYear! - birthYear!;
  if (refMonth! < birthMonth! || (refMonth === birthMonth && refDay! < birthDay!)) {
    age -= 1;
  }
  return age;
};

export const passengerTypeForAge = (age: number): PassengerType => {
  if (age <= INFANT_MAX_AGE) return "infant";
  if (age <= CHILD_MAX_AGE) return "child";
  return "adult";
};

export const passengerTypeOnDeparture = (
  birthDate: string,
  departureDate: string
): PassengerType => passengerTypeForAge(ageOnDate(birthDate, departureDate));
