import type { NextApiRequest, NextApiResponse } from "next";
import { runDailyNotifications } from "../../../lib/server/notifications";
import { isServiceRoleConfigured } from "../../../lib/server/secrets";

// Cron diário (Vercel Cron — vercel.json). Dispara aniversários, lembrete de
// viagem (3 dias), embarque (véspera) e pós-viagem.
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // Vercel envia Authorization: Bearer ${CRON_SECRET} quando a env existe.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isServiceRoleConfigured()) {
    return res.status(200).json({
      skipped: true,
      reason: "SUPABASE_SERVICE_ROLE_KEY ausente — notificações desativadas.",
    });
  }

  try {
    const summary = await runDailyNotifications();
    return res.status(200).json({ ok: true, summary });
  } catch (error) {
    console.error("daily cron failed", error);
    return res.status(500).json({ error: "Cron failed" });
  }
};

export default handler;
