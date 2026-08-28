import { getSecrets } from "../../server/secrets";
import type { PagamentoNormalizado } from "../normalized";

// Cliente HTTP da InfinitePay.
//
// LEIA ISTO ANTES DE MEXER — o modelo de confiança aqui é o oposto do da Stripe.
//
// A Stripe assina cada webhook, e `constructEvent` prova que o evento veio
// dela. A InfinitePay NÃO tem assinatura nenhuma: nem HMAC, nem header de
// origem, nem segredo compartilhado. O corpo que chega no nosso webhook é um
// JSON anônimo que qualquer pessoa da internet pode postar — e o `order_nsu`
// viaja na URL de retorno, então o próprio cliente conhece o identificador do
// pedido dele.
//
// Portanto: o webhook é apenas um GATILHO ("vá conferir o pedido X"). A prova
// de que o dinheiro entrou é `verificarPagamento()`, uma chamada que o NOSSO
// servidor faz. Nada do corpo recebido decide dinheiro — nem valor, nem status,
// nem método.
//
// Isto não é zelo excessivo: o plugin de WooCommerce público da InfinitePay
// confirma o pedido lendo `paid_amount >= amount` do próprio corpo recebido, e
// está rodando assim em lojas de verdade.

const BASE = "https://api.checkout.infinitepay.io";

// Nem a criação de link nem o payment_check exigem credencial: sondagem sem
// header nenhum chega na regra de negócio e devolve 400/404, nunca 401. O
// `handle` é a InfiniteTag — nome de usuário público, não segredo. Ele diz de
// QUEM é a cobrança, não prova quem está pedindo.
export class InfinitePayError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "InfinitePayError";
    this.statusCode = statusCode;
  }
}

export type ConfiguracaoInfinitePay = {
  handle: string;
  habilitado: boolean;
  tokenDoWebhook: string;
};

export const lerConfiguracao = async (): Promise<ConfiguracaoInfinitePay | null> => {
  const segredos = await getSecrets([
    "infinitepay_handle",
    "infinitepay_enabled",
    "infinitepay_webhook_token",
  ]);

  const handle = (segredos.infinitepay_handle ?? "").trim().replace(/^\$/, "");
  if (!handle) return null;

  return {
    handle,
    habilitado: segredos.infinitepay_enabled === "true",
    tokenDoWebhook: (segredos.infinitepay_webhook_token ?? "").trim(),
  };
};

const chamar = async (
  caminho: string,
  corpo: Record<string, unknown>
): Promise<{ status: number; body: any }> => {
  let resposta: Response;

  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      // A InfinitePay pede resposta rápida no webhook. Se a chamada de
      // verificação pendurar, é melhor falhar e deixar o cron reconciliar do
      // que segurar a conexão até o teto da função.
      signal: AbortSignal.timeout(12_000),
    });
  } catch (erro) {
    throw new InfinitePayError(
      `Não foi possível falar com a InfinitePay: ${
        erro instanceof Error ? erro.message : String(erro)
      }`,
      504
    );
  }

  const texto = await resposta.text();
  let body: any = null;
  try {
    body = texto ? JSON.parse(texto) : null;
  } catch {
    body = { raw: texto };
  }

  return { status: resposta.status, body };
};

export type LinkCriado = {
  url: string;
  slug: string | null;
  respostaBruta: unknown;
};

// Extrai o identificador da fatura da própria URL de pagamento.
//
// A documentação NÃO documenta a resposta de sucesso da criação — as duas
// integrações públicas leem apenas `url`. O slug é o que amarra a cobrança ao
// pedido e é a nossa defesa contra replay, então vale tentar tirá-lo de onde
// der: do corpo, se vier, e da URL como plano B.
const extrairSlug = (body: any, url: string): string | null => {
  const doCorpo =
    typeof body?.slug === "string"
      ? body.slug
      : typeof body?.invoice_slug === "string"
        ? body.invoice_slug
        : null;
  if (doCorpo) return doCorpo;

  try {
    const partes = new URL(url).pathname.split("/").filter(Boolean);
    return partes.length ? partes[partes.length - 1]! : null;
  } catch {
    return null;
  }
};

export const criarLink = async (parametros: {
  handle: string;
  valorEmCentavos: number;
  descricao: string;
  orderNsu: string;
  redirectUrl: string;
  webhookUrl: string;
  cliente?: { nome?: string | null; email?: string | null; telefone?: string | null };
}): Promise<LinkCriado> => {
  const { status, body } = await chamar("/links", {
    handle: parametros.handle,
    // "items", e NUNCA "itens". O texto em prosa da documentação oficial escreve
    // em português e está ERRADO: o widget da própria página gera `items`, e
    // mandar o campo com o nome traduzido devolve 400.
    //
    // Um item só, com o total já calculado pelo banco. Nada de mandar `amount`
    // na raiz (o plugin WooCommerce manda, e não é documentado): se a API
    // preferir aquele campo à soma dos itens, a cobrança diverge em silêncio.
    items: [
      {
        quantity: 1,
        price: parametros.valorEmCentavos,
        description: parametros.descricao,
      },
    ],
    order_nsu: parametros.orderNsu,
    redirect_url: parametros.redirectUrl,
    webhook_url: parametros.webhookUrl,
    ...(parametros.cliente
      ? {
          customer: {
            name: parametros.cliente.nome ?? undefined,
            email: parametros.cliente.email ?? undefined,
            phone_number: parametros.cliente.telefone ?? undefined,
          },
        }
      : {}),
  });

  // Resposta bruta sempre no log. A documentação não descreve o sucesso da
  // criação, então a primeira cobrança real é o que vai revelar o formato.
  console.info("infinitepay criarLink", { status, body });

  if (status >= 400 || !body?.url) {
    const detalhe =
      body?.message ?? body?.error ?? `HTTP ${status} sem url na resposta`;

    // Erro conhecido e acionável: o Checkout Externo não foi habilitado na
    // conta. Sem isso TODA chamada falha, e a mensagem genérica esconderia a
    // única coisa que o operador precisa fazer.
    if (String(body?.error ?? "").includes("external_checkout_not_enabled")) {
      throw new InfinitePayError(
        "O Checkout Externo não está habilitado na conta InfinitePay. Ative em app.infinitepay.io/external-checkout#configuracoes.",
        503
      );
    }

    throw new InfinitePayError(`InfinitePay recusou a cobrança: ${detalhe}`);
  }

  return {
    url: String(body.url),
    slug: extrairSlug(body, String(body.url)),
    respostaBruta: body,
  };
};

export type VerificacaoDePagamento = {
  pago: boolean;
  valorCobradoEmCentavos: number;
  valorPagoEmCentavos: number;
  parcelas: number;
  metodo: string | null;
  respostaBruta: unknown;
};

// A ÚNICA prova de pagamento. Consulta servidor-a-servidor.
//
// O endpoint não é autenticado, e mesmo assim serve como prova pelo motivo que
// importa: o atacante não consegue fazer uma fatura NÃO PAGA responder
// `paid: true`. Para isso teria que pagar de verdade.
//
// O que ele PODE fazer é pagar R$ 1,00 numa fatura própria e reapresentar
// aquele transaction_nsu com o nosso order_nsu. Contra isso serve o slug
// gravado na criação do link — quem chama esta função deve recusar qualquer
// slug diferente do que guardamos. Não foi possível confirmar se a própria
// InfinitePay faz esse cruzamento; até prova em contrário, assuma que não.
export const verificarPagamento = async (parametros: {
  handle: string;
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}): Promise<VerificacaoDePagamento> => {
  const { status, body } = await chamar("/payment_check", {
    handle: parametros.handle,
    order_nsu: parametros.orderNsu,
    transaction_nsu: parametros.transactionNsu,
    slug: parametros.slug,
  });

  console.info("infinitepay payment_check", { status, body });

  if (status >= 500) {
    throw new InfinitePayError(
      `InfinitePay indisponível para verificação (HTTP ${status}).`,
      503
    );
  }

  // 404 é resposta de negócio ("não achei essa cobrança"), não erro de
  // transporte. Tratar como "não pago" é o comportamento seguro: nada é
  // confirmado.
  const pago = body?.success === true && body?.paid === true;

  return {
    pago,
    valorCobradoEmCentavos: Number(body?.amount ?? 0),
    valorPagoEmCentavos: Number(body?.paid_amount ?? 0),
    parcelas: Number(body?.installments ?? 1),
    metodo: typeof body?.capture_method === "string" ? body.capture_method : null,
    respostaBruta: body,
  };
};

// Monta o pagamento normalizado a partir da verificação — nunca do webhook.
export const normalizarPagamentoInfinitePay = (parametros: {
  paymentId: string;
  bookingId: string;
  slug: string;
  transactionNsu: string;
  verificacao: VerificacaoDePagamento;
  comprovanteUrl?: string | null;
}): PagamentoNormalizado => ({
  provider: "infinitepay",
  paymentId: parametros.paymentId,
  bookingId: parametros.bookingId,
  // A InfinitePay não tem onde carregar o dono. O vínculo que decide é o do
  // banco (pagamento ↔ reserva ↔ usuário), que já era o que valia.
  userId: null,
  // O valor COBRADO. O pago pode ser maior, com os juros do parcelamento
  // repassados ao cliente — comparar aquele por igualdade com o total da
  // reserva derrubaria toda venda parcelada.
  valorCobradoEmCentavos: parametros.verificacao.valorCobradoEmCentavos,
  moeda: "BRL",
  pago: parametros.verificacao.pago,
  idCobranca: parametros.slug,
  idTransacao: parametros.transactionNsu,
  comprovanteUrl: parametros.comprovanteUrl ?? null,
  // A InfinitePay não manda id de evento. A chave é a transação — e NÃO o
  // order_nsu, que é o mesmo nas duas cobranças de um pagamento em dobro e
  // faria a trava engolir a segunda em silêncio.
  chaveDoEvento: `infinitepay:${parametros.transactionNsu}`,
});
