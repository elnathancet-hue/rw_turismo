import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Drawer from "../../components/Drawer";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import ProductGallery from "../../components/ProductGallery";
import useSupabaseSession from "../../hooks/useSupabaseSession";
import useWhatsAppWidget from "../../hooks/useWhatsAppWidget";
import { WhatsAppIcon } from "../../components/WhatsAppFloat";
import { buildWaLink } from "../../lib/content/whatsapp";
import {
  addFavorite,
  isFavorite as checkIsFavorite,
  removeFavorite,
} from "../../lib/favorites/client";
import { joinWaitlist } from "../../lib/waitlist/client";
import {
  getActiveProductDatesServer,
  getProductBySlugServer,
} from "../../lib/products/server";
import type {
  FaqItem,
  ItineraryDay,
  Product,
  ProductDate,
} from "../../lib/products/types";
import {
  fallbackProductDates,
  getFallbackProductBySlug,
} from "../../lib/products/fallback";
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
  const whatsApp = useWhatsAppWidget();
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
  const [couponCode, setCouponCode] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsFav(false);
      return;
    }

    checkIsFavorite({ product_id: product.id })
      .then(setIsFav)
      .catch(console.error);
  }, [isAuthenticated, product.id]);

  // Restore a booking draft saved before the user was sent to login.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(`rw:booking-draft:${product.slug}`);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (
        typeof draft.selectedDateId === "string" &&
        productDates.some((date) => date.id === draft.selectedDateId)
      ) {
        setSelectedDateId(draft.selectedDateId);
      }
      if (typeof draft.travelersCount === "number" && draft.travelersCount > 0) {
        setTravelersCount(draft.travelersCount);
      }
      if (typeof draft.customerName === "string") setCustomerName(draft.customerName);
      if (typeof draft.customerEmail === "string") setCustomerEmail(draft.customerEmail);
      if (typeof draft.customerPhone === "string") setCustomerPhone(draft.customerPhone);
      if (typeof draft.couponCode === "string") setCouponCode(draft.couponCode);
    } catch {
      // ignore malformed draft
    }
    window.localStorage.removeItem(`rw:booking-draft:${product.slug}`);
  }, [product.slug]);

  const toggleFavorite = async () => {
    setFavoriteError(null);

    if (!isAuthenticated) {
      saveBookingDraft();
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
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o favorito."
      );
    }
  };

  const displayPrice = product.promotional_price ?? product.price;
  const galleryImages = (
    Array.isArray(product.gallery) ? product.gallery : []
  ).filter(
    (item): item is string => typeof item === "string" && item.length > 0
  );
  const itinerary = (
    Array.isArray(product.itinerary) ? product.itinerary : []
  ).filter(
    (item): item is ItineraryDay =>
      !!item &&
      typeof item === "object" &&
      typeof (item as { title?: unknown }).title === "string"
  );
  const faq = (Array.isArray(product.faq) ? product.faq : []).filter(
    (item): item is FaqItem =>
      !!item &&
      typeof item === "object" &&
      typeof (item as { question?: unknown }).question === "string" &&
      typeof (item as { answer?: unknown }).answer === "string"
  );
  const selectedDate = productDates.find((date) => date.id === selectedDateId);
  const selectedUnitPrice = selectedDate?.price_override ?? displayPrice;
  const estimatedTotal = selectedUnitPrice * travelersCount;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
  const canonicalUrl = `${siteUrl}/products/${product.slug}`;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": product.type === "package" || product.type === "experience" ? "TouristTrip" : "Product",
    name: product.title,
    description: product.description,
    image: [product.cover_image, ...galleryImages].filter(Boolean),
    touristType: product.type,
    ...(itinerary.length
      ? {
          itinerary: {
            "@type": "ItemList",
            itemListElement: itinerary.map((day, index) => ({
              "@type": "ListItem",
              position: day.day || index + 1,
              name: day.title,
            })),
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: displayPrice,
      availability: productDates.length ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      url: canonicalUrl,
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: siteUrl },
      { "@type": "ListItem", position: 2, name: product.title, item: canonicalUrl },
    ],
  };
  const faqJsonLd = faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }
    : null;

  useEffect(() => {
    if (!customerName && profile?.name) {
      setCustomerName(profile.name);
    }

    if (!customerEmail && user?.email) {
      setCustomerEmail(user.email);
    }
  }, [customerEmail, customerName, profile?.name, user?.email]);

  const saveBookingDraft = () => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      `rw:booking-draft:${product.slug}`,
      JSON.stringify({
        selectedDateId,
        travelersCount,
        customerName,
        customerEmail,
        customerPhone,
        couponCode,
      })
    );
  };

  const startPendingBooking = async () => {
    setBookingError(null);

    if (!isAuthenticated) {
      saveBookingDraft();
      router.push(`/signin?next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    if (!selectedDateId) {
      setBookingError("Selecione uma data disponível.");
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
          coupon_code: couponCode || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível iniciar a reserva.");
      }

      router.push(`/account/bookings/${result.booking_id}`);
    } catch (error) {
      setBookingError(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a reserva."
      );
    } finally {
      setIsBooking(false);
    }
  };

  // Saída lotada (ou sem datas): oferece a lista de espera com os mesmos
  // campos do formulário de reserva.
  const soldOut =
    productDates.length === 0 || (selectedDate?.available_slots ?? 0) <= 0;

  const joinWaitlistNow = async () => {
    setWaitlistError(null);

    if (!customerName.trim() || !customerEmail.trim()) {
      setWaitlistError(
        "Preencha nome e e-mail acima para entrar na lista de espera."
      );
      return;
    }

    setIsJoiningWaitlist(true);
    try {
      await joinWaitlist({
        product_id: product.id,
        product_date_id: selectedDate?.id ?? null,
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        travelers_count: travelersCount,
      });
      setWaitlistDone(true);
    } catch {
      setWaitlistError(
        "Não foi possível entrar na lista agora. Tente novamente."
      );
    } finally {
      setIsJoiningWaitlist(false);
    }
  };

  // Botão de WhatsApp acima do botão de compra (configurado em Integrações).
  const whatsAppLink = whatsApp.enabled
    ? buildWaLink(
        whatsApp.phone,
        `Olá! Tenho interesse em "${product.title}". Pode me ajudar?`
      )
    : null;

  return (
    <div>
      <Head>
        <title>{product.title} | RW Turismo</title>
        <meta
          name="description"
          content={product.description ?? "Pacotes e experiências RW Turismo."}
        />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:title" content={product.title} />
        <meta property="og:description" content={product.description ?? ""} />
        {product.cover_image && <meta property="og:image" content={product.cover_image} />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c") }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }} />
        {faqJsonLd && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} />
        )}
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

            <ProductGallery
              cover={product.cover_image}
              gallery={galleryImages}
              title={product.title}
            />
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
                  max={selectedDate?.available_slots || undefined}
                  min={1}
                  onChange={(event) => {
                    const parsed = Math.floor(Number(event.target.value));
                    setTravelersCount(
                      Number.isFinite(parsed) && parsed > 0 ? parsed : 1
                    );
                  }}
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
              <label className="mt-3 block text-sm font-medium">
                Cupom de desconto
                <input
                  className="mt-1 w-full rounded border px-3 py-2 uppercase placeholder:normal-case"
                  onChange={(event) => setCouponCode(event.target.value)}
                  placeholder="Se você tiver um cupom"
                  value={couponCode}
                />
              </label>
              <p className="mt-4 text-sm text-gray-500">
                Total estimado:{" "}
                <span className="font-semibold text-gray-900">
                  {formatCurrency(estimatedTotal)}
                </span>
              </p>
              {whatsAppLink && (
                <a
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded border border-green-600 px-4 py-2 font-semibold text-green-700 transition hover:bg-green-50"
                  href={whatsAppLink}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <WhatsAppIcon className="h-5 w-5" />
                  Tirar dúvida no WhatsApp
                </a>
              )}
              {soldOut ? (
                <div className="mt-4">
                  {waitlistDone ? (
                    <p
                      className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800"
                      role="status"
                    >
                      Você entrou na lista de espera! Avisaremos assim que
                      abrir vaga.
                    </p>
                  ) : (
                    <>
                      <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        {productDates.length === 0
                          ? "Sem datas abertas no momento."
                          : "Esta saída está lotada."}{" "}
                        Preencha seus dados acima e entre na lista de espera —
                        avisamos quando abrir vaga.
                      </p>
                      <button
                        className="mt-3 w-full rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                        disabled={isJoiningWaitlist}
                        onClick={joinWaitlistNow}
                        type="button"
                      >
                        {isJoiningWaitlist
                          ? "Enviando…"
                          : "Entrar na lista de espera"}
                      </button>
                    </>
                  )}
                  {waitlistError && (
                    <p
                      className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                      role="alert"
                    >
                      {waitlistError}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  className="mt-4 w-full rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                  disabled={isBooking}
                  onClick={startPendingBooking}
                  type="button"
                >
                  {isBooking ? "Iniciando..." : "Iniciar reserva"}
                </button>
              )}
              {bookingError && (
                <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {bookingError}
                </p>
              )}
            </div>
          </aside>
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Datas disponíveis</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {productDates.length === 0 && (
              <p className="text-gray-500">
                Nenhuma data disponível no momento.
              </p>
            )}
            {productDates.map((productDate) => (
              <article
                className="rounded-lg border bg-white p-4 shadow-sm"
                key={productDate.id}
              >
                <p className="font-semibold">
                  {formatDate(productDate.start_date)} até{" "}
                  {formatDate(productDate.end_date)}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  {productDate.available_slots} vagas disponíveis
                </p>
                <p className="mt-3 font-semibold">
                  {formatCurrency(productDate.price_override ?? displayPrice)}
                </p>
              </article>
            ))}
          </div>
        </section>

        {itinerary.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Roteiro dia a dia</h2>
            <ol className="mt-6 space-y-6 border-l-2 border-orange-200 pl-6">
              {itinerary.map((day, index) => (
                <li className="relative" key={index}>
                  <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                    {day.day || index + 1}
                  </span>
                  <h3 className="font-semibold">{day.title}</h3>
                  {day.description && (
                    <p className="mt-1 whitespace-pre-line text-gray-700">
                      {day.description}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {faq.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Perguntas frequentes</h2>
            <div className="mt-4 divide-y rounded-lg border bg-white">
              {faq.map((item, index) => (
                <details className="group p-4" key={index}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold marker:hidden">
                    {item.question}
                    <span className="text-xl text-orange-500 transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-gray-700">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-item">
          <Link href={"/favorites"}>Meus favoritos</Link>
        </p>
        <p className="drawer-item">
          <Link href={"/bookings"}>Minhas reservas</Link>
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

  const fallbackProduct = getFallbackProductBySlug(slug);

  try {
    const product = await getProductBySlugServer(slug);
    if (!product) {
      if (fallbackProduct) {
        return {
          props: {
            product: fallbackProduct,
            productDates: fallbackProductDates,
          },
        };
      }
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

    if (fallbackProduct) {
      return {
        props: {
          product: fallbackProduct,
          productDates: fallbackProductDates,
        },
      };
    }

    return {
      notFound: true,
    };
  }
};
