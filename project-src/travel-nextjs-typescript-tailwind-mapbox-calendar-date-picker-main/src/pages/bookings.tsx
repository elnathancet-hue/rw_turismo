import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Drawer from "../components/Drawer";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { ISuggestionFormatted } from "../types/typings";

const Bookings = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(
    null
  );

  useEffect(() => {
    router.replace("/account/bookings");
  }, [router]);

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
      <main className="mx-auto min-h-[70vh] max-w-3xl px-6 py-14">
        <section className="rounded-lg border bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold">Minhas reservas mudaram</h1>
          <p className="mt-4 text-gray-600">
            O historico de reservas agora fica em uma area Supabase protegida
            por RLS. Voce sera redirecionado automaticamente.
          </p>
          <Link
            className="mt-6 inline-flex rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600"
            href="/account/bookings"
          >
            Ir para minhas reservas
          </Link>
        </section>
      </main>
      <Footer />

      {/* Drawer */}
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-item">
          <Link href={"/favorites"}>List of Favorites</Link>
        </p>
        <p className="drawer-current-item">Your Bookings</p>
      </Drawer>
    </div>
  );
};

export default Bookings;
