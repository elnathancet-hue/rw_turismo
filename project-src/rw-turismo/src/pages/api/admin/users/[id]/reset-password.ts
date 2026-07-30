import type { NextApiRequest, NextApiResponse } from "next";
import { AdminUserError, resetStaffPassword } from "../../../../../lib/admin/users";
import { requireAdmin } from "../../../../../lib/server/adminAuth";
import { checkRateLimit } from "../../../../../lib/server/rateLimit";

// POST /api/admin/users/[id]/reset-password — define nova senha provisória.
// A senha vai só no corpo da requisição: nunca é gravada em system_logs.
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    return res.status(400).json({ error: "Usuário inválido." });
  }

  const limit = checkRateLimit(`admin-users-password:${admin.userId}`, {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    return res.status(429).json({
      error: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    });
  }

  try {
    const body = req.body ?? {};
    await resetStaffPassword(
      admin.userId,
      id,
      typeof body.password === "string" ? body.password : ""
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error instanceof AdminUserError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("admin reset user password failed", error);
    return res
      .status(500)
      .json({ error: "Não foi possível trocar a senha." });
  }
};

export default handler;
