import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import BookingSummaryCard from "../../../components/BookingSummaryCard";
import Drawer from "../../../components/Drawer";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";
import useSupabaseSession from "../../../hooks/useSupabaseSession";
import { getMyBookingById } from "../../../lib/bookings/client";
import {
  isBookingExpired,
  isExpiredPendingBooking,
  isPayablePendingBooking,
  isProcessingPayment,
} from "../../../lib/bookings/status";
import type { BookingSummary } from "../../../lib/bookings/types";
import { formatDateTimeBR } from "../../../lib/format";

const formatRemaining = (ms: number): string => {
  if (ms <= 0) return "expirado";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}min ${seconds}s`;
  return `${seconds}s`;
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
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [isOpen, setIsOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");

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
            : "Não foi possível carregar a reserva."
        )
      );
  }, [id, isAuthenticated, isLoading, router]);

  // Live tick so the payment countdown updates.
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-release the slots of a pending hold whose window has lapsed.
  useEffect(() => {
    if (!booking || hasTriedExpire || !isExpiredPendingBooking(booking)) {
      return;
    }
    setHasTriedExpire(true);
    setExpireNotice("Liberando as vagas desta reserva vencida…");

    fetch("/api/bookings/expire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: booking.id }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Não foi possível liberar a reserva.");
        }
        await getMyBookingById(booking.id).then(setBooking);
        setExpireNotice(null);
      })
      .catch((expireError) =>
        setExpireNotice(
          expireError instanceof Error
            ? expireError.message
            : "Não foi possível liberar a reserva."
        )
      );
  }, [booking, hasTriedExpire]);

  const handlePayNow = async () => {
    if (!booking || !isPayablePendingBooking(booking)) return;

    setCheckoutError(null);
    setIsCreatingCheckout(true);

    try {
      const response = await fetch("/api/payments/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: booking.id }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível iniciar o pagamento.");
      }
      if (!payload?.checkout_url) {
        throw new Error("Pagamento indisponível no momento.");
      }

      window.location.assign(payload.checkout_url);
    } catch (payError) {
      setCheckoutError(
        payError instanceof Error
          ? payError.message
          : "Não foi possível iniciar o pagamento."
      );
      setIsCreatingCheckout(false);
    }
  };

  const payable = booking ? isPayablePendingBooking(booking) : false;
  const remainingMs = booking?.expires_at
    ? new Date(booking.expires_at).getTime() - nowTick
    : 0;

  return (
    <div>
      <Header
        isOpen={isOpen}
        searchInput={headerSearch}
        setIsOpen={setIsOpen}
        setSearchInput={setHeaderSearch}
      />
      <main className="mx-auto min-h-[70vh] max-w-3xl px-6 py-10">
        <Link
          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
          href="/account/bookings"
        >
          ← Voltar para minhas reservas
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Sua reserva</h1>

        {error && (
          <p
            className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {!booking && !error && (
          <p className="mt-6 text-gray-500">Carregando reserva…</p>
        )}

        {booking && (
          <div className="mt-6">
            <BookingSummaryCard booking={booking}>
              {expireNotice && (
                <p
                  className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                  role="status"
                >
                  {expireNotice}
                </p>
              )}
              {checkoutError && (
                <p
                  className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  role="alert"
                >
                  {checkoutError}
                </p>
              )}

              {payable && booking.expires_at && (
                <p className="mb-4 text-sm text-gray-600">
                  Prazo para pagamento:{" "}
                  <span className="font-semibold text-amber-700">
                    {formatRemaining(remainingMs)}
                  </span>{" "}
                  <span className="text-gray-400">
                    (até {formatDateTimeBR(booking.expires_at)})
                  </span>
                </p>
              )}

              {payable ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded bg-orange-600 px-6 py-2.5 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
                    disabled={isCreatingCheckout}
                    onClick={handlePayNow}
                    type="button"
                  >
                    {isCreatingCheckout
                      ? "Abrindo pagamento…"
                      : booking.stripe_checkout_session_id
                        ? "Tentar pagamento novamente"
                        : "Pagar agora"}
                  </button>
                  {isProcessingPayment(booking) && (
                    <button
                      className="rounded border px-6 py-2.5 font-semibold hover:bg-gray-50"
                      onClick={() =>
                        getMyBookingById(booking.id)
                          .then(setBooking)
                          .catch(() => {})
                      }
                      type="button"
                    >
                      Atualizar status
                    </button>
                  )}
                </div>
              ) : isBookingExpired(booking) ? (
                <Link
                  className="inline-flex rounded bg-orange-600 px-6 py-2.5 font-semibold text-white hover:bg-orange-700"
                  href="/#pacotes"
                >
                  Buscar novas datas
                </Link>
              ) : isProcessingPayment(booking) ? (
                <button
                  className="rounded border px-6 py-2.5 font-semibold hover:bg-gray-50"
                  onClick={() =>
                    getMyBookingById(booking.id)
                      .then(setBooking)
                      .catch(() => {})
                  }
                  type="button"
                >
                  Atualizar status
                </button>
              ) : null}

              {booking.payment_status === "paid" && (
                <a
                  className="mt-4 inline-flex rounded border border-orange-600 px-6 py-2.5 font-semibold text-orange-700 hover:bg-orange-50"
                  href={`/api/bookings/${booking.id}/voucher`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Baixar voucher (PDF)
                </a>
              )}
            </BookingSummaryCard>
          </div>
        )}
      </main>
      <Footer />
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-item">
          <Link href="/favorites">Meus favoritos</Link>
        </p>
        <p className="drawer-current-item">Minhas reservas</p>
      </Drawer>
    </div>
  );
};

export default BookingDetails;
