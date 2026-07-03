import Head from "next/head";
import { useEffect, useState } from "react";
import {
  ensureSupabaseBrowserProfile,
  getSupabaseBrowserSession,
  signInWithSupabaseGoogle,
  signOutFromSupabase,
} from "../lib/auth/client";
import type { UserProfile } from "../lib/auth/profile";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type AuthState = {
  loading: boolean;
  email: string | null;
  profile: UserProfile | null;
  error: string | null;
};

const SupabaseAuthTest = () => {
  const [state, setState] = useState<AuthState>({
    loading: true,
    email: null,
    profile: null,
    error: null,
  });

  const refreshAuthState = async () => {
    try {
      const session = await getSupabaseBrowserSession();
      const profile = session?.user
        ? await ensureSupabaseBrowserProfile()
        : null;

      setState({
        loading: false,
        email: session?.user.email ?? null,
        profile,
        error: null,
      });
    } catch (error) {
      setState({
        loading: false,
        email: null,
        profile: null,
        error: error instanceof Error ? error.message : "Unexpected error",
      });
    }
  };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    refreshAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshAuthState();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await signInWithSupabaseGoogle("/supabase-auth-test");

    if (error) {
      setState((current) => ({ ...current, error: error.message }));
    }
  };

  const signOut = async () => {
    const { error } = await signOutFromSupabase();

    if (error) {
      setState((current) => ({ ...current, error: error.message }));
      return;
    }

    await refreshAuthState();
  };

  return (
    <>
      <Head>
        <title>Supabase Auth Test</title>
      </Head>
      <main className="min-h-screen bg-gray-50 px-6 py-10 text-gray-900">
        <div className="mx-auto max-w-2xl rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
            Temporary Supabase Auth test
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            Supabase Auth status
          </h1>

          <div className="mt-6 space-y-3 text-sm">
            <p>
              Session:{" "}
              <span className="font-semibold">
                {state.loading
                  ? "checking"
                  : state.email
                  ? "authenticated"
                  : "not authenticated"}
              </span>
            </p>
            <p>
              Email:{" "}
              <span className="font-semibold">{state.email ?? "none"}</span>
            </p>
            <p>
              Profile role:{" "}
              <span className="font-semibold">
                {state.profile?.role ?? "none"}
              </span>
            </p>
            {state.error && (
              <p className="rounded border border-red-200 bg-red-50 p-3 text-red-700">
                {state.error}
              </p>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              className="rounded bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700"
              onClick={signInWithGoogle}
              type="button"
            >
              Login with Google
            </button>
            <button
              className="rounded border px-4 py-2 font-semibold hover:bg-gray-100"
              onClick={signOut}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </main>
    </>
  );
};

export default SupabaseAuthTest;
