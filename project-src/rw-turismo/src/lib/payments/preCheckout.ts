import { countPendingDocuments } from "../bookings/passengerDocuments";
import { createSupabaseAdminClient } from "../supabase/admin";
import type { PaymentProvider } from "./normalized";

// Tudo que precisa ser verdade ANTES de abrir uma cobrança, seja qual for o
// provedor.
//
// POR QUE ISTO É UM ARQUIVO PRÓPRIO: estas verificações moravam dentro do
// caminho da Stripe. Escrever o caminho da InfinitePay do zero significaria
// reescrevê-las — e a que mais dói esquecer é o portão do documento
// obrigatório, porque a falta dele não quebra nada: só deixa uma criança
// embarcar sem documento, e ninguém descobre até o dia da viagem.

export class InternalCheckoutError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "InternalCheckoutError";
    this.statusCode = statusCode;
  }
}

export type BookingRecord = {
  id: string;
  user_id: string;
  product_id: string;
  product_date_id: string;
  travelers_count: number;
  total_amount: number | string;
  status: string;
  payment_status: string;
  expires_at: string | null;
  access_token?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  stripe_checkout_session_id?: string | null;
  payment_provider?: string | null;
  checkout_url?: string | null;
  infinitepay_invoice_slug?: string | null;
  products?: {
    title?: string | null;
    destination?: string | null;
    cover_image?: string | null;
  } | null;
};

export type PaymentRecord = {
  id: string;
  status: string;
};

export const COLUNAS_DA_RESERVA =
  "id, user_id, product_id, product_date_id, travelers_count, total_amount, status, payment_status, expires_at, access_token, customer_name, customer_email, customer_phone, stripe_checkout_session_id, payment_provider, checkout_url, infinitepay_invoice_slug, products(title, destination, cover_image)";

export const toAmountInCents = (value: number | string): number => {
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

export type PreCheckout = {
  booking: BookingRecord;
  payment: PaymentRecord;
  amountInCents: number;
};

// Confere posse, estado, prazo e documentos, e devolve o registro de pagamento
// a ser usado — reaproveitando o pendente que já exista, para uma segunda
// tentativa não virar uma segunda linha no financeiro.
export const prepararCheckout = async (
  bookingId: string,
  userId: string,
  provider: PaymentProvider
): Promise<PreCheckout> => {
  const supabase = createSupabaseAdminClient() as any;

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(COLUNAS_DA_RESERVA)
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) throw bookingError;
  if (!booking) throw new InternalCheckoutError("Booking not found.", 404);

  const bookingRecord = booking as BookingRecord;

  // Mesma mensagem de "não existe" para reserva de outra pessoa: dizer
  // "existe, mas não é sua" já entrega que ela existe.
  if (bookingRecord.user_id !== userId) {
    throw new InternalCheckoutError("Booking not found.", 404);
  }

  if (
    bookingRecord.status !== "pending" ||
    bookingRecord.payment_status !== "pending"
  ) {
    throw new InternalCheckoutError(
      bookingRecord.payment_status === "processing"
        ? "Já existe uma cobrança aberta para esta reserva. Pague por ela ou aguarde o prazo terminar para tentar de outra forma."
        : "Esta reserva não está mais disponível para pagamento.",
      409
    );
  }

  assertNotExpired(bookingRecord.expires_at);

  // Portão do documento obrigatório. A especificação é explícita: "o botão 'Ir
  // para pagamento' permanece bloqueado até o envio do documento obrigatório".
  //
  // A trava vive AQUI, e não só no botão da tela: esconder o botão não impede
  // ninguém de chamar a rota direto, e é justamente o caso em que a agência
  // ficaria sem o documento de uma criança já embarcada.
  const pendingDocuments = await countPendingDocuments(bookingRecord.id);
  if (pendingDocuments > 0) {
    throw new InternalCheckoutError(
      pendingDocuments === 1
        ? "Envie o documento obrigatório do passageiro antes de pagar."
        : `Envie os documentos obrigatórios (${pendingDocuments} pendentes) antes de pagar.`,
      409
    );
  }

  const amountInCents = toAmountInCents(bookingRecord.total_amount);

  const { data: existingPayments, error: paymentLookupError } = await supabase
    .from("payments")
    .select("id, status")
    .eq("booking_id", bookingRecord.id)
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (paymentLookupError) throw paymentLookupError;

  let payment = (existingPayments?.[0] ?? null) as PaymentRecord | null;

  if (!payment) {
    const { data: createdPayment, error: createPaymentError } = await supabase
      .from("payments")
      .insert({
        booking_id: bookingRecord.id,
        user_id: userId,
        amount: Number(bookingRecord.total_amount),
        currency: "BRL",
        status: "pending",
        // Explícito, sempre. O default da coluna foi removido justamente para
        // que "esqueci de dizer qual" falhe em vez de gravar 'stripe' numa
        // venda de outro provedor e fazer o painel mentir.
        provider,
      })
      .select("id, status")
      .single();

    if (createPaymentError) throw createPaymentError;

    payment = createdPayment as PaymentRecord;
  }

  return { booking: bookingRecord, payment, amountInCents };
};
