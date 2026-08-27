import { createSupabaseAdminClient } from "../supabase/admin";

// Trava de evento da Stripe, por event.id.
//
// POR QUE EXISTE: a proteção anterior era por ESTADO ("a reserva já está
// confirmada, ignora"). Ela resolve reentrega em sequência e não resolve
// entrega concorrente: dois processos leem o estado antigo ao mesmo tempo e os
// dois seguem em frente. O que dói é `increment_coupon_usage`, um
// `used_count + 1` cego — contaria duas vezes.
//
// POR QUE TEM `processed_at`: marcar só "peguei" não basta. Se o processo
// morrer no meio (timeout da Vercel, deploy, falta de memória), o evento fica
// marcado para sempre e a reentrega da Stripe — que é justamente o conserto
// automático dessa falha — é descartada como repetida. Com Pix, isso é
// literalmente "o cliente pagou e ficou sem reserva".
//
// Então são dois momentos distintos: `received_at` = alguém pegou;
// `processed_at` = alguém terminou. Claim parado há mais de 5 minutos sem
// terminar é considerado órfão e pode ser retomado.

const admin = () => createSupabaseAdminClient() as any;

// Tempo depois do qual um claim sem conclusão é dado por abandonado. Precisa
// ser maior que a duração máxima da função (60 s) com folga confortável.
const CLAIM_ORFAO_MS = 5 * 60 * 1000;

export type EventClaim =
  | { claimed: true }
  | { claimed: false; reason: "duplicate" | "in_progress" | "unavailable" };

export const claimStripeEvent = async (
  eventId: string,
  eventType: string
): Promise<EventClaim> => {
  const { error } = await admin()
    .from("stripe_events")
    .insert({ event_id: eventId, event_type: eventType });

  if (!error) return { claimed: true };

  // 23505 = unique_violation: a linha já existe. Três casos muito diferentes.
  if (error.code === "23505") {
    // Claim órfão: alguém pegou, nunca terminou, e faz tempo. Retoma.
    const { data: retomado } = await admin()
      .from("stripe_events")
      .update({ received_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .is("processed_at", null)
      .lt("received_at", new Date(Date.now() - CLAIM_ORFAO_MS).toISOString())
      .select("event_id");

    if (retomado?.length) return { claimed: true };

    const { data: linha } = await admin()
      .from("stripe_events")
      .select("processed_at")
      .eq("event_id", eventId)
      .maybeSingle();

    // Terminado → repetido de verdade. Ainda rodando → devolver 500 para a
    // Stripe tentar de novo mais tarde, em vez de dar 200 num trabalho que
    // pode não chegar ao fim.
    return {
      claimed: false,
      reason: linha?.processed_at ? "duplicate" : "in_progress",
    };
  }

  // Erro que não é violação de unicidade. Pode ser tabela ausente (migration
  // não aplicada) ou a gravação ter dado certo com a resposta perdida no
  // caminho — e nesse segundo caso seguir "sem trava" deixaria a linha
  // marcada e nunca liberada. Pergunta ao banco antes de decidir.
  const { data, error: readError } = await admin()
    .from("stripe_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (!readError && data) return { claimed: true };

  // Tabela ausente ou banco fora do ar. Seguir SEM a trava é deliberado:
  // bloquear significaria a Stripe reentregar em laço e nenhuma reserva
  // confirmar. Volta-se ao comportamento anterior a esta proteção, que é a
  // proteção por estado.
  console.error("stripe event claim indisponível, seguindo sem trava", error);
  return { claimed: false, reason: "unavailable" };
};

// "Terminei." Chamado antes de responder 200, e ANTES das notificações — elas
// são best-effort, têm timeout de 15 s cada e são o que mais aproxima o
// handler do teto de tempo da função.
export const markStripeEventProcessed = async (
  eventId: string
): Promise<void> => {
  const { error } = await admin()
    .from("stripe_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);

  if (error) {
    console.error("falha ao marcar evento da Stripe como processado", error);
  }
};

// Devolve o evento para a fila depois de uma falha, para a reentrega da Stripe
// conseguir tentar de novo. Se o DELETE falhar, o claim vira órfão — e a
// retomada por tempo em claimStripeEvent é a rede que pega esse caso.
export const releaseStripeEvent = async (eventId: string): Promise<void> => {
  const { error } = await admin()
    .from("stripe_events")
    .delete()
    .eq("event_id", eventId);

  if (error) {
    console.error("falha ao liberar evento da Stripe para reentrega", error);
  }
};
