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

export const paymentStatusBadge = (status: PaymentStatus): StatusBadge =>
  paymentLabels[status] ?? { label: status, tone: "neutral" };

export const bookingStatusBadge = (status: BookingStatus): StatusBadge =>
  bookingLabels[status] ?? { label: status, tone: "neutral" };

// A pending hold whose payment window has lapsed (still needs to be expired).
export const isExpiredPendingBooking = (booking: BookingSummary): boolean =>
  booking.status === "pending" &&
  booking.payment_status === "pending" &&
  Boolean(booking.expires_at) &&
  new Date(booking.expires_at as string).getTime() < Date.now();

export const isBookingExpired = (booking: BookingSummary): boolean =>
  booking.status === "expired" || isExpiredPendingBooking(booking);

// Pending hold, still in time, no checkout started yet — the user can pay.
export const isPayablePendingBooking = (booking: BookingSummary): boolean =>
  booking.status === "pending" &&
  booking.payment_status === "pending" &&
  !booking.stripe_checkout_session_id &&
  Boolean(booking.expires_at) &&
  new Date(booking.expires_at as string).getTime() > Date.now();

// Checkout started, waiting on the payment confirmation.
export const isProcessingPayment = (booking: BookingSummary): boolean =>
  booking.status === "pending" &&
  booking.payment_status === "pending" &&
  Boolean(booking.stripe_checkout_session_id);

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

  if (isProcessingPayment(booking)) {
    return {
      label: "Processando pagamento",
      tone: "info",
      description:
        "Estamos confirmando seu pagamento. Costuma levar só alguns instantes — atualize a página em um minuto.",
    };
  }

  return {
    label: "Aguardando pagamento",
    tone: "warning",
    description:
      "Sua reserva está separada. Conclua o pagamento antes do prazo para garantir sua vaga.",
  };
};
