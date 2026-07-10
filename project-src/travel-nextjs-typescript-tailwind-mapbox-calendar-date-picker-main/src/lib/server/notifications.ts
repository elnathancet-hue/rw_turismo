import { createSupabaseAdminClient } from "../supabase/admin";
import { formatBRL, formatDateBR, formatDateRangeBR, formatDateTimeBR } from "../format";
import { sendEmail } from "./email";
import { sendWhatsAppText } from "./whatsapp";

// Motor de notificações: monta o texto (pt-BR), tenta WhatsApp + e-mail e
// registra tudo em notification_log. `ref` garante idempotência (o mesmo
// evento para o mesmo destino não é reenviado pelos crons).

const db = () => createSupabaseAdminClient() as any;

const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

type LogRow = {
  event: string;
  channel: "whatsapp" | "email";
  recipient: string | null;
  subject?: string | null;
  body: string;
  status: "sent" | "skipped" | "failed";
  error?: string | null;
  ref?: string | null;
  booking_id?: string | null;
};

const log = async (row: LogRow) => {
  try {
    await db().from("notification_log").insert(row);
  } catch {
    // log é melhor-esforço — nunca derruba o fluxo principal
  }
};

const alreadySent = async (event: string, ref: string): Promise<boolean> => {
  try {
    const { data } = await db()
      .from("notification_log")
      .select("id")
      .eq("event", event)
      .eq("ref", ref)
      .eq("status", "sent")
      .limit(1);
    return Boolean(data?.length);
  } catch {
    return false;
  }
};

type Message = {
  event: string;
  ref?: string | null;
  bookingId?: string | null;
  phone?: string | null;
  email?: string | null;
  text: string; // WhatsApp
  subject: string; // e-mail
  html?: string; // e-mail (default: texto com <br>)
};

export const deliver = async (message: Message): Promise<void> => {
  const html =
    message.html ??
    `<div style="font-family:sans-serif;line-height:1.6">${message.text
      .split("\n")
      .join("<br>")}</div>`;

  if (message.ref && (await alreadySent(message.event, message.ref))) {
    return;
  }

  let anySent = false;

  if (message.phone) {
    const result = await sendWhatsAppText(message.phone, message.text);
    anySent = anySent || result.ok;
    await log({
      event: message.event,
      channel: "whatsapp",
      recipient: message.phone,
      body: message.text,
      status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
      error: result.error ?? null,
      ref: message.ref ?? null,
      booking_id: message.bookingId ?? null,
    });
  }

  if (message.email) {
    const result = await sendEmail(message.email, message.subject, html);
    anySent = anySent || result.ok;
    await log({
      event: message.event,
      channel: "email",
      recipient: message.email,
      subject: message.subject,
      body: message.text,
      status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
      error: result.error ?? null,
      ref: message.ref ?? null,
      booking_id: message.bookingId ?? null,
    });
  }

  void anySent;
};

// ---------------------------------------------------------------------------
// Eventos de reserva (gatilhos do fluxo de pagamento).
// ---------------------------------------------------------------------------

type BookingRow = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  travelers_count: number;
  total_amount: number | string;
  expires_at: string | null;
  products?: { title: string | null } | null;
  product_dates?: { start_date: string; end_date: string } | null;
};

const fetchBooking = async (bookingId: string): Promise<BookingRow | null> => {
  const { data } = await db()
    .from("bookings")
    .select(
      "id, customer_name, customer_email, customer_phone, travelers_count, total_amount, expires_at, products(title), product_dates(start_date, end_date)"
    )
    .eq("id", bookingId)
    .maybeSingle();
  return (data ?? null) as BookingRow | null;
};

export type BookingEvent =
  | "booking_created"
  | "booking_confirmed"
  | "payment_failed";

export const notifyBookingEvent = async (
  event: BookingEvent,
  bookingId: string
): Promise<void> => {
  try {
    const booking = await fetchBooking(bookingId);
    if (!booking) return;

    const firstName = booking.customer_name.split(" ")[0] ?? "viajante";
    const product = booking.products?.title ?? "sua viagem";
    const period = booking.product_dates
      ? formatDateRangeBR(
          booking.product_dates.start_date,
          booking.product_dates.end_date
        )
      : "";
    const total = formatBRL(Number(booking.total_amount));
    const link = `${siteUrl()}/account/bookings/${booking.id}`;

    let text = "";
    let subject = "";

    if (event === "booking_created") {
      const deadline = booking.expires_at
        ? ` até ${formatDateTimeBR(booking.expires_at)}`
        : "";
      subject = `Recebemos sua reserva — ${product}`;
      text = `Olá, ${firstName}! 👋\n\nRecebemos sua reserva:\n📍 ${product}\n📅 ${period}\n👥 ${booking.travelers_count} viajante(s)\n💰 ${total}\n\nConclua o pagamento${deadline} para garantir sua vaga:\n${link}\n\nQualquer dúvida, é só responder. — RW Turismo`;
    } else if (event === "booking_confirmed") {
      subject = `Reserva confirmada! — ${product}`;
      text = `🎉 Tudo certo, ${firstName}! Sua reserva está confirmada:\n📍 ${product}\n📅 ${period}\n💰 ${total}\n\nPerto da viagem enviaremos as orientações de embarque.\nAcompanhe em: ${link}\n\nBoa viagem! — RW Turismo`;
    } else {
      subject = `Pagamento não aprovado — ${product}`;
      text = `Olá, ${firstName}. O pagamento da sua reserva (${product} · ${period}) não foi aprovado. 😕\n\nSe a reserva ainda estiver no prazo, você pode tentar novamente:\n${link}\n\nPrecisa de ajuda? Responda esta mensagem. — RW Turismo`;
    }

    await deliver({
      event,
      // criado/confirmado: 1x por reserva; falha pode repetir (sem ref)
      ref: event === "payment_failed" ? null : `${event}:${booking.id}`,
      bookingId: booking.id,
      phone: booking.customer_phone,
      email: booking.customer_email,
      text,
      subject,
    });
  } catch (error) {
    console.error(`notifyBookingEvent(${event}) failed`, error);
  }
};

// ---------------------------------------------------------------------------
// Jobs diários (cron): aniversários, lembrete, embarque e pós-viagem.
// ---------------------------------------------------------------------------

const isoDatePlus = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

type JobSummary = Record<string, number>;

const confirmedBookingsForDates = async (
  dateIds: string[]
): Promise<BookingRow[]> => {
  if (dateIds.length === 0) return [];
  const { data } = await db()
    .from("bookings")
    .select(
      "id, customer_name, customer_email, customer_phone, travelers_count, total_amount, expires_at, products(title), product_dates(start_date, end_date)"
    )
    .in("product_date_id", dateIds)
    .eq("status", "confirmed");
  return (data ?? []) as BookingRow[];
};

const departuresStarting = async (dateIso: string) => {
  const { data } = await db()
    .from("product_dates")
    .select("id, start_date, end_date, products(title)")
    .eq("start_date", dateIso)
    .eq("active", true);
  return (data ?? []) as {
    id: string;
    start_date: string;
    end_date: string;
    products?: { title: string | null } | null;
  }[];
};

export const runDailyNotifications = async (): Promise<JobSummary> => {
  const summary: JobSummary = {
    birthdays: 0,
    trip_reminder: 0,
    boarding: 0,
    post_trip: 0,
  };
  const today = isoDatePlus(0);
  const [, month, day] = today.split("-");
  const year = today.slice(0, 4);

  // 1) Aniversariantes (passageiros + clientes), dedupe por telefone/e-mail.
  try {
    const [{ data: pax }, { data: clients }] = await Promise.all([
      db()
        .from("passengers")
        .select("full_name, birth_date, bookings(customer_phone, customer_email)")
        .not("birth_date", "is", null),
      db()
        .from("users_profiles")
        .select("name, phone, email, birth_date")
        .not("birth_date", "is", null),
    ]);

    const people: { name: string; phone: string | null; email: string | null }[] =
      [];
    for (const row of (pax ?? []) as any[]) {
      const [, m, d] = String(row.birth_date).split("-");
      if (m === month && d === day) {
        people.push({
          name: row.full_name,
          phone: row.bookings?.customer_phone ?? null,
          email: row.bookings?.customer_email ?? null,
        });
      }
    }
    for (const row of (clients ?? []) as any[]) {
      const [, m, d] = String(row.birth_date).split("-");
      if (m === month && d === day && row.name) {
        people.push({ name: row.name, phone: row.phone, email: row.email });
      }
    }

    const seen = new Set<string>();
    for (const person of people) {
      const key = (person.phone ?? person.email ?? person.name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const firstName = person.name.split(" ")[0];
      await deliver({
        event: "birthday",
        ref: `birthday:${year}:${key}`,
        phone: person.phone,
        email: person.email,
        subject: "Feliz aniversário! 🎂",
        text: `🎂 Feliz aniversário, ${firstName}!\n\nA equipe RW Turismo deseja um dia incrível pra você. E que tal comemorar planejando a próxima viagem? 😉\n${siteUrl()}/#pacotes\n\nUm abraço! — RW Turismo`,
      });
      summary.birthdays += 1;
    }
  } catch (error) {
    console.error("birthday job failed", error);
  }

  // 2) Lembrete: viagem em 3 dias.
  try {
    const departures = await departuresStarting(isoDatePlus(3));
    const bookings = await confirmedBookingsForDates(departures.map((d) => d.id));
    for (const booking of bookings) {
      const firstName = booking.customer_name.split(" ")[0];
      const product = booking.products?.title ?? "sua viagem";
      const start = booking.product_dates?.start_date;
      await deliver({
        event: "trip_reminder",
        ref: `trip_reminder:${booking.id}`,
        bookingId: booking.id,
        phone: booking.customer_phone,
        email: booking.customer_email,
        subject: `Sua viagem está chegando — ${product}`,
        text: `Olá, ${firstName}! 🎒\n\nFalta pouco: ${product} sai em ${
          start ? formatDateBR(start) : "breve"
        }.\n\nJá confira documentos e bagagem. Na véspera enviaremos o local e horário de embarque.\n\n— RW Turismo`,
      });
      summary.trip_reminder += 1;
    }
  } catch (error) {
    console.error("trip_reminder job failed", error);
  }

  // 3) Embarque: viagem amanhã (usa o primeiro transfer da saída, se houver).
  try {
    const departures = await departuresStarting(isoDatePlus(1));
    for (const departure of departures) {
      const { data: transfers } = await db()
        .from("transfers")
        .select("title, transfer_time, meeting_point, driver_name, vehicle")
        .eq("product_date_id", departure.id)
        .order("transfer_date", { ascending: true })
        .order("transfer_time", { ascending: true })
        .limit(1);
      const transfer = (transfers ?? [])[0] as
        | {
            title: string;
            transfer_time: string | null;
            meeting_point: string | null;
            driver_name: string | null;
            vehicle: string | null;
          }
        | undefined;

      const bookings = await confirmedBookingsForDates([departure.id]);
      for (const booking of bookings) {
        const firstName = booking.customer_name.split(" ")[0];
        const product = departure.products?.title ?? "sua viagem";
        const boardingLines = transfer
          ? [
              transfer.meeting_point
                ? `📍 Ponto de encontro: ${transfer.meeting_point}`
                : null,
              transfer.transfer_time
                ? `🕐 Horário: ${transfer.transfer_time.slice(0, 5)}`
                : null,
              transfer.vehicle ? `🚐 Veículo: ${transfer.vehicle}` : null,
              transfer.driver_name
                ? `🧑‍✈️ Motorista: ${transfer.driver_name}`
                : null,
            ]
              .filter(Boolean)
              .join("\n")
          : "Nossa equipe confirmará o ponto de encontro com você.";
        await deliver({
          event: "boarding",
          ref: `boarding:${booking.id}`,
          bookingId: booking.id,
          phone: booking.customer_phone,
          email: booking.customer_email,
          subject: `É amanhã! Embarque — ${product}`,
          text: `É amanhã, ${firstName}! 🚌\n\n${product}\n${boardingLines}\n\nChegue com 15 minutos de antecedência. Boa viagem!\n— RW Turismo`,
        });
        summary.boarding += 1;
      }
    }
  } catch (error) {
    console.error("boarding job failed", error);
  }

  // 4) Pós-viagem: terminou ontem — agradecimento + pesquisa.
  try {
    const { data: ended } = await db()
      .from("product_dates")
      .select("id, products(title)")
      .eq("end_date", isoDatePlus(-1))
      .eq("active", true);
    const dateIds = ((ended ?? []) as { id: string }[]).map((d) => d.id);
    const bookings = await confirmedBookingsForDates(dateIds);
    for (const booking of bookings) {
      const firstName = booking.customer_name.split(" ")[0];
      const product = booking.products?.title ?? "sua viagem";
      await deliver({
        event: "post_trip",
        ref: `post_trip:${booking.id}`,
        bookingId: booking.id,
        phone: booking.customer_phone,
        email: booking.customer_email,
        subject: `Como foi a viagem? — ${product}`,
        text: `Olá, ${firstName}! 💛\n\nObrigado por viajar com a RW Turismo (${product}).\n\nSua opinião vale ouro — avalie em 30 segundos:\n${siteUrl()}/avaliar/${booking.id}\n\nAté a próxima viagem!`,
      });
      summary.post_trip += 1;
    }
  } catch (error) {
    console.error("post_trip job failed", error);
  }

  return summary;
};
