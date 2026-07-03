import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useState } from "react";
import Drawer from "../components/Drawer";
import Footer from "../components/Footer";
import Header from "../components/Header";
import useSupabaseSession from "../hooks/useSupabaseSession";
import { getMyFavorites, removeFavorite } from "../lib/favorites/client";
import type { Favorite } from "../lib/favorites/types";
import { ISuggestionFormatted } from "../types/typings";

const Favorites = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSupabaseSession();
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(
    null
  );
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFavorites = async () => {
    setIsLoadingFavorites(true);
    setError(null);

    try {
      const data = await getMyFavorites();
      setFavorites(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar os favoritos."
      );
    } finally {
      setIsLoadingFavorites(false);
    }
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      loadFavorites();
    }
  }, [isAuthenticated, isLoading]);

  const handleRemoveFavorite = async (favorite: Favorite) => {
    await removeFavorite(
      favorite.product_id
        ? { product_id: favorite.product_id }
        : {
            external_hotel_id: favorite.external_hotel_id!,
            provider: favorite.provider,
          }
    );

    setFavorites((currentFavorites) =>
      currentFavorites.filter((item) => item.id !== favorite.id)
    );
  };

  const goToSignIn = () => {
    router.push(`/signin?next=${encodeURIComponent("/favorites")}`);
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
      <main className="max-w-5xl mx-auto pt-14 px-6 min-h-[70vh]">
          <p className="text-xs">Sua seleção de viagens</p>
          <h1 className="text-3xl font-semibold mt-2 mb-6">Favoritos</h1>

          {!isLoading && !isAuthenticated && (
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <p className="text-gray-700">
                Entre para ver e gerenciar seus favoritos.
              </p>
              <button
                className="mt-4 rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600"
                onClick={goToSignIn}
                type="button"
              >
                Entrar
              </button>
            </div>
          )}

          {isAuthenticated && (
            <div className="flex flex-col">
              {isLoadingFavorites && (
                <p className="py-8 text-gray-500">Carregando favoritos...</p>
              )}

              {error && (
                <p className="rounded border border-red-200 bg-red-50 p-3 text-red-700">
                  {error}
                </p>
              )}

              {!isLoadingFavorites && favorites.length === 0 && !error && (
                <p className="py-8 text-gray-500">
                  Você ainda não adicionou favoritos.
                </p>
              )}

              {favorites.map((favorite) => (
                <article
                  className="flex gap-5 py-7 px-2 pr-4 border-b first:border-t"
                  key={favorite.id}
                >
                  <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 md:h-44 md:w-64">
                    {favorite.image_url && (
                      <img
                        className="h-full w-full object-cover"
                        src={favorite.image_url}
                        alt={favorite.title}
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <p className="text-sm text-gray-500">
                      {favorite.destination || favorite.provider}
                    </p>
                    <h2 className="text-xl font-semibold">
                      {favorite.title}
                    </h2>
                    <p className="mt-2 text-sm text-gray-500">
                      Origem: {favorite.provider}
                    </p>
                    <div className="mt-auto pt-4">
                      <button
                        className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                        onClick={() => handleRemoveFavorite(favorite)}
                        type="button"
                      >
                        Remover favorito
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
      </main>
      <Footer />
      {/* Drawer Menu, hided by default */}
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-current-item">Meus favoritos</p>
        <p className="drawer-item">
          <Link href={"/bookings"}>Minhas reservas</Link>
        </p>
      </Drawer>
    </div>
  );
};

export default Favorites;
