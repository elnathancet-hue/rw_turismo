import type { NextApiRequest, NextApiResponse } from "next";
import {
  adminRebook,
  AdminBookingError,
} from "../../../../../lib/admin/manualBookings";
import { requireAdmin } from "../../../../../lib/server/adminAuth";

const getString = (value: unknown) => (typeof value === "string" ? value : "");

// POST /api/admin/bookings/:id/rebook — remarca para outra data do produto.
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
    const newProductDateId = getString(body.new_product_date_id);

    if (!newProductDateId) {
      return res.status(400).json({ error: "Selecione a nova data." });
    }

    const result = await adminRebook({
      admin_id: admin.userId,
      booking_id: bookingId,
      new_product_date_id: newProductDateId,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof AdminBookingError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("admin rebook failed", error);
    return res.status(500).json({ error: "Não foi possível remarcar a reserva." });
  }
};

export default handler;
