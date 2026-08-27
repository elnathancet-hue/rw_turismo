import type { NextApiRequest, NextApiResponse } from "next";
import { PendingBookingError } from "../../../lib/bookings/createPendingBooking";
import {
  quoteBooking,
  type QuoteBookingResult,
} from "../../../lib/bookings/quoteBooking";
import { checkRateLimit } from "../../../lib/server/rateLimit";

type ErrorResponse = { error: string };

const getString = (value: unknown) => (typeof value === "string" ? value : "");

// O preço já é público na página do pacote, então a cotação não exige login —
// pedir sessão só para ver o total mataria a compra sem conta.
//
// Mas ela valida cupom, e um endpoint aberto que responde "cupom existe / não
// existe" é um oráculo para adivinhar códigos por força bruta. Daí o limite por
// IP, mais apertado que o de criar reserva.
const clientIp = (req: NextApiRequest): string => {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(",")[0] ?? req.socket.remoteAddress ?? "desconhecido").trim();
};

// POST /api/bookings/quote — total oficial (com cupom) sem criar reserva.
const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<QuoteBookingResult | ErrorResponse>
) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const rate = checkRateLimit(`booking-quote:${clientIp(req)}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res
      .status(429)
      .json({ error: "Muitas consultas. Aguarde alguns segundos." });
  }

  try {
    const body = req.body ?? {};
    const quote = await quoteBooking({
      product_id: getString(body.product_id),
      product_date_id: getString(body.product_date_id),
      travelers_count: Number(body.travelers_count),
      coupon_code: getString(body.coupon_code) || null,
    });

    return res.status(200).json(quote);
  } catch (error) {
    if (error instanceof PendingBookingError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("booking quote failed", error);
    return res.status(500).json({ error: "Não foi possível calcular o valor." });
  }
};

export default handler;
