import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import BookingSummaryCard from "../../../components/BookingSummaryCard";
import Drawer from "../../../components/Drawer";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";
import useSupabaseSession from "../../../hooks/useSupabaseSession";
import { gaEvent } from "../../../lib/analytics/gtag";
import { getMyBookingById } from "../../../lib/bookings/client";
import { isProcessingPayment } from "../../../lib/bookings/status";
import type { BookingSummary } from "../../../lib/bookings/types";

const PaymentSuccess = () => {
  const router = useRouter();
  const bookingId =
    typeof router.query.booking_id === "string" ? router.query.booking_id : "";
  const { isAuthenticated, isLoading } = useSupabaseSession();
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [isOpen, setIsOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const purchaseFired = useRef(false);

  const loadBooking = () => {
    if (!bookingId) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    getMyBookingById(bookingId)
      .then((data) => {
        setBooking(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push(`/signin?next=${encodeURIComponent(router.asPath)}`);
      return;
    }
    loadBooking();
  }, [isAuthenticated, isLoading, bookingId]);

  // The payment confirmation can lag a few seconds — refresh while processing.
  useEffect(() => {
    if (!booking || !isProcessingPayment(booking)) return;
    const timer = setInterval(() => {
      getMyBookingById(booking.id)
        .then(setBooking)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [booking]);

  // GA4: purchase — dispara uma vez, quando o pagamento consta como pago.
  useEffect(() => {
    if (!booking || booking.payment_status !== "paid" || purchaseFired.current) {
      return;
    }
    purchaseFired.current = true;
    gaEvent("purchase", {
      transaction_id: booking.id,
      currency: "BRL",
      value: Number(booking.total_amount),
      items: [
        {
          item_id: booking.product_id,
          item_name: booking.products?.title,
          quantity: booking.travelers_count,
        },
      ],
    });
  }, [booking]);

  return (
    <div>
      <Header
        isOpen={isOpen}
        searchInput={headerSearch}
        setIsOpen={setIsOpen}
        setSearchInput={setHeaderSearch}
      />
      <main className="mx-auto min-h-[70vh] max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Recebemos seu pagamento</h1>
        <p className="mt-2 text-gray-600">
          Obrigado! Aqui estão os detalhes da sua reserva.
        </p>

        {status === "loading" && (
          <p className="mt-8 text-gray-500">Carregando sua reserva…</p>
        )}

        {status === "error" && (
          <div className="mt-8 rounded-lg border bg-white p-6">
            <p className="text-gray-700">
              Não conseguimos carregar os detalhes agora.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded bg-orange-600 px-5 py-2 font-semibold text-white hover:bg-orange-700"
                onClick={loadBooking}
                type="button"
              >
                Tentar novamente
              </button>
              <Link
                className="rounded border px-5 py-2 font-semibold hover:bg-gray-50"
                href="/account/bookings"
              >
                Minhas reservas
              </Link>
            </div>
          </div>
        )}

        {status === "ready" && booking && (
          <div className="mt-8">
            <BookingSummaryCard booking={booking}>
              <div className="flex flex-wrap gap-3">
                <Link
                  className="rounded bg-orange-600 px-5 py-2 font-semibold text-white hover:bg-orange-700"
                  href={`/account/bookings/${booking.id}`}
                >
                  Ver reserva
                </Link>
                <Link
                  className="rounded border px-5 py-2 font-semibold hover:bg-gray-50"
                  href="/account/bookings"
                >
                  Minhas reservas
                </Link>
                {isProcessingPayment(booking) && (
                  <button
                    className="rounded border px-5 py-2 font-semibold hover:bg-gray-50"
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

export default PaymentSuccess;
