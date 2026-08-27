import type { NextApiRequest, NextApiResponse } from "next";
import { findBookingByAccessToken } from "../../../../lib/bookings/guestAccess";
import {
  confirmDocumentUpload,
  createDocumentUploadUrl,
  PassengerDocumentError,
} from "../../../../lib/bookings/passengerDocuments";
import { checkRateLimit } from "../../../../lib/server/rateLimit";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const clientIp = (req: NextApiRequest): string => {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(",")[0] ?? req.socket.remoteAddress ?? "desconhecido").trim();
};

// POST /api/bookings/[id]/documents
//   action = "upload-url" -> devolve permissão de escrita curta e o caminho
//   action = "confirm"    -> marca o documento como enviado
//
// Posse da reserva pelos mesmos dois caminhos do checkout: sessão do cliente
// logado, ou o token de acesso da compra sem cadastro. O convidado precisa
// enviar documento ANTES de pagar, então exigir login aqui recriaria o muro que
// a correção anterior derrubou.
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const bookingId = typeof req.query.id === "string" ? req.query.id : "";
  if (!bookingId) {
    return res.status(400).json({ error: "Reserva inválida." });
  }

  const rate = checkRateLimit(`booking-documents:${clientIp(req)}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({ error: "Muitos envios. Aguarde um instante." });
  }

  try {
    const supabase = createSupabaseServerClient({ req, res });
    const { data: session } = await supabase.auth.getUser();
    let autorizado = false;

    if (session?.user?.id) {
      // Sessão só vale se a reserva for realmente desta pessoa.
      const { data: owned } = await (supabase as any)
        .from("bookings")
        .select("id")
        .eq("id", bookingId)
        .eq("user_id", session.user.id)
        .maybeSingle();
      autorizado = Boolean(owned);
    }

    if (!autorizado) {
      const guest = await findBookingByAccessToken(
        bookingId,
        getString(req.body?.access_token)
      );
      autorizado = Boolean(guest);
    }

    if (!autorizado) {
      return res.status(404).json({ error: "Reserva não encontrada." });
    }

    const action = getString(req.body?.action);
    const passengerId = getString(req.body?.passenger_id);

    if (action === "upload-url") {
      const upload = await createDocumentUploadUrl(
        bookingId,
        passengerId,
        getString(req.body?.content_type)
      );
      return res.status(200).json(upload);
    }

    if (action === "confirm") {
      await confirmDocumentUpload(
        bookingId,
        passengerId,
        getString(req.body?.path)
      );
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Ação inválida." });
  } catch (error) {
    if (error instanceof PassengerDocumentError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("passenger document request failed", error);
    return res
      .status(500)
      .json({ error: "Não foi possível processar o documento." });
  }
};

export default handler;
