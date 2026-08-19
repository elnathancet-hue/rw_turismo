import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useRef, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import StatusPill from "../../../components/StatusPill";
import Button from "../../../components/ui/Button";
import { Input, Select } from "../../../components/ui/form";
import {
  searchAdminBookings,
  type AdminBooking,
} from "../../../lib/admin/client";
import {
  bookingStatusBadge,
  paymentStatusBadge,
} from "../../../lib/bookings/status";
import type { BookingStatus, PaymentStatus } from "../../../lib/bookings/types";
import {
  formatBRL,
  formatDateRangeBR,
  formatDateTimeBR,
} from "../../../lib/format";

const PAGE_SIZE = 25;

const bookingStatuses: Array<BookingStatus | "all"> = [
  "all",
  "pending",
  "confirmed",
  "expired",
  "cancelled",
];

const paymentStatuses: Array<PaymentStatus | "all"> = [
  "all",
  "pending",
  "paid",
  "failed",
  "refunded",
  "cancelled",
  "requires_review",
];

const shortId = (id: string) => id.slice(0, 8);

const AdminBookings = () => {
  const router = useRouter();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "all">(
    "all"
  );
  const [source, setSource] = useState<"site" | "manual" | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  // Só busca depois de saber se a URL traz filtro: sem isto a lista carregava
  // uma vez sem filtro e outra com, piscando o resultado errado no meio.
  const [filtersReady, setFiltersReady] = useState(false);
  // Último status que veio da URL e já foi aplicado. É um ref e não um booleano
  // "já rodei" porque as duas coisas precisam continuar valendo: a URL manda
  // quando MUDA, e a escolha feita no seletor da tela sobrevive quando ela não
  // muda. Com um booleano, sair de ?status=expired para /admin/bookings deixava
  // a tela travada no filtro antigo, discordando da URL.
  const appliedUrlStatus = useRef<string | null>(null);

  const load = () => {
    setLoadStatus("loading");
    setError(null);
    searchAdminBookings({
      status,
      paymentStatus,
      source,
      search: appliedSearch,
      page,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        setBookings(result.bookings);
        setCount(result.count);
        setLoadStatus("ready");
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar as reservas."
        );
        setLoadStatus("error");
      });
  };

  // Permite chegar da dashboard já filtrado (/admin/bookings?status=expired).
  // No Pages Router router.query só fica preenchido depois do isReady, por isso
  // isto é um efeito e não um valor inicial do useState.
  //
  // Reage à MUDANÇA da URL, não à primeira execução: /admin/bookings e
  // /admin/bookings?status=expired são a mesma página, e trocar entre elas não
  // remonta o componente (o _app.tsx renderiza <Component /> sem key). Sem
  // comparar com o último valor aplicado, clicar em "Reservas" na lateral
  // deixava a lista presa no filtro anterior, sem nem refazer a busca.
  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.status;
    const fromUrl =
      typeof raw === "string" && (bookingStatuses as string[]).includes(raw)
        ? raw
        : "all";

    if (appliedUrlStatus.current !== fromUrl) {
      appliedUrlStatus.current = fromUrl;
      setStatus(fromUrl as BookingStatus | "all");
      setPage(1);
    }
    setFiltersReady(true);
  }, [router.isReady, router.query.status]);

  useEffect(() => {
    if (!filtersReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersReady, status, paymentStatus, source, appliedSearch, page]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput);
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <AdminGuard>
      <AdminLayout
        title="Reservas"
        description="Acompanhe reservas internas, status de pagamento e prazos."
        action={
          <Link
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            href="/admin/bookings/new"
          >
            + Nova reserva
          </Link>
        }
      >
        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 shadow-sm"
          onSubmit={submitSearch}
        >
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-600">
              Status da reserva
            </span>
            <Select
              className="mt-0 w-44"
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value as BookingStatus | "all");
              }}
              value={status}
            >
              {bookingStatuses.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "Todos" : bookingStatusBadge(item).label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-600">
              Status do pagamento
            </span>
            <Select
              className="mt-0 w-48"
              onChange={(event) => {
                setPage(1);
                setPaymentStatus(event.target.value as PaymentStatus | "all");
              }}
              value={paymentStatus}
            >
              {paymentStatuses.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "Todos" : paymentStatusBadge(item).label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-600">
              Origem
            </span>
            <Select
              className="mt-0 w-36"
              onChange={(event) => {
                setPage(1);
                setSource(event.target.value as "site" | "manual" | "all");
              }}
              value={source}
            >
              <option value="all">Todas</option>
              <option value="site">Site</option>
              <option value="manual">Manual</option>
            </Select>
          </label>
          <label className="min-w-[220px] flex-1 text-sm">
            <span className="mb-1 block font-medium text-gray-600">
              Buscar cliente
            </span>
            <Input
              className="mt-0"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nome ou e-mail…"
              type="search"
              value={searchInput}
            />
          </label>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>

        <AdminListState
          emptyTitle="Nenhuma reserva encontrada"
          error={error}
          isEmpty={bookings.length === 0}
          onRetry={load}
          status={loadStatus}
        >
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Viajantes</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Reserva</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">Criada</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bookings.map((booking) => {
                  const bookingBadge = bookingStatusBadge(booking.status);
                  const paymentBadge = paymentStatusBadge(
                    booking.payment_status
                  );
                  return (
                    <tr key={booking.id}>
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link
                          className="font-semibold text-orange-600 hover:text-orange-700"
                          href={`/admin/bookings/${booking.id}`}
                        >
                          {shortId(booking.id)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {booking.customer_name}
                          {booking.source === "manual" && (
                            <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-700">
                              Manual
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {booking.customer_email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {booking.products?.title ?? booking.product_id}
                      </td>
                      <td className="px-4 py-3">
                        {formatDateRangeBR(
                          booking.product_dates?.start_date,
                          booking.product_dates?.end_date
                        )}
                      </td>
                      <td className="px-4 py-3">{booking.travelers_count}</td>
                      <td className="px-4 py-3">
                        {formatBRL(booking.total_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill
                          label={bookingBadge.label}
                          tone={bookingBadge.tone}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill
                          label={paymentBadge.label}
                          tone={paymentBadge.tone}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {formatDateTimeBR(booking.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Página {page} de {totalPages} · {count}{" "}
              {count === 1 ? "reserva" : "reservas"}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                size="sm"
                type="button"
                variant="secondary"
              >
                ‹ Anterior
              </Button>
              <Button
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                size="sm"
                type="button"
                variant="secondary"
              >
                Próxima ›
              </Button>
            </div>
          </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminBookings;
