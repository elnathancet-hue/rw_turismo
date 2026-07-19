import Head from "next/head";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { requestPasswordReset } from "../lib/auth/client";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (!emailPattern.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }

    setIsLoading(true);
    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch {
      setError("Não foi possível enviar o e-mail agora. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Recuperar senha | RW Turismo</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-lg">
          <Link className="text-xl font-bold text-orange-600" href="/">
            RW Turismo
          </Link>
          <h1 className="mt-8 text-3xl font-semibold">Recupere sua senha</h1>
          <p className="mt-2 text-slate-600">
            Informe seu e-mail para receber as instruções de recuperação.
          </p>
          <form className="mt-7 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium">
              E-mail
              <input
                autoComplete="email"
                className="mt-1 w-full rounded-lg border px-3 py-2.5 outline-none focus:border-orange-500"
                disabled={isLoading}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {success && (
              <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                Se o e-mail estiver cadastrado, você receberá as instruções em instantes.
              </p>
            )}
            <button
              className="w-full rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white disabled:opacity-60"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? "Enviando..." : "Enviar instruções"}
            </button>
          </form>
          <Link className="mt-6 inline-flex text-sm font-medium text-orange-600" href="/signin">
            Voltar para entrar
          </Link>
        </section>
      </main>
    </>
  );
};

export default ForgotPassword;
