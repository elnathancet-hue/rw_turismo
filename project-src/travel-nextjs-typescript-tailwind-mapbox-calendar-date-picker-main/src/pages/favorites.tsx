import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Drawer from "../components/Drawer";
import Footer from "../components/Footer";
import Header from "../components/Header";
import useSupabaseSession from "../hooks/useSupabaseSession";
import { getMyFavorites, removeFavorite } from "../lib/favorites/client";
import type { Favorite } from "../lib/favorites/types";

// Internal product favorites store the slug in metadata — use it to link back.
const getFavoriteHref = (favorite: Favorite): string | null => {
  if (
    favorite.product_id &&
    favorite.metadata &&
    typeof favorite.metadata === "object" &&
    !Array.isArray(favorite.metadata)
  ) {
    const slug = (favorite.metadata as Record<string, unknown>).slug;
    if (typeof slug === "string" && slug) return `/products/${slug}`;
  }
  return null;
};

const Favorites = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSupabaseSession();
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

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
    setRemovingId(favorite.id);
    setError(null);
    try {
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
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Não foi possível remover o favorito."
      );
    } finally {
      setRemovingId(null);
    }
  };

  const goToSignIn = () => {
    router.push(`/signin?next=${encodeURIComponent("/favorites")}`);
  };

  return (
    <div>
      <Header
        isOpen={isOpen}
        searchInput={searchInput}
        setIsOpen={setIsOpen}
        setSearchInput={setSearchInput}
      />
      <main className="mx-auto min-h-[70vh] max-w-5xl px-6 pb-16 pt-14">
        <p className="text-xs">Sua seleção de viagens</p>
        <h1 className="mb-6 mt-2 text-3xl font-semibold">Favoritos</h1>

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
              <p
                className="rounded border border-red-200 bg-red-50 p-3 text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            {!isLoadingFavorites && favorites.length === 0 && !error && (
              <div className="rounded-lg border bg-white p-8 text-center">
                <p className="text-lg font-semibold">
                  Você ainda não adicionou favoritos
                </p>
                <p className="mt-1 text-gray-500">
                  Salve os pacotes que curtir para reservar depois.
                </p>
                <Link
                  className="mt-4 inline-flex rounded-full bg-orange-500 px-5 py-2 font-semibold text-white hover:bg-orange-600"
                  href="/#pacotes"
                >
                  Explorar viagens
                </Link>
              </div>
            )}

            {favorites.map((favorite) => {
              const href = getFavoriteHref(favorite);
              const media = (
                <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 md:h-44 md:w-64">
                  {favorite.image_url && (
                    <img
                      alt={favorite.title}
                      className="h-full w-full object-cover"
                      src={favorite.image_url}
                    />
                  )}
                </div>
              );
              return (
                <article
                  className="flex gap-5 border-b px-2 py-7 pr-4 first:border-t"
                  key={favorite.id}
                >
                  {href ? (
                    <Link className="flex-shrink-0" href={href}>
                      {media}
                    </Link>
                  ) : (
                    media
                  )}
                  <div className="flex flex-1 flex-col">
                    <p className="text-sm text-gray-500">
                      {favorite.destination || "Pacote"}
                    </p>
                    {href ? (
                      <Link href={href}>
                        <h2 className="text-xl font-semibold hover:text-orange-600">
                          {favorite.title}
                        </h2>
                      </Link>
                    ) : (
                      <h2 className="text-xl font-semibold">{favorite.title}</h2>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-4 pt-4">
                      {href && (
                        <Link
                          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                          href={href}
                        >
                          Ver pacote →
                        </Link>
                      )}
                      <button
                        className="text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-60"
                        disabled={removingId === favorite.id}
                        onClick={() => handleRemoveFavorite(favorite)}
                        type="button"
                      >
                        {removingId === favorite.id ? "Removendo…" : "Remover"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
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
