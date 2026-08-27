import { createSupabaseAdminClient } from "../supabase/admin";
import {
  isValidDateString,
  passengerTypeOnDeparture,
} from "./passengerAge";
import type {
  BookingPassengerInput,
  CreatePendingBookingInput,
  CreatePendingBookingResult,
  PassengerType,
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

  if (message.includes("ACCOMMODATION_REQUIRED")) {
    return new PendingBookingError(
      "Escolha a acomodação para continuar.",
      400
    );
  }

  if (message.includes("ACCOMMODATION_NOT_AVAILABLE")) {
    return new PendingBookingError(
      "Esta acomodação não está mais disponível neste pacote.",
      400
    );
  }

  if (message.includes("ACCOMMODATION_DOES_NOT_FIT")) {
    return new PendingBookingError(
      "Esta acomodação não comporta essa quantidade de viajantes.",
      400
    );
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


// Monta as linhas de `passengers` a partir do que o comprador digitou.
// Exportada para teste unitário, como mapRpcError.
//
// Valida no SERVIDOR de propósito: o formulário também confere, mas quem chama
// a API direto não passa pelo formulário. E o tipo do passageiro é DERIVADO da
// data de nascimento contra a data da saída — nunca escolhido numa lista, que é
// o que a especificação pede.
export const buildPassengerRows = (
  passengers: BookingPassengerInput[],
  travelersCount: number,
  departureDate: string
): Array<{ full_name: string; birth_date: string; type: PassengerType }> => {
  if (passengers.length !== travelersCount) {
    throw new PendingBookingError(
      `Informe os dados de ${travelersCount} ${
        travelersCount === 1 ? "viajante" : "viajantes"
      }.`,
      400
    );
  }

  return passengers.map((passenger, index) => {
    const fullName = (passenger.full_name ?? "").trim();
    const birthDate = (passenger.birth_date ?? "").trim();
    const posicao = `${index + 1}º viajante`;

    if (fullName.length < 3) {
      throw new PendingBookingError(
        `${posicao}: informe o nome completo.`,
        400
      );
    }

    if (!isValidDateString(birthDate)) {
      throw new PendingBookingError(
        `${posicao}: data de nascimento inválida.`,
        400
      );
    }

    if (birthDate > departureDate) {
      throw new PendingBookingError(
        `${posicao}: a data de nascimento é depois da viagem.`,
        400
      );
    }

    return {
      full_name: fullName,
      birth_date: birthDate,
      type: passengerTypeOnDeparture(birthDate, departureDate),
    };
  });
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

  // Passageiros são validados ANTES de criar a reserva: um nome faltando não
  // pode deixar a vaga retida por 30 minutos até a expiração.
  let passengerRows: Array<{
    full_name: string;
    birth_date: string;
    type: PassengerType;
  }> = [];

  if (input.passengers && input.passengers.length > 0) {
    const { data: departure, error: departureError } = await supabase
      .from("product_dates")
      .select("start_date")
      .eq("id", input.product_date_id)
      .maybeSingle();

    if (departureError || !departure?.start_date) {
      throw new PendingBookingError("Product date is not available.", 404);
    }

    passengerRows = buildPassengerRows(
      input.passengers,
      input.travelers_count,
      departure.start_date as string
    );
  }

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
      p_accommodation_code: input.accommodation_code ?? null,
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

  // Grava os viajantes com service role (não depende de sessão no navegador —
  // na compra sem cadastro o cliente não tem sessão). Sem isto, a venda online
  // chegava na operação com zero passageiros: sem rooming, sem mapa de
  // assentos, sem check-in e com o voucher em branco.
  if (passengerRows.length > 0) {
    const { error: passengerError } = await supabase.from("passengers").insert(
      passengerRows.map((row) => ({ ...row, booking_id: booking.booking_id }))
    );

    // A reserva já existe e a vaga já está retida; derrubar tudo aqui seria
    // pior. Registra e segue — o admin completa pela tela da reserva.
    if (passengerError) {
      console.error("pending booking passengers insert failed", {
        booking_id: booking.booking_id,
        error: passengerError,
      });
    }
  }

  return {
    booking_id: booking.booking_id,
    total_amount: Number(booking.total_amount),
    expires_at: booking.expires_at,
  };
};
