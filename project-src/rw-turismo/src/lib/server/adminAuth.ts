import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseServerClient } from "../supabase/server";

export type AdminContext = {
  userId: string;
};

// Valida no servidor que a requisição vem de um admin autenticado (mesmo padrão
// de api/admin/integration-status.ts). Em caso negativo, JÁ responde 401/403 e
// retorna null — o handler deve apenas `return` quando receber null.
export const requireAdmin = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AdminContext | null> => {
  const supabase = createSupabaseServerClient({ req, res }) as any;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    res.status(401).json({ error: "Autenticação necessária." });
    return null;
  }

  const { data: profile } = await supabase
    .from("users_profiles")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    res.status(403).json({ error: "Acesso restrito." });
    return null;
  }

  return { userId: userData.user.id };
};
