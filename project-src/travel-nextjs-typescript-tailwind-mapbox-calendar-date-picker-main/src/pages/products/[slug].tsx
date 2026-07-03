import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Drawer from "../../components/Drawer";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import useSupabaseSession from "../../hooks/useSupabaseSession";
import {
  addFavorite,
  isFavorite as checkIsFavorite,
  removeFavorite,
} from "../../lib/favorites/client";
import {
  getActiveProductDatesServer,
  getProductBySlugServer,
} from "../../lib/products/server";
import type { Product, ProductDate } from "../../lib/products/types";
import type { ISuggestionFormatted } from "../../types/typings";

type Props = {
  product: Product;
  productDates: ProductDate[];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));

const ProductDetails = ({ product, productDates }: Props) => {
  const router = useRouter();
  const { user, profile, isAuthenticated } = useSupabaseSession();
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(
    null
  );
  const [isFav, setIsFav] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [selectedDateId, setSelectedDateId] = useState(productDates[0]?.id ?? "");
  const [travelersCount, setTravelersCount] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsFav(false);
      return;
    }

    checkIsFavorite({ product_id: product.id })
      .then(setIsFav)
      .catch(console.error);
  }, [isAuthenticated, product.id]);

  const toggleFavorite = async () => {
    setFavoriteError(null);

    if (!isAuthenticated) {
      router.push(`/signin?next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    try {
      if (isFav) {
        await removeFavorite({ product_id: product.id });
        setIsFav(false);
        return;
      }

      await addFavorite({
        product_id: product.id,
        title: product.title,
        destination: product.destination,
        image_url: product.cover_image,
        provider: "internal",
        metadata: {
          slug: product.slug,
          type: product.type,
        },
      });
      setIsFav(true);
    } catch (error) {
      setFavoriteError(
        error instanceof Error ? error.message : "Unable to update favorite."
      );
    }
  };

  const displayPrice = product.promotional_price ?? product.price;
  const selectedDate = productDates.find((date) => date.id === selectedDateId);
  const selectedUnitPrice = selectedDate?.price_override ?? displayPrice;
  const estimatedTotal = selectedUnitPrice * travelersCount;

  useEffect(() => {
    if (!customerName && profile?.name) {
      setCustomerName(profile.name);
    }

    if (!customerEmail && user?.email) {
      setCustomerEmail(user.email);
    }
  }, [customerEmail, customerName, profile?.name, user?.email]);

  const startPendingBooking = async () => {
    setBookingError(null);

    if (!isAuthenticated) {
      router.push(`/signin?next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    if (!selectedDateId) {
      setBookingError("Selecione uma data disponivel.");
      return;
    }

    setIsBooking(true);

    try {
      const response = await fetch("/api/bookings/create-pending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: product.id,
          product_date_id: selectedDateId,
          travelers_count: travelersCount,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel iniciar reserva.");
      }

      router.push(`/account/bookings/${result.booking_id}`);
    } catch (error) {
      setBookingError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel iniciar reserva."
      );
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div>
      <Head>
        <title>{product.title} - Travel</title>
      </Head>
      <Header
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section>
            <p className="text-sm text-gray-500">{product.destination}</p>
            <h1 className="mt-2 text-4xl font-semibold">{product.title}</h1>
            <p className="mt-4 text-gray-700">{product.description}</p>

            {product.cover_image && (
              <div className="mt-8 overflow-hidden rounded-lg bg-gray-100">
                <img
                  alt={product.title}
                  className="h-[420px] w-full object-cover"
                  src={product.cover_image}
                />
              </div>
            )}
          </section>

          <aside className="h-fit rounded-lg border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">A partir de</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-orange-600">
                {formatCurrency(displayPrice)}
              </span>
              {product.promotional_price && (
                <span className="text-sm text-gray-400 line-through">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>

            <button
              className="mt-5 w-full rounded border px-4 py-2 font-semibold text-orange-600 hover:bg-orange-50"
              onClick={toggleFavorite}
              type="button"
            >
              {isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            </button>
            {favoriteError && (
              <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {favoriteError}
              </p>
            )}

            <div className="mt-5 border-t pt-5">
              <label className="block text-sm font-medium">
                Data
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  onChange={(event) => setSelectedDateId(event.target.value)}
                  value={selectedDateId}
                >
                  {productDates.map((productDate) => (
                    <option key={productDate.id} value={productDate.id}>
                      {formatDate(productDate.start_date)} -{" "}
                      {formatDate(productDate.end_date)} (
                      {productDate.available_slots} vagas)
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-sm font-medium">
                Viajantes
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  min={1}
                  onChange={(event) =>
                    setTravelersCount(Number(event.target.value))
                  }
                  type="number"
                  value={travelersCount}
                />
              </label>
              <label className="mt-3 block text-sm font-medium">
                Nome
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  onChange={(event) => setCustomerName(event.target.value)}
                  value={customerName}
                />
              </label>
              <label className="mt-3 block text-sm font-medium">
                Email
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  type="email"
                  value={customerEmail}
                />
              </label>
              <label className="mt-3 block text-sm font-medium">
                Telefone
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  value={customerPhone}
                />
              </label>
              <p className="mt-4 text-sm text-gray-500">
                Total estimado:{" "}
                <span className="font-semibold text-gray-900">
                  {formatCurrency(estimatedTotal)}
                </span>
              </p>
              <button
                className="mt-4 w-full rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                disabled={isBooking || productDates.length === 0}
                onClick={startPendingBooking}
                type="button"
              >
                {isBooking ? "Iniciando..." : "Iniciar reserva"}
              </button>
              {bookingError && (
                <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {bookingError}
                </p>
              )}
            </div>
          </aside>
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Datas disponiveis</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {productDates.length === 0 && (
              <p className="text-gray-500">
                Nenhuma data disponivel no momento.
              </p>
            )}
            {productDates.map((productDate) => (
              <article
                className="rounded-lg border bg-white p-4 shadow-sm"
                key={productDate.id}
              >
                <p className="font-semibold">
                  {formatDate(productDate.start_date)} ate{" "}
                  {formatDate(productDate.end_date)}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  {productDate.available_slots} vagas disponiveis
                </p>
                <p className="mt-3 font-semibold">
                  {formatCurrency(productDate.price_override ?? displayPrice)}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <Footer />
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-item">
          <Link href={"/favorites"}>List of Favorites</Link>
        </p>
        <p className="drawer-item">
          <Link href={"/bookings"}>Your Bookings</Link>
        </p>
      </Drawer>
    </div>
  );
};

export default ProductDetails;

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const slug = Array.isArray(context.params?.slug)
    ? context.params?.slug[0]
    : context.params?.slug;

  if (!slug) {
    return {
      notFound: true,
    };
  }

  try {
    const product = await getProductBySlugServer(slug);

    if (!product) {
      return {
        notFound: true,
      };
    }

    const productDates = await getActiveProductDatesServer(product.id);

    return {
      props: {
        product,
        productDates,
      },
    };
  } catch (error) {
    console.error("Failed to load Supabase product", error);

    return {
      notFound: true,
    };
  }
};
