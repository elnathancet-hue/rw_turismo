import { createSupabaseBrowserClient } from "../supabase/browser";
import type { Category, Product, ProductDate } from "./types";

const productsTable = () =>
  (createSupabaseBrowserClient() as any).from("products");

const productDatesTable = () =>
  (createSupabaseBrowserClient() as any).from("product_dates");

const categoriesTable = () =>
  (createSupabaseBrowserClient() as any).from("categories");

export const getActiveProducts = async (): Promise<Product[]> => {
  const { data, error } = await productsTable()
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Product[];
};

export const getProductBySlug = async (
  slug: string
): Promise<Product | null> => {
  const { data, error } = await productsTable()
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Product | null;
};

export const getActiveProductDates = async (
  productId: string
): Promise<ProductDate[]> => {
  const { data, error } = await productDatesTable()
    .select("*")
    .eq("product_id", productId)
    .eq("active", true)
    .order("start_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProductDate[];
};

export const getProductsByCategory = async (
  categorySlug: string
): Promise<Product[]> => {
  const { data, error } = await productsTable()
    .select("*, product_categories!inner(categories!inner(slug))")
    .eq("active", true)
    .eq("product_categories.categories.slug", categorySlug)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Product[];
};

export const searchProducts = async (query: string): Promise<Product[]> => {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return getActiveProducts();
  }

  const { data, error } = await productsTable()
    .select("*")
    .eq("active", true)
    .or(
      `title.ilike.%${normalizedQuery}%,destination.ilike.%${normalizedQuery}%,description.ilike.%${normalizedQuery}%`
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Product[];
};

export const getActiveCategories = async (): Promise<Category[]> => {
  const { data, error } = await categoriesTable()
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Category[];
};
