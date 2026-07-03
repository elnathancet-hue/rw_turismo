import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabasePublicEnv } from "../env";
import type { Database } from "./types";

type ServerClientContext = {
  req?: Pick<NextApiRequest, "cookies">;
  res?: NextApiResponse;
};

type ResponseCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

const serializeCookie = (
  name: string,
  value: string,
  options: CookieOptions = {}
): string => {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  if (options.httpOnly) parts.push("HttpOnly");

  return parts.join("; ");
};

const appendSetCookieHeader = (
  res: NextApiResponse | undefined,
  cookies: ResponseCookie[]
) => {
  if (!res || cookies.length === 0) return;

  const existing = res.getHeader("Set-Cookie");
  const serialized = cookies.map(({ name, value, options }) =>
    serializeCookie(name, value, options)
  );

  if (!existing) {
    res.setHeader("Set-Cookie", serialized);
    return;
  }

  res.setHeader(
    "Set-Cookie",
    Array.isArray(existing)
      ? [...existing.map(String), ...serialized]
      : [String(existing), ...serialized]
  );
};

export const createSupabaseServerClient = (
  context: ServerClientContext = {}
): SupabaseClient<Database> => {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv();
  const { req, res } = context;

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return Object.entries(req?.cookies ?? {}).map(([name, value]) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        appendSetCookieHeader(res, cookiesToSet);
      },
    },
  });
};
