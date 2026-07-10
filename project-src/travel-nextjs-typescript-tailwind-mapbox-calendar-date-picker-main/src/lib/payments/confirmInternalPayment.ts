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
    .eq("id", payment.id);

  if (updatePaymentError) {
    throw updatePaymentError;
  }

  const { error: updateBookingError } = await supabase
    .from("bookings")
    .update({
      payment_status: "requires_review",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .eq("id", booking.id);

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
    .select("id, user_id, total_amount, status, payment_status, expires_at")
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
    bookingRecord.payment_status !== "pending" ||
    // "failed" é confirmável: cartão recusado seguido de nova tentativa na
    // MESMA sessão de checkout. Valor/moeda e expiração já foram validados
    // acima, então o dinheiro capturado corresponde à reserva ainda válida.
    !["pending", "paid", "failed"].includes(paymentRecord.status)
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

  const { error: updateBookingError } = await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      payment_status: "paid",
      confirmed_at: paidAt,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .eq("id", bookingRecord.id);

  if (updateBookingError) {
    throw updateBookingError;
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
