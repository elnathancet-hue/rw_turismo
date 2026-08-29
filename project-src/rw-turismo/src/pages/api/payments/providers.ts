import type { NextApiRequest, NextApiResponse } from "next";
import { lerConfiguracao } from "../../../lib/payments/adapters/infinitepay";
import { getSecrets } from "../../../lib/server/secrets";

// Quais meios de pagamento a tela deve oferecer.
//
// Rota pública e sem sessão de propósito: a resposta só diz "esta agência
// aceita cartão" e "aceita Pix", que é informação de vitrine — o mesmo que
// estaria escrito na porta da loja. Nenhuma chave, nenhum identificador de
// conta, nada que dependa de quem está perguntando.
//
// Existe porque a tela do cliente não pode adivinhar isso: o que liga e desliga
// cada provedor é um segredo do painel de integrações, que vive no servidor.

export type ProvedorDisponivel = {
  id: "stripe" | "infinitepay";
  titulo: string;
  descricao: string;
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<{ providers: ProvedorDisponivel[] } | { error: string }>
) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const providers: ProvedorDisponivel[] = [];

  const stripe = await getSecrets(["stripe_secret_key", "stripe_pix_enabled"]);
  if (stripe.stripe_secret_key) {
    providers.push({
      id: "stripe",
      titulo: "Cartão de crédito",
      descricao:
        stripe.stripe_pix_enabled === "true"
          ? "Cartão ou Pix, em pagamento único."
          : "Pagamento único no cartão.",
    });
  }

  const infinitePay = await lerConfiguracao();
  if (infinitePay?.habilitado) {
    providers.push({
      id: "infinitepay",
      titulo: "Pix ou cartão parcelado",
      // Sem número de parcelas no texto: a API não permite fixar nem limitar
      // quantas, quem escolhe é o cliente na tela deles. Prometer "10x" aqui
      // seria anunciar o que não se controla.
      descricao: "Pix à vista ou cartão em até 12 vezes.",
    });
  }

  // Cache curto: a resposta muda só quando alguém mexe no painel, e a tela da
  // reserva é recarregada várias vezes durante a espera do pagamento.
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");

  return res.status(200).json({ providers });
};

export default handler;
