import { CheckCircleIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useState } from "react";
import Drawer from "../components/Drawer";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { ISuggestionFormatted } from "../types/typings";

const Success = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(
    null
  );

  return (
    <div>
      {/* No Placeholder for Hotels from Favorite List */}
      <Header
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />
      <main className="mx-auto flex min-h-[70vh] max-w-4xl flex-col px-6 py-14">
        <section className="rounded-lg border bg-white p-8 shadow-sm">
          <div className="flex flex-col space-y-8">
            <div className="mb-5 flex items-center space-x-2">
              <CheckCircleIcon className="text-green-500 h-10" />
              <h1 className="text-3xl">Pagamento recebido</h1>
            </div>
            <p className="text-gray-600">
              Obrigado! Recebemos a confirmação do seu pagamento. Você pode
              acompanhar os detalhes e o status da sua reserva na sua conta.
            </p>
            <Link
              className="mx-auto mt-3 inline-flex rounded-lg bg-orange-500 px-5 py-2 font-semibold text-white transition hover:bg-orange-600 active:scale-95"
              href="/account/bookings"
            >
              Acompanhar reservas
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      {/* Drawer Menu, closed by default */}
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-item">
          <Link href={"/favorites"}>Meus favoritos</Link>
        </p>
        <p className="drawer-item">
          <Link href={"/account/bookings"}>Minhas reservas</Link>
        </p>
      </Drawer>
    </div>
  );
};

export default Success;
