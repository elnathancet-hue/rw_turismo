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

export type PackageSearchFilters = {
  origem?: string | null;
  destino?: string | null;
  ida?: string | null;
};

// Distinct departure cities from active products, for the search "Origem" dropdown.
export const getProductOrigins = async (): Promise<string[]> => {
  const { data, error } = await productsTable()
    .select("origin")
    .eq("active", true)
    .not("origin", "is", null);

  if (error) {
    throw error;
  }

  const origins = ((data ?? []) as { origin: string | null }[])
    .map((row) => (row.origin ?? "").trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set(origins)).sort((a, b) => a.localeCompare(b, "pt-BR"));
};

// Search internal packages by departure city, destination text and departure date.
export const searchPackages = async (
  filters: PackageSearchFilters = {}
): Promise<Product[]> => {
  const origem = filters.origem?.trim() ?? "";
  const destino = (filters.destino ?? "").replace(/[(),]/g, " ").trim();
  const ida = filters.ida?.trim() ?? "";

  let query = productsTable()
    .select("*, product_dates(start_date, active)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (origem) {
    query = query.eq("origin", origem);
  }

  if (destino) {
    query = query.or(
      `title.ilike.%${destino}%,destination.ilike.%${destino}%,description.ilike.%${destino}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  type ProductWithDates = Product & {
    product_dates?: { start_date: string; active: boolean }[];
  };

  let rows = (data ?? []) as ProductWithDates[];

  // Soft date filter: keep packages that still have an active departure on/after "Ida".
  if (ida) {
    rows = rows.filter((product) =>
      (product.product_dates ?? []).some(
        (date) => date.active && date.start_date >= ida
      )
    );
  }

  return rows as Product[];
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
