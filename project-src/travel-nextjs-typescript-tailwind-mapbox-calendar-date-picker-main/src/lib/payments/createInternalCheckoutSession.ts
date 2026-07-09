import Stripe from "stripe";
import { getPublicEnv } from "../env";
import { getSecret } from "../server/secrets";
import { createSupabaseAdminClient } from "../supabase/admin";
import type { CreateCheckoutInput, CreateCheckoutResult } from "./types";

export class InternalCheckoutError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "InternalCheckoutError";
    this.statusCode = statusCode;
  }
}

type BookingRecord = {
  id: string;
  user_id: string;
  product_id: string;
  product_date_id: string;
  travelers_count: number;
  total_amount: number | string;
  status: string;
  payment_status: string;
  expires_at: string | null;
  products?: {
    title?: string | null;
    destination?: string | null;
    cover_image?: string | null;
  } | null;
};

type PaymentRecord = {
  id: string;
  status: string;
};

const toStripeAmountInCents = (value: number | string) => {
  const normalized = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new InternalCheckoutError("Invalid booking amount.", 500);
  }

  return Math.round(normalized * 100);
};

const assertNotExpired = (expiresAt: string | null) => {
  if (!expiresAt) {
    throw new InternalCheckoutError("Booking expiration is missing.");
  }

  const expiresAtMs = new Date(expiresAt).getTime();

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new InternalCheckoutError("Booking has expired.", 409);
  }

};

export const createInternalCheckoutSession = async (
  input: CreateCheckoutInput
): Promise<CreateCheckoutResult> => {
  if (!input.booking_id) {
    throw new InternalCheckoutError("booking_id is required.");
  }

  if (!input.user_id) {
    throw new InternalCheckoutError("Authentication required.", 401);
  }

  const supabase = createSupabaseAdminClient() as any;

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, user_id, product_id, product_date_id, travelers_count, total_amount, status, payment_status, expires_at, products(title, destination, cover_image)"
    )
    .eq("id", input.booking_id)
    .maybeSingle();

  if (bookingError) {
    throw bookingError;
  }

  if (!booking) {
    throw new InternalCheckoutError("Booking not found.", 404);
  }

  const bookingRecord = booking as BookingRecord;

  if (bookingRecord.user_id !== input.user_id) {
    throw new InternalCheckoutError("Booking not found.", 404);
  }

  if (
    bookingRecord.status !== "pending" ||
    bookingRecord.payment_status !== "pending"
  ) {
    throw new InternalCheckoutError("Booking is not payable.", 409);
  }

  assertNotExpired(bookingRecord.expires_at);
  const amountInCents = toStripeAmountInCents(bookingRecord.total_amount);

  const { data: existingPayments, error: paymentLookupError } = await supabase
    .from("payments")
    .select("id, status")
    .eq("booking_id", bookingRecord.id)
    .eq("user_id", input.user_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (paymentLookupError) {
    throw paymentLookupError;
  }

  let payment = (existingPayments?.[0] ?? null) as PaymentRecord | null;

  if (!payment) {
    const { data: createdPayment, error: createPaymentError } = await supabase
      .from("payments")
      .insert({
        booking_id: bookingRecord.id,
        user_id: input.user_id,
        amount: Number(bookingRecord.total_amount),
        currency: "BRL",
        status: "pending",
        provider: "stripe",
      })
      .select("id, status")
      .single();

    if (createPaymentError) {
      throw createPaymentError;
    }

    payment = createdPayment as PaymentRecord;
  }

  const { siteUrl } = getPublicEnv();
  // Chave do painel de integrações (fallback: env STRIPE_SECRET_KEY).
  const stripeSecretKey = await getSecret("stripe_secret_key");

  if (!stripeSecretKey) {
    throw new InternalCheckoutError(
      "Pagamento ainda não configurado. Cole as chaves do Stripe em Admin → Integrações.",
      503
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2022-11-15",
  });

  const productName = bookingRecord.products?.title ?? "Reserva RWTurismo";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "brl",
          unit_amount: amountInCents,
          product_data: {
            name: productName,
            description: bookingRecord.products?.destination ?? undefined,
            images: bookingRecord.products?.cover_image
              ? [bookingRecord.products.cover_image]
              : undefined,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/account/bookings/payment-success?booking_id=${bookingRecord.id}`,
    cancel_url: `${siteUrl}/account/bookings/payment-cancel?booking_id=${bookingRecord.id}`,
    metadata: {
      booking_id: bookingRecord.id,
      payment_id: payment.id,
      user_id: input.user_id,
      source: "internal_booking",
    },
    payment_intent_data: {
      metadata: {
        booking_id: bookingRecord.id,
        payment_id: payment.id,
        user_id: input.user_id,
        source: "internal_booking",
      },
    },
  });

  if (!session.url) {
    throw new InternalCheckoutError("Unable to create checkout URL.", 500);
  }

  const { error: updatePaymentError } = await supabase
    .from("payments")
    .update({
      stripe_checkout_session_id: session.id,
    })
    .eq("id", payment.id);

  if (updatePaymentError) {
    throw updatePaymentError;
  }

  const { error: updateBookingError } = await supabase
    .from("bookings")
    .update({
      stripe_checkout_session_id: session.id,
    })
    .eq("id", bookingRecord.id);

  if (updateBookingError) {
    throw updateBookingError;
  }

  return {
    checkout_url: session.url,
  };
};
