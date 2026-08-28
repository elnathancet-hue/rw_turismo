import type { BookingStatus, BookingSummary, PaymentStatus } from "./types";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export type StatusBadge = {
  label: string;
  tone: StatusTone;
};

// Tailwind classes per tone (used by <StatusPill>). Kept here so customer and
// admin surfaces share one source of truth for status colours.
export const toneClasses: Record<StatusTone, string> = {
  success: "bg-green-100 text-green-800 border-green-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  danger: "bg-red-100 text-red-800 border-red-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
  neutral: "bg-gray-100 text-gray-700 border-gray-200",
};

const paymentLabels: Record<PaymentStatus, StatusBadge> = {
  pending: { label: "Aguardando pagamento", tone: "warning" },
  processing: { label: "Aguardando Pix", tone: "info" },
  paid: { label: "Pago", tone: "success" },
  failed: { label: "Recusado", tone: "danger" },
  refunded: { label: "Reembolsado", tone: "neutral" },
  cancelled: { label: "Cancelado", tone: "neutral" },
  requires_review: { label: "Em análise", tone: "warning" },
};

const bookingLabels: Record<BookingStatus, StatusBadge> = {
  pending: { label: "Aguardando", tone: "warning" },
  confirmed: { label: "Confirmada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "neutral" },
  expired: { label: "Expirada", tone: "neutral" },
};

// Rótulos para os demais valores que vinham do banco em inglês e chegavam
// crus na tela (pagamento, passageiro). Ficam aqui junto dos status para o
// painel ter um lugar só de onde tirar texto de enum.
const providerLabels: Record<string, string> = {
  stripe: "Cartão (Stripe)",
  infinitepay: "Cartão/Pix (InfinitePay)",
  manual: "Manual",
};

export const paymentProviderLabel = (provider: string | null): string =>
  provider ? providerLabels[provider] ?? provider : "—";

const passengerTypeLabels: Record<string, string> = {
  adult: "Adulto",
  child: "Criança",
  infant: "Bebê de colo",
};

export const passengerTypeLabel = (type: string | null): string =>
  type ? passengerTypeLabels[type] ?? type : "—";

export const paymentStatusBadge = (status: PaymentStatus): StatusBadge =>
  paymentLabels[status] ?? { label: status, tone: "neutral" };

export const bookingStatusBadge = (status: BookingStatus): StatusBadge =>
  bookingLabels[status] ?? { label: status, tone: "neutral" };

// A pending hold whose payment window has lapsed (still needs to be expired).
// 'processing' entra junto: é o Pix emitido e nunca pago, que também precisa
// devolver a vaga. Se ficasse de fora, a liberação sob demanda não enxergaria
// justamente o caso que a sessão da Stripe nunca vai expirar sozinha.
export const isExpiredPendingBooking = (booking: BookingSummary): boolean =>
  booking.status === "pending" &&
  ["pending", "processing"].includes(booking.payment_status) &&
  Boolean(booking.expires_at) &&
  new Date(booking.expires_at as string).getTime() < Date.now();

export const isBookingExpired = (booking: BookingSummary): boolean =>
  booking.status === "expired" || isExpiredPendingBooking(booking);

// Pending hold, still in time — the user can (re)start the checkout. A
// previous Stripe session does NOT block a new attempt: abandoning the
// checkout was the biggest funnel leak; the server expires the old session
// before opening a new one.
export const isPayablePendingBooking = (booking: BookingSummary): boolean =>
  booking.status === "pending" &&
  booking.payment_status === "pending" &&
  Boolean(booking.expires_at) &&
  new Date(booking.expires_at as string).getTime() > Date.now();

// Checkout started, waiting on the payment confirmation.
export const isProcessingPayment = (booking: BookingSummary): boolean =>
  booking.status === "pending" &&
  (booking.payment_status === "processing" ||
    (booking.payment_status === "pending" &&
      Boolean(booking.stripe_checkout_session_id)));

// Pix emitido: o cliente já fechou o pedido e tem o código na mão. Difere de
// isProcessingPayment porque aqui a Stripe CONFIRMOU que a cobrança existe —
// não é o palpite "abriu o checkout e sumiu".
export const isAwaitingAsyncPayment = (booking: BookingSummary): boolean =>
  booking.payment_status === "processing";

export type CustomerBookingState = StatusBadge & { description: string };

// Single, customer-friendly state derived from booking + payment status.
// No engineering jargon — this is what a buyer reads.
export const getCustomerBookingState = (
  booking: BookingSummary
): CustomerBookingState => {
  if (booking.payment_status === "paid") {
    return {
      label: "Reserva confirmada",
      tone: "success",
      description: "Seu pagamento foi aprovado e sua reserva está garantida.",
    };
  }

  if (booking.payment_status === "processing") {
    // Depois do prazo, as duas promessas do texto abaixo viram mentira: a vaga
    // não está mais separada, e o pagamento que chegar agora não confirma nada
    // sozinho — vai para análise humana.
    const prazoVencido =
      Boolean(booking.expires_at) &&
      new Date(booking.expires_at as string).getTime() < Date.now();

    if (prazoVencido) {
      return {
        label: "Prazo encerrado",
        tone: "warning",
        description:
          "O prazo desta reserva terminou. Se você já pagou o Pix, vamos conferir e falar com você. Se ainda não pagou, não pague por este código.",
      };
    }

    return {
      label: "Aguardando o Pix",
      tone: "info",
      description:
        "Já geramos sua cobrança. Assim que o pagamento cair, sua reserva é confirmada automaticamente e avisamos você. Sua vaga fica separada até o fim do prazo.",
    };
  }

  if (booking.payment_status === "requires_review") {
    return {
      label: "Em análise",
      tone: "warning",
      description:
        "Recebemos seu pagamento e estamos confirmando os detalhes. Avisaremos você assim que estiver tudo certo.",
    };
  }

  if (booking.payment_status === "failed") {
    return {
      label: "Pagamento recusado",
      tone: "danger",
      description:
        "O pagamento não foi aprovado. Se a reserva ainda estiver no prazo, você pode tentar novamente.",
    };
  }

  if (booking.payment_status === "refunded") {
    return {
      label: "Reembolsado",
      tone: "neutral",
      description: "Esta reserva foi reembolsada.",
    };
  }

  if (isBookingExpired(booking)) {
    return {
      label: "Reserva expirada",
      tone: "neutral",
      description:
        "O prazo para pagamento acabou e as vagas foram liberadas. Você pode buscar novas datas.",
    };
  }

  if (booking.status === "cancelled" || booking.payment_status === "cancelled") {
    return {
      label: "Reserva cancelada",
      tone: "neutral",
      description: "Esta reserva foi cancelada.",
    };
  }

  // Este ramo cobre tanto "abriu o checkout e abandonou" quanto "a tentativa
  // anterior não passou": nos dois casos existe stripe_checkout_session_id e a
  // reserva voltou para 'pending'. Afirmar "estamos confirmando seu pagamento"
  // seria mentira para quem acabou de receber o aviso de recusa.
  if (isProcessingPayment(booking)) {
    return {
      label: "Aguardando pagamento",
      tone: "warning",
      description:
        "Sua reserva está separada e o pagamento ainda não foi concluído. Você pode retomar pelo botão abaixo enquanto estiver no prazo.",
    };
  }

  return {
    label: "Aguardando pagamento",
    tone: "warning",
    description:
      "Sua reserva está separada. Conclua o pagamento antes do prazo para garantir sua vaga.",
  };
};
