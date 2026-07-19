import { createSupabaseBrowserClient } from "../supabase/browser";

// Envia a avaliação pós-viagem (link com o id da reserva chega por
// WhatsApp/e-mail). RLS permite insert público; 1 resposta por reserva
// (constraint única — 23505 = já avaliou).
export const submitSurveyResponse = async (
  bookingId: string,
  rating: number,
  comment: string
): Promise<"ok" | "duplicate"> => {
  const supabase = createSupabaseBrowserClient() as any;
  const { error } = await supabase.from("survey_responses").insert({
    booking_id: bookingId,
    rating,
    comment: comment.trim() || null,
  });

  if (error) {
    if (error.code === "23505") return "duplicate";
    throw error;
  }
  return "ok";
};
