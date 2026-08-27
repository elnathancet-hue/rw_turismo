import type { NextApiRequest, NextApiResponse } from "next";
import { requireStaff } from "../../../../../lib/server/adminAuth";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

// POST /api/admin/departures/[id]/log-export — registra que a relação de
// passageiros de uma saída foi exportada.
//
// O CSV leva nome, documento, data de nascimento e telefone — inclusive de
// crianças — para fora do sistema, para a máquina de quem clicou. Sem registro,
// não há como responder "quem baixou os dados dessa saída, e quando", que é
// exatamente a pergunta que aparece num incidente de dado pessoal.
//
// Escrita em system_logs vai pelo service role: a policy de insert exige
// is_admin(), e Operações também exporta.
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const staff = await requireStaff(req, res, ["admin", "operacoes"]);
  if (!staff) return;

  const departureId = typeof req.query.id === "string" ? req.query.id : "";
  if (!departureId) {
    return res.status(400).json({ error: "Saída inválida." });
  }

  const body = req.body ?? {};
  const { error } = await (createSupabaseAdminClient() as any)
    .from("system_logs")
    .insert({
      user_id: staff.userId,
      action: "export_passenger_list",
      entity: "product_dates",
      entity_id: departureId,
      metadata: {
        role: staff.role,
        passenger_count: Number(body.passenger_count) || 0,
        // Deixa explícito no log que o arquivo continha dado pessoal.
        includes_personal_data: true,
      },
    });

  if (error) {
    console.error("log passenger export failed", error);
    return res.status(500).json({ error: "Não foi possível registrar." });
  }

  return res.status(201).json({ ok: true });
};

export default handler;
