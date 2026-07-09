import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { confirmInternalPayment } from "../../../lib/payments/confirmInternalPayment";
import { handleInternalPaymentNegativeEvent } from "../../../lib/payments/handleInternalPaymentNegativeEvent";
import { notifyBookingEvent } from "../../../lib/server/notifications";
import { getSecrets } from "../../../lib/server/secrets";

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

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await confirmInternalPayment(session);

      const bookingId = session.metadata?.booking_id;
      if (bookingId) {
        await notifyBookingEvent("booking_confirmed", bookingId).catch(
          (notifyError) =>
            console.error("booking_confirmed notify failed", notifyError)
        );
      }

      return res.status(200).json({ received: true, result });
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await handleInternalPaymentNegativeEvent(
        session,
        "checkout_expired"
      );

      return res.status(200).json({ received: true, result });
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const result = await handleInternalPaymentNegativeEvent(
        paymentIntent,
        "payment_failed"
      );

      const bookingId = paymentIntent.metadata?.booking_id;
      if (bookingId) {
        await notifyBookingEvent("payment_failed", bookingId).catch(
          (notifyError) =>
            console.error("payment_failed notify failed", notifyError)
        );
      }

      return res.status(200).json({ received: true, result });
    }

    return res.status(200).json({ received: true, ignored: event.type });
  } catch (error) {
    console.error("Failed to process internal Stripe webhook", error);
    return res.status(500).json({ error: "Webhook processing failed." });
  }
};

export default handler;

export const config = {
  api: {
    bodyParser: false,
  },
};
