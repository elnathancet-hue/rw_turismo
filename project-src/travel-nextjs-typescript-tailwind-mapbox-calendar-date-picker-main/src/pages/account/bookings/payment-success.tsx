import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import Drawer from "../../../components/Drawer";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";
import type { ISuggestionFormatted } from "../../../types/typings";

const PaymentSuccess = () => {
  const router = useRouter();
  const bookingId =
    typeof router.query.booking_id === "string" ? router.query.booking_id : "";
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(
    null
  );

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
      <main className="mx-auto min-h-[70vh] max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Pagamento em processamento</h1>
        <p className="mt-4 text-gray-600">
          Recebemos o retorno do Stripe. A confirmacao real da reserva sera
          feita pelo webhook interno validado por assinatura. Se o status ainda
          estiver pendente, aguarde alguns instantes e abra a reserva novamente.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {bookingId && (
            <Link
              className="rounded bg-orange-600 px-5 py-2 font-semibold text-white hover:bg-orange-700"
              href={`/account/bookings/${bookingId}`}
            >
              Ver reserva
            </Link>
          )}
          <Link
            className="rounded border px-5 py-2 font-semibold hover:bg-gray-50"
            href="/account/bookings"
          >
            Minhas reservas
          </Link>
        </div>
      </main>
      <Footer />
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-current-item">Minhas reservas</p>
      </Drawer>
    </div>
  );
};

export default PaymentSuccess;
