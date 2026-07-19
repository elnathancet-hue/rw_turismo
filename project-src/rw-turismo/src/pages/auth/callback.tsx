import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import {
  ensureSupabaseBrowserProfile,
  getSafeInternalPath,
} from "../../lib/auth/client";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

const SupabaseAuthCallback = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    const handleCallback = async () => {
      const code = Array.isArray(router.query.code)
        ? router.query.code[0]
        : router.query.code;

      if (!code) {
        setError("Não foi possível concluir o login. Tente novamente.");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error: sessionError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (sessionError) {
        if (process.env.NODE_ENV === "development") {
          console.error("Supabase callback exchange failed", sessionError);
        }
        setError("Não foi possível concluir o login. Tente novamente.");
        return;
      }

      try {
        await ensureSupabaseBrowserProfile();
        await router.replace(getSafeInternalPath(router.query.next));
      } catch (profileError) {
        if (process.env.NODE_ENV === "development") {
          console.error("Supabase profile setup failed", profileError);
        }
        setError("Não foi possível concluir o login. Tente novamente.");
      }
    };

    void handleCallback();
  }, [router]);

  return (
    <>
      <Head>
        <title>Autenticação | RW Turismo</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Finalizando login</h1>
          <p className="mt-3 text-sm text-gray-600">
            Aguarde enquanto preparamos sua sessão.
          </p>
          {error && (
            <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </main>
    </>
  );
};

export default SupabaseAuthCallback;
