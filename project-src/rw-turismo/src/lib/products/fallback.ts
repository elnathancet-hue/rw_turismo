import type { Product, ProductDate } from "./types";

export const fallbackProducts: Product[] = [
  {
    id: "fallback-lencois",
    title: "Lençóis Maranhenses Essencial",
    slug: "lencois-maranhenses-essencial",
    description:
      "Pacote de 4 dias com hospedagem, passeio pelas lagoas e traslado compartilhado.",
    type: "package",
    destination: "Barreirinhas, MA",
    origin: "Teresina",
    price: 1890,
    promotional_price: 1690,
    cover_image: "/get-inspired1200x600.jpg",
    gallery: [],
    itinerary: [],
    faq: [],
    active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

export const fallbackProductDates: ProductDate[] = [];

export const getFallbackProductBySlug = (slug: string) =>
  fallbackProducts.find((product) => product.slug === slug) ?? null;

