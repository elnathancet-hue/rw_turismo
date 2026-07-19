import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import Drawer from "../../../components/Drawer";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";

const PaymentCancel = () => {
  const router = useRouter();
  const bookingId =
    typeof router.query.booking_id === "string" ? router.query.booking_id : "";
  const [isOpen, setIsOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");

  return (
    <div>
      <Header
        isOpen={isOpen}
        searchInput={headerSearch}
        setIsOpen={setIsOpen}
        setSearchInput={setHeaderSearch}
      />
      <main className="mx-auto min-h-[70vh] max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Pagamento não concluído</h1>
        <p className="mt-4 text-gray-600">
          Você saiu antes de finalizar o pagamento. Se a sua reserva ainda
          estiver dentro do prazo, é só concluir o pagamento para garantir sua
          vaga.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {bookingId && (
            <Link
              className="rounded bg-orange-600 px-5 py-2 font-semibold text-white hover:bg-orange-700"
              href={`/account/bookings/${bookingId}`}
            >
              Concluir pagamento
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
        <p className="drawer-item">
          <Link href="/favorites">Meus favoritos</Link>
        </p>
        <p className="drawer-current-item">Minhas reservas</p>
      </Drawer>
    </div>
  );
};

export default PaymentCancel;
