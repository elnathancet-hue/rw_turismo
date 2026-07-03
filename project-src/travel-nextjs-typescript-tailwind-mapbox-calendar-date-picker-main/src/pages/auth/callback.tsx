import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { ensureSupabaseBrowserProfile } from "../../lib/auth/client";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

const getSafeNextPath = (value: string | string[] | undefined): string => {
  const nextPath = Array.isArray(value) ? value[0] : value;

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  return nextPath;
};

const SupabaseAuthCallback = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const handleCallback = async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      try {
        await ensureSupabaseBrowserProfile();
        await router.replace(getSafeNextPath(router.query.next));
      } catch (profileError) {
        setError(
          profileError instanceof Error
            ? profileError.message
            : "Não foi possível preparar o perfil do usuário."
        );
      }
    };

    handleCallback();
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
            Aguarde enquanto preparamos sua sessao.
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
