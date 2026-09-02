import type { NextApiRequest, NextApiResponse } from "next";
import { checkRateLimit } from "../../../lib/server/rateLimit";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

// POST /api/quiz/responder — recebe o que a pessoa escolheu e devolve o
// resultado calculado pelo banco.
//
// POR QUE PASSA POR AQUI, e não direto do navegador para a RPC:
// a função responder_quiz() é concedida só a service_role, e não a anon. Isso é
// deliberado. Se ela fosse pública, o quiz viraria a quinta escrita sem limite
// do projeto — a auditoria já registrou as outras quatro (leads, waitlist,
// newsletter, survey). Aqui entra o limite por IP antes de qualquer coisa.
//
// O QUE NÃO CHEGA AQUI: o resultado. Ele não é parâmetro da RPC nem deste
// handler. Se viesse do cliente, a pessoa escreveria o próprio desfecho e o
// relatório viraria ficção — o mesmo erro que a auditoria achou em
// survey_responses.approved.

const texto = (valor: unknown): string =>
  typeof valor === "string" ? valor.trim() : "";

const clientIp = (req: NextApiRequest): string => {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(",")[0] ?? req.socket.remoteAddress ?? "desconhecido").trim();
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const rate = checkRateLimit(`quiz-responder:${clientIp(req)}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({ error: "Muitas respostas. Aguarde." });
  }

  const slug = texto(req.body?.slug);
  const respostas = req.body?.respostas;

  if (!slug) {
    return res.status(400).json({ error: "Quiz não informado." });
  }
  if (!Array.isArray(respostas)) {
    return res.status(400).json({ error: "Respostas inválidas." });
  }
  // Teto de sanidade: nenhum quiz tem centenas de perguntas, e sem isto um
  // corpo gigante viraria trabalho do banco.
  if (respostas.length > 100) {
    return res.status(400).json({ error: "Respostas demais." });
  }

  try {
    const admin = createSupabaseAdminClient() as any;
    const { data, error } = await admin.rpc("responder_quiz", {
      p_slug: slug,
      p_respostas: respostas,
      p_nome: texto(req.body?.nome) || null,
      p_telefone: texto(req.body?.telefone) || null,
      p_email: texto(req.body?.email).toLowerCase() || null,
      p_utm: req.body?.utm && typeof req.body.utm === "object" ? req.body.utm : {},
    });

    if (error) {
      // A RPC recusa quiz não publicado e slug inexistente com a mesma
      // mensagem: para quem está de fora, os dois casos são "não existe".
      if (/nao encontrado|não encontrado/i.test(error.message ?? "")) {
        return res.status(404).json({ error: "Quiz não encontrado." });
      }
      throw error;
    }

    return res.status(200).json(data);
  } catch (erro) {
    console.error("quiz responder failed", erro);
    return res
      .status(500)
      .json({ error: "Não foi possível calcular o resultado." });
  }
};

export default handler;
