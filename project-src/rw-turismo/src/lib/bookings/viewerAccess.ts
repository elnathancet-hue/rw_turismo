import { getMyBookingById, getMyBookingPassengers } from "./client";
import type { BookingSummary } from "./types";

// Como QUALQUER tela do cliente carrega uma reserva.
//
// Existem dois jeitos de provar que a reserva é sua: a sessão (cliente logado)
// e o token de acesso da compra sem cadastro (?t=). Toda tela precisa dos dois
// — foi exatamente por ter só o primeiro que a pessoa que comprou sem cadastro
// pagava e caía numa tela de login logo em seguida.
//
// Uma função só, para não existir uma terceira tela que lembre de metade.

export type BookingPassengerView = {
  id: string;
  full_name: string;
  document_status: string;
};

export type BookingForViewer = {
  booking: BookingSummary;
  passengers: BookingPassengerView[];
};

export const fetchBookingForViewer = async (
  bookingId: string,
  viewer: { isAuthenticated: boolean; accessToken: string }
): Promise<BookingForViewer | null> => {
  if (!bookingId) return null;

  // Tenta a sessão primeiro, mas NÃO desiste se ela não servir.
  //
  // Caso real: a pessoa compra sem cadastro e abre o link no computador de
  // casa, onde outra pessoa da família está logada. O RLS filtra pelo dono e a
  // consulta volta vazia — sem erro. Desistir aqui deixava a tela do botão de
  // pagar carregando para sempre, que é exatamente o muro que o token existe
  // para derrubar.
  if (viewer.isAuthenticated) {
    try {
      const [booking, passengers] = await Promise.all([
        getMyBookingById(bookingId),
        getMyBookingPassengers(bookingId),
      ]);

      if (booking) return { booking, passengers };
    } catch {
      // Sessão de outra conta ou leitura recusada: o token abaixo ainda pode
      // provar a posse. O try/catch importa — sem ele um erro em qualquer das
      // duas leituras mataria o caminho alternativo.
    }
  }

  if (!viewer.accessToken) return null;

  const response = await fetch(`/api/bookings/${bookingId}/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: viewer.accessToken }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error ?? "Reserva não encontrada.");
  }

  return {
    booking: payload.booking as BookingSummary,
    passengers: (payload.passengers ?? []) as BookingPassengerView[],
  };
};

// Preserva o token ao navegar entre telas do cliente. Sem isto, o convidado
// perde o acesso no primeiro link que clicar.
export const withAccessToken = (href: string, accessToken: string): string =>
  accessToken
    ? `${href}${href.includes("?") ? "&" : "?"}t=${encodeURIComponent(accessToken)}`
    : href;
