import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import {
  getAdminPayments,
  type AdminPayment,
} from "../../../lib/admin/client";
import type { PaymentStatus } from "../../../lib/bookings/types";

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

const paymentStatuses: Array<PaymentStatus | "all"> = [
  "all",
  "pending",
  "paid",
  "failed",
  "refunded",
  "cancelled",
  "requires_review",
];

const AdminPayments = () => {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  const loadPayments = () => {
    setLoadStatus("loading");
    setError(null);
    getAdminPayments()
      .then((data) => {
        setPayments(data);
        setLoadStatus("ready");
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os pagamentos."
        );
        setLoadStatus("error");
      });
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) => status === "all" || payment.status === status),
    [payments, status]
  );

  return (
    <AdminGuard>
      <AdminLayout
        title="Pagamentos"
        description="Acompanhe pagamentos internos Stripe e revisoes manuais."
      >
        <div className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-600">
              Status do pagamento
            </span>
            <select
              className="rounded border px-3 py-2"
              onChange={(event) =>
                setStatus(event.target.value as PaymentStatus | "all")
              }
              value={status}
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
          emptyTitle="Nenhum pagamento encontrado"
          error={error}
          isEmpty={filteredPayments.length === 0}
          onRetry={loadPayments}
          status={loadStatus}
        >
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Checkout</th>
                <th className="px-4 py-3">Payment Intent</th>
                <th className="px-4 py-3">Pago em</th>
                <th className="px-4 py-3">Criado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPayments.map((payment) => (
                <tr
                  className={
                    payment.status === "requires_review" ? "bg-amber-50" : ""
                  }
                  key={payment.id}
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      className="font-semibold text-orange-600 hover:text-orange-700"
                      href={`/admin/payments/${payment.id}`}
                    >
                      {payment.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      className="font-semibold text-orange-600 hover:text-orange-700"
                      href={`/admin/bookings/${payment.booking_id}`}
                    >
                      {payment.booking_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {payment.bookings?.customer_name ?? "-"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {payment.bookings?.customer_email ?? "-"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {formatCurrency(payment.amount, payment.currency)}
                  </td>
                  <td className="px-4 py-3">{payment.status}</td>
                  <td className="px-4 py-3">{payment.provider}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {payment.stripe_checkout_session_id ?? "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {payment.stripe_payment_intent_id ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    {formatDateTime(payment.paid_at)}
                  </td>
                  <td className="px-4 py-3">
                    {formatDateTime(payment.created_at)}
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

export default AdminPayments;
