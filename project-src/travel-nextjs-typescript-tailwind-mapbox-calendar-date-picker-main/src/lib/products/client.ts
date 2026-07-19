import { createSupabaseBrowserClient } from "../supabase/browser";
import type { Category, Product, ProductDate, ProductType } from "./types";

// The five product types accepted by the "tipo" search filter.
const isProductType = (value: string): value is ProductType =>
  ["package", "hotel", "flight", "stay", "experience"].includes(value);

const productsTable = () =>
  (createSupabaseBrowserClient() as any).from("products");

const productDatesTable = () =>
  (createSupabaseBrowserClient() as any).from("product_dates");

const categoriesTable = () =>
  (createSupabaseBrowserClient() as any).from("categories");

// Turns the embedded product_categories rows into a flat category_ids array.
const withCategoryIds = (row: any): Product => {
  const { product_categories, ...rest } = row ?? {};
  return {
    ...rest,
    category_ids: Array.isArray(product_categories)
      ? product_categories.map((pc: any) => pc?.category_id).filter(Boolean)
      : [],
  } as Product;
};

export const getActiveProducts = async (): Promise<Product[]> => {
  const { data, error } = await productsTable()
    .select("*, product_categories(category_id)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as any[]).map(withCategoryIds);
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
  promo?: boolean;
  tipo?: string | null;
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
  const tipo = filters.tipo?.trim() ?? "";

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

  if (filters.promo) {
    query = query.not("promotional_price", "is", null);
  }

  if (isProductType(tipo)) {
    query = query.eq("type", tipo);
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

  // Rotula quem está sem saída futura e joga para o fim da lista (continua
  // visível para capturar lista de espera).
  const today = new Date().toISOString().slice(0, 10);
  const annotated = rows
    .map((product) => ({
      ...product,
      has_future_date: (product.product_dates ?? []).some(
        (date) => date.active && date.start_date >= today
      ),
    }))
    .sort((a, b) => Number(b.has_future_date) - Number(a.has_future_date));

  return annotated as Product[];
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
