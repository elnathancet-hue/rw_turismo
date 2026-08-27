import type { NextApiRequest, NextApiResponse } from "next";
import { renderVoucherPdf } from "../../../../lib/pdf/voucher";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

// GET /api/bookings/:id/voucher — PDF do voucher. Autorizado para o dono da
// reserva ou para um admin (Fase 4.1).
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const bookingId = typeof req.query.id === "string" ? req.query.id : "";
  if (!bookingId) {
    return res.status(400).json({ error: "Reserva inválida." });
  }

  const supabase = createSupabaseServerClient({ req, res }) as any;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return res.status(401).json({ error: "Autenticação necessária." });
  }

  const admin = createSupabaseAdminClient() as any;
  const { data: booking, error } = await admin
    .from("bookings")
    .select(
      "id, user_id, customer_name, customer_email, customer_phone, travelers_count, total_amount, status, payment_status, products(title, destination, itinerary), product_dates(start_date, end_date), passengers(full_name, document, type)"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("voucher: booking fetch failed", error);
    return res.status(500).json({ error: "Erro ao carregar a reserva." });
  }
  if (!booking) {
    return res.status(404).json({ error: "Reserva não encontrada." });
  }

  // Autorização: dono da reserva ou equipe (atendimento emite voucher no
  // balcão). Papel de conteúdo não lida com reserva, então fica de fora.
  let allowed = booking.user_id === userData.user.id;
  if (!allowed) {
    const { data: profile } = await supabase
      .from("users_profiles")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const isActive = (profile as { active?: boolean } | null)?.active !== false;
    allowed =
      isActive &&
      ["admin", "operacoes", "financeiro"].includes(String(profile?.role));
  }
  if (!allowed) {
    return res.status(403).json({ error: "Acesso restrito." });
  }

  // Voucher é comprovante de embarque, não de intenção. Emitir um para reserva
  // aguardando Pix entrega ao cliente um documento que a operação vai recusar
  // no dia — e que ele já pode ter mostrado para a família.
  if (booking.payment_status !== "paid") {
    return res.status(409).json({
      error: "O voucher fica disponível assim que o pagamento for confirmado.",
    });
  }

  try {
    const pdf = await renderVoucherPdf(booking);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="voucher-${bookingId.slice(0, 8)}.pdf"`
    );
    return res.send(pdf);
  } catch (renderError) {
    console.error("voucher: render failed", renderError);
    return res.status(500).json({ error: "Não foi possível gerar o voucher." });
  }
};

export default handler;
