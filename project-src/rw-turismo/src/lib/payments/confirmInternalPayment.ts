import { colunasDoProvedor, type PagamentoNormalizado } from "./normalized";
import { createSupabaseAdminClient } from "../supabase/admin";
import type { ConfirmInternalPaymentResult } from "./types";

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
  pagamento: PagamentoNormalizado,
  reason: string
): Promise<ConfirmInternalPaymentResult> => {
  const supabase = createSupabaseAdminClient() as any;
  const colunas = colunasDoProvedor(pagamento);

  const { error: updatePaymentError } = await supabase
    .from("payments")
    .update({
      status: "requires_review",
      paid_at: new Date().toISOString(),
      ...colunas,
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
      ...colunas,
    })
    .eq("id", booking.id)
    .neq("status", "confirmed")
    .not("payment_status", "eq", "paid");

  if (updateBookingError) {
    throw updateBookingError;
  }

  await logEvent("payment_requires_review", "payment", payment.id, {
    booking_id: booking.id,
    provider: pagamento.provider,
    cobranca: pagamento.idCobranca,
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
  pagamento: PagamentoNormalizado
): Promise<ConfirmInternalPaymentResult> => {
  const supabase = createSupabaseAdminClient() as any;
  const colunas = colunasDoProvedor(pagamento);

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
      provider: pagamento.provider,
      cobranca: pagamento.idCobranca,
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
      ...colunas,
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
      provider: pagamento.provider,
      cobranca: pagamento.idCobranca,
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
      ...colunas,
    })
    .eq("id", payment.id)
    .not("status", "eq", "paid");

  if (updatePaymentError) {
    throw updatePaymentError;
  }

  await logEvent("payment_awaiting_async", "payment", payment.id, {
    booking_id: booking.id,
    provider: pagamento.provider,
    cobranca: pagamento.idCobranca,
  });

  return {
    booking_id: booking.id,
    payment_id: payment.id,
    status: "processing",
    reason: "Awaiting asynchronous payment confirmation.",
  };
};

// A regra que decide dinheiro, para QUALQUER provedor.
//
// Recebe o pagamento já normalizado (ver normalized.ts). Quem traduz o formato
// de cada provedor — e, no caso da InfinitePay, quem PROVA que o pagamento
// existe — é o adaptador, antes de chegar aqui.
export const confirmInternalPayment = async (
  pagamento: PagamentoNormalizado
): Promise<ConfirmInternalPaymentResult> => {
  const supabase = createSupabaseAdminClient() as any;

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, booking_id, user_id, amount, currency, status")
    .eq("id", pagamento.paymentId)
    .maybeSingle();

  if (paymentError) {
    throw paymentError;
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, user_id, total_amount, status, payment_status, expires_at, coupon_id")
    .eq("id", pagamento.bookingId)
    .maybeSingle();

  if (bookingError) {
    throw bookingError;
  }

  if (!payment || !booking) {
    await logEvent("payment_invalid_metadata", "payment", pagamento.paymentId, {
      booking_id: pagamento.bookingId,
      provider: pagamento.provider,
      cobranca: pagamento.idCobranca,
      reason: "Payment or booking not found.",
    });

    return {
      booking_id: pagamento.bookingId,
      payment_id: pagamento.paymentId,
      status: "ignored",
      reason: "Payment or booking not found.",
    };
  }

  const paymentRecord = payment as PaymentRecord;
  const bookingRecord = booking as BookingRecord;

  const relationshipIsValid =
    paymentRecord.booking_id === bookingRecord.id &&
    paymentRecord.user_id === bookingRecord.user_id &&
    (pagamento.userId === null || pagamento.userId === bookingRecord.user_id);

  if (!relationshipIsValid) {
    await logEvent("payment_invalid_metadata", "payment", paymentRecord.id, {
      booking_id: bookingRecord.id,
      provider: pagamento.provider,
      cobranca: pagamento.idCobranca,
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

  // Compara o valor COBRADO, nunca o valor pago. Na InfinitePay o pago pode ser
  // maior quando os juros do parcelamento são repassados ao cliente — comparar
  // aquele por igualdade derrubaria toda venda parcelada.
  if (
    pagamento.valorCobradoEmCentavos !== expectedAmount ||
    pagamento.moeda !== "BRL"
  ) {
    return markRequiresReview(
      paymentRecord,
      bookingRecord,
      pagamento,
      "Provider amount or currency does not match booking."
    );
  }

  if (
    paymentRecord.status === "paid" &&
    bookingRecord.status === "confirmed" &&
    bookingRecord.payment_status === "paid"
  ) {
    await logEvent("payment_ignored_duplicate", "payment", paymentRecord.id, {
      booking_id: bookingRecord.id,
      provider: pagamento.provider,
      cobranca: pagamento.idCobranca,
    });

    return {
      booking_id: bookingRecord.id,
      payment_id: paymentRecord.id,
      status: "duplicate",
    };
  }

  // O PORTÃO DO DINHEIRO DE VERDADE.
  //
  // "a cobrança foi concluída" não quer dizer "o dinheiro entrou". Na Stripe,
  // com Pix, a sessão conclui no instante em que o cliente recebe o QR Code, e
  // o valor já vem certo desde a criação — ou seja, a conferência logo acima
  // passa perfeitamente numa cobrança que ninguém pagou. Na InfinitePay é pior:
  // o corpo do webhook nem tem campo de status, e quem responde "pago" é o
  // payment_check, consultado pelo servidor.
  //
  // Cada adaptador resolve isso à sua maneira e entrega a resposta aqui.
  if (!pagamento.pago) {
    return markAwaitingAsyncPayment(paymentRecord, bookingRecord, pagamento);
  }

  const expiresAtMs = bookingRecord.expires_at
    ? new Date(bookingRecord.expires_at).getTime()
    : NaN;

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return markRequiresReview(
      paymentRecord,
      bookingRecord,
      pagamento,
      "Booking expired before payment completion."
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
      pagamento,
      "Booking or payment is not in a confirmable state."
    );
  }

  const paidAt = new Date().toISOString();
  const colunasFinais = colunasDoProvedor(pagamento);

  const { error: updatePaymentError } = await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_at: paidAt,
      ...colunasFinais,
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
      ...colunasFinais,
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
      provider: pagamento.provider,
      cobranca: pagamento.idCobranca,
      reason: "Booking left the pending state between read and write.",
    });

    return markRequiresReview(
      paymentRecord,
      bookingRecord,
      pagamento,
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
    provider: pagamento.provider,
    cobranca: pagamento.idCobranca,
    transacao: pagamento.idTransacao,
  });

  return {
    booking_id: bookingRecord.id,
    payment_id: paymentRecord.id,
    status: "confirmed",
  };
};
