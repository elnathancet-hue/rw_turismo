import type { NextApiRequest, NextApiResponse } from "next";
import {
  createInternalCheckoutSession,
  InternalCheckoutError,
} from "../../../lib/payments/createInternalCheckoutSession";
import type { CreateCheckoutResult } from "../../../lib/payments/types";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

type ErrorResponse = {
  error: string;
};

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<CreateCheckoutResult | ErrorResponse>
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
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const result = await createInternalCheckoutSession({
      booking_id: bookingId,
      user_id: data.user.id,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof InternalCheckoutError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("Failed to create internal checkout session", error);

    return res.status(500).json({ error: "Unable to create checkout session." });
  }
};

export default handler;
