import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import Button from "../../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../../components/ui/form";
import {
  listAdminProducts,
  listAdminProductDates,
  searchAdminClients,
  type AdminClient,
  type ProductDateWithProduct,
} from "../../../lib/admin/client";
import type { Product } from "../../../lib/products/types";
import { formatBRL, formatDateRangeBR } from "../../../lib/format";

type PassengerRow = {
  full_name: string;
  type: "adult" | "child" | "infant";
  document: string;
  birth_date: string;
};

const PAYMENT_METHODS: Array<{ value: string; label: string }> = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "stripe", label: "Cartão (Stripe)" },
  { value: "outro", label: "Outro" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyPassenger = (): PassengerRow => ({
  full_name: "",
  type: "adult",
  document: "",
  birth_date: "",
});

const NewManualBooking = () => {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [dates, setDates] = useState<ProductDateWithProduct[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Cliente
  const [customerUserId, setCustomerUserId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<AdminClient[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);

  // Reserva
  const [productId, setProductId] = useState("");
  const [productDateId, setProductDateId] = useState("");
  const [travelers, setTravelers] = useState(1);
  const [status, setStatus] = useState<"confirmed" | "pending">("confirmed");
  const [overrideTotal, setOverrideTotal] = useState("");
  const [passengers, setPassengers] = useState<PassengerRow[]>([]);

  // Pagamento agora (opcional)
  const [registerPayment, setRegisterPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Submissão
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listAdminProducts(), listAdminProductDates()])
      .then(([productsData, datesData]) => {
        setProducts(productsData.filter((p) => p.active));
        setDates(datesData);
      })
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : "Falha ao carregar dados."
        )
      );
  }, []);

  const availableDates = useMemo(() => {
    const today = todayISO();
    return dates.filter(
      (d) => d.product_id === productId && d.active && d.start_date >= today
    );
  }, [dates, productId]);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const selectedDate =
    availableDates.find((d) => d.id === productDateId) ?? null;

  const unitPrice = selectedDate
    ? selectedDate.price_override ??
      selectedProduct?.promotional_price ??
      selectedProduct?.price ??
      0
    : selectedProduct?.promotional_price ?? selectedProduct?.price ?? 0;

  const suggestedTotal = unitPrice * (travelers || 0);

  const searchClients = async () => {
    if (!clientQuery.trim()) return;
    setSearchingClients(true);
    try {
      const { clients } = await searchAdminClients({
        search: clientQuery,
        limit: 8,
      });
      setClientResults(clients);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao buscar clientes."
      );
    } finally {
      setSearchingClients(false);
    }
  };

  const selectClient = (client: AdminClient) => {
    setCustomerUserId(client.user_id);
    setCustomerName(client.name ?? "");
    setCustomerEmail(client.email ?? "");
    setCustomerPhone(client.phone ?? "");
    setClientResults([]);
    setClientQuery("");
  };

  const clearClient = () => {
    setCustomerUserId(null);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
  };

  const updatePassenger = (
    index: number,
    patch: Partial<PassengerRow>
  ) => {
    setPassengers((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const canSubmit =
    Boolean(productId) &&
    Boolean(productDateId) &&
    customerName.trim().length > 0 &&
    customerEmail.trim().length > 0 &&
    travelers > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let bookingId = createdBookingId;

      if (!bookingId) {
        const response = await fetch("/api/admin/bookings/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_user_id: customerUserId,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone || null,
            product_id: productId,
            product_date_id: productDateId,
            travelers_count: travelers,
            status,
            total_override: overrideTotal === "" ? null : Number(overrideTotal),
            passengers: passengers
              .filter((p) => p.full_name.trim())
              .map((p) => ({
                full_name: p.full_name,
                type: p.type,
                document: p.document || null,
                birth_date: p.birth_date || null,
              })),
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Não foi possível criar a reserva.");
        }
        bookingId = data.booking_id as string;
        setCreatedBookingId(bookingId);
      }

      if (registerPayment && bookingId) {
        const payResponse = await fetch(
          `/api/admin/bookings/${bookingId}/confirm-payment`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: paymentAmount === "" ? null : Number(paymentAmount),
              method: paymentMethod,
              notes: paymentNotes || null,
            }),
          }
        );
        const payData = await payResponse.json();
        if (!payResponse.ok) {
          throw new Error(
            payData?.error ??
              "Reserva criada, mas não foi possível confirmar o pagamento."
          );
        }
      }

      router.push(`/admin/bookings/${bookingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Nova reserva manual"
        description="Lance uma venda por WhatsApp/telefone e receba por PIX, boleto ou dinheiro."
        action={
          <button
            className="rounded border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            onClick={() => router.push("/admin/bookings")}
            type="button"
          >
            Voltar
          </button>
        }
      >
        {loadError && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {loadError}
          </p>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Cliente */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Cliente</h2>
            <p className="mt-1 text-sm text-gray-500">
              Busque um cliente existente ou preencha os dados — uma conta é
              criada automaticamente para a reserva aparecer em “Minhas
              reservas”.
            </p>

            {customerUserId ? (
              <div className="mt-3 flex items-center justify-between rounded border border-green-200 bg-green-50 px-3 py-2 text-sm">
                <span>
                  Cliente vinculado:{" "}
                  <strong>{customerName || customerEmail}</strong>
                </span>
                <button
                  className="text-xs font-semibold text-gray-600 underline"
                  onClick={clearClient}
                  type="button"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Field label="Buscar cliente cadastrado">
                  <Input
                    onChange={(e) => setClientQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        searchClients();
                      }
                    }}
                    placeholder="Nome ou e-mail…"
                    value={clientQuery}
                  />
                </Field>
                <Button
                  loading={searchingClients}
                  onClick={searchClients}
                  type="button"
                  variant="secondary"
                >
                  Buscar
                </Button>
              </div>
            )}

            {clientResults.length > 0 && (
              <ul className="mt-2 divide-y rounded border">
                {clientResults.map((client) => (
                  <li key={client.id}>
                    <button
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => selectClient(client)}
                      type="button"
                    >
                      <span className="font-medium">
                        {client.name ?? "(sem nome)"}
                      </span>
                      <span className="text-gray-500">{client.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Nome *">
                <Input
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  value={customerName}
                />
              </Field>
              <Field label="E-mail *">
                <Input
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                  type="email"
                  value={customerEmail}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+55 11 90000-0000"
                  value={customerPhone}
                />
              </Field>
            </div>
          </section>

          {/* Produto e data */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Produto e data</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Produto *">
                <Select
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setProductDateId("");
                  }}
                  required
                  value={productId}
                >
                  <option value="">Selecione…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Data / saída *"
                hint={
                  productId && availableDates.length === 0
                    ? "Nenhuma data futura com vagas para este produto."
                    : undefined
                }
              >
                <Select
                  disabled={!productId}
                  onChange={(e) => setProductDateId(e.target.value)}
                  required
                  value={productDateId}
                >
                  <option value="">Selecione…</option>
                  {availableDates.map((date) => (
                    <option key={date.id} value={date.id}>
                      {formatDateRangeBR(date.start_date, date.end_date)} ·{" "}
                      {date.available_slots} vaga(s)
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Nº de viajantes *"
                hint={
                  selectedDate
                    ? `${selectedDate.available_slots} vaga(s) disponível(is)`
                    : undefined
                }
              >
                <Input
                  min={1}
                  onChange={(e) =>
                    setTravelers(Math.max(1, Number(e.target.value)))
                  }
                  type="number"
                  value={travelers}
                />
              </Field>
              <Field label="Status inicial">
                <Select
                  onChange={(e) =>
                    setStatus(e.target.value as "confirmed" | "pending")
                  }
                  value={status}
                >
                  <option value="confirmed">Confirmada (segura a vaga)</option>
                  <option value="pending">
                    Pendente (aguardando pagamento)
                  </option>
                </Select>
              </Field>
              <Field
                label="Valor total (opcional)"
                hint={
                  selectedProduct
                    ? `Sugerido: ${formatBRL(suggestedTotal)} — deixe em branco para usar o preço do produto.`
                    : "Deixe em branco para usar o preço do produto."
                }
              >
                <Input
                  min={0}
                  onChange={(e) => setOverrideTotal(e.target.value)}
                  placeholder="Preço negociado…"
                  step="0.01"
                  type="number"
                  value={overrideTotal}
                />
              </Field>
            </div>
          </section>

          {/* Passageiros */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Passageiros (opcional)</h2>
              <Button
                onClick={() =>
                  setPassengers((rows) => [...rows, emptyPassenger()])
                }
                size="sm"
                type="button"
                variant="secondary"
              >
                + Adicionar
              </Button>
            </div>
            {passengers.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">
                Nenhum passageiro adicionado.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {passengers.map((passenger, index) => (
                  <div
                    className="grid gap-3 rounded border p-3 md:grid-cols-[2fr,1fr,1fr,1fr,auto]"
                    key={index}
                  >
                    <Field label="Nome completo">
                      <Input
                        onChange={(e) =>
                          updatePassenger(index, { full_name: e.target.value })
                        }
                        value={passenger.full_name}
                      />
                    </Field>
                    <Field label="Tipo">
                      <Select
                        onChange={(e) =>
                          updatePassenger(index, {
                            type: e.target.value as PassengerRow["type"],
                          })
                        }
                        value={passenger.type}
                      >
                        <option value="adult">Adulto</option>
                        <option value="child">Criança</option>
                        <option value="infant">Bebê</option>
                      </Select>
                    </Field>
                    <Field label="Documento">
                      <Input
                        onChange={(e) =>
                          updatePassenger(index, { document: e.target.value })
                        }
                        value={passenger.document}
                      />
                    </Field>
                    <Field label="Nascimento">
                      <Input
                        onChange={(e) =>
                          updatePassenger(index, { birth_date: e.target.value })
                        }
                        type="date"
                        value={passenger.birth_date}
                      />
                    </Field>
                    <div className="flex items-end">
                      <button
                        className="rounded border px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        onClick={() =>
                          setPassengers((rows) =>
                            rows.filter((_, i) => i !== index)
                          )
                        }
                        type="button"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Pagamento agora */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <label className="flex items-center gap-2 font-semibold">
              <input
                checked={registerPayment}
                onChange={(e) => setRegisterPayment(e.target.checked)}
                type="checkbox"
              />
              Registrar pagamento agora
            </label>
            <p className="mt-1 text-sm text-gray-500">
              Marque se o cliente já pagou (PIX/dinheiro/etc.). A reserva será
              confirmada e o cliente notificado.
            </p>
            {registerPayment && (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Método">
                  <Select
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    value={paymentMethod}
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Valor recebido"
                  hint="Em branco = valor total da reserva."
                >
                  <Input
                    min={0}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    step="0.01"
                    type="number"
                    value={paymentAmount}
                  />
                </Field>
                <Field label="Observação">
                  <Input
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Ex.: comprovante enviado no WhatsApp"
                    value={paymentNotes}
                  />
                </Field>
              </div>
            )}
          </section>

          {error && (
            <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
              {createdBookingId && (
                <>
                  {" "}
                  A reserva já foi criada —{" "}
                  <button
                    className="font-semibold underline"
                    onClick={() =>
                      router.push(`/admin/bookings/${createdBookingId}`)
                    }
                    type="button"
                  >
                    abrir a reserva
                  </button>
                  .
                </>
              )}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button
              disabled={!canSubmit}
              loading={submitting}
              type="submit"
            >
              {createdBookingId
                ? "Reenviar pagamento"
                : registerPayment
                ? "Criar reserva e registrar pagamento"
                : "Criar reserva"}
            </Button>
          </div>
        </form>
      </AdminLayout>
    </AdminGuard>
  );
};

export default NewManualBooking;
