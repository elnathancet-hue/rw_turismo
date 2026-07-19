import { createSupabaseBrowserClient } from "../supabase/browser";
import type { Favorite, FavoriteIdentifier, FavoriteInput } from "./types";

const favoritesTable = () =>
  (createSupabaseBrowserClient() as any).from("favorites");

const getAuthenticatedUserId = async (): Promise<string> => {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("User must be authenticated to manage favorites.");
  }

  return data.user.id;
};

const applyFavoriteIdentifier = (query: any, identifier: FavoriteIdentifier) => {
  if ("product_id" in identifier) {
    return query.eq("product_id", identifier.product_id);
  }

  return query
    .eq("provider", identifier.provider ?? "rapidapi")
    .eq("external_hotel_id", identifier.external_hotel_id);
};

const findFavorite = async (
  userId: string,
  identifier: FavoriteIdentifier
): Promise<Favorite | null> => {
  const query = favoritesTable().select("*").eq("user_id", userId);
  const { data, error } = await applyFavoriteIdentifier(query, identifier)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Favorite | null;
};

export const getMyFavorites = async (): Promise<Favorite[]> => {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await favoritesTable()
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Favorite[];
};

export const addFavorite = async (
  favorite: FavoriteInput
): Promise<Favorite> => {
  const userId = await getAuthenticatedUserId();
  const provider = favorite.provider ?? "internal";
  const identifier =
    favorite.product_id
      ? { product_id: favorite.product_id, provider }
      : favorite.external_hotel_id
      ? { external_hotel_id: favorite.external_hotel_id, provider }
      : null;

  if (!identifier) {
    throw new Error("Favorite must include product_id or external_hotel_id.");
  }

  const { data, error } = await favoritesTable()
    .insert({
      user_id: userId,
      product_id: favorite.product_id ?? null,
      external_hotel_id: favorite.external_hotel_id ?? null,
      title: favorite.title,
      destination: favorite.destination ?? null,
      image_url: favorite.image_url ?? null,
      provider,
      metadata: favorite.metadata ?? {},
    })
    .select("*")
    .single();

  if (!error) {
    return data as Favorite;
  }

  if (error.code === "23505") {
    const existingFavorite = await findFavorite(userId, identifier);

    if (existingFavorite) {
      return existingFavorite;
    }
  }

  throw error;
};

export const removeFavorite = async (
  identifier: FavoriteIdentifier
): Promise<void> => {
  const userId = await getAuthenticatedUserId();
  const query = favoritesTable().delete().eq("user_id", userId);
  const { error } = await applyFavoriteIdentifier(query, identifier);

  if (error) {
    throw error;
  }
};

export const isFavorite = async (
  identifier: FavoriteIdentifier
): Promise<boolean> => {
  const userId = await getAuthenticatedUserId();
  const favorite = await findFavorite(userId, identifier);

  return Boolean(favorite);
};
