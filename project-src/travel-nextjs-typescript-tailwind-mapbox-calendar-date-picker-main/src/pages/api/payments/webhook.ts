import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { confirmInternalPayment } from "../../../lib/payments/confirmInternalPayment";
import { getStripeInternalWebhookEnv } from "../../../lib/env";
import { handleInternalPaymentNegativeEvent } from "../../../lib/payments/handleInternalPaymentNegativeEvent";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { stripeSecretKey, stripeInternalWebhookSecret } =
    getStripeInternalWebhookEnv();
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
