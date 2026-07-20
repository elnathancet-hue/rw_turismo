import type { Json } from "../supabase/types";

export type ProductType = "package" | "hotel" | "flight" | "stay" | "experience";

export type ItineraryDay = { day: number; title: string; description: string };

export type FaqItem = { question: string; answer: string };

// Opção de suíte/quarto com preço próprio (informativo — não altera a reserva).
export type ProductTier = { name: string; price: number };

export type Product = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  type: ProductType;
  destination: string;
  origin: string | null;
  price: number;
  promotional_price: number | null;
  cover_image: string | null;
  gallery: Json;
  itinerary: Json;
  faq: Json;
  tiers?: ProductTier[];
  active: boolean;
  // Ids das categorias (temas comerciais) às quais o produto pertence. Anexado
  // ao carregar via product_categories; usado no filtro "por categoria" da home.
  category_ids?: string[];
  // Anotado na vitrine: o produto tem alguma saída futura ativa? (undefined =
  // não calculado; false = mostrar "novas datas em breve" e despriorizar)
  has_future_date?: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductDate = {
  id: string;
  product_id: string;
  start_date: string;
  end_date: string;
  available_slots: number;
  price_override: number | null;
  departure_time?: string | null;
  return_time?: string | null;
  total_seats?: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};
