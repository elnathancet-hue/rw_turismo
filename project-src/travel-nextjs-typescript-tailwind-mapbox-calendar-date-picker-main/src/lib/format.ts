export const formatBRL = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

// Parse "YYYY-MM-DD" as LOCAL time (avoids the UTC off-by-one day). Full
// timestamps (with a "T") are parsed directly.
export const formatDateBR = (value: string | null | undefined): string => {
  if (!value) return "-";

  if (!value.includes("T")) {
    const [year, month, day] = value.split("-").map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : parsed.toLocaleDateString("pt-BR");
};

export const formatDateRangeBR = (
  start: string | null | undefined,
  end: string | null | undefined
): string => `${formatDateBR(start)} – ${formatDateBR(end)}`;

export const formatDateTimeBR = (value: string | null | undefined): string => {
  if (!value) return "-";

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(parsed);
};
