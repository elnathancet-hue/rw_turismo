import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "../env";
import type { Database } from "./types";

let adminClient: SupabaseClient<Database> | null = null;

export const createSupabaseAdminClient = (): SupabaseClient<Database> => {
  if (typeof window !== "undefined") {
    throw new Error("Supabase admin client cannot be used in the browser.");
  }

  if (adminClient) {
    return adminClient;
  }

  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseAdminEnv();

  adminClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
};
