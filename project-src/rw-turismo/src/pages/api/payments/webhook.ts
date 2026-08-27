import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { confirmInternalPayment } from "../../../lib/payments/confirmInternalPayment";
import { handleInternalPaymentNegativeEvent } from "../../../lib/payments/handleInternalPaymentNegativeEvent";
import {
  claimStripeEvent,
  markStripeEventProcessed,
  releaseStripeEvent,
} from "../../../lib/payments/stripeEventLock";
import type {
  ConfirmInternalPaymentResult,
  HandleInternalPaymentNegativeEventResult,
} from "../../../lib/payments/types";
import { notifyBookingEvent } from "../../../lib/server/notifications";
import { getSecrets } from "../../../lib/server/secrets";

// Avisa o cliente SOMENTE quando o banco confirmou de fato.
//
// Antes esta decisão saía de `session.metadata?.booking_id`, que existe em
// qualquer sessão — inclusive nas que caíram em requires_review por valor
// divergente, nas que expiraram antes de concluir e, o pior, nas que estão
// apenas aguardando um Pix. O estrago não é só a mensagem errada: o `ref`
// gravado em notification_log é `booking_confirmed:<id>`, então o aviso legítimo
// que viria depois seria engolido como repetido.
const notifyIfConfirmed = async (result: ConfirmInternalPaymentResult) => {
  if (result.status !== "confirmed" || !result.booking_id) return;

  await notifyBookingEvent("booking_confirmed", result.booking_id).catch(
    (notifyError) => console.error("booking_confirmed notify failed", notifyError)
  );
};

// O mesmo cuidado do lado negativo, que faltava.
//
// Cenário real de uma entrega só: Pix emitido, cliente paga na agência, a
// operação confirma no painel, o Pix vence e chega async_payment_failed. O
// handler devolve "skipped" (não mexeu em nada, e com razão) — e o cliente que
// acabou de pagar recebia "O pagamento da sua reserva não foi aprovado 😕".
const notifyIfFailed = async (
  result: HandleInternalPaymentNegativeEventResult
) => {
  if (!result.booking_id) return;
  if (result.status !== "expired" && result.status !== "updated") return;

  await notifyBookingEvent("payment_failed", result.booking_id).catch(
    (notifyError) => console.error("payment_failed notify failed", notifyError)
  );
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  // Chaves vêm do painel de integrações (com fallback para env).
  const secrets = await getSecrets(["stripe_secret_key", "stripe_webhook_secret"]);
  const stripeSecretKey = secrets.stripe_secret_key;
  const stripeInternalWebhookSecret = secrets.stripe_webhook_secret;

  if (!stripeSecretKey || !stripeInternalWebhookSecret) {
    return res
      .status(503)
      .json({ error: "Stripe não configurado em Integrações." });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2022-11-15",
  });

  const signature = req.headers["stripe-signature"];

  if (!signature) {
    return res.status(400).send("Missing Stripe signature.");
  }

  let event: Stripe.Event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      stripeInternalWebhookSecret
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid Stripe signature.";
    return res.status(400).send(`Webhook error: ${message}`);
  }

  // A trava vem DEPOIS da conferência da assinatura: sem isso, qualquer um
  // encheria a tabela mandando event_id inventado.
  const claim = await claimStripeEvent(event.id, event.type);

  if (!claim.claimed && claim.reason === "duplicate") {
    return res.status(200).json({ received: true, duplicate: event.id });
  }

  // Alguém está tratando este evento agora. Responder 200 aqui seria dizer
  // "pronto" por um trabalho que ainda pode não terminar; 500 faz a Stripe
  // tentar de novo mais tarde, e a retomada por tempo assume se aquele
  // processo tiver morrido.
  if (!claim.claimed && claim.reason === "in_progress") {
    return res.status(500).json({ error: "Event already being processed." });
  }

  // Fecha a trava antes de responder. Fica ANTES das notificações de propósito:
  // elas são best-effort, cada uma com timeout de 15 s, e são o que pode fazer
  // a função estourar o tempo com o trabalho de banco já feito.
  const concluir = async (payload: Record<string, unknown>) => {
    await markStripeEventProcessed(event.id);
    return res.status(200).json({ received: true, ...payload });
  };

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await confirmInternalPayment(session);

      await markStripeEventProcessed(event.id);
      await notifyIfConfirmed(result);

      return res.status(200).json({ received: true, result });
    }

    // Pix e outros métodos assíncronos: a sessão foi concluída lá atrás, com o
    // dinheiro ainda por vir. ESTE é o evento que significa "entrou".
    if (event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await confirmInternalPayment(session);

      await markStripeEventProcessed(event.id);
      await notifyIfConfirmed(result);

      return res.status(200).json({ received: true, result });
    }

    // O Pix não pago não gera checkout.session.expired: uma sessão só expira
    // enquanto está `open`, e ela virou `complete` no instante em que o QR foi
    // emitido. Este evento é o único aviso de que a transferência não veio.
    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await handleInternalPaymentNegativeEvent(
        session,
        "async_payment_failed"
      );

      await markStripeEventProcessed(event.id);
      await notifyIfFailed(result);

      return res.status(200).json({ received: true, result });
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await handleInternalPaymentNegativeEvent(
        session,
        "checkout_expired"
      );

      return concluir({ result });
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const result = await handleInternalPaymentNegativeEvent(
        paymentIntent,
        "payment_failed"
      );

      await markStripeEventProcessed(event.id);
      await notifyIfFailed(result);

      return res.status(200).json({ received: true, result });
    }

    return concluir({ ignored: event.type });
  } catch (error) {
    console.error("Failed to process internal Stripe webhook", error);

    // Devolve o evento para a fila: a reentrega da Stripe é o conserto
    // automático de falha temporária, e um event_id marcado como tratado faria
    // a próxima tentativa ser descartada em silêncio. Vale também quando o
    // claim veio "unavailable" — o DELETE é inofensivo se a linha não existir,
    // e pode existir se a gravação tiver funcionado com a resposta perdida.
    if (claim.claimed || (!claim.claimed && claim.reason === "unavailable")) {
      await releaseStripeEvent(event.id);
    }

    return res.status(500).json({ error: "Webhook processing failed." });
  }
};

export default handler;

export const config = {
  api: {
    bodyParser: false,
  },
  // Teto explícito. O handler encadeia leitura de segredos, dois SELECTs, dois
  // UPDATEs, uma RPC, log e duas chamadas HTTP de notificação com 15 s de
  // timeout cada. Sem um teto declarado, o padrão curto da plataforma mata a
  // função no meio — e é exatamente o cenário que deixa um evento pago para
  // trás.
  maxDuration: 60,
};
