import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import StatusPill from "../../../components/StatusPill";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { Field, Input } from "../../../components/ui/form";
import {
  getAdminClient,
  listClientBookings,
  updateAdminClient,
  type AdminBooking,
  type AdminClient,
} from "../../../lib/admin/client";
import {
  bookingStatusBadge,
  paymentStatusBadge,
} from "../../../lib/bookings/status";
import { formatBRL, formatDateRangeBR } from "../../../lib/format";

const AdminClientDetail = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [client, setClient] = useState<AdminClient | null>(null);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [values, setValues] = useState({
    name: "",
    phone: "",
    birth_date: "",
    document: "",
  });
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    getAdminClient(id)
      .then(async (data) => {
        setClient(data);
        if (data) {
          setValues({
            name: data.name ?? "",
            phone: data.phone ?? "",
            birth_date: data.birth_date ?? "",
            document: data.document ?? "",
          });
          setBookings(await listClientBookings(data.user_id));
        }
        setLoadStatus("ready");
      })
      .catch(() => setLoadStatus("error"));
  }, [id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!client) return;
    setMessage(null);
    setIsSaving(true);
    try {
      const updated = await updateAdminClient(client.id, {
        name: values.name.trim() || null,
        phone: values.phone.trim() || null,
        birth_date: values.birth_date || null,
        document: values.document.trim() || null,
      });
      setClient(updated);
      setMessage({ tone: "ok", text: "Cliente salvo." });
    } catch (caught) {
      setMessage({
        tone: "error",
        text:
          caught instanceof Error
            ? caught.message
            : "Não foi possível salvar. A migration da Fase 1 já rodou no banco?",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminGuard>
      <AdminLayout title="Cliente" description="Dados e histórico de viagens.">
        <Link
          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
          href="/admin/clients"
        >
          ← Voltar para clientes
        </Link>

        {loadStatus === "loading" && (
          <p className="mt-6 text-gray-500">Carregando cliente…</p>
        )}
        {loadStatus === "error" && (
          <p className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-red-700">
            Não foi possível carregar o cliente.
          </p>
        )}
        {loadStatus === "ready" && !client && (
          <p className="mt-6 text-gray-500">Cliente não encontrado.</p>
        )}

        {client && (
          <div className="mt-5 grid gap-6 lg:grid-cols-[380px_1fr]">
            <Card className="h-fit p-5">
              <h2 className="font-semibold">Dados do cliente</h2>
              <p className="mt-1 text-sm text-gray-500">{client.email}</p>
              <form className="mt-4 space-y-4" onSubmit={submit}>
                <Field label="Nome">
                  <Input
                    onChange={(event) =>
                      setValues((v) => ({ ...v, name: event.target.value }))
                    }
                    value={values.name}
                  />
                </Field>
                <Field label="Telefone (WhatsApp)">
                  <Input
                    onChange={(event) =>
                      setValues((v) => ({ ...v, phone: event.target.value }))
                    }
                    placeholder="(86) 9…"
                    value={values.phone}
                  />
                </Field>
                <Field
                  hint="Alimenta o relatório de aniversariantes."
                  label="Data de nascimento"
                >
                  <Input
                    onChange={(event) =>
                      setValues((v) => ({
                        ...v,
                        birth_date: event.target.value,
                      }))
                    }
                    type="date"
                    value={values.birth_date}
                  />
                </Field>
                <Field label="Documento (CPF/RG)">
                  <Input
                    onChange={(event) =>
                      setValues((v) => ({
                        ...v,
                        document: event.target.value,
                      }))
                    }
                    value={values.document}
                  />
                </Field>
                {message && (
                  <p
                    className={`text-sm ${
                      message.tone === "ok"
                        ? "text-green-700"
                        : "text-red-600"
                    }`}
                    role="alert"
                  >
                    {message.text}
                  </p>
                )}
                <Button loading={isSaving} type="submit">
                  {isSaving ? "Salvando…" : "Salvar cliente"}
                </Button>
              </form>
            </Card>

            <div>
              <h2 className="font-semibold">
                Viagens ({bookings.length})
              </h2>
              {bookings.length === 0 ? (
                <Card className="mt-3 p-6 text-sm text-gray-500">
                  Este cliente ainda não tem reservas.
                </Card>
              ) : (
                <div className="mt-3 divide-y rounded-lg border bg-white shadow-sm">
                  {bookings.map((booking) => {
                    const bBadge = bookingStatusBadge(booking.status);
                    const pBadge = paymentStatusBadge(booking.payment_status);
                    return (
                      <Link
                        className="block p-4 hover:bg-gray-50"
                        href={`/admin/bookings/${booking.id}`}
                        key={booking.id}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">
                              {booking.products?.title ?? booking.product_id}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDateRangeBR(
                                booking.product_dates?.start_date,
                                booking.product_dates?.end_date
                              )}{" "}
                              · {booking.travelers_count} pax ·{" "}
                              {formatBRL(booking.total_amount)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <StatusPill label={bBadge.label} tone={bBadge.tone} />
                            <StatusPill label={pBadge.label} tone={pBadge.tone} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminClientDetail;
