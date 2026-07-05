import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import {
  getAdminBookings,
  type AdminBooking,
} from "../../../lib/admin/client";
import type { BookingStatus, PaymentStatus } from "../../../lib/bookings/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

const shortId = (id: string) => id.slice(0, 8);

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

const AdminBookings = () => {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "all">(
    "all"
  );
  const [error, setError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  const loadBookings = () => {
    setLoadStatus("loading");
    setError(null);
    getAdminBookings()
      .then((data) => {
        setBookings(data);
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

  useEffect(() => {
    loadBookings();
  }, []);

  const filteredBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        const statusMatches = status === "all" || booking.status === status;
        const paymentMatches =
          paymentStatus === "all" ||
          booking.payment_status === paymentStatus;

        return statusMatches && paymentMatches;
      }),
    [bookings, paymentStatus, status]
  );

  return (
    <AdminGuard>
      <AdminLayout
        title="Reservas"
        description="Acompanhe reservas internas, status de pagamento e prazos."
      >
        <div className="mb-4 flex flex-wrap gap-3 rounded-lg border bg-white p-4 shadow-sm">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-600">
              Status da reserva
            </span>
            <select
              className="rounded border px-3 py-2"
              onChange={(event) =>
                setStatus(event.target.value as BookingStatus | "all")
              }
              value={status}
            >
              {bookingStatuses.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "Todos" : item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-600">
              Status do pagamento
            </span>
            <select
              className="rounded border px-3 py-2"
              onChange={(event) =>
                setPaymentStatus(event.target.value as PaymentStatus | "all")
              }
              value={paymentStatus}
            >
              {paymentStatuses.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "Todos" : item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <AdminListState
          emptyTitle="Nenhuma reserva encontrada"
          error={error}
          isEmpty={filteredBookings.length === 0}
          onRetry={loadBookings}
          status={loadStatus}
        >
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Viajantes</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Reserva</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Expira</th>
                <th className="px-4 py-3">Criada</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredBookings.map((booking) => (
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
                    <p className="font-medium">{booking.customer_name}</p>
                    <p className="text-xs text-gray-500">
                      {booking.customer_email}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {booking.products?.title ?? booking.product_id}
                  </td>
                  <td className="px-4 py-3">
                    {booking.product_dates?.start_date} ate{" "}
                    {booking.product_dates?.end_date}
                  </td>
                  <td className="px-4 py-3">{booking.travelers_count}</td>
                  <td className="px-4 py-3">
                    {formatCurrency(booking.total_amount)}
                  </td>
                  <td className="px-4 py-3">{booking.status}</td>
                  <td className="px-4 py-3">{booking.payment_status}</td>
                  <td className="px-4 py-3">
                    {formatDateTime(booking.expires_at)}
                  </td>
                  <td className="px-4 py-3">
                    {formatDateTime(booking.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminBookings;
