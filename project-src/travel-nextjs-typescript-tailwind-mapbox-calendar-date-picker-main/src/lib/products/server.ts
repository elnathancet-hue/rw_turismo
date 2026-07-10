import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseServerClient } from "../supabase/server";
import type { Product, ProductDate } from "./types";

type ProductServerContext = {
  req?: Pick<NextApiRequest, "cookies">;
  res?: NextApiResponse;
};

const serverClient = (context: ProductServerContext = {}) =>
  createSupabaseServerClient(context) as any;

export const getActiveProductsServer = async (
  context: ProductServerContext = {}
): Promise<Product[]> => {
  const { data, error } = await serverClient(context)
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Product[];
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
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Product | null;
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
    .gte("start_date", today)
    .order("start_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProductDate[];
};
