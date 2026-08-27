import { createSupabaseAdminClient } from "../supabase/admin";
import type { BookingSummary } from "./types";

// Acesso à reserva sem sessão, para a compra sem cadastro.
//
// O convidado não fica logado — a conta dele é criada nos bastidores, mas o
// navegador não tem sessão. Sem isto, ele criava a reserva e batia num login
// antes de conseguir pagar, com a vaga retida e o prazo correndo.
//
// O token é um segredo por reserva (bookings.access_token, gerado por trigger).
// Ele NÃO é sessão: só abre aquela reserva, não dá acesso a mais nada e não
// afrouxa nenhuma policy. Por isso a leitura aqui usa service role e filtra
// pelos dois campos ao mesmo tempo.

const BOOKING_SELECT =
  "*, products(title, destination, cover_image), product_dates(start_date, end_date)";

export const findBookingByAccessToken = async (
  bookingId: string,
  accessToken: string
): Promise<BookingSummary | null> => {
  // Token curto ou vazio nem chega ao banco: evita varrer a tabela com um
  // palpite trivial.
  if (!bookingId || !accessToken || accessToken.length < 32) return null;

  const supabase = createSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("id", bookingId)
    .eq("access_token", accessToken)
    .maybeSingle();

  if (error) return null;
  return (data as BookingSummary | null) ?? null;
};

// O token some da resposta: quem já o tem veio pela URL, e repeti-lo no corpo
// só aumentaria a chance de ele acabar num log.
export const withoutAccessToken = <T extends Record<string, unknown>>(
  booking: T
): Omit<T, "access_token"> => {
  const { access_token: _ignored, ...rest } = booking as T & {
    access_token?: string;
  };
  return rest;
};
