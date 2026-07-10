import type { NextApiRequest, NextApiResponse } from "next";
import { expireOverdueBookings } from "../../../lib/bookings/expireOverdueBookings";
import { isServiceRoleConfigured } from "../../../lib/server/secrets";

// Cron frequente (Vercel Cron — vercel.json): varre reservas pendentes com
// expires_at vencido, expira e devolve as vagas. Idempotente — pode rodar em
// paralelo com a expiração disparada pela página da reserva ou pelo webhook.
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // Vercel envia Authorization: Bearer ${CRON_SECRET} quando a env existe.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
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
    if (!cronSecret) {
      console.warn(
        "expire-bookings: CRON_SECRET não configurado — endpoint aberto. Defina na Vercel."
      );
    }
    return res.status(200).json({
      ok: true,
      expired,
      ...(cronSecret
        ? {}
        : { warning: "CRON_SECRET não configurado — defina nas envs da Vercel." }),
    });
  } catch (error) {
    console.error("expire-bookings cron failed", error);
    return res.status(500).json({ error: "Cron failed" });
  }
};

export default handler;
