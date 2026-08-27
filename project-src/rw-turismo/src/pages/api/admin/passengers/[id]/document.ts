import type { NextApiRequest, NextApiResponse } from "next";
import {
  createDocumentViewUrl,
  PassengerDocumentError,
} from "../../../../../lib/bookings/passengerDocuments";
import { requireStaff } from "../../../../../lib/server/adminAuth";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

// POST /api/admin/passengers/[id]/document — link temporário para conferir o
// documento, ou decisão da conferência.
//
// Só Admin e Operações. Financeiro e Conteúdo ficam de fora de propósito:
// nenhuma tarefa deles precisa do documento de uma criança, e a mesma exclusão
// já vale para a leitura da tabela de passageiros.
//
// O link é assinado e curto. Não existe URL pública para este bucket, então não
// há endereço permanente que possa vazar por print, log ou histórico.
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const staff = await requireStaff(req, res, ["admin", "operacoes"]);
  if (!staff) return;

  const passengerId = typeof req.query.id === "string" ? req.query.id : "";
  if (!passengerId) {
    return res.status(400).json({ error: "Passageiro inválido." });
  }

  const admin = createSupabaseAdminClient() as any;

  try {
    const { data: passenger } = await admin
      .from("passengers")
      .select("id, booking_id, document_path, document_status")
      .eq("id", passengerId)
      .maybeSingle();

    if (!passenger) {
      return res.status(404).json({ error: "Passageiro não encontrado." });
    }

    const action =
      typeof req.body?.action === "string" ? req.body.action : "view";

    if (action === "view") {
      if (!passenger.document_path) {
        return res.status(404).json({ error: "Sem documento enviado." });
      }

      const url = await createDocumentViewUrl(passenger.document_path);
      if (!url) {
        return res.status(500).json({ error: "Não foi possível abrir." });
      }

      // Quem abriu documento de passageiro, e quando. Sem isto não há como
      // responder essa pergunta num incidente de dado pessoal.
      await admin.from("system_logs").insert({
        user_id: staff.userId,
        action: "view_passenger_document",
        entity: "passengers",
        entity_id: passenger.id,
        metadata: { role: staff.role, booking_id: passenger.booking_id },
      });

      return res.status(200).json({ url });
    }

    if (action === "verify" || action === "resend") {
      const status = action === "verify" ? "verified" : "resend";
      const { error } = await admin
        .from("passengers")
        .update({
          document_status: status,
          document_verified_at:
            status === "verified" ? new Date().toISOString() : null,
        })
        .eq("id", passenger.id);

      if (error) {
        return res.status(500).json({ error: "Não foi possível salvar." });
      }

      await admin.from("system_logs").insert({
        user_id: staff.userId,
        action: `document_${status}`,
        entity: "passengers",
        entity_id: passenger.id,
        metadata: { role: staff.role, booking_id: passenger.booking_id },
      });

      return res.status(200).json({ ok: true, document_status: status });
    }

    return res.status(400).json({ error: "Ação inválida." });
  } catch (error) {
    if (error instanceof PassengerDocumentError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("admin passenger document failed", error);
    return res.status(500).json({ error: "Não foi possível concluir." });
  }
};

export default handler;
