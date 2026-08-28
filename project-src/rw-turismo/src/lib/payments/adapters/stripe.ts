import type Stripe from "stripe";
import type { PagamentoNormalizado } from "../normalized";

// Traduz uma sessão de checkout da Stripe para o formato único.
//
// Toda a validação de origem já aconteceu antes daqui: o handler do webhook
// roda `stripe.webhooks.constructEvent` sobre o corpo cru, e é a assinatura que
// prova que o evento veio da Stripe. Este arquivo só converte formato.

type MetadataInterna = {
  booking_id: string;
  payment_id: string;
  user_id: string;
};

// A metadata é o que amarra a sessão à nossa reserva. `source` existindo e
// valendo "internal_booking" é o que separa uma cobrança nossa de qualquer
// outra coisa que passe pela mesma conta Stripe.
const lerMetadata = (
  metadata: Stripe.Metadata | null
): MetadataInterna | null => {
  if (!metadata || metadata.source !== "internal_booking") return null;

  const bookingId = metadata.booking_id;
  const paymentId = metadata.payment_id;
  const userId = metadata.user_id;

  if (!bookingId || !paymentId || !userId) return null;

  return { booking_id: bookingId, payment_id: paymentId, user_id: userId };
};

const idDoPaymentIntent = (session: Stripe.Checkout.Session): string | null => {
  if (!session.payment_intent) return null;
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent.id;
};

export const normalizarSessaoStripe = (
  session: Stripe.Checkout.Session,
  eventId: string
): PagamentoNormalizado | null => {
  const metadata = lerMetadata(session.metadata);
  if (!metadata) return null;

  return {
    provider: "stripe",
    paymentId: metadata.payment_id,
    bookingId: metadata.booking_id,
    userId: metadata.user_id,
    valorCobradoEmCentavos: session.amount_total ?? 0,
    moeda: (session.currency ?? "").toUpperCase(),
    // "checkout.session.completed" quer dizer que a SESSÃO terminou, não que o
    // pagamento entrou. Com Pix a sessão conclui no instante em que o cliente
    // recebe o QR Code, com o dinheiro ainda por vir.
    pago: session.payment_status === "paid",
    idCobranca: session.id,
    idTransacao: idDoPaymentIntent(session),
    chaveDoEvento: eventId,
  };
};
