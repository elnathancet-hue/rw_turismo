import { createSupabaseAdminClient } from "../supabase/admin";
import type {
  CreatePendingBookingInput,
  CreatePendingBookingResult,
} from "./types";

export class PendingBookingError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "PendingBookingError";
    this.statusCode = statusCode;
  }
}

const assertPositiveInteger = (value: number, field: string) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new PendingBookingError(`${field} must be a positive integer.`);
  }
};

// Exportada para teste unitário (Fase 5.5) — mapeia códigos da RPC para erro
// amigável. Retorna null quando a mensagem não casa com nenhum código conhecido.
export const mapRpcError = (message: string) => {
  if (message.includes("AUTH_REQUIRED")) {
    return new PendingBookingError("Authentication required.", 401);
  }

  if (message.includes("PRODUCT_AND_DATE_REQUIRED")) {
    return new PendingBookingError("product_id and product_date_id are required.");
  }

  if (message.includes("CUSTOMER_NAME_REQUIRED")) {
    return new PendingBookingError("customer_name is required.");
  }

  if (message.includes("CUSTOMER_EMAIL_REQUIRED")) {
    return new PendingBookingError("customer_email is required.");
  }

  if (message.includes("INVALID_TRAVELERS_COUNT")) {
    return new PendingBookingError(
      "travelers_count must be a positive integer."
    );
  }

  if (message.includes("PRODUCT_NOT_AVAILABLE")) {
    return new PendingBookingError("Product is not available.", 404);
  }

  if (message.includes("PRODUCT_DATE_NOT_AVAILABLE")) {
    return new PendingBookingError("Product date is not available.", 404);
  }

  if (message.includes("PRODUCT_DATE_MISMATCH")) {
    return new PendingBookingError("Product date does not belong to product.");
  }

  if (message.includes("PRODUCT_DATE_IN_PAST")) {
    return new PendingBookingError("Product date has already departed.", 404);
  }

  if (message.includes("NOT_ENOUGH_SLOTS")) {
    return new PendingBookingError("Not enough available slots.", 409);
  }

  if (message.includes("COUPON_NOT_FOUND")) {
    return new PendingBookingError("Cupom inválido ou inativo.", 400);
  }

  if (message.includes("COUPON_EXPIRED")) {
    return new PendingBookingError("Cupom expirado.", 400);
  }

  if (message.includes("COUPON_EXHAUSTED")) {
    return new PendingBookingError("Este cupom já esgotou.", 400);
  }

  if (message.includes("COUPON_WRONG_PRODUCT")) {
    return new PendingBookingError(
      "Este cupom não é válido para este produto.",
      400
    );
  }

  return null;
};

export const createPendingBooking = async (
  input: CreatePendingBookingInput
): Promise<CreatePendingBookingResult> => {
  assertPositiveInteger(input.travelers_count, "travelers_count");

  if (!input.customer_name.trim()) {
    throw new PendingBookingError("customer_name is required.");
  }

  if (!input.customer_email.trim()) {
    throw new PendingBookingError("customer_email is required.");
  }

  const supabase = createSupabaseAdminClient() as any;

  const { data, error } = await supabase.rpc(
    "create_pending_booking_transaction",
    {
      p_user_id: input.user_id,
      p_product_id: input.product_id,
      p_product_date_id: input.product_date_id,
      p_customer_name: input.customer_name,
      p_customer_email: input.customer_email,
      p_customer_phone: input.customer_phone ?? null,
      p_travelers_count: input.travelers_count,
      p_coupon_code: input.coupon_code ?? null,
    }
  );

  if (error) {
    const mappedError = mapRpcError(error.message);
    throw mappedError ?? error;
  }

  const booking = Array.isArray(data) ? data[0] : data;

  if (!booking) {
    throw new PendingBookingError("Unable to create pending booking.", 500);
  }

  return {
    booking_id: booking.booking_id,
    total_amount: Number(booking.total_amount),
    expires_at: booking.expires_at,
  };
};
