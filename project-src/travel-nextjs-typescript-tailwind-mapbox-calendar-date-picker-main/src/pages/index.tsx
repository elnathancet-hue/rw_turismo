import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import Banner from "../components/Banner";
import CarouselTitlesCard from "../components/CarouselTitlesCard";
import Drawer from "../components/Drawer";
import Footer from "../components/Footer";
import Header from "../components/Header";
import LargeCard from "../components/LargeCard";
import SmallCard from "../components/SmallCard";
import { getActiveProductsServer } from "../lib/products/server";
import type { Product } from "../lib/products/types";
import { IStyleData, ISuggestionFormatted } from "../types/typings";

type Props = {
  citiesData: ISuggestionFormatted[];
  stylesData: IStyleData[];
  getInspiredCities: ISuggestionFormatted[];
  products: Product[];
};

const fallbackCitiesData: ISuggestionFormatted[] = [
  {
    shortName: "Toronto",
    displayName: "Toronto, Ontario, Canada",
    id: 6057937,
    type: "CITY",
    img: "/banner1200x600.jpg",
    location: "Toronto",
    province: "Ontario",
  },
];

const fallbackStylesData: IStyleData[] = [
  {
    img: "/get-inspired1200x600.jpg",
    title: "Get Inspired",
  },
];

const fallbackInspiredCities: ISuggestionFormatted[] = [
  {
    shortName: "Montreal",
    displayName: "Montreal, Quebec, Canada",
    id: 178288,
    type: "CITY",
    img: "/get-inspired1200x600.jpg",
    location: "Montreal",
    province: "Quebec",
  },
];

const fallbackProducts: Product[] = [
  {
    id: "fallback-lencois",
    title: "Lencois Maranhenses Essencial",
    slug: "lencois-maranhenses-essencial",
    description:
      "Pacote de 4 dias com hospedagem, passeio pelas lagoas e traslado compartilhado.",
    type: "package",
    destination: "Barreirinhas, MA",
    price: 1890,
    promotional_price: 1690,
    cover_image: "/get-inspired1200x600.jpg",
    gallery: [],
    active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const Home = ({ citiesData, stylesData, getInspiredCities, products }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(
    null
  );

  return (
    <div className="">
      <Head>
        <title>Travel - Vacation rentals for every style</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {/* Header */}
      <Header
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />
      {/* Banner */}
      <Banner
        getInspiredCities={getInspiredCities}
        setSearchInput={setSearchInput}
        setSelectedCity={setSelectedCity}
      />

      <main className="max-w-7xl mx-auto px-8 sm:px-16">
        <section className="pt-8">
          <h2 className="text-4xl font-semibold pb-5">
            Pacotes em destaque
          </h2>
          {/* Temporary mapper while the legacy hotel search still uses RapidAPI. */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Link
                className="group overflow-hidden rounded-lg border bg-white shadow-sm transition hover:shadow-lg"
                href={`/products/${product.slug}`}
                key={product.id}
              >
                <div className="h-52 bg-gray-100">
                  {product.cover_image && (
                    <img
                      alt={product.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      src={product.cover_image}
                    />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-500">
                    {product.destination}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">
                    {product.title}
                  </h3>
                  {product.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                      {product.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-baseline gap-2">
                    {product.promotional_price ? (
                      <>
                        <span className="text-lg font-semibold text-orange-600">
                          {formatCurrency(product.promotional_price)}
                        </span>
                        <span className="text-sm text-gray-400 line-through">
                          {formatCurrency(product.price)}
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-semibold">
                        {formatCurrency(product.price)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="pt-6">
          <h2 className="text-4xl font-semibold pb-5">
            Most visited Canadian cities
          </h2>
          {/* Map Canadian cities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {citiesData.map((city) => (
              <SmallCard
                key={city.img}
                cityData={city}
                setSearchInput={setSearchInput}
                setSelectedCity={setSelectedCity}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-4xl font-semibold py-8">
            Find your travel style
          </h2>
          {/* Map styles data from api */}
          <CarouselTitlesCard images={stylesData} />
          {/* Travel Styles Carousel */}
        </section>

        <LargeCard
          img="/get-inspired1200x600.jpg"
          title="Discover New Destinations"
          description="Curated by our Travel Experts"
          buttonText="Get Inspired"
          getInspiredCities={getInspiredCities}
          setSearchInput={setSearchInput}
          setSelectedCity={setSelectedCity}
        />
      </main>
      <Footer />

      {/* Drawer */}
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

export default Home;

export const getStaticProps = async () => {
  let products = fallbackProducts;

  try {
    const supabaseProducts = await getActiveProductsServer();

    if (supabaseProducts.length > 0) {
      products = supabaseProducts;
    }
  } catch (error) {
    console.error("Failed to load Supabase products for homepage", error);
  }

  return {
    props: {
      products,
      // Legacy visual blocks keep local fallback data until the homepage is fully redesigned around Supabase products.
      citiesData: fallbackCitiesData,
      stylesData: fallbackStylesData,
      getInspiredCities: fallbackInspiredCities,
    },
  };
};
