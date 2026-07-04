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
import { fallbackProducts } from "../lib/products/fallback";
import type { Product } from "../lib/products/types";
import { IStyleData, ISuggestionFormatted } from "../types/typings";
import EditableHome from "../components/home/EditableHome";
import { getPublicHomeContent } from "../lib/content/server";
import type { HomeBanner, HomeSection, SiteSetting } from "../lib/content/types";

type Props = {
  citiesData: ISuggestionFormatted[];
  stylesData: IStyleData[];
  getInspiredCities: ISuggestionFormatted[];
  products: Product[];
};

const fallbackCitiesData: ISuggestionFormatted[] = [
  {
    shortName: "Barreirinhas",
    displayName: "Barreirinhas, Maranhão, Brasil",
    id: 1,
    type: "CITY",
    img: "/banner1200x600.jpg",
    location: "Barreirinhas",
    province: "Maranhão",
  },
];

const fallbackStylesData: IStyleData[] = [
  {
    img: "/get-inspired1200x600.jpg",
    title: "Inspire-se",
  },
];

const fallbackInspiredCities: ISuggestionFormatted[] = [
  {
    shortName: "Barreirinhas",
    displayName: "Barreirinhas, Maranhão, Brasil",
    id: 1,
    type: "CITY",
    img: "/get-inspired1200x600.jpg",
    location: "Barreirinhas",
    province: "Maranhão",
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
        <title>RW Turismo</title>
        <meta
          name="description"
          content="Pacotes, experiências e destinos para sua próxima viagem."
        />
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

        <section>
          <h2 className="text-4xl font-semibold py-8">
            Encontre seu estilo de viagem
          </h2>
          {/* Map styles data from api */}
          <CarouselTitlesCard images={stylesData} />
          {/* Travel Styles Carousel */}
        </section>

        <LargeCard
          img="/get-inspired1200x600.jpg"
          title="Descubra novos destinos"
          description="Seleção especial dos nossos especialistas em viagens"
          buttonText="Inspire-se"
          getInspiredCities={getInspiredCities}
          setSearchInput={setSearchInput}
          setSelectedCity={setSelectedCity}
        />
      </main>
      <Footer />

      {/* Drawer */}
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

export default EditableHome;

export const getStaticProps = async () => {
  let products = fallbackProducts;
  let sections: HomeSection[] = [
    { id: "fallback-featured", section_key: "featured_products", title: "Pacotes em destaque", subtitle: null, content: { limit: 6 }, active: true, display_order: 10, created_at: "", updated_at: "" },
    { id: "fallback-benefits", section_key: "benefits", title: "Viaje com tranquilidade", subtitle: null, content: { items: [{ title: "Atendimento próximo", text: "Conte com nossa equipe." }, { title: "Experiências selecionadas", text: "Roteiros escolhidos com cuidado." }, { title: "Reserva segura", text: "Seus dados protegidos." }] }, active: true, display_order: 20, created_at: "", updated_at: "" },
  ];
  let banners: HomeBanner[] = [{ id: "fallback-banner", title: "Sua próxima viagem começa aqui", subtitle: "Pacotes e experiências escolhidos para você.", image_url: "/banner1200x600.jpg", mobile_image_url: null, button_text: "Ver pacotes", button_url: "#pacotes", overlay_strength: 0.35, active: true, display_order: 0, starts_at: null, ends_at: null, created_at: "", updated_at: "" }];
  let settings: SiteSetting[] = [{ id: "fallback-seo", setting_key: "home_seo", value: { title: "RW Turismo", description: "Pacotes, experiências e destinos para sua próxima viagem.", og_image: "/banner1200x600.jpg" }, updated_at: "" }];
  try {
    products = await getActiveProductsServer();
  } catch (error) {
    console.error("Failed to load products for homepage; using fallback", error);
  }

  try {
    const homeContent = await getPublicHomeContent();
    // Empty arrays are intentional: fallback is used only when Supabase fails.
    sections = homeContent.sections;
    banners = homeContent.banners;
    settings = homeContent.settings;
  } catch (error) {
    console.error("Failed to load editable homepage; using fallback", error);
  }

  return {
    props: {
      products,
      sections,
      banners,
      settings,
    },
    revalidate: 60,
  };
};
