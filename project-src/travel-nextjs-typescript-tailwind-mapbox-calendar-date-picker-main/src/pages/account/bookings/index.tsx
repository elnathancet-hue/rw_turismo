import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Drawer from "../../../components/Drawer";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";
import useSupabaseSession from "../../../hooks/useSupabaseSession";
import { getMyBookings } from "../../../lib/bookings/client";
import type { BookingSummary } from "../../../lib/bookings/types";
import type { ISuggestionFormatted } from "../../../types/typings";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const AccountBookings = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSupabaseSession();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(
    null
  );

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push(`/signin?next=${encodeURIComponent("/account/bookings")}`);
      return;
    }

    getMyBookings()
      .then(setBookings)
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nao foi possivel carregar reservas."
        )
      );
  }, [isAuthenticated, isLoading, router]);

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
      <main className="mx-auto min-h-[70vh] max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Minhas reservas</h1>
        {error && (
          <p className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-red-700">
            {error}
          </p>
        )}
        <div className="mt-6 divide-y rounded-lg border bg-white shadow-sm">
          {bookings.length === 0 && !error && (
            <p className="p-6 text-gray-500">Nenhuma reserva encontrada.</p>
          )}
          {bookings.map((booking) => (
            <Link
              className="block p-5 hover:bg-gray-50"
              href={`/account/bookings/${booking.id}`}
              key={booking.id}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-semibold">{booking.products?.title}</h2>
                  <p className="text-sm text-gray-500">
                    {booking.product_dates?.start_date} ate{" "}
                    {booking.product_dates?.end_date}
                  </p>
                </div>
                <div className="text-sm md:text-right">
                  <p className="font-semibold">
                    {formatCurrency(booking.total_amount)}
                  </p>
                  <p className="text-gray-500">
                    {booking.status} / {booking.payment_status}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-item">
          <Link href={"/favorites"}>List of Favorites</Link>
        </p>
        <p className="drawer-current-item">Your Bookings</p>
      </Drawer>
    </div>
  );
};

export default AccountBookings;
