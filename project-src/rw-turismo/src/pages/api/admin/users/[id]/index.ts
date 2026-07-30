import type { NextApiRequest, NextApiResponse } from "next";
import {
  AdminUserError,
  setStaffUserActive,
  updateStaffUser,
} from "../../../../../lib/admin/users";
import { requireAdmin } from "../../../../../lib/server/adminAuth";

// PATCH /api/admin/users/[id] — nome, telefone, papel e ativar/desativar.
// As regras de "não mexer na própria conta" e "não ficar sem admin ativo" ficam
// em lib/admin/users.ts, valendo para qualquer caller.
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    return res.status(400).json({ error: "Usuário inválido." });
  }

  try {
    const body = req.body ?? {};
    let user = await updateStaffUser(admin.userId, id, {
      name: typeof body.name === "string" ? body.name : undefined,
      phone: body.phone === undefined ? undefined : String(body.phone ?? ""),
      role: typeof body.role === "string" ? body.role : undefined,
    });

    if (typeof body.active === "boolean") {
      user = await setStaffUserActive(admin.userId, id, body.active);
    }

    return res.status(200).json({ user });
  } catch (error) {
    if (error instanceof AdminUserError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("admin update user failed", error);
    return res
      .status(500)
      .json({ error: "Não foi possível salvar o usuário." });
  }
};

export default handler;
