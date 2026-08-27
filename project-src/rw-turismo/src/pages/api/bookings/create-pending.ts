import type { NextApiRequest, NextApiResponse } from "next";
import {
  CustomerAccountError,
  resolveCustomerUserId,
} from "../../../lib/auth/customerAccount";
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
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

type ErrorResponse = {
  error: string;
};

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const clientIp = (req: NextApiRequest): string => {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(",")[0] ?? req.socket.remoteAddress ?? "desconhecido").trim();
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<CreatePendingBookingResult | ErrorResponse>
) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const customerEmail = getString(req.body?.customer_email).trim().toLowerCase();
    const customerName = getString(req.body?.customer_name).trim();
    const customerPhone = getString(req.body?.customer_phone) || null;

    // Sessão é OPCIONAL. A especificação pede que o cliente não seja obrigado a
    // criar conta antes de pagar. Quem já está logado continua dono da reserva;
    // quem não está tem a conta criada nos bastidores pelo e-mail (sem senha),
    // o que mantém bookings.user_id preenchido e todo o RLS de reservas,
    // pagamentos e passageiros valendo exatamente como antes.
    const supabase = createSupabaseServerClient({ req, res });
    const { data: session } = await supabase.auth.getUser();
    const sessionUserId = session?.user?.id ?? null;

    // Com sessão, o limite é por usuário. Sem sessão seria por ninguém, então
    // passa a ser por IP + e-mail.
    const rateKey = sessionUserId
      ? `create-pending:${sessionUserId}`
      : `create-pending-guest:${clientIp(req)}:${customerEmail}`;
    const rate = checkRateLimit(rateKey, { limit: 5, windowMs: 60_000 });
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfterSeconds));
      return res.status(429).json({
        error: "Muitas reservas em pouco tempo. Aguarde um instante.",
      });
    }

    if (!customerName || !customerEmail) {
      return res
        .status(400)
        .json({ error: "Informe seu nome e e-mail para reservar." });
    }

    const userId = await resolveCustomerUserId(createSupabaseAdminClient(), {
      user_id: sessionUserId,
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
    });

    const input: CreatePendingBookingInput = {
      user_id: userId,
      product_id: getString(req.body?.product_id),
      product_date_id: getString(req.body?.product_date_id),
      travelers_count: Number(req.body?.travelers_count),
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      coupon_code: getString(req.body?.coupon_code) || null,
      accommodation_code: getString(req.body?.accommodation_code) || null,
      passengers: Array.isArray(req.body?.passengers)
        ? req.body.passengers
        : undefined,
    };

    const result = await createPendingBooking(input);

    // Notificação "reserva realizada" (WhatsApp/e-mail) — nunca bloqueia a reserva.
    await notifyBookingEvent("booking_created", result.booking_id).catch(
      (notifyError) => console.error("booking_created notify failed", notifyError)
    );

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof CustomerAccountError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    if (error instanceof PendingBookingError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("Failed to create pending booking", error);

    return res.status(500).json({ error: "Unable to create pending booking." });
  }
};

export default handler;
