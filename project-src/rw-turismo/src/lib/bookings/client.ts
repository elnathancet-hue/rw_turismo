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
