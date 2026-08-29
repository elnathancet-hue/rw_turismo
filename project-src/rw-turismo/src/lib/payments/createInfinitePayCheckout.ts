import {
  criarLink,
  InfinitePayError,
  lerConfiguracao,
} from "./adapters/infinitepay";
import { getPublicEnv } from "../env";
import { InternalCheckoutError, prepararCheckout } from "./preCheckout";
import { createSupabaseAdminClient } from "../supabase/admin";
import type { CreateCheckoutInput, CreateCheckoutResult } from "./types";

// Abre uma cobrança na InfinitePay.
//
// O equivalente de createInternalCheckoutSession, com uma diferença que vale
// destacar: na InfinitePay NÃO EXISTE forma de invalidar um link já criado.
// Na Stripe, antes de abrir uma sessão nova a anterior é expirada, para nunca
// existirem dois checkouts vivos da mesma reserva. Aqui isso é impossível — a
// API não tem o endpoint.
//
// A defesa possível é não criar o segundo: enquanto o prazo estiver de pé,
// devolvemos o MESMO link. Isso resolve o caso real (cliente clica duas vezes
// em "pagar") e não fecha o buraco de verdade — se alguém pagar um link antigo
// de reserva já expirada, o dinheiro entra sem vaga. O sistema trata isso
// corretamente mandando para "Em análise" em vez de confirmar, mas o desfecho
// exige estorno manual. É uma fila nova para a operação, e não tem conserto em
// código.

export const createInfinitePayCheckout = async (
  input: CreateCheckoutInput
): Promise<CreateCheckoutResult> => {
  const configuracao = await lerConfiguracao();

  if (!configuracao) {
    throw new InternalCheckoutError(
      "InfinitePay não configurada. Cole a InfiniteTag em Admin → Integrações.",
      503
    );
  }

  if (!configuracao.habilitado) {
    throw new InternalCheckoutError(
      "Pagamento pela InfinitePay não está ativo.",
      503
    );
  }

  if (!configuracao.tokenDoWebhook) {
    throw new InternalCheckoutError(
      "Falta o token do webhook da InfinitePay em Admin → Integrações.",
      503
    );
  }

  const { booking, payment, amountInCents } = await prepararCheckout(
    input.booking_id,
    input.user_id,
    "infinitepay"
  );

  const supabase = createSupabaseAdminClient() as any;

  // Link vivo desta mesma reserva: devolve o que já existe. Ver o comentário no
  // topo — não há como matar o anterior, então o jeito de não ter dois é não
  // criar o segundo.
  if (
    booking.checkout_url &&
    booking.payment_provider === "infinitepay" &&
    booking.infinitepay_invoice_slug
  ) {
    return { checkout_url: booking.checkout_url };
  }

  const { siteUrl } = getPublicEnv();

  // O token do convidado viaja no retorno pelo mesmo motivo da Stripe: quem
  // comprou sem cadastro não tem sessão, e sem ele cairia numa tela de login
  // logo depois de pagar.
  const tokenDeRetorno =
    input.is_guest && booking.access_token
      ? `&t=${encodeURIComponent(booking.access_token)}`
      : "";

  let link;

  try {
    link = await criarLink({
      handle: configuracao.handle,
      valorEmCentavos: amountInCents,
      descricao: booking.products?.title ?? "Reserva RW Turismo",
      // O id do NOSSO pagamento. É um UUID, e não um sequencial, de propósito:
      // ele volta ao navegador do cliente na URL de retorno, e sequencial seria
      // adivinhável.
      orderNsu: payment.id,
      redirectUrl: `${siteUrl}/account/bookings/payment-success?booking_id=${booking.id}${tokenDeRetorno}`,
      webhookUrl: `${siteUrl}/api/payments/webhook/infinitepay/${configuracao.tokenDoWebhook}`,
      cliente: {
        nome: booking.customer_name,
        email: booking.customer_email,
        telefone: booking.customer_phone,
      },
    });
  } catch (erro) {
    if (erro instanceof InfinitePayError) {
      throw new InternalCheckoutError(erro.message, erro.statusCode);
    }
    throw erro;
  }

  // Sem identificar a fatura, NAO abrimos a cobrança.
  //
  // O slug é a única defesa contra replay: sem ele gravado, o webhook não teria
  // como recusar um aviso que aponte para outra fatura, e alguém poderia pagar
  // R$ 1,00 numa cobrança própria e reapresentar aquela prova aqui.
  //
  // Recusar neste ponto é barato: ninguém pagou nada ainda, e o erro aparece
  // para a operação em vez de virar fraude silenciosa mais tarde.
  if (!link.slug) {
    console.error("infinitepay: link criado sem slug identificável", {
      url: link.url,
      resposta: link.respostaBruta,
    });
    throw new InternalCheckoutError(
      "Não foi possível abrir a cobrança com segurança. Tente pagar pelo cartão ou fale com a gente.",
      502
    );
  }

  // Grava a fatura ANTES de devolver a URL ao cliente.
  //
  // É esta linha que sustenta a defesa contra replay: o webhook não tem
  // assinatura, então a única forma de recusar um aviso que aponte para outra
  // fatura é saber, de antemão, qual é a nossa.
  const { error: erroPagamento } = await supabase
    .from("payments")
    .update({
      infinitepay_invoice_slug: link.slug,
      checkout_url: link.url,
    })
    .eq("id", payment.id);

  if (erroPagamento) throw erroPagamento;

  const { error: erroReserva } = await supabase
    .from("bookings")
    .update({
      payment_provider: "infinitepay",
      infinitepay_invoice_slug: link.slug,
      checkout_url: link.url,
    })
    .eq("id", booking.id);

  if (erroReserva) throw erroReserva;

  return { checkout_url: link.url };
};
