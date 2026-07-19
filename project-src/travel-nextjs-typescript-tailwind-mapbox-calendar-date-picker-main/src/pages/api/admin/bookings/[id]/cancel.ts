import type { NextApiRequest, NextApiResponse } from "next";
import {
  adminCancelBooking,
  AdminBookingError,
} from "../../../../../lib/admin/manualBookings";
import { requireAdmin } from "../../../../../lib/server/adminAuth";

// POST /api/admin/bookings/:id/cancel — cancela a reserva e devolve vagas.
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

    const result = await adminCancelBooking({
      admin_id: admin.userId,
      booking_id: bookingId,
      reason: typeof body.reason === "string" ? body.reason : null,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof AdminBookingError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("admin cancel booking failed", error);
    return res.status(500).json({ error: "Não foi possível cancelar a reserva." });
  }
};

export default handler;
