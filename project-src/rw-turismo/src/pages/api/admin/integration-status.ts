import type { NextApiRequest, NextApiResponse } from "next";
import { testEmailConnection } from "../../../lib/server/email";
import { requireAdmin } from "../../../lib/server/adminAuth";
import { isServiceRoleConfigured, getSecrets } from "../../../lib/server/secrets";
import { testWhatsAppConnection } from "../../../lib/server/whatsapp";

// Status e teste das integrações — somente admin (verificado no servidor).
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // Antes, esta rota fazia a checagem de papel à mão e era a ÚNICA das 23 que
  // não usava requireAdmin — e a checagem manual não olhava `active`, então um
  // admin desativado continuava entrando e acionando a chave viva do Stripe
  // logo abaixo. requireAdmin valida sessão, papel E conta ativa.
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    return res.status(200).json({
      serviceRole: isServiceRoleConfigured(),
      cronSecret: Boolean(process.env.CRON_SECRET),
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    });
  }

  if (req.method === "POST") {
    const service = String(req.body?.service ?? "");

    if (service === "whatsapp") {
      const result = await testWhatsAppConnection();
      return res.status(200).json(result);
    }

    if (service === "email") {
      const result = await testEmailConnection();
      return res.status(200).json(result);
    }

    if (service === "stripe") {
      const secrets = await getSecrets(["stripe_secret_key"]);
      if (!secrets.stripe_secret_key) {
        return res
          .status(200)
          .json({ ok: false, skipped: true, error: "Preencha a chave secreta." });
      }
      try {
        const response = await fetch("https://api.stripe.com/v1/balance", {
          headers: { Authorization: `Bearer ${secrets.stripe_secret_key}` },
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          return res
            .status(200)
            .json({ ok: false, error: `Stripe respondeu ${response.status}` });
        }
        return res.status(200).json({ ok: true });
      } catch (error) {
        return res.status(200).json({
          ok: false,
          error: error instanceof Error ? error.message : "Falha na conexão",
        });
      }
    }

    return res.status(400).json({ error: "Serviço desconhecido." });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed." });
};

export default handler;
