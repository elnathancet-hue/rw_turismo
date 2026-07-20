// Extrai o parcelamento da descrição do pacote (a agência escreve, ex.:
// "Parcelamento em 10x R$180,00"). Retorna "10x de R$ 180,00" ou null quando
// não há parcelamento no texto (ex.: pacotes "à vista"). Sem campo novo no banco.
export const parseInstallment = (
  description: string | null | undefined
): string | null => {
  if (!description) return null;
  const match = description.match(/(\d+)\s*x\s*R\$\s*([\d.]+,\d{2})/);
  if (!match) return null;
  return `${match[1]}x de R$ ${match[2]}`;
};
