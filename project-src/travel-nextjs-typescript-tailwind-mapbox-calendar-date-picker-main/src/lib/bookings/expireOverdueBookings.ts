import { createSupabaseAdminClient } from "../supabase/admin";

// Expira em lote as reservas pendentes vencidas e devolve as vagas ao
// estoque (RPC expire_overdue_pending_bookings — idempotente, com lock por
// reserva). Retorna quantas reservas foram expiradas nesta varredura.
export const expireOverdueBookings = async (): Promise<number> => {
  const supabase = createSupabaseAdminClient() as any;
  const { data, error } = await supabase.rpc("expire_overdue_pending_bookings");
  if (error) throw error;
  return Number(data ?? 0);
};
