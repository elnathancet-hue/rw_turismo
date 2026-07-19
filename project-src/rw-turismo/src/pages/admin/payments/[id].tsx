import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import {
  getAdminPaymentById,
  type AdminPaymentDetail,
} from "../../../lib/admin/client";

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

const Field = ({ label, value }: { label: string; value: string | number }) => (
  <div>
    <p className="text-xs uppercase text-gray-500">{label}</p>
    <p className="mt-1 break-words font-medium">{value}</p>
  </div>
);

const AdminPaymentDetailPage = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [payment, setPayment] = useState<AdminPaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    getAdminPaymentById(id)
      .then(setPayment)
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nao foi possivel carregar pagamento."
        )
      );
  }, [id]);

  return (
    <AdminGuard>
      <AdminLayout
        action={
          <Link
            className="rounded border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            href="/admin/payments"
          >
            Voltar
          </Link>
        }
        title="Detalhe do pagamento"
        description="Leitura operacional do pagamento interno Stripe."
      >
        {error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {!payment && !error && (
          <p className="text-sm text-gray-500">Carregando pagamento...</p>
        )}

        {payment && (
          <div className="space-y-6">
            {payment.status === "requires_review" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Este pagamento requer revisao manual. Reembolso e reconciliacao
                com Stripe ainda nao estao automatizados.
              </div>
            )}

            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Pagamento</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="ID" value={payment.id} />
                <Field
                  label="Valor"
                  value={formatCurrency(payment.amount, payment.currency)}
                />
                <Field label="Status" value={payment.status} />
                <Field label="Provider" value={payment.provider} />
                <Field label="Currency" value={payment.currency} />
                <Field label="Pago em" value={formatDateTime(payment.paid_at)} />
                <Field
                  label="Checkout Session"
                  value={payment.stripe_checkout_session_id ?? "-"}
                />
                <Field
                  label="Payment Intent"
                  value={payment.stripe_payment_intent_id ?? "-"}
                />
                <Field label="Criado em" value={formatDateTime(payment.created_at)} />
              </div>
            </section>

            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Reserva relacionada</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Booking ID" value={payment.booking_id} />
                <Field
                  label="Cliente"
                  value={payment.bookings?.customer_name ?? "-"}
                />
                <Field
                  label="Email"
                  value={payment.bookings?.customer_email ?? "-"}
                />
                <Field
                  label="Produto"
                  value={payment.bookings?.products?.title ?? "-"}
                />
                <Field
                  label="Status reserva"
                  value={payment.bookings?.status ?? "-"}
                />
                <Field
                  label="Status pagamento"
                  value={payment.bookings?.payment_status ?? "-"}
                />
              </div>
              <Link
                className="mt-4 inline-flex rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                href={`/admin/bookings/${payment.booking_id}`}
              >
                Abrir reserva
              </Link>
            </section>

            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Logs do pagamento</h2>
              <div className="mt-4 space-y-3">
                {payment.logs.map((log) => (
                  <div className="rounded border p-3 text-sm" key={log.id}>
                    <p className="font-medium">{log.action}</p>
                    <p className="text-gray-500">
                      {formatDateTime(log.created_at)}
                    </p>
                    <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                ))}
                {payment.logs.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Nenhum log direto do pagamento.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminPaymentDetailPage;
