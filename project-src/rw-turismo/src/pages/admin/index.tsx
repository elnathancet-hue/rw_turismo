import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import StatusPill from "../../components/StatusPill";
import Card from "../../components/ui/Card";
import {
  getDepartureBookingTotals,
  listAdminDepartures,
  listAdminWaitlist,
  listBirthdayPeople,
  searchAdminBookings,
  type AdminBooking,
  type AdminDeparture,
  type BirthdayPerson,
} from "../../lib/admin/client";
import { getCrmStages, listLeads } from "../../lib/admin/crm";
import { getFinanceSummary, type FinanceSummary } from "../../lib/admin/finance";
import {
  bookingStatusBadge,
  paymentStatusBadge,
} from "../../lib/bookings/status";
import { formatBRL, formatDateRangeBR, formatDateTimeBR } from "../../lib/format";

const currentMonth = () => new Date().toISOString().slice(0, 7);

const toWhatsAppLink = (phone: string | null): string | null => {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
};

const Kpi = ({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
  href: string;
}) => (
  <Link href={href}>
    <Card className="h-full p-4 transition hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${
          tone === "good"
            ? "text-green-700"
            : tone === "warn"
              ? "text-amber-700"
              : tone === "bad"
                ? "text-red-600"
                : ""
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </Card>
  </Link>
);

const quickActions = [
  { label: "+ Produto", href: "/admin/products/new" },
  { label: "+ Data de saída", href: "/admin/product-dates/new" },
  { label: "+ Página", href: "/admin/pages/new" },
  { label: "+ Post no blog", href: "/admin/blog/new" },
  { label: "+ Despesa", href: "/admin/finance/expenses" },
  { label: "Abrir CRM", href: "/admin/crm" },
];

const AdminDashboard = () => {
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [recentBookings, setRecentBookings] = useState<AdminBooking[]>([]);
  const [bookingsCount, setBookingsCount] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [departures, setDepartures] = useState<AdminDeparture[]>([]);
  const [paxTotals, setPaxTotals] = useState<Record<string, number>>({});
  const [birthdaysToday, setBirthdaysToday] = useState<BirthdayPerson[]>([]);
  const [leadsOpen, setLeadsOpen] = useState<number | null>(null);
  const [waitlistPending, setWaitlistPending] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(5, 10); // "MM-DD"

    // Cada bloco carrega de forma independente — módulo sem migration só
    // fica de fora, sem derrubar o dashboard.
    const jobs: Promise<unknown>[] = [
      getFinanceSummary(currentMonth())
        .then(setFinance)
        .catch(() => {}),
      searchAdminBookings({ page: 1, limit: 5 })
        .then((result) => {
          setRecentBookings(result.bookings);
          setBookingsCount(result.count);
        })
        .catch(() => {}),
      searchAdminBookings({ paymentStatus: "requires_review", limit: 1 })
        .then((result) => setReviewCount(result.count))
        .catch(() => {}),
      Promise.all([listAdminDepartures(false), getDepartureBookingTotals()])
        .then(([dates, totals]) => {
          setDepartures(dates.slice(0, 3));
          setPaxTotals(totals);
        })
        .catch(() => {}),
      listBirthdayPeople()
        .then((people) =>
          setBirthdaysToday(
            people.filter((p) => p.birth_date.slice(5, 10) === today)
          )
        )
        .catch(() => {}),
      Promise.all([listLeads(), getCrmStages()])
        .then(([leads, stages]) => {
          const closed = new Set(
            stages
              .filter((s) => /ganhou|perdeu|won|lost/i.test(s.label + s.id))
              .map((s) => s.id)
          );
          setLeadsOpen(leads.filter((l) => !closed.has(l.stage_id)).length);
        })
        .catch(() => {}),
      listAdminWaitlist("pending")
        .then((entries) => setWaitlistPending(entries.length))
        .catch(() => {}),
    ];

    Promise.allSettled(jobs).then(() => setIsLoading(false));
  }, []);

  return (
    <AdminGuard>
      <AdminLayout
        title="Dashboard"
        description="O dia da operação num olhar só."
      >
        {reviewCount > 0 && (
          <Link href="/admin/bookings">
            <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-800 hover:bg-amber-100">
              ⚠️ {reviewCount}{" "}
              {reviewCount === 1
                ? "pagamento precisa de revisão"
                : "pagamentos precisam de revisão"}{" "}
              — clique para abrir as reservas.
            </p>
          </Link>
        )}

        {isLoading ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                className="h-24 animate-pulse rounded-lg border bg-white"
                key={index}
              />
            ))}
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Kpi
              href="/admin/finance"
              hint={
                finance
                  ? `manual: ${formatBRL(finance.manualReceived)}`
                  : "rode as migrations para ativar"
              }
              label="Recebido no mês"
              tone="good"
              value={finance ? formatBRL(finance.totalReceived) : "—"}
            />
            <Kpi
              href="/admin/finance/receivables"
              hint={
                finance && finance.overdueReceivables > 0
                  ? `${formatBRL(finance.overdueReceivables)} vencido!`
                  : "nada vencido"
              }
              label="A receber"
              tone={
                finance && finance.overdueReceivables > 0 ? "bad" : "warn"
              }
              value={finance ? formatBRL(finance.openReceivables) : "—"}
            />
            <Kpi
              href="/admin/crm"
              hint="leads em negociação"
              label="CRM — no funil"
              value={leadsOpen === null ? "—" : String(leadsOpen)}
            />
            <Kpi
              href="/admin/waitlist"
              hint={
                waitlistPending
                  ? "interessados aguardando vaga"
                  : "ninguém aguardando"
              }
              label="Lista de espera"
              tone={waitlistPending ? "warn" : "default"}
              value={waitlistPending === null ? "—" : String(waitlistPending)}
            />
          </section>
        )}

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Próximas saídas */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Próximas saídas</h2>
              <Link
                className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                href="/admin/departures"
              >
                Ver todas →
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {departures.length === 0 && (
                <Card className="p-6 text-sm text-gray-500">
                  Nenhuma saída futura. Cadastre datas em Catálogo → Datas.
                </Card>
              )}
              {departures.map((departure) => (
                <Link
                  href={`/admin/departures/${departure.id}`}
                  key={departure.id}
                >
                  <Card className="mb-2 flex items-center justify-between gap-3 p-4 transition hover:shadow-md">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {departure.products?.title ?? "Saída"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDateRangeBR(
                          departure.start_date,
                          departure.end_date
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold">
                        {paxTotals[departure.id] ?? 0}{" "}
                        <span className="text-xs font-normal text-gray-500">
                          pax
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {departure.available_slots} vagas livres
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Últimas reservas */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                Últimas reservas
                {bookingsCount !== null && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {bookingsCount} no total
                  </span>
                )}
              </h2>
              <Link
                className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                href="/admin/bookings"
              >
                Ver todas →
              </Link>
            </div>
            <div className="mt-3 divide-y rounded-lg border bg-white shadow-sm">
              {recentBookings.length === 0 && (
                <p className="p-6 text-sm text-gray-500">
                  Nenhuma reserva ainda.
                </p>
              )}
              {recentBookings.map((booking) => {
                const pBadge = paymentStatusBadge(booking.payment_status);
                const bBadge = bookingStatusBadge(booking.status);
                return (
                  <Link
                    className="block p-3 hover:bg-gray-50"
                    href={`/admin/bookings/${booking.id}`}
                    key={booking.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {booking.customer_name}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {booking.products?.title ?? ""} ·{" "}
                          {formatDateTimeBR(booking.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold">
                          {formatBRL(booking.total_amount)}
                        </span>
                        <StatusPill label={bBadge.label} tone={bBadge.tone} />
                        <StatusPill label={pBadge.label} tone={pBadge.tone} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Aniversariantes de hoje */}
        {birthdaysToday.length > 0 && (
          <section className="mt-6">
            <Card className="border-pink-200 bg-pink-50/50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-semibold">🎂 Aniversariantes de hoje:</p>
                {birthdaysToday.map((person, index) => {
                  const wa = toWhatsAppLink(person.phone);
                  return wa ? (
                    <a
                      className="rounded-full border border-pink-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:border-green-300 hover:text-green-700"
                      href={wa}
                      key={`${person.name}-${index}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {person.name} · WhatsApp →
                    </a>
                  ) : (
                    <span
                      className="rounded-full border border-pink-200 bg-white px-3 py-1 text-sm font-medium text-gray-700"
                      key={`${person.name}-${index}`}
                    >
                      {person.name}
                    </span>
                  );
                })}
                <Link
                  className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                  href="/admin/birthdays"
                >
                  Ver o mês →
                </Link>
              </div>
            </Card>
          </section>
        )}

        {/* Ações rápidas */}
        <section className="mt-6">
          <h2 className="font-semibold">Ações rápidas</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickActions.map((actionItem) => (
              <Link
                className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-orange-400 hover:text-orange-700"
                href={actionItem.href}
                key={actionItem.href}
              >
                {actionItem.label}
              </Link>
            ))}
          </div>
        </section>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminDashboard;
