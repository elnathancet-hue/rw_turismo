import type { NextApiRequest, NextApiResponse } from "next";
import {
  adminCreateBooking,
  AdminBookingError,
} from "../../../../lib/admin/manualBookings";
import { notifyBookingEvent } from "../../../../lib/server/notifications";
import { requireAdmin } from "../../../../lib/server/adminAuth";

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const parseOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// POST /api/admin/bookings/create — cria reserva manual (Fase 1.3).
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const body = req.body ?? {};
    const status = body.status === "pending" ? "pending" : "confirmed";

    const result = await adminCreateBooking({
      admin_id: admin.userId,
      customer: {
        user_id: getString(body.customer_user_id) || null,
        name: getString(body.customer_name),
        email: getString(body.customer_email),
        phone: getString(body.customer_phone) || null,
      },
      product_id: getString(body.product_id),
      product_date_id: getString(body.product_date_id),
      travelers_count: Number(body.travelers_count),
      status,
      total_override: parseOptionalNumber(body.total_override),
      passengers: Array.isArray(body.passengers) ? body.passengers : [],
    });

    // Reserva pendente → avisa o cliente para pagar. Reserva já confirmada será
    // notificada na confirmação do pagamento (evita mensagem "conclua o pagamento").
    if (result.status === "pending") {
      await notifyBookingEvent("booking_created", result.booking_id).catch(
        (error) => console.error("manual booking_created notify failed", error)
      );
    }

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof AdminBookingError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("admin create booking failed", error);
    return res.status(500).json({ error: "Não foi possível criar a reserva." });
  }
};

export default handler;
