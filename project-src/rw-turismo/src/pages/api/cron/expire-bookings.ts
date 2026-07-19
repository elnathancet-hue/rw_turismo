import type { NextApiRequest, NextApiResponse } from "next";
import { expireOverdueBookings } from "../../../lib/bookings/expireOverdueBookings";
import { isServiceRoleConfigured } from "../../../lib/server/secrets";

// Cron frequente (Vercel Cron — vercel.json): varre reservas pendentes com
// expires_at vencido, expira e devolve as vagas. Idempotente — pode rodar em
// paralelo com a expiração disparada pela página da reserva ou pelo webhook.
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // Fail closed: sem CRON_SECRET configurado o endpoint recusa qualquer chamada.
  // A Vercel só envia Authorization: Bearer ${CRON_SECRET} quando a env existe,
  // então o secret precisa estar definido em produção para o cron funcionar.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isServiceRoleConfigured()) {
    return res.status(200).json({
      skipped: true,
      reason: "SUPABASE_SERVICE_ROLE_KEY ausente — varredura desativada.",
    });
  }

  try {
    const expired = await expireOverdueBookings();
    return res.status(200).json({ ok: true, expired });
  } catch (error) {
    console.error("expire-bookings cron failed", error);
    return res.status(500).json({ error: "Cron failed" });
  }
};

export default handler;
