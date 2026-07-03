import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import {
  getAdminBookingById,
  type AdminBookingDetail,
} from "../../../lib/admin/client";

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

const Field = ({ label, value }: { label: string; value: string | number }) => (
  <div>
    <p className="text-xs uppercase text-gray-500">{label}</p>
    <p className="mt-1 break-words font-medium">{value}</p>
  </div>
);

const AdminBookingDetailPage = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [booking, setBooking] = useState<AdminBookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    getAdminBookingById(id)
      .then(setBooking)
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nao foi possivel carregar reserva."
        )
      );
  }, [id]);

  return (
    <AdminGuard>
      <AdminLayout
        action={
          <Link
            className="rounded border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            href="/admin/bookings"
          >
            Voltar
          </Link>
        }
        title="Detalhe da reserva"
        description="Leitura operacional da reserva interna e seus eventos."
      >
        {error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {!booking && !error && (
          <p className="text-sm text-gray-500">Carregando reserva...</p>
        )}

        {booking && (
          <div className="space-y-6">
            {booking.payment_status === "requires_review" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Esta reserva requer revisao manual. Nao marque pagamento como
                pago sem reconciliar com Stripe.
              </div>
            )}

            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Reserva</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="ID" value={booking.id} />
                <Field label="Cliente" value={booking.customer_name} />
                <Field label="Email" value={booking.customer_email} />
                <Field label="Telefone" value={booking.customer_phone ?? "-"} />
                <Field label="Viajantes" value={booking.travelers_count} />
                <Field
                  label="Total"
                  value={formatCurrency(booking.total_amount)}
                />
                <Field label="Status" value={booking.status} />
                <Field
                  label="Pagamento"
                  value={booking.payment_status}
                />
                <Field
                  label="Vagas liberadas"
                  value={booking.slots_released ? "Sim" : "Nao"}
                />
                <Field label="Expira em" value={formatDateTime(booking.expires_at)} />
                <Field
                  label="Confirmada em"
                  value={formatDateTime(booking.confirmed_at)}
                />
                <Field label="Criada em" value={formatDateTime(booking.created_at)} />
              </div>
            </section>

            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Produto e data</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field
                  label="Produto"
                  value={booking.products?.title ?? booking.product_id}
                />
                <Field
                  label="Destino"
                  value={booking.products?.destination ?? "-"}
                />
                <Field
                  label="Periodo"
                  value={`${booking.product_dates?.start_date ?? "-"} ate ${
                    booking.product_dates?.end_date ?? "-"
                  }`}
                />
              </div>
            </section>

            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Pagamentos</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Provider</th>
                      <th className="px-3 py-2">Pago em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {booking.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-3 py-2 font-mono text-xs">
                          <Link
                            className="font-semibold text-orange-600"
                            href={`/admin/payments/${payment.id}`}
                          >
                            {payment.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-3 py-2">{payment.status}</td>
                        <td className="px-3 py-2">{payment.provider}</td>
                        <td className="px-3 py-2">
                          {formatDateTime(payment.paid_at)}
                        </td>
                      </tr>
                    ))}
                    {booking.payments.length === 0 && (
                      <tr>
                        <td className="px-3 py-3 text-gray-500" colSpan={5}>
                          Nenhum pagamento relacionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Passageiros</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {booking.passengers.map((passenger) => (
                  <div className="rounded border p-3" key={passenger.id}>
                    <p className="font-medium">{passenger.full_name}</p>
                    <p className="text-sm text-gray-500">{passenger.type}</p>
                    <p className="text-sm text-gray-500">
                      Documento: {passenger.document ?? "-"}
                    </p>
                  </div>
                ))}
                {booking.passengers.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Nenhum passageiro cadastrado.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Timeline operacional</h2>
              <div className="mt-4 space-y-3">
                {booking.logs.map((log) => (
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
                {booking.logs.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Nenhum log direto da reserva.
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

export default AdminBookingDetailPage;
