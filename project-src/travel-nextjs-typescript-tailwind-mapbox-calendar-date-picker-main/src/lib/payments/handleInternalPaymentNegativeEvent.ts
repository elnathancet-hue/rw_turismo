import type Stripe from "stripe";
import { createSupabaseAdminClient } from "../supabase/admin";
import type {
  HandleInternalPaymentNegativeEventResult,
  InternalStripeMetadata,
} from "./types";

type NegativeEventKind = "checkout_expired" | "payment_failed";

type BookingRecord = {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  slots_released: boolean;
};

type PaymentRecord = {
  id: string;
  booking_id: string;
  user_id: string;
  status: string;
};

const getMetadata = (
  metadata: Stripe.Metadata | null | undefined
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

const getPaymentIntentId = (
  eventObject: Stripe.Checkout.Session | Stripe.PaymentIntent
) => {
  if ("payment_intent" in eventObject) {
    if (!eventObject.payment_intent) return null;
    return typeof eventObject.payment_intent === "string"
      ? eventObject.payment_intent
      : eventObject.payment_intent.id;
  }

  return eventObject.id;
};

export const handleInternalPaymentNegativeEvent = async (
  eventObject: Stripe.Checkout.Session | Stripe.PaymentIntent,
  kind: NegativeEventKind
): Promise<HandleInternalPaymentNegativeEventResult> => {
  const metadata = getMetadata(eventObject.metadata);
  const stripeCheckoutSessionId =
    eventObject.object === "checkout.session" ? eventObject.id : null;
  const stripePaymentIntentId = getPaymentIntentId(eventObject);
  const targetPaymentStatus = kind === "payment_failed" ? "failed" : "cancelled";

  if (!metadata) {
    await logEvent("payment_invalid_metadata", "payment", null, {
      stripe_event_kind: kind,
      stripe_object_id: eventObject.id,
      source: eventObject.metadata?.source ?? null,
    });

    return {
      status: "ignored",
      reason: "Invalid or non-internal metadata.",
    };
  }

  const supabase = createSupabaseAdminClient() as any;

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, booking_id, user_id, status")
    .eq("id", metadata.payment_id)
    .maybeSingle();

  if (paymentError) {
    throw paymentError;
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, user_id, status, payment_status, slots_released")
    .eq("id", metadata.booking_id)
    .maybeSingle();

  if (bookingError) {
    throw bookingError;
  }

  if (!payment || !booking) {
    await logEvent("payment_invalid_metadata", "payment", metadata.payment_id, {
      booking_id: metadata.booking_id,
      stripe_event_kind: kind,
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
      stripe_event_kind: kind,
      reason: "Payment, booking and user relationship mismatch.",
    });

    return {
      booking_id: bookingRecord.id,
      payment_id: paymentRecord.id,
      status: "ignored",
      reason: "Invalid payment relationship.",
    };
  }

  if (paymentRecord.status === "paid" || bookingRecord.status === "confirmed") {
    await logEvent("booking_expire_skipped_paid", "booking", bookingRecord.id, {
      payment_id: paymentRecord.id,
      stripe_event_kind: kind,
      payment_status: paymentRecord.status,
      booking_status: bookingRecord.status,
    });

    return {
      booking_id: bookingRecord.id,
      payment_id: paymentRecord.id,
      status: "skipped",
      reason: "Payment is paid or booking is confirmed.",
    };
  }

  if (
    bookingRecord.status === "expired" &&
    Boolean(bookingRecord.slots_released)
  ) {
    await logEvent("booking_expire_duplicate", "booking", bookingRecord.id, {
      payment_id: paymentRecord.id,
      stripe_event_kind: kind,
    });

    return {
      booking_id: bookingRecord.id,
      payment_id: paymentRecord.id,
      status: "duplicate",
      reason: "Booking already expired and slots already released.",
    };
  }

  let expired = false;
  let slotsReleased = Boolean(bookingRecord.slots_released);

  if (
    bookingRecord.status === "pending" &&
    bookingRecord.payment_status === "pending"
  ) {
    const { data: expireResult, error: expireError } = await supabase.rpc(
      "expire_pending_booking",
      {
        p_booking_id: bookingRecord.id,
      }
    );

    if (expireError) {
      throw expireError;
    }

    const result = Array.isArray(expireResult) ? expireResult[0] : expireResult;
    expired = Boolean(result?.expired);
    slotsReleased = Boolean(result?.slots_released);

    if (expired) {
      await logEvent("booking_expired", "booking", bookingRecord.id, {
        payment_id: paymentRecord.id,
        stripe_event_kind: kind,
        slots_released: slotsReleased,
      });
    }
  }

  if (paymentRecord.status === "pending") {
    const { error: updatePaymentError } = await supabase
      .from("payments")
      .update({
        status: targetPaymentStatus,
        stripe_checkout_session_id: stripeCheckoutSessionId ?? undefined,
        stripe_payment_intent_id: stripePaymentIntentId,
      })
      .eq("id", paymentRecord.id)
      .eq("status", "pending");

    if (updatePaymentError) {
      throw updatePaymentError;
    }
  }

  if (!expired && !slotsReleased) {
    await logEvent("booking_expire_duplicate", "booking", bookingRecord.id, {
      payment_id: paymentRecord.id,
      stripe_event_kind: kind,
      reason: "Booking was not expired by RPC.",
    });
  }

  await logEvent(kind, "payment", paymentRecord.id, {
    booking_id: bookingRecord.id,
    payment_status: targetPaymentStatus,
    stripe_checkout_session_id: stripeCheckoutSessionId,
    stripe_payment_intent_id: stripePaymentIntentId,
  });

  return {
    booking_id: bookingRecord.id,
    payment_id: paymentRecord.id,
    status: expired ? "expired" : "updated",
    slots_released: slotsReleased,
  };
};
