import type { Session, User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "../supabase/browser";
import { ensureUserProfile, getUserProfile, type UserProfile } from "./profile";

const getBrowserOrigin = (): string => {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "";
  }

  return window.location.origin;
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
  const safeNextPath = nextPath.startsWith("/") ? nextPath : "/";
  const redirectTo = `${getBrowserOrigin()}/auth/callback?next=${encodeURIComponent(
    safeNextPath
  )}`;

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });
};

export const signOutFromSupabase = async () => {
  const supabase = createSupabaseBrowserClient();

  return supabase.auth.signOut();
};
