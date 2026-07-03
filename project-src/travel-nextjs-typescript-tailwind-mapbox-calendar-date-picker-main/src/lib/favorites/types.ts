import type { Json } from "../supabase/types";

export type FavoriteProvider = "internal" | "rapidapi";

export type Favorite = {
  id: string;
  user_id: string;
  product_id: string | null;
  external_hotel_id: string | null;
  title: string;
  destination: string | null;
  image_url: string | null;
  provider: FavoriteProvider;
  metadata: Json;
  created_at: string;
};

export type FavoriteInput = {
  product_id?: string | null;
  external_hotel_id?: string | null;
  title: string;
  destination?: string | null;
  image_url?: string | null;
  provider?: FavoriteProvider;
  metadata?: Json;
};

export type FavoriteIdentifier =
  | {
      product_id: string;
      provider?: FavoriteProvider;
    }
  | {
      external_hotel_id: string;
      provider?: FavoriteProvider;
    };
