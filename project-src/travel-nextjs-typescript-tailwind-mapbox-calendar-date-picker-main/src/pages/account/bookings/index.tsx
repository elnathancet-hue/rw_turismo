import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Drawer from "../../../components/Drawer";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";
import StatusPill from "../../../components/StatusPill";
import useSupabaseSession from "../../../hooks/useSupabaseSession";
import { getMyBookings } from "../../../lib/bookings/client";
import {
  getCustomerBookingState,
  isPayablePendingBooking,
} from "../../../lib/bookings/status";
import type { BookingSummary } from "../../../lib/bookings/types";
import { formatBRL, formatDateRangeBR } from "../../../lib/format";

const AccountBookings = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSupabaseSession();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push(`/signin?next=${encodeURIComponent("/account/bookings")}`);
      return;
    }
    setStatus("loading");
    getMyBookings()
      .then((data) => {
        setBookings(data);
        setStatus("ready");
      })
      .catch((loadError) => {
        setErrorMessage(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar as reservas."
        );
        setStatus("error");
      });
  }, [isAuthenticated, isLoading, router]);

  return (
    <div>
      <Header
        isOpen={isOpen}
        searchInput={headerSearch}
        setIsOpen={setIsOpen}
        setSearchInput={setHeaderSearch}
      />
      <main className="mx-auto min-h-[70vh] max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Minhas reservas</h1>

        {status === "loading" && (
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((index) => (
              <div
                className="h-20 animate-pulse rounded-lg border bg-white"
                key={index}
              />
            ))}
          </div>
        )}

        {status === "error" && (
          <p
            className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-red-700"
            role="alert"
          >
            {errorMessage}
          </p>
        )}

        {status === "ready" && bookings.length === 0 && (
          <div className="mt-6 rounded-lg border bg-white p-8 text-center">
            <p className="text-lg font-semibold">Você ainda não tem reservas</p>
            <p className="mt-1 text-gray-500">
              Encontre seu próximo destino e garanta sua vaga.
            </p>
            <Link
              className="mt-4 inline-flex rounded-full bg-orange-500 px-5 py-2 font-semibold text-white hover:bg-orange-600"
              href="/#pacotes"
            >
              Explorar viagens
            </Link>
          </div>
        )}

        {status === "ready" && bookings.length > 0 && (
          <div className="mt-6 divide-y rounded-lg border bg-white shadow-sm">
            {bookings.map((booking) => {
              const state = getCustomerBookingState(booking);
              return (
                <Link
                  className="block p-5 hover:bg-gray-50"
                  href={`/account/bookings/${booking.id}`}
                  key={booking.id}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">
                          {booking.products?.title}
                        </h2>
                        <StatusPill label={state.label} tone={state.tone} />
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {formatDateRangeBR(
                          booking.product_dates?.start_date,
                          booking.product_dates?.end_date
                        )}
                      </p>
                    </div>
                    <div className="text-sm md:text-right">
                      <p className="font-semibold">
                        {formatBRL(booking.total_amount)}
                      </p>
                      {isPayablePendingBooking(booking) && (
                        <p className="font-semibold text-orange-600">
                          Concluir pagamento →
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
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

export default AccountBookings;
