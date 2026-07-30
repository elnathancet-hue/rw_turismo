import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseServerClient } from "../supabase/server";
import { isStaffRole, type StaffRole } from "../auth/roles";

export type AdminContext = {
  userId: string;
  role: StaffRole;
};

// Valida no servidor que a requisição vem de um membro da equipe com um dos
// papéis informados. Em caso negativo, JÁ responde 401/403 e retorna null — o
// handler deve apenas `return` quando receber null.
export const requireStaff = async (
  req: NextApiRequest,
  res: NextApiResponse,
  allowedRoles: StaffRole[]
): Promise<AdminContext | null> => {
  const supabase = createSupabaseServerClient({ req, res }) as any;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    res.status(401).json({ error: "Autenticação necessária." });
    return null;
  }

  // select("*") em vez de listar colunas: assim o app não quebra se subir antes
  // da migration que adiciona `active`.
  const { data: profile } = await supabase
    .from("users_profiles")
    .select("*")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  const isActive = profile?.active !== false;
  const role = isActive && isStaffRole(profile?.role) ? profile.role : null;

  if (!role || !allowedRoles.includes(role)) {
    res.status(403).json({ error: "Acesso restrito." });
    return null;
  }

  return { userId: userData.user.id, role };
};

export const requireAdmin = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AdminContext | null> => requireStaff(req, res, ["admin"]);
