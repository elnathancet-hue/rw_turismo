import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Drawer from "../../../components/Drawer";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";
import useSupabaseSession from "../../../hooks/useSupabaseSession";
import { getMyBookingById } from "../../../lib/bookings/client";
import type { BookingSummary } from "../../../lib/bookings/types";
import type { ISuggestionFormatted } from "../../../types/typings";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDateTime = (value: string | null) => {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const isExpiredPendingBooking = (booking: BookingSummary) =>
  booking.status === "pending" &&
  booking.payment_status === "pending" &&
  Boolean(booking.expires_at) &&
  new Date(booking.expires_at as string).getTime() < Date.now();

const isPayablePendingBooking = (booking: BookingSummary) =>
  booking.status === "pending" &&
  booking.payment_status === "pending" &&
  !booking.stripe_checkout_session_id &&
  Boolean(booking.expires_at) &&
  new Date(booking.expires_at as string).getTime() > Date.now();

const isProcessingPayment = (booking: BookingSummary) =>
  booking.status === "pending" &&
  booking.payment_status === "pending" &&
  Boolean(booking.stripe_checkout_session_id);

const getStatusNotice = (booking: BookingSummary, expireNotice: string | null) => {
  if (expireNotice) return expireNotice;

  if (booking.status === "confirmed" && booking.payment_status === "paid") {
    return "Reserva confirmada. O pagamento foi validado com sucesso.";
  }

  if (booking.payment_status === "requires_review") {
    return "Pagamento recebido com divergencia ou fora do prazo. A reserva esta em revisao manual.";
  }

  if (booking.payment_status === "failed") {
    return "Pagamento recusado. Se a reserva expirou, as vagas foram liberadas.";
  }

  if (booking.status === "expired" || booking.payment_status === "cancelled") {
    return "Esta reserva expirou ou foi cancelada e nao pode seguir para pagamento.";
  }

  if (isProcessingPayment(booking)) {
    return "Pagamento em processamento. O status sera atualizado pelo webhook seguro do Stripe.";
  }

  return null;
};

const BookingDetails = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { isAuthenticated, isLoading } = useSupabaseSession();
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expireNotice, setExpireNotice] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [hasTriedExpire, setHasTriedExpire] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(
    null
  );

  useEffect(() => {
    if (isLoading || !id) return;

    if (!isAuthenticated) {
      router.push(`/signin?next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    getMyBookingById(id)
      .then(setBooking)
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nao foi possivel carregar reserva."
        )
      );
  }, [id, isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!booking || hasTriedExpire || !isExpiredPendingBooking(booking)) {
      return;
    }

    setHasTriedExpire(true);
    setExpireNotice("Reserva vencida. Liberando vagas automaticamente...");

    fetch("/api/bookings/expire", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ booking_id: booking.id }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Nao foi possivel expirar a reserva.");
        }

        await getMyBookingById(booking.id).then(setBooking);
        setExpireNotice("Reserva expirada. As vagas foram liberadas.");
      })
      .catch((expireError) =>
        setExpireNotice(
          expireError instanceof Error
            ? expireError.message
            : "Nao foi possivel expirar a reserva."
        )
      );
  }, [booking, hasTriedExpire]);

  const handlePayNow = async () => {
    if (!booking || !isPayablePendingBooking(booking)) {
      return;
    }

    setCheckoutError(null);
    setIsCreatingCheckout(true);

    try {
      const response = await fetch("/api/payments/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ booking_id: booking.id }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Nao foi possivel iniciar pagamento.");
      }

      if (!payload?.checkout_url) {
        throw new Error("Checkout indisponivel.");
      }

      window.location.assign(payload.checkout_url);
    } catch (checkoutError) {
      setCheckoutError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Nao foi possivel iniciar pagamento."
      );
      setIsCreatingCheckout(false);
    }
  };

  return (
    <div>
      <Header
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />
      <main className="mx-auto min-h-[70vh] max-w-4xl px-6 py-10">
        <Link className="text-sm font-semibold text-orange-600" href="/account/bookings">
          Voltar para minhas reservas
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Resumo da reserva</h1>

        {error && (
          <p className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-red-700">
            {error}
          </p>
        )}

        {!booking && !error && (
          <p className="mt-6 text-gray-500">Carregando reserva...</p>
        )}

        {booking && (
          <section className="mt-6 overflow-hidden rounded-lg border bg-white shadow-sm">
            {getStatusNotice(booking, expireNotice) && (
              <div className="border-b border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800">
                {getStatusNotice(booking, expireNotice)}
              </div>
            )}
            {booking.products?.cover_image && (
              <img
                alt={booking.products.title}
                className="h-64 w-full object-cover"
                src={booking.products.cover_image}
              />
            )}
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">Produto</p>
                <p className="font-semibold">{booking.products?.title}</p>
                <p className="text-sm text-gray-600">
                  {booking.products?.destination}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Periodo</p>
                <p className="font-semibold">
                  {booking.product_dates?.start_date} ate{" "}
                  {booking.product_dates?.end_date}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Viajantes</p>
                <p className="font-semibold">{booking.travelers_count}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Valor total</p>
                <p className="font-semibold">
                  {formatCurrency(booking.total_amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status da reserva</p>
                <p className="font-semibold">{booking.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status do pagamento</p>
                <p className="font-semibold">{booking.payment_status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Expira em</p>
                <p className="font-semibold">
                  {formatDateTime(booking.expires_at)}
                </p>
                {isExpiredPendingBooking(booking) && (
                  <p className="mt-1 text-sm text-amber-700">
                    Prazo vencido. Esta reserva sera expirada antes do pagamento.
                  </p>
                )}
              </div>
            </div>
            <div className="border-t p-6">
              {checkoutError && (
                <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {checkoutError}
                </p>
              )}

              {booking.payment_status === "paid" ? (
                <p className="font-semibold text-green-700">
                  Pagamento confirmado
                </p>
              ) : booking.payment_status === "requires_review" ? (
                <p className="font-semibold text-amber-700">
                  Pagamento em revisao manual
                </p>
              ) : booking.payment_status === "failed" ? (
                <p className="font-semibold text-red-700">
                  Pagamento recusado
                </p>
              ) : isProcessingPayment(booking) ? (
                <p className="font-semibold text-orange-700">
                  Processando pagamento
                </p>
              ) : booking.status === "expired" ||
                booking.payment_status === "cancelled" ||
                isExpiredPendingBooking(booking) ? (
                <p className="font-semibold text-amber-700">
                  Reserva expirada
                </p>
              ) : isPayablePendingBooking(booking) ? (
                <button
                  className="rounded bg-orange-600 px-5 py-2 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
                  disabled={isCreatingCheckout}
                  onClick={handlePayNow}
                  type="button"
                >
                  {isCreatingCheckout ? "Abrindo checkout..." : "Pagar agora"}
                </button>
              ) : (
                <p className="font-semibold text-gray-600">
                  Pagamento indisponivel
                </p>
              )}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-item">
          <Link href={"/favorites"}>Meus favoritos</Link>
        </p>
        <p className="drawer-current-item">Minhas reservas</p>
      </Drawer>
    </div>
  );
};

export default BookingDetails;
