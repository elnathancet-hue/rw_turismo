import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseServerClient } from "../supabase/server";
import type { Product, ProductDate } from "./types";

type ProductServerContext = {
  req?: Pick<NextApiRequest, "cookies">;
  res?: NextApiResponse;
};

const serverClient = (context: ProductServerContext = {}) =>
  createSupabaseServerClient(context) as any;

// Turns the embedded product_categories rows into a flat category_ids array.
export const withCategoryIds = (row: any): Product => {
  const { product_categories, ...rest } = row ?? {};
  return {
    ...rest,
    category_ids: Array.isArray(product_categories)
      ? product_categories.map((pc: any) => pc?.category_id).filter(Boolean)
      : [],
  } as Product;
};

export const getActiveProductsServer = async (
  context: ProductServerContext = {}
): Promise<Product[]> => {
  const { data, error } = await serverClient(context)
    .from("products")
    .select("*, product_categories(category_id)")
    .eq("active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as any[]).map(withCategoryIds);
};

export const getProductBySlugServer = async (
  slug: string,
  context: ProductServerContext = {}
): Promise<Product | null> => {
  const { data, error } = await serverClient(context)
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Product | null;
};

// Ids de produtos com alguma saída futura ativa — para a vitrine rotular e
// despriorizar os que estão sem data.
export const getFutureDateProductIdsServer = async (
  context: ProductServerContext = {}
): Promise<Set<string>> => {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await serverClient(context)
    .from("product_dates")
    .select("product_id")
    .eq("active", true)
    .is("deleted_at", null)
    .gte("start_date", today);

  if (error) {
    throw error;
  }

  return new Set(
    ((data ?? []) as { product_id: string }[]).map((row) => row.product_id)
  );
};

export const getActiveProductDatesServer = async (
  productId: string,
  context: ProductServerContext = {}
): Promise<ProductDate[]> => {
  // UTC hoje, mesma referência do current_date do Postgres — uma saída que já
  // partiu nunca deve aparecer como comprável (a RPC de reserva também barra).
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await serverClient(context)
    .from("product_dates")
    .select("*")
    .eq("product_id", productId)
    .eq("active", true)
    .is("deleted_at", null)
    .gte("start_date", today)
    .order("start_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProductDate[];
};
