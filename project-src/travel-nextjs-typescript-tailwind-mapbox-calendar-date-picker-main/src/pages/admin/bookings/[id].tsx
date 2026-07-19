import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import Button from "../../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../../components/ui/form";
import {
  getAdminBookingById,
  listAdminProductDates,
  type AdminBookingDetail,
  type ProductDateWithProduct,
} from "../../../lib/admin/client";
import { formatDateRangeBR } from "../../../lib/format";

const PAYMENT_METHODS: Array<{ value: string; label: string }> = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "stripe", label: "Cartão (Stripe)" },
  { value: "outro", label: "Outro" },
];

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

const todayISO = () => new Date().toISOString().slice(0, 10);

const Field2 = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div>
    <p className="text-xs uppercase text-gray-500">{label}</p>
    <p className="mt-1 break-words font-medium">{value}</p>
  </div>
);

const Modal = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    onClick={onClose}
  >
    <div
      className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <button
          aria-label="Fechar"
          className="text-gray-400 hover:text-gray-600"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  </div>
);

type ActiveModal = "payment" | "cancel" | "rebook" | null;

const AdminBookingDetailPage = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [booking, setBooking] = useState<AdminBookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dates, setDates] = useState<ProductDateWithProduct[]>([]);

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Confirmar pagamento
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("pix");
  const [payNotes, setPayNotes] = useState("");

  // Cancelar
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirmed, setCancelConfirmed] = useState(false);

  // Remarcar
  const [newDateId, setNewDateId] = useState("");

  const load = useCallback(() => {
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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    listAdminProductDates()
      .then(setDates)
      .catch(() => {
        /* datas para remarcação são opcionais na carga */
      });
  }, []);

  const rebookDates = useMemo(() => {
    if (!booking) return [];
    const today = todayISO();
    return dates.filter(
      (date) =>
        date.product_id === booking.product_id &&
        date.active &&
        date.start_date >= today &&
        date.id !== booking.product_date_id
    );
  }, [dates, booking]);

  const isClosed =
    booking?.status === "cancelled" || booking?.status === "expired";
  const isPaid = booking?.payment_status === "paid";

  const runAction = async (
    url: string,
    body: Record<string, unknown>,
    onDone: () => void
  ) => {
    setActionError(null);
    setActionSubmitting(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Não foi possível concluir a ação.");
      }
      onDone();
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha na operação.");
    } finally {
      setActionSubmitting(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setActionError(null);
    setCancelConfirmed(false);
  };

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
        description="Operação da reserva interna: pagamento manual, cancelamento e remarcação."
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

            {/* Ações operacionais */}
            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Ações</h2>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  disabled={isClosed || isPaid}
                  onClick={() => {
                    setPayAmount(String(booking.total_amount));
                    setPayMethod("pix");
                    setPayNotes("");
                    setActiveModal("payment");
                  }}
                  type="button"
                >
                  Confirmar pagamento manual
                </Button>
                <Button
                  disabled={isClosed}
                  onClick={() => {
                    setNewDateId("");
                    setActiveModal("rebook");
                  }}
                  type="button"
                  variant="secondary"
                >
                  Remarcar data
                </Button>
                <Button
                  disabled={isClosed}
                  onClick={() => {
                    setCancelReason("");
                    setCancelConfirmed(false);
                    setActiveModal("cancel");
                  }}
                  type="button"
                  variant="danger"
                >
                  Cancelar reserva
                </Button>
                <a
                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  href={`/api/bookings/${booking.id}/voucher`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Baixar voucher
                </a>
              </div>
              {isClosed && (
                <p className="mt-3 text-sm text-gray-500">
                  Reserva {booking.status === "cancelled" ? "cancelada" : "expirada"} —
                  ações indisponíveis.
                </p>
              )}
              {isPaid && !isClosed && (
                <p className="mt-3 text-sm text-gray-500">
                  Pagamento já confirmado.
                </p>
              )}
            </section>

            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Reserva</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field2 label="ID" value={booking.id} />
                <Field2
                  label="Origem"
                  value={booking.source === "manual" ? "Manual" : "Site"}
                />
                <Field2 label="Cliente" value={booking.customer_name} />
                <Field2 label="Email" value={booking.customer_email} />
                <Field2 label="Telefone" value={booking.customer_phone ?? "-"} />
                <Field2 label="Viajantes" value={booking.travelers_count} />
                <Field2
                  label="Total"
                  value={formatCurrency(booking.total_amount)}
                />
                <Field2 label="Status" value={booking.status} />
                <Field2 label="Pagamento" value={booking.payment_status} />
                <Field2
                  label="Vagas liberadas"
                  value={booking.slots_released ? "Sim" : "Nao"}
                />
                <Field2
                  label="Expira em"
                  value={formatDateTime(booking.expires_at)}
                />
                <Field2
                  label="Confirmada em"
                  value={formatDateTime(booking.confirmed_at)}
                />
                <Field2
                  label="Criada em"
                  value={formatDateTime(booking.created_at)}
                />
              </div>
            </section>

            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Produto e data</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field2
                  label="Produto"
                  value={booking.products?.title ?? booking.product_id}
                />
                <Field2
                  label="Destino"
                  value={booking.products?.destination ?? "-"}
                />
                <Field2
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
                      <th className="px-3 py-2">Método</th>
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
                        <td className="px-3 py-2">
                          {payment.method ?? payment.provider}
                        </td>
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

        {/* Modal: confirmar pagamento manual */}
        {activeModal === "payment" && booking && (
          <Modal title="Confirmar pagamento manual" onClose={closeModal}>
            <div className="space-y-3">
              <Field label="Método">
                <Select
                  onChange={(e) => setPayMethod(e.target.value)}
                  value={payMethod}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Valor recebido" hint="Padrão: total da reserva.">
                <Input
                  min={0}
                  onChange={(e) => setPayAmount(e.target.value)}
                  step="0.01"
                  type="number"
                  value={payAmount}
                />
              </Field>
              <Field label="Observação">
                <Textarea
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                  value={payNotes}
                />
              </Field>
              {actionError && (
                <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                  {actionError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button onClick={closeModal} type="button" variant="secondary">
                  Cancelar
                </Button>
                <Button
                  loading={actionSubmitting}
                  onClick={() =>
                    runAction(
                      `/api/admin/bookings/${booking.id}/confirm-payment`,
                      {
                        amount: payAmount === "" ? null : Number(payAmount),
                        method: payMethod,
                        notes: payNotes || null,
                      },
                      closeModal
                    )
                  }
                  type="button"
                >
                  Confirmar pagamento
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal: remarcar */}
        {activeModal === "rebook" && booking && (
          <Modal title="Remarcar data" onClose={closeModal}>
            <div className="space-y-3">
              <Field
                label="Nova data"
                hint={
                  rebookDates.length === 0
                    ? "Nenhuma outra data futura com vagas para este produto."
                    : "As vagas da data atual são devolvidas automaticamente."
                }
              >
                <Select
                  onChange={(e) => setNewDateId(e.target.value)}
                  value={newDateId}
                >
                  <option value="">Selecione…</option>
                  {rebookDates.map((date) => (
                    <option key={date.id} value={date.id}>
                      {formatDateRangeBR(date.start_date, date.end_date)} ·{" "}
                      {date.available_slots} vaga(s)
                    </option>
                  ))}
                </Select>
              </Field>
              {actionError && (
                <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                  {actionError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button onClick={closeModal} type="button" variant="secondary">
                  Cancelar
                </Button>
                <Button
                  disabled={!newDateId}
                  loading={actionSubmitting}
                  onClick={() =>
                    runAction(
                      `/api/admin/bookings/${booking.id}/rebook`,
                      { new_product_date_id: newDateId },
                      closeModal
                    )
                  }
                  type="button"
                >
                  Remarcar
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal: cancelar */}
        {activeModal === "cancel" && booking && (
          <Modal title="Cancelar reserva" onClose={closeModal}>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                As vagas serão devolvidas à data.{" "}
                {isPaid && "A reserva está paga — marque o reembolso por fora."}
              </p>
              <Field label="Motivo">
                <Textarea
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex.: cliente desistiu"
                  rows={2}
                  value={cancelReason}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  checked={cancelConfirmed}
                  onChange={(e) => setCancelConfirmed(e.target.checked)}
                  type="checkbox"
                />
                Confirmo o cancelamento desta reserva.
              </label>
              {actionError && (
                <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                  {actionError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button onClick={closeModal} type="button" variant="secondary">
                  Voltar
                </Button>
                <Button
                  disabled={!cancelConfirmed}
                  loading={actionSubmitting}
                  onClick={() =>
                    runAction(
                      `/api/admin/bookings/${booking.id}/cancel`,
                      { reason: cancelReason || null },
                      closeModal
                    )
                  }
                  type="button"
                  variant="danger"
                >
                  Cancelar reserva
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminBookingDetailPage;
