import type { NextApiRequest, NextApiResponse } from "next";
import {
  AdminUserError,
  createStaffUser,
  listStaffUsers,
} from "../../../../lib/admin/users";
import { requireAdmin } from "../../../../lib/server/adminAuth";
import { checkRateLimit } from "../../../../lib/server/rateLimit";

const getString = (value: unknown) => (typeof value === "string" ? value : "");

// GET  /api/admin/users — lista a equipe com acesso ao painel.
// POST /api/admin/users — cria o acesso com senha provisória definida pelo admin.
// Só Administrador: gerenciar usuários não é delegado a nenhum outro papel.
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    if (req.method === "GET") {
      const users = await listStaffUsers();
      return res.status(200).json({ users });
    }

    // Criação de acesso é operação sensível: limita tentativas por admin.
    const limit = checkRateLimit(`admin-users-create:${admin.userId}`, {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!limit.allowed) {
      res.setHeader("Retry-After", String(limit.retryAfterSeconds));
      return res.status(429).json({
        error: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
      });
    }

    const body = req.body ?? {};
    const result = await createStaffUser({
      adminId: admin.userId,
      name: getString(body.name),
      email: getString(body.email),
      password: getString(body.password),
      role: getString(body.role),
      phone: getString(body.phone) || null,
    });

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof AdminUserError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("admin users request failed", error);
    return res
      .status(500)
      .json({ error: "Não foi possível concluir a operação." });
  }
};

export default handler;
