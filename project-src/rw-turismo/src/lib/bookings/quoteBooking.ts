import { createSupabaseAdminClient } from "../supabase/admin";
import { mapRpcError, PendingBookingError } from "./createPendingBooking";

// Cotação: o total oficial ANTES de criar a reserva. Chama a RPC quote_booking,
// que é a mesma função que create_pending_booking_transaction usa para calcular
// o preço — por isso o valor da revisão não tem como divergir do cobrado.
//
// Reaproveita mapRpcError de createPendingBooking: os códigos de erro são os
// mesmos (cupom inválido, vagas insuficientes, data no passado…), então o
// cliente recebe exatamente a mesma mensagem nos dois caminhos.

export type QuoteBookingInput = {
  product_id: string;
  product_date_id: string;
  travelers_count: number;
  coupon_code?: string | null;
};

export type QuoteBookingResult = {
  unit_amount: number;
  total_amount: number;
  // Quanto o cupom abateu. 0 quando não há cupom (ou quando ele não muda nada).
  discount: number;
  coupon_applied: boolean;
};

export const quoteBooking = async (
  input: QuoteBookingInput
): Promise<QuoteBookingResult> => {
  if (!Number.isInteger(input.travelers_count) || input.travelers_count <= 0) {
    throw new PendingBookingError("travelers_count must be a positive integer.");
  }

  const supabase = createSupabaseAdminClient() as any;

  const { data, error } = await supabase.rpc("quote_booking", {
    p_product_id: input.product_id,
    p_product_date_id: input.product_date_id,
    p_travelers_count: input.travelers_count,
    p_coupon_code: input.coupon_code ?? null,
  });

  if (error) {
    const mappedError = mapRpcError(error.message);
    throw mappedError ?? error;
  }

  const quote = Array.isArray(data) ? data[0] : data;

  if (!quote) {
    throw new PendingBookingError("Não foi possível calcular o valor.", 500);
  }

  const unitAmount = Number(quote.unit_amount);
  const totalAmount = Number(quote.total_amount);

  return {
    unit_amount: unitAmount,
    total_amount: totalAmount,
    discount: Math.max(
      0,
      Number((unitAmount * input.travelers_count - totalAmount).toFixed(2))
    ),
    coupon_applied: Boolean(quote.coupon_id),
  };
};
