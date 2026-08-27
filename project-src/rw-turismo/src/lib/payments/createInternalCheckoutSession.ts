import Stripe from "stripe";
import { countPendingDocuments } from "../bookings/passengerDocuments";
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
  access_token?: string | null;
  stripe_checkout_session_id?: string | null;
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
      "id, user_id, product_id, product_date_id, travelers_count, total_amount, status, payment_status, expires_at, access_token, stripe_checkout_session_id, products(title, destination, cover_image)"
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
    throw new InternalCheckoutError(
      bookingRecord.payment_status === "processing"
        ? "Já existe um Pix aberto para esta reserva. Pague por ele ou aguarde o código expirar para tentar de outra forma."
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

  // Nova tentativa de pagamento: expira a sessão antiga no Stripe antes de
  // abrir outra, para nunca existirem dois checkouts vivos da mesma reserva.
  // Melhor esforço: sessão já completada/expirada apenas ignora o erro.
  if (bookingRecord.stripe_checkout_session_id) {
    try {
      await stripe.checkout.sessions.expire(
        bookingRecord.stripe_checkout_session_id
      );
    } catch {
      // já expirada, já completada ou inexistente — seguir em frente
    }
  }

  const productName = bookingRecord.products?.title ?? "Reserva RWTurismo";

  // Tenta alinhar a vida da sessão Stripe ao hold da reserva (30 min) em vez
  // do padrão de 24h — mas o Stripe só aceita expires_at >= agora + 30 min
  // (erro de API abaixo disso), e o checkout é sempre criado ALGUM tempo
  // depois do início do hold. Na prática isso significa que
  // "agora + 31min de folga" quase sempre é maior que o expires_at real da
  // reserva, então esse piso do Stripe é o que realmente decide a vida da
  // sessão na maioria dos casos — o Math.max não é o bug em si, é o piso
  // físico da API. O resíduo (sessão Stripe viva além do hold) é coberto
  // pelo gate de expiração em confirmInternalPayment: um pagamento
  // completado depois do expires_at da reserva cai em requires_review em vez
  // de confirmar uma reserva já expirada/com vaga já liberada.
  const bookingExpiresAtMs = new Date(bookingRecord.expires_at as string).getTime();
  const minSessionExpiryMs = Date.now() + 31 * 60 * 1000;
  const sessionExpiresAt = Math.floor(
    Math.max(bookingExpiresAtMs, minSessionExpiryMs) / 1000
  );

  // Pix é assíncrono: a sessão conclui quando o QR é emitido, e o dinheiro vem
  // depois. Todo o caminho que trata isso (payment_status 'processing',
  // async_payment_succeeded/failed) já está no ar — esta chave só decide se o
  // meio de pagamento aparece na tela.
  //
  // Lista explícita em vez de formas de pagamento dinâmicas de propósito: se o
  // Pix não estiver liberado na conta, sessions.create falha alto e visível. Com
  // formas dinâmicas ele sumiria em silêncio, inclusive por estourar o teto de
  // valor do Pix — e pacote de viagem é justamente o caso caro.
  // Quem comprou sem cadastro volta da Stripe sem sessão nenhuma. Sem o token na
  // URL de retorno, a tela de "pagamento aprovado" manda a pessoa para o login
  // logo depois de ela pagar — que é onde o funil morre.
  const returnToken =
    input.is_guest && bookingRecord.access_token
      ? `&t=${encodeURIComponent(bookingRecord.access_token)}`
      : "";

  const pixEnabled = (await getSecret("stripe_pix_enabled")) === "true";

  // O Pix é assíncrono: o cliente sai da tela com um código e paga depois. Se o
  // hold estiver acabando, esse código nasce condenado — ou o cliente paga um
  // QR de uma vaga que já voltou para o estoque, ou desiste no meio. Com pouco
  // tempo restante, oferecer só cartão (que resolve na hora) é o certo.
  const restanteDoHoldMs = bookingExpiresAtMs - Date.now();
  const MARGEM_MINIMA_PIX_MS = 10 * 60 * 1000;
  const oferecePix = pixEnabled && restanteDoHoldMs >= MARGEM_MINIMA_PIX_MS;

  // A Stripe conta este prazo a partir do momento em que o cliente CONFIRMA o
  // Pix na tela dela, não de agora. Ou seja: mesmo alinhado ao hold, sobra uma
  // folga em que o QR vive além da reserva. Quem pagar nessa folga cai no
  // portão de expiração de confirmInternalPayment e vai para "em análise" —
  // dinheiro recebido, reserva conferida por gente. É o motivo da margem acima
  // ser generosa. O mínimo aceito pela API é 10 segundos.
  const pixExpiresAfterSeconds = Math.min(
    86400,
    Math.max(10, Math.floor(restanteDoHoldMs / 1000))
  );

  const parametrosDaSessao = (
    metodos: Array<"card" | "pix">
  ): Stripe.Checkout.SessionCreateParams => ({
    mode: "payment" as const,
    payment_method_types: metodos,
    ...(metodos.includes("pix")
      ? {
          payment_method_options: {
            pix: { expires_after_seconds: pixExpiresAfterSeconds },
          },
        }
      : {}),
    expires_at: sessionExpiresAt,
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
    success_url: `${siteUrl}/account/bookings/payment-success?booking_id=${bookingRecord.id}${returnToken}`,
    cancel_url: `${siteUrl}/account/bookings/payment-cancel?booking_id=${bookingRecord.id}${returnToken}`,
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

  // Pix e cartão não podem cair juntos.
  //
  // No Brasil o Pix é liberado por convite: se a chave estiver ligada e a conta
  // não tiver a permissão, sessions.create lança e o comprador vê um erro
  // genérico — sem conseguir pagar por meio NENHUM, cartão inclusive. Um campo
  // de texto no painel derrubaria o funil inteiro. Aqui a sessão é refeita só
  // com cartão, e a recusa fica registrada para alguém ver.
  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.create(
      parametrosDaSessao(oferecePix ? ["card", "pix"] : ["card"])
    );
  } catch (erroDaSessao) {
    const mensagem =
      erroDaSessao instanceof Error ? erroDaSessao.message : String(erroDaSessao);
    const pareceRecusaDePix =
      oferecePix &&
      (mensagem.toLowerCase().includes("pix") ||
        mensagem.includes("payment_method_types"));

    if (!pareceRecusaDePix) {
      console.error("Stripe recusou a criação da sessão", erroDaSessao);
      throw new InternalCheckoutError(
        "Não foi possível abrir o pagamento agora. Tente novamente em instantes.",
        502
      );
    }

    await supabase.from("system_logs").insert({
      action: "stripe_pix_rejected",
      entity: "booking",
      entity_id: bookingRecord.id,
      metadata: { message: mensagem },
    });

    session = await stripe.checkout.sessions.create(parametrosDaSessao(["card"]));
  }

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
