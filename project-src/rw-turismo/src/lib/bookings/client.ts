import { createSupabaseBrowserClient } from "../supabase/browser";
import type { BookingSummary } from "./types";

const bookingsTable = () =>
  (createSupabaseBrowserClient() as any).from("bookings");

export const getMyBookings = async (): Promise<BookingSummary[]> => {
  const { data, error } = await bookingsTable()
    .select(
      "*, products(title, destination, cover_image), product_dates(start_date, end_date)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as BookingSummary[];
};

export const getMyBookingById = async (
  id: string
): Promise<BookingSummary | null> => {
  const { data, error } = await bookingsTable()
    .select(
      "*, products(title, destination, cover_image), product_dates(start_date, end_date)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as BookingSummary | null;
};

// Passageiros da própria reserva, só com o que a tela de documento precisa.
// O RLS já permite ao dono ler os passageiros da reserva dele — esta é a
// primeira tela do cliente a usar essa permissão.
export const getMyBookingPassengers = async (
  bookingId: string
): Promise<Array<{ id: string; full_name: string; document_status: string }>> => {
  const { data, error } = await (createSupabaseBrowserClient() as any)
    .from("passengers")
    .select("id, full_name, document_status")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
};
