// A agência escreve o parcelamento na descrição do pacote (ex.: "Parcelamento em
// 10x R$180,00"). O site DETECTA que existe parcelamento, mas não repete o número.
//
// Motivo: o checkout é Stripe `mode: "payment"` — cobra o valor cheio de uma vez.
// A Stripe não oferece parcelamento do lojista no Brasil (a página de métodos
// aceitos lista só cartão, Pix e boleto, e o Mastercard Installments não atende
// o Brasil). Anunciar "10x de R$ 180,00" e cobrar R$ 1.800 à vista é promessa que
// a cobrança não cumpre.
//
// Quando existir uma forma real de parcelar, basta voltar a exibir o valor aqui.
const INSTALLMENT_PATTERN = /(\d+)\s*x\s*R\$\s*([\d.]+,\d{2})/;

export const INSTALLMENT_LABEL = "Parcelamento sob consulta";

export const hasInstallmentOffer = (
  description: string | null | undefined
): boolean => Boolean(description && INSTALLMENT_PATTERN.test(description));
