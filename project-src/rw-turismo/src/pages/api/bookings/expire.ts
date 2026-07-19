import type { NextApiRequest, NextApiResponse } from "next";
import type { ExpirePendingBookingResult } from "../../../lib/bookings/types";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

type ErrorResponse = {
  error: string;
};

type IdleResponse = ExpirePendingBookingResult & {
  reason?: string;
};

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<IdleResponse | ErrorResponse>
) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const bookingId = getString(req.body?.booking_id);

    if (!bookingId) {
      return res.status(400).json({ error: "booking_id is required." });
    }

    const supabase = createSupabaseServerClient({ req, res });
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const { data: booking, error: bookingError } = await (supabase as any)
      .from("bookings")
      .select("id, user_id, status, payment_status, expires_at, slots_released")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      throw bookingError;
    }

    if (!booking || booking.user_id !== authData.user.id) {
      return res.status(404).json({ error: "Booking not found." });
    }

    if (booking.status !== "pending" || booking.payment_status !== "pending") {
      return res.status(200).json({
        booking_id: booking.id,
        expired: false,
        slots_released: Boolean(booking.slots_released),
        reason: "Booking is not pending.",
      });
    }

    if (!booking.expires_at || new Date(booking.expires_at).getTime() >= Date.now()) {
      return res.status(200).json({
        booking_id: booking.id,
        expired: false,
        slots_released: Boolean(booking.slots_released),
        reason: "Booking has not expired yet.",
      });
    }

    const admin = createSupabaseAdminClient() as any;
    const { data, error } = await admin.rpc("expire_pending_booking", {
      p_booking_id: booking.id,
    });

    if (error) {
      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;

    return res.status(200).json({
      booking_id: result?.booking_id ?? booking.id,
      expired: Boolean(result?.expired),
      slots_released: Boolean(result?.slots_released),
    });
  } catch (error) {
    console.error("Failed to expire pending booking", error);
    return res.status(500).json({ error: "Unable to expire booking." });
  }
};

export default handler;
