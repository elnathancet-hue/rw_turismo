import type { NextApiRequest, NextApiResponse } from "next";
import {
  createInternalCheckoutSession,
  InternalCheckoutError,
} from "../../../lib/payments/createInternalCheckoutSession";
import type { CreateCheckoutResult } from "../../../lib/payments/types";
import { findBookingByAccessToken } from "../../../lib/bookings/guestAccess";
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

    // Dois caminhos de posse da reserva:
    //  - sessão (cliente logado), como sempre foi;
    //  - token de acesso (compra sem cadastro), porque o convidado não tem
    //    sessão e sem isto não chegaria ao pagamento.
    //
    // Em ambos, quem manda é o dono da reserva NO BANCO. No caminho do token o
    // user_id sai da própria reserva encontrada, nunca de algo que o cliente
    // enviou — do contrário bastaria mandar o user_id de outra pessoa.
    const supabase = createSupabaseServerClient({ req, res });
    const { data } = await supabase.auth.getUser();
    let ownerUserId = data?.user?.id ?? null;

    if (!ownerUserId) {
      const guestBooking = await findBookingByAccessToken(
        bookingId,
        getString(req.body?.access_token)
      );

      if (!guestBooking) {
        return res.status(401).json({ error: "Authentication required." });
      }

      ownerUserId = (guestBooking as unknown as { user_id: string }).user_id;
    }

    const result = await createInternalCheckoutSession({
      booking_id: bookingId,
      user_id: ownerUserId,
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
