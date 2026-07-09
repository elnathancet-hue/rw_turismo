import type { Json } from "../supabase/types";

export type ProductType = "package" | "hotel" | "flight" | "stay" | "experience";

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
  active: boolean;
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
