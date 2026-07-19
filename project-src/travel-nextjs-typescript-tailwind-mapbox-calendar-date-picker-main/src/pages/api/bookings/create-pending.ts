import type { NextApiRequest, NextApiResponse } from "next";
import {
  createPendingBooking,
  PendingBookingError,
} from "../../../lib/bookings/createPendingBooking";
import type {
  CreatePendingBookingInput,
  CreatePendingBookingResult,
} from "../../../lib/bookings/types";
import { notifyBookingEvent } from "../../../lib/server/notifications";
import { checkRateLimit } from "../../../lib/server/rateLimit";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

type ErrorResponse = {
  error: string;
};

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<CreatePendingBookingResult | ErrorResponse>
) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const supabase = createSupabaseServerClient({ req, res });
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    // Rate limit: no máximo 5 reservas pendentes por minuto por usuário.
    const rate = checkRateLimit(`create-pending:${data.user.id}`, {
      limit: 5,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfterSeconds));
      return res.status(429).json({
        error: "Muitas reservas em pouco tempo. Aguarde um instante.",
      });
    }

    const travelersCount = Number(req.body?.travelers_count);
    const input: CreatePendingBookingInput = {
      user_id: data.user.id,
      product_id: getString(req.body?.product_id),
      product_date_id: getString(req.body?.product_date_id),
      travelers_count: travelersCount,
      customer_name: getString(req.body?.customer_name),
      customer_email: getString(req.body?.customer_email),
      customer_phone: getString(req.body?.customer_phone) || null,
      coupon_code: getString(req.body?.coupon_code) || null,
    };

    const result = await createPendingBooking(input);

    // Notificação "reserva realizada" (WhatsApp/e-mail) — nunca bloqueia a reserva.
    await notifyBookingEvent("booking_created", result.booking_id).catch(
      (notifyError) => console.error("booking_created notify failed", notifyError)
    );

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof PendingBookingError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("Failed to create pending booking", error);

    return res.status(500).json({ error: "Unable to create pending booking." });
  }
};

export default handler;
