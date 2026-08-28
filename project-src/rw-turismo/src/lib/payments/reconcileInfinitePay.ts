import {
  lerConfiguracao,
  normalizarPagamentoInfinitePay,
  verificarPagamento,
} from "./adapters/infinitepay";
import { confirmInternalPayment } from "./confirmInternalPayment";
import { notifyBookingEvent } from "../server/notifications";
import { createSupabaseAdminClient } from "../supabase/admin";

// Reconciliação ativa com a InfinitePay.
//
// POR QUE ISTO PRECISA EXISTIR ANTES DO PRIMEIRO CLIENTE REAL:
//
// Na Stripe, se o nosso webhook falha, ela reentrega por horas — e se o
// endpoint fica fora do ar por dias, ela avisa. Na InfinitePay a reentrega é
// subespecificada: a documentação só diz "se você responder 400, a gente tenta
// enviar de novo". Não há número de tentativas, nem intervalo, nem prazo. E não
// se sabe sequer se ela reentrega em caso de timeout.
//
// Junte a isso o fato de que o link de pagamento NÃO EXPIRA e o prazo da
// reserva é de 30 minutos, e o desfecho ruim deixa de ser exceção: o cliente
// paga, o aviso se perde, e o cron de expiração devolve a vaga de uma reserva
// que foi paga.
//
// Esta função é a rede: pergunta à InfinitePay, para cada cobrança que ficou
// sem resposta, se o dinheiro entrou.
//
// Ela NÃO substitui o webhook — só chega mais tarde. E não é um caminho
// paralelo de confirmação: usa exatamente a mesma prova (payment_check) e a
// mesma regra (confirmInternalPayment) do webhook.

// Quanto tempo olhar para trás. Cobre com folga o prazo da reserva e o tempo de
// alguém pagar um link que ficou aberto.
const JANELA_HORAS = 72;

export type ResultadoReconciliacao = {
  verificados: number;
  confirmados: number;
  erros: number;
};

export const reconcileInfinitePay = async (): Promise<ResultadoReconciliacao> => {
  const configuracao = await lerConfiguracao();

  if (!configuracao || !configuracao.habilitado) {
    return { verificados: 0, confirmados: 0, erros: 0 };
  }

  const supabase = createSupabaseAdminClient() as any;
  const desde = new Date(Date.now() - JANELA_HORAS * 3600_000).toISOString();

  // Cobranças abertas que já têm fatura criada e ainda não fecharam.
  //
  // Inclui as de reserva já expirada de propósito: são justamente as que mais
  // importam. Se o cliente pagou depois do prazo, o dinheiro está na conta e
  // alguém precisa saber — confirmInternalPayment manda para "Em análise" em
  // vez de confirmar uma reserva sem vaga, que é o desfecho certo.
  const { data: pendentes, error } = await supabase
    .from("payments")
    .select("id, booking_id, infinitepay_invoice_slug, infinitepay_transaction_nsu")
    .eq("provider", "infinitepay")
    .in("status", ["pending", "processing"])
    .not("infinitepay_invoice_slug", "is", null)
    .gte("created_at", desde)
    .limit(200);

  if (error) throw error;

  let confirmados = 0;
  let erros = 0;
  const lista = (pendentes ?? []) as Array<{
    id: string;
    booking_id: string;
    infinitepay_invoice_slug: string;
    infinitepay_transaction_nsu: string | null;
  }>;

  for (const pendente of lista) {
    try {
      const verificacao = await verificarPagamento({
        handle: configuracao.handle,
        orderNsu: pendente.id,
        // Numa cobrança cujo webhook nunca chegou, não temos a transação. O
        // payment_check é consultado com o que existe; se ele exigir os quatro
        // campos, a resposta virá "não encontrado" e a cobrança fica para a
        // próxima rodada — sem confirmar nada, que é o comportamento seguro.
        transactionNsu: pendente.infinitepay_transaction_nsu ?? "",
        slug: pendente.infinitepay_invoice_slug,
      });

      if (!verificacao.pago) continue;

      const pagamento = normalizarPagamentoInfinitePay({
        paymentId: pendente.id,
        bookingId: pendente.booking_id,
        slug: pendente.infinitepay_invoice_slug,
        transactionNsu:
          pendente.infinitepay_transaction_nsu ??
          `reconciliado-${pendente.infinitepay_invoice_slug}`,
        verificacao,
      });

      const resultado = await confirmInternalPayment(pagamento);

      if (resultado.status === "confirmed" && resultado.booking_id) {
        confirmados += 1;
        await notifyBookingEvent("booking_confirmed", resultado.booking_id).catch(
          (erro) => console.error("booking_confirmed notify failed", erro)
        );
      }

      // Registra a reconciliação: um pagamento que só foi encontrado por aqui
      // significa que o webhook falhou, e isso precisa ser visível.
      await supabase.from("system_logs").insert({
        action: "infinitepay_reconciliado",
        entity: "payment",
        entity_id: pendente.id,
        metadata: {
          booking_id: pendente.booking_id,
          resultado: resultado.status,
          tinha_transacao: Boolean(pendente.infinitepay_transaction_nsu),
        },
      });
    } catch (erro) {
      erros += 1;
      console.error("reconciliação InfinitePay falhou", {
        payment_id: pendente.id,
        erro,
      });
    }
  }

  return { verificados: lista.length, confirmados, erros };
};
