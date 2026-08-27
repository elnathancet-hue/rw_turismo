import type { NextApiRequest, NextApiResponse } from "next";
import {
  findBookingByAccessToken,
  withoutAccessToken,
} from "../../../../lib/bookings/guestAccess";
import { checkRateLimit } from "../../../../lib/server/rateLimit";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

// POST /api/bookings/[id]/guest — devolve a reserva para quem comprou sem
// cadastro, provando posse pelo token que recebeu ao reservar.
//
// Rota sem login de propósito: é o único caminho do convidado até a tela de
// pagamento. O limite por IP existe porque, sem sessão, não há mais nada
// segurando tentativa de adivinhação — ainda que o token tenha 48 caracteres.
const clientIp = (req: NextApiRequest): string => {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(",")[0] ?? req.socket.remoteAddress ?? "desconhecido").trim();
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const rate = checkRateLimit(`booking-guest:${clientIp(req)}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({ error: "Muitas tentativas. Aguarde." });
  }

  const bookingId = typeof req.query.id === "string" ? req.query.id : "";
  const accessToken =
    typeof req.body?.access_token === "string" ? req.body.access_token : "";

  const booking = await findBookingByAccessToken(bookingId, accessToken);

  // Mesma resposta para "não existe" e "token errado": diferenciar as duas
  // contaria a quem está tentando que a reserva existe.
  if (!booking) {
    return res.status(404).json({ error: "Reserva não encontrada." });
  }

  // Passageiros com o MINIMO necessario para a tela de documento: id, nome e
  // status. Sem nascimento e sem document_path — o convidado nao precisa deles,
  // e cada campo a mais aqui e dado pessoal exposto numa rota sem login.
  const { data: passengers } = await (createSupabaseAdminClient() as any)
    .from("passengers")
    .select("id, full_name, document_status")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  return res.status(200).json({
    booking: withoutAccessToken(booking as Record<string, unknown>),
    passengers: passengers ?? [],
  });
};

export default handler;
