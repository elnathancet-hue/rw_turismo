import type { Session, User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "../supabase/browser";
import { ensureUserProfile, getUserProfile, type UserProfile } from "./profile";

export const getAuthBaseUrl = (): string => {
  const rawUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL;

  if (!rawUrl) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL.");
  }

  const normalizedUrl = rawUrl.trim().replace(/\/+$/, "");
  const parsedUrl = new URL(normalizedUrl);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Invalid site URL protocol.");
  }

  return parsedUrl.origin;
};

export const getSafeInternalPath = (
  value: string | string[] | undefined,
  fallback = "/"
): string => {
  const path = Array.isArray(value) ? value[0] : value;

  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }

  return path;
};

export const getAuthCallbackUrl = (nextPath = "/") =>
  `${getAuthBaseUrl()}/auth/callback?next=${encodeURIComponent(
    getSafeInternalPath(nextPath)
  )}`;

export const getFriendlyAuthError = (
  error: { message?: string } | null | undefined
): string => {
  const message = error?.message?.toLowerCase() ?? "";

  if (message.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }

  if (message.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  return "Não foi possível concluir o login. Tente novamente.";
};

export const getSupabaseBrowserSession = async (): Promise<Session | null> => {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
};

export const getSupabaseBrowserUser = async (): Promise<User | null> => {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user;
};

export const isSupabaseBrowserAuthenticated = async (): Promise<boolean> => {
  const user = await getSupabaseBrowserUser();

  return Boolean(user);
};

export const getSupabaseBrowserProfile =
  async (): Promise<UserProfile | null> => {
    const supabase = createSupabaseBrowserClient();
    const user = await getSupabaseBrowserUser();

    if (!user) {
      return null;
    }

    return getUserProfile(supabase, user.id);
  };

export const ensureSupabaseBrowserProfile =
  async (): Promise<UserProfile | null> => {
    const supabase = createSupabaseBrowserClient();
    const user = await getSupabaseBrowserUser();

    if (!user) {
      return null;
    }

    return ensureUserProfile(supabase, user);
  };

export const signInWithSupabaseGoogle = async (nextPath = "/") => {
  const supabase = createSupabaseBrowserClient();

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthCallbackUrl(nextPath),
    },
  });
};

export const signInWithEmailPassword = async (
  email: string,
  password: string
) => {
  const supabase = createSupabaseBrowserClient();
  const result = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (!result.error && result.data.session) {
    await ensureUserProfile(supabase, result.data.user);
  }

  return result;
};

export const signUpWithEmailPassword = async (
  name: string,
  email: string,
  password: string,
  nextPath = "/"
) => {
  const supabase = createSupabaseBrowserClient();
  const result = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        name: name.trim(),
      },
      emailRedirectTo: getAuthCallbackUrl(nextPath),
    },
  });

  if (!result.error && result.data.session && result.data.user) {
    await ensureUserProfile(supabase, result.data.user);
  }

  return result;
};

export const signInWithEmailOtp = async (
  email: string,
  nextPath = "/"
) => {
  const supabase = createSupabaseBrowserClient();

  return supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: getAuthCallbackUrl(nextPath),
      shouldCreateUser: false,
    },
  });
};

export const requestPasswordReset = async (email: string) => {
  const supabase = createSupabaseBrowserClient();

  return supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${getAuthBaseUrl()}/reset-password`,
  });
};

export const updatePassword = async (password: string) => {
  const supabase = createSupabaseBrowserClient();

  return supabase.auth.updateUser({ password });
};

export const signOutFromSupabase = async () => {
  const supabase = createSupabaseBrowserClient();

  return supabase.auth.signOut();
};
