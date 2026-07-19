import type { NextApiRequest, NextApiResponse } from "next";
import {
  adminConfirmManualPayment,
  AdminBookingError,
} from "../../../../../lib/admin/manualBookings";
import { notifyBookingEvent } from "../../../../../lib/server/notifications";
import { requireAdmin } from "../../../../../lib/server/adminAuth";

const parseOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// POST /api/admin/bookings/:id/confirm-payment — registra pagamento manual.
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const bookingId = typeof req.query.id === "string" ? req.query.id : "";
  if (!bookingId) {
    return res.status(400).json({ error: "Reserva inválida." });
  }

  try {
    const body = req.body ?? {};

    const result = await adminConfirmManualPayment({
      admin_id: admin.userId,
      booking_id: bookingId,
      amount: parseOptionalNumber(body.amount),
      method: typeof body.method === "string" ? body.method : "pix",
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    await notifyBookingEvent("booking_confirmed", result.booking_id).catch(
      (error) => console.error("manual booking_confirmed notify failed", error)
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof AdminBookingError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("admin confirm manual payment failed", error);
    return res
      .status(500)
      .json({ error: "Não foi possível confirmar o pagamento." });
  }
};

export default handler;
