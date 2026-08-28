// O formato único de "um pagamento aconteceu", independente de quem processou.
//
// POR QUE ISTO EXISTE: `confirmInternalPayment` guarda as regras que decidem
// dinheiro — confere valor contra o banco, checa se a reserva ainda está no
// prazo, impede confirmar duas vezes, queima o cupom uma vez só. Nada disso é
// específico da Stripe. O que era específico era o FORMATO do evento.
//
// Duplicar essa função por provedor seria repetir o erro que já custou caro
// neste projeto: dois lugares decidindo a mesma coisa, divergindo no primeiro
// conserto que alguém fizesse em um só. Então cada provedor traduz o evento
// dele para o formato abaixo, e a regra continua morando num lugar só.

export type PaymentProvider = "stripe" | "infinitepay";

export type PagamentoNormalizado = {
  provider: PaymentProvider;

  // Como achar o nosso registro. Vem do identificador que mandamos junto com a
  // cobrança e que o provedor devolve.
  paymentId: string;
  bookingId: string;

  // Só a Stripe carrega isto (na metadata da sessão) e é conferido contra o
  // banco. A InfinitePay não tem onde guardar, então vem null — e a conferência
  // do dono passa a ser só a do banco, que já era a que valia.
  userId: string | null;

  // O DINHEIRO.
  //
  // `valorCobradoEmCentavos` é o que foi COBRADO, e é o único que se compara
  // com o total da reserva. Na InfinitePay existe também um "pago", que pode
  // ser MAIOR quando os juros do parcelamento são repassados ao cliente —
  // comparar aquele por igualdade derrubaria toda venda parcelada.
  valorCobradoEmCentavos: number;
  moeda: string;

  // "O dinheiro entrou?" já resolvido por quem sabe responder: na Stripe é
  // session.payment_status === 'paid'; na InfinitePay é a resposta do
  // payment_check, nunca o corpo do webhook.
  pago: boolean;

  // Identificadores do provedor, para gravar e para o painel exibir.
  idCobranca: string | null;
  idTransacao: string | null;
  comprovanteUrl?: string | null;

  // Chave da trava de idempotência. Stripe: o event.id. InfinitePay: não existe
  // id de evento, então é "infinitepay:<transaction_nsu>".
  chaveDoEvento: string;
};

// Nomes das colunas do provedor. Reaproveitar as colunas da Stripe para ids da
// InfinitePay funcionaria e envenenaria a operação: o painel exibe esses campos
// com rótulo de Stripe, e o atendente leria um transaction_nsu como se fosse um
// payment_intent.
export const colunasDoProvedor = (
  pagamento: PagamentoNormalizado
): Record<string, string | null> =>
  pagamento.provider === "stripe"
    ? {
        stripe_checkout_session_id: pagamento.idCobranca,
        stripe_payment_intent_id: pagamento.idTransacao,
      }
    : {
        infinitepay_invoice_slug: pagamento.idCobranca,
        infinitepay_transaction_nsu: pagamento.idTransacao,
        receipt_url: pagamento.comprovanteUrl ?? null,
      };
