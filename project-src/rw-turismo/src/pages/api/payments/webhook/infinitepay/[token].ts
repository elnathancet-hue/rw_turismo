import type { NextApiRequest, NextApiResponse } from "next";
import {
  lerConfiguracao,
  normalizarPagamentoInfinitePay,
  verificarPagamento,
} from "../../../../../lib/payments/adapters/infinitepay";
import { confirmInternalPayment } from "../../../../../lib/payments/confirmInternalPayment";
import {
  claimStripeEvent,
  markStripeEventProcessed,
  releaseStripeEvent,
} from "../../../../../lib/payments/stripeEventLock";
import { notifyBookingEvent } from "../../../../../lib/server/notifications";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

// Webhook da InfinitePay.
//
// ROTA SEPARADA DA STRIPE DE PROPÓSITO. Os dois protocolos não têm nada em
// comum: lá a origem é provada por assinatura sobre o corpo cru (por isso
// bodyParser fica desligado), aqui não há assinatura nenhuma e o corpo é
// descartável. A semântica de retorno é até invertida — na Stripe, 500 pede
// reentrega; aqui quem provoca reentrega é o 400.
//
// O QUE ESTE HANDLER FAZ COM O CORPO RECEBIDO: extrai três identificadores e
// joga o resto fora. Valor, status e método vêm todos da verificação
// servidor-a-servidor. Confiar no corpo é a vulnerabilidade que o plugin de
// WooCommerce da InfinitePay tem rodando em produção.

// O token no caminho não é autenticação — é obscuridade, e está aqui só para
// que a URL não seja adivinhável a partir do domínio. A segurança de verdade
// vem do payment_check e do slug gravado na criação da cobrança.
const tokenConfere = (informado: string, esperado: string): boolean => {
  if (!esperado) return false;
  if (informado.length !== esperado.length) return false;

  // Comparação de tempo constante: um `===` vazaria o prefixo correto pela
  // diferença de tempo de resposta.
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i += 1) {
    diferenca |= informado.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diferenca === 0;
};

const texto = (valor: unknown): string =>
  typeof valor === "string" ? valor.trim() : "";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const configuracao = await lerConfiguracao();
  if (!configuracao) {
    return res.status(503).json({ error: "InfinitePay não configurada." });
  }

  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!tokenConfere(token, configuracao.tokenDoWebhook)) {
    return res.status(404).json({ error: "Not found." });
  }

  // Do corpo saem SÓ identificadores. Nada aqui decide dinheiro.
  const orderNsu = texto(req.body?.order_nsu);
  const transactionNsu = texto(req.body?.transaction_nsu);
  const slugRecebido = texto(req.body?.invoice_slug);
  const comprovante = texto(req.body?.receipt_url) || null;

  if (!orderNsu || !transactionNsu) {
    // 400 pede reentrega na InfinitePay. Um corpo sem identificador nunca vai
    // melhorar numa nova tentativa, então respondemos 200 para não gerar laço.
    console.warn("infinitepay webhook sem identificadores", req.body);
    return res.status(200).json({ received: true, ignored: "sem order_nsu" });
  }

  const supabase = createSupabaseAdminClient() as any;

  // O order_nsu é o id do NOSSO registro de pagamento. Ele volta ao navegador
  // do cliente na URL de retorno, então é conhecido — serve para achar a linha,
  // nunca para autorizar.
  const { data: pagamentoNoBanco } = await supabase
    .from("payments")
    .select("id, booking_id, provider, infinitepay_invoice_slug")
    .eq("id", orderNsu)
    .maybeSingle();

  if (!pagamentoNoBanco || pagamentoNoBanco.provider !== "infinitepay") {
    console.warn("infinitepay webhook para pagamento desconhecido", { orderNsu });
    return res.status(200).json({ received: true, ignored: "desconhecido" });
  }

  // A AMARRA CONTRA REPLAY.
  //
  // Sem isto, alguém paga R$ 1,00 numa fatura própria, guarda o transaction_nsu
  // e o slug reais, e reapresenta esse par junto com o NOSSO order_nsu. Se o
  // payment_check não cruzar os dois — e não foi possível confirmar que cruza —
  // ele responde "pago" e uma reserva de centenas de reais é confirmada por
  // R$ 1,00. O slug que gravamos ao criar a cobrança é o que fecha essa porta.
  const slugEsperado = texto(pagamentoNoBanco.infinitepay_invoice_slug);
  if (slugEsperado && slugRecebido && slugRecebido !== slugEsperado) {
    console.error("infinitepay webhook com fatura divergente", {
      orderNsu,
      slugEsperado,
      slugRecebido,
    });
    await supabase.from("system_logs").insert({
      action: "infinitepay_slug_mismatch",
      entity: "payment",
      entity_id: pagamentoNoBanco.id,
      metadata: { slug_esperado: slugEsperado, slug_recebido: slugRecebido },
    });
    return res.status(200).json({ received: true, ignored: "fatura divergente" });
  }

  const slug = slugEsperado || slugRecebido;
  if (!slug) {
    console.warn("infinitepay webhook sem slug e sem slug gravado", { orderNsu });
    return res.status(200).json({ received: true, ignored: "sem fatura" });
  }

  // Trava de idempotência pela TRANSAÇÃO, não pelo pedido: order_nsu é o mesmo
  // nas duas cobranças de um pagamento em dobro, e a trava confundiria "pagou
  // duas vezes" com "reentrega do mesmo evento" — engolindo a segunda cobrança
  // em silêncio, sem log e sem linha.
  const chave = `infinitepay:${transactionNsu}`;
  const claim = await claimStripeEvent(chave, "infinitepay.payment");

  if (!claim.claimed && claim.reason === "duplicate") {
    return res.status(200).json({ received: true, duplicate: chave });
  }
  if (!claim.claimed && claim.reason === "in_progress") {
    // 400 é o que faz a InfinitePay tentar de novo. Aqui queremos isso: outro
    // processo está no meio do trabalho e pode não terminar.
    return res.status(400).json({ error: "Em processamento, tente de novo." });
  }

  try {
    // A PROVA. Servidor-a-servidor, ignorando tudo que veio no corpo.
    const verificacao = await verificarPagamento({
      handle: configuracao.handle,
      orderNsu,
      transactionNsu,
      slug,
    });

    const pagamento = normalizarPagamentoInfinitePay({
      paymentId: pagamentoNoBanco.id,
      bookingId: pagamentoNoBanco.booking_id,
      slug,
      transactionNsu,
      verificacao,
      comprovanteUrl: comprovante,
    });

    const resultado = await confirmInternalPayment(pagamento);

    await markStripeEventProcessed(chave);

    if (resultado.status === "confirmed" && resultado.booking_id) {
      await notifyBookingEvent("booking_confirmed", resultado.booking_id).catch(
        (erro) => console.error("booking_confirmed notify failed", erro)
      );
    }

    return res.status(200).json({ received: true, result: resultado });
  } catch (erro) {
    console.error("infinitepay webhook falhou", erro);

    if (claim.claimed || (!claim.claimed && claim.reason === "unavailable")) {
      await releaseStripeEvent(chave);
    }

    // 400, e não 500: na InfinitePay é o 400 que provoca nova tentativa. Copiar
    // o 500 da rota da Stripe faria um timeout do banco perder o evento em
    // definitivo, com o dinheiro já na conta do lojista.
    return res.status(400).json({ error: "Falha ao processar, reenvie." });
  }
};

export default handler;

export const config = {
  api: {
    // Ao contrário da Stripe, aqui o corpo cru não serve para nada: não há
    // assinatura para conferir sobre ele.
    bodyParser: true,
  },
  maxDuration: 60,
};
