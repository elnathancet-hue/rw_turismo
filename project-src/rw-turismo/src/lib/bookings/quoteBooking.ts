import { createSupabaseAdminClient } from "../supabase/admin";
import { mapRpcError, PendingBookingError } from "./createPendingBooking";

// Cotação: o total oficial ANTES de criar a reserva. Chama a RPC quote_booking,
// que é a mesma função que create_pending_booking_transaction usa para calcular
// o preço — por isso o valor da revisão não tem como divergir do cobrado.
//
// Reaproveita mapRpcError de createPendingBooking: os códigos de erro são os
// mesmos (cupom inválido, vagas insuficientes, acomodação que não cabe…), então
// o cliente recebe exatamente a mesma mensagem nos dois caminhos.

export type QuoteBookingInput = {
  product_id: string;
  product_date_id: string;
  travelers_count: number;
  coupon_code?: string | null;
  accommodation_code?: string | null;
  // Só as datas de nascimento importam para o preço; o nome não entra aqui.
  // Lista vazia = todo mundo adulto, que é o valor mais alto: enquanto a pessoa
  // não preenche as datas, o total mostrado só pode cair, nunca subir.
  passengers?: Array<{ birth_date: string }>;
};

export type QuoteBookingResult = {
  unit_amount: number;
  // Antes do cupom, já com a tarifa infantil aplicada.
  subtotal_amount: number;
  total_amount: number;
  // Só o que o CUPOM abateu. A economia da tarifa infantil aparece na
  // composição (adults/children/infants), não aqui — misturar as duas faria a
  // tela creditar ao cupom um desconto que é da idade.
  discount: number;
  coupon_applied: boolean;
  accommodation_code: string | null;
  accommodation_name: string | null;
  adults_count: number;
  children_count: number;
  infants_count: number;
};

export const quoteBooking = async (
  input: QuoteBookingInput
): Promise<QuoteBookingResult> => {
  if (!Number.isInteger(input.travelers_count) || input.travelers_count <= 0) {
    throw new PendingBookingError("travelers_count must be a positive integer.");
  }

  const supabase = createSupabaseAdminClient() as any;

  // Só manda a lista quando TODAS as datas estão preenchidas: uma lista parcial
  // classificaria os campos vazios como adulto e mostraria um total que muda
  // sozinho conforme a pessoa digita.
  const birthDates = (input.passengers ?? [])
    .map((passenger) => (passenger.birth_date ?? "").trim())
    .filter(Boolean);
  const passengers =
    birthDates.length === input.travelers_count
      ? birthDates.map((birth_date) => ({ birth_date }))
      : null;

  const { data, error } = await supabase.rpc("quote_booking", {
    p_product_id: input.product_id,
    p_product_date_id: input.product_date_id,
    p_travelers_count: input.travelers_count,
    p_coupon_code: input.coupon_code ?? null,
    p_accommodation_code: input.accommodation_code ?? null,
    p_passengers: passengers,
  });

  if (error) {
    const mappedError = mapRpcError(error.message);
    throw mappedError ?? error;
  }

  const quote = Array.isArray(data) ? data[0] : data;

  if (!quote) {
    throw new PendingBookingError("Não foi possível calcular o valor.", 500);
  }

  const subtotal = Number(quote.subtotal_amount);
  const total = Number(quote.total_amount);

  return {
    unit_amount: Number(quote.unit_amount),
    subtotal_amount: subtotal,
    total_amount: total,
    discount: Math.max(0, Number((subtotal - total).toFixed(2))),
    coupon_applied: Boolean(quote.coupon_id),
    accommodation_code: quote.accommodation_code ?? null,
    accommodation_name: quote.accommodation_name ?? null,
    adults_count: Number(quote.adults_count) || 0,
    children_count: Number(quote.children_count) || 0,
    infants_count: Number(quote.infants_count) || 0,
  };
};
