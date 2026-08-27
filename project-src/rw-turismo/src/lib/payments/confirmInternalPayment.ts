import type Stripe from "stripe";
import { createSupabaseAdminClient } from "../supabase/admin";
import type {
  ConfirmInternalPaymentResult,
  InternalStripeMetadata,
} from "./types";

type BookingRecord = {
  id: string;
  user_id: string;
  total_amount: number | string;
  status: string;
  payment_status: string;
  expires_at: string | null;
  coupon_id: string | null;
};

type PaymentRecord = {
  id: string;
  booking_id: string;
  user_id: string;
  amount: number | string;
  currency: string;
  status: string;
};

const toAmountInCents = (value: number | string) =>
  Math.round(Number(value) * 100);

const getPaymentIntentId = (session: Stripe.Checkout.Session) => {
  if (!session.payment_intent) return null;
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent.id;
};

const getMetadata = (
  metadata: Stripe.Metadata | null
): InternalStripeMetadata | null => {
  if (!metadata || metadata.source !== "internal_booking") {
    return null;
  }

  const bookingId = metadata.booking_id;
  const paymentId = metadata.payment_id;
  const userId = metadata.user_id;

  if (!bookingId || !paymentId || !userId) {
    return null;
  }

  return {
    booking_id: bookingId,
    payment_id: paymentId,
    user_id: userId,
    source: "internal_booking",
  };
};

const logEvent = async (
  action: string,
  entity: string,
  entityId: string | null,
  metadata: Record<string, unknown>
) => {
  try {
    const supabase = createSupabaseAdminClient() as any;

    await supabase.from("system_logs").insert({
      action,
      entity,
      entity_id: entityId,
      metadata,
    });
  } catch (error) {
    console.error("Failed to write payment system log", error);
  }
};

const markRequiresReview = async (
  payment: PaymentRecord,
  booking: BookingRecord,
  session: Stripe.Checkout.Session,
  reason: string
): Promise<ConfirmInternalPaymentResult> => {
  const supabase = createSupabaseAdminClient() as any;
  const stripePaymentIntentId = getPaymentIntentId(session);

  const { error: updatePaymentError } = await supabase
    .from("payments")
    .update({
      status: "requires_review",
      paid_at: new Date().toISOString(),
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .eq("id", payment.id)
    .not("status", "eq", "paid");

  if (updatePaymentError) {
    throw updatePaymentError;
  }

  // As guardas acima conferem um snapshot lido segundos antes; entre a leitura
  // e a escrita não há transação. Sem estas condições, um evento atrasado
  // rebaixaria para "Em análise" uma reserva que já confirmou — e o pagamento
  // sumiria da receita, que filtra por 'paid'.
  const { error: updateBookingError } = await supabase
    .from("bookings")
    .update({
      payment_status: "requires_review",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .eq("id", booking.id)
    .neq("status", "confirmed")
    .not("payment_status", "eq", "paid");

  if (updateBookingError) {
    throw updateBookingError;
  }

  await logEvent("payment_requires_review", "payment", payment.id, {
    booking_id: booking.id,
    stripe_checkout_session_id: session.id,
    reason,
  });

  return {
    booking_id: booking.id,
    payment_id: payment.id,
    status: "requires_review",
    reason,
  };
};

// Sessão concluída com o dinheiro ainda por vir (Pix, boleto).
//
// A reserva NÃO é confirmada e o cupom NÃO é queimado: nada disso aconteceu
// ainda. O hold segue de pé com o mesmo expires_at, então a vaga continua
// separada até a transferência cair ou o prazo passar.
const markAwaitingAsyncPayment = async (
  payment: PaymentRecord,
  booking: BookingRecord,
  session: Stripe.Checkout.Session
): Promise<ConfirmInternalPaymentResult> => {
  const supabase = createSupabaseAdminClient() as any;
  const stripePaymentIntentId = getPaymentIntentId(session);

  // Já estava em processing: reentrega do mesmo evento, nada a fazer.
  if (
    payment.status === "processing" &&
    booking.payment_status === "processing"
  ) {
    return {
      booking_id: booking.id,
      payment_id: payment.id,
      status: "processing",
      reason: "Already awaiting asynchronous payment.",
    };
  }

  // Só reserva viva e sem dinheiro pode ficar esperando. Reserva já expirada,
  // cancelada ou paga não volta para "aguardando" por causa de um evento
  // atrasado — a Stripe não garante ordem de entrega.
  if (
    booking.status !== "pending" ||
    !["pending", "processing"].includes(booking.payment_status)
  ) {
    await logEvent("payment_async_ignored", "payment", payment.id, {
      booking_id: booking.id,
      stripe_checkout_session_id: session.id,
      booking_status: booking.status,
      booking_payment_status: booking.payment_status,
    });

    return {
      booking_id: booking.id,
      payment_id: payment.id,
      status: "ignored",
      reason: "Booking cannot wait for an asynchronous payment.",
    };
  }

  // A reserva primeiro, e com condição de estado: é ela que decide o que a tela
  // mostra e o que o cron faz. Um UPDATE do PostgREST que não casa nenhuma
  // linha NÃO devolve erro — por isso o .select(), para saber se de fato mudou
  // alguma coisa em vez de seguir contando uma história que não aconteceu.
  const { data: reservaAtualizada, error: updateBookingError } = await supabase
    .from("bookings")
    .update({
      payment_status: "processing",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .eq("id", booking.id)
    .eq("status", "pending")
    .in("payment_status", ["pending", "processing"])
    .select("id");

  if (updateBookingError) {
    throw updateBookingError;
  }

  if (!reservaAtualizada?.length) {
    await logEvent("payment_async_race", "payment", payment.id, {
      booking_id: booking.id,
      stripe_checkout_session_id: session.id,
      reason: "Booking state changed between read and write.",
    });

    return {
      booking_id: booking.id,
      payment_id: payment.id,
      status: "ignored",
      reason: "Booking state changed between read and write.",
    };
  }

  // 'failed' também pode virar 'processing': cartão recusado e depois Pix, na
  // mesma sessão. O que nunca pode é rebaixar um pagamento já confirmado.
  const { error: updatePaymentError } = await supabase
    .from("payments")
    .update({
      status: "processing",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .eq("id", payment.id)
    .not("status", "eq", "paid");

  if (updatePaymentError) {
    throw updatePaymentError;
  }

  await logEvent("payment_awaiting_async", "payment", payment.id, {
    booking_id: booking.id,
    stripe_checkout_session_id: session.id,
    stripe_payment_status: session.payment_status,
  });

  return {
    booking_id: booking.id,
    payment_id: payment.id,
    status: "processing",
    reason: "Awaiting asynchronous payment confirmation.",
  };
};

export const confirmInternalPayment = async (
  session: Stripe.Checkout.Session
): Promise<ConfirmInternalPaymentResult> => {
  const metadata = getMetadata(session.metadata);

  if (!metadata) {
    await logEvent("payment_invalid_metadata", "payment", null, {
      stripe_checkout_session_id: session.id,
      source: session.metadata?.source ?? null,
    });

    return {
      status: "ignored",
      reason: "Invalid or non-internal metadata.",
    };
  }

  const supabase = createSupabaseAdminClient() as any;

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, booking_id, user_id, amount, currency, status")
    .eq("id", metadata.payment_id)
    .maybeSingle();

  if (paymentError) {
    throw paymentError;
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, user_id, total_amount, status, payment_status, expires_at, coupon_id")
    .eq("id", metadata.booking_id)
    .maybeSingle();

  if (bookingError) {
    throw bookingError;
  }

  if (!payment || !booking) {
    await logEvent("payment_invalid_metadata", "payment", metadata.payment_id, {
      booking_id: metadata.booking_id,
      stripe_checkout_session_id: session.id,
      reason: "Payment or booking not found.",
    });

    return {
      booking_id: metadata.booking_id,
      payment_id: metadata.payment_id,
      status: "ignored",
      reason: "Payment or booking not found.",
    };
  }

  const paymentRecord = payment as PaymentRecord;
  const bookingRecord = booking as BookingRecord;

  const relationshipIsValid =
    paymentRecord.booking_id === bookingRecord.id &&
    paymentRecord.user_id === bookingRecord.user_id &&
    metadata.user_id === bookingRecord.user_id;

  if (!relationshipIsValid) {
    await logEvent("payment_invalid_metadata", "payment", paymentRecord.id, {
      booking_id: bookingRecord.id,
      stripe_checkout_session_id: session.id,
      reason: "Payment, booking and user relationship mismatch.",
    });

    return {
      booking_id: bookingRecord.id,
      payment_id: paymentRecord.id,
      status: "ignored",
      reason: "Invalid payment relationship.",
    };
  }

  const expectedAmount = toAmountInCents(bookingRecord.total_amount);
  const receivedAmount = session.amount_total ?? 0;
  const receivedCurrency = session.currency?.toUpperCase();

  if (receivedAmount !== expectedAmount || receivedCurrency !== "BRL") {
    return markRequiresReview(
      paymentRecord,
      bookingRecord,
      session,
      "Stripe amount or currency does not match booking."
    );
  }

  if (
    paymentRecord.status === "paid" &&
    bookingRecord.status === "confirmed" &&
    bookingRecord.payment_status === "paid"
  ) {
    await logEvent("payment_ignored_duplicate", "payment", paymentRecord.id, {
      booking_id: bookingRecord.id,
      stripe_checkout_session_id: session.id,
    });

    return {
      booking_id: bookingRecord.id,
      payment_id: paymentRecord.id,
      status: "duplicate",
    };
  }

  // O PORTÃO DO DINHEIRO DE VERDADE.
  //
  // "checkout.session.completed" quer dizer que a SESSÃO terminou, não que o
  // pagamento entrou. Com cartão as duas coisas coincidem. Com Pix não: a
  // sessão conclui no instante em que o cliente recebe o QR Code, e o
  // amount_total já vem certo desde a criação — ou seja, a conferência de valor
  // logo acima passa perfeitamente numa sessão em que ninguém pagou nada. Sem
  // esta linha, ligar o Pix confirmaria reserva não paga e queimaria o cupom.
  //
  // 'no_payment_required' (sessão de valor zero) não existe neste fluxo, mas
  // também não é dinheiro entrando: só 'paid' confirma.
  if (session.payment_status !== "paid") {
    return markAwaitingAsyncPayment(paymentRecord, bookingRecord, session);
  }

  const expiresAtMs = bookingRecord.expires_at
    ? new Date(bookingRecord.expires_at).getTime()
    : NaN;

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return markRequiresReview(
      paymentRecord,
      bookingRecord,
      session,
      "Booking expired before Stripe completion."
    );
  }

  if (
    bookingRecord.status !== "pending" ||
    // "processing" é onde o Pix fica entre o QR e a transferência: é
    // exatamente de onde async_payment_succeeded confirma.
    !["pending", "processing"].includes(bookingRecord.payment_status) ||
    // "failed" é confirmável: cartão recusado seguido de nova tentativa na
    // MESMA sessão de checkout. Valor/moeda e expiração já foram validados
    // acima, então o dinheiro capturado corresponde à reserva ainda válida.
    !["pending", "processing", "paid", "failed"].includes(paymentRecord.status)
  ) {
    return markRequiresReview(
      paymentRecord,
      bookingRecord,
      session,
      "Booking or payment is not in a confirmable state."
    );
  }

  const stripePaymentIntentId = getPaymentIntentId(session);
  const paidAt = new Date().toISOString();

  const { error: updatePaymentError } = await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_at: paidAt,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .eq("id", paymentRecord.id);

  if (updatePaymentError) {
    throw updatePaymentError;
  }

  const { data: confirmada, error: updateBookingError } = await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      payment_status: "paid",
      confirmed_at: paidAt,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .eq("id", bookingRecord.id)
    // Só reserva ainda pendente vira confirmada. Se o cron a expirou entre a
    // leitura e agora, confirmar aqui daria vaga que já voltou para o estoque.
    .eq("status", "pending")
    .select("id");

  if (updateBookingError) {
    throw updateBookingError;
  }

  if (!confirmada?.length) {
    await logEvent("payment_confirm_race", "payment", paymentRecord.id, {
      booking_id: bookingRecord.id,
      stripe_checkout_session_id: session.id,
      reason: "Booking left the pending state between read and write.",
    });

    return markRequiresReview(
      paymentRecord,
      bookingRecord,
      session,
      "Booking left the pending state before confirmation."
    );
  }

  // Cupom só é "consumido" quando o pagamento confirma (Fase 2.5). Falha aqui
  // não desfaz a confirmação — apenas registra.
  if (bookingRecord.coupon_id) {
    const { error: couponError } = await supabase.rpc("increment_coupon_usage", {
      p_coupon_id: bookingRecord.coupon_id,
    });
    if (couponError) {
      console.error("Failed to increment coupon usage", couponError);
    }
  }

  await logEvent("payment_confirmed", "payment", paymentRecord.id, {
    booking_id: bookingRecord.id,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: stripePaymentIntentId,
  });

  return {
    booking_id: bookingRecord.id,
    payment_id: paymentRecord.id,
    status: "confirmed",
  };
};
