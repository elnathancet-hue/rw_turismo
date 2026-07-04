import Head from "next/head";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { updatePassword } from "../lib/auth/client";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);
    try {
      const { error: authError } = await updatePassword(password);
      if (authError) {
        setError("O link é inválido ou expirou. Solicite uma nova recuperação.");
        return;
      }
      setSuccess(true);
      setPassword("");
      setConfirmation("");
    } catch {
      setError("Não foi possível atualizar sua senha. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Definir nova senha | RW Turismo</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-lg">
          <Link className="text-xl font-bold text-orange-600" href="/">
            RW Turismo
          </Link>
          <h1 className="mt-8 text-3xl font-semibold">Defina uma nova senha</h1>
          <p className="mt-2 text-slate-600">
            Escolha uma senha segura para sua conta.
          </p>
          <form className="mt-7 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium">
              Nova senha
              <input
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border px-3 py-2.5 outline-none focus:border-orange-500"
                disabled={isLoading}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <label className="block text-sm font-medium">
              Confirmar nova senha
              <input
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border px-3 py-2.5 outline-none focus:border-orange-500"
                disabled={isLoading}
                onChange={(event) => setConfirmation(event.target.value)}
                type="password"
                value={confirmation}
              />
            </label>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {success && (
              <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                Senha atualizada com sucesso. Você já pode entrar.
              </p>
            )}
            <button
              className="w-full rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white disabled:opacity-60"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
          <Link className="mt-6 inline-flex text-sm font-medium text-orange-600" href="/signin">
            Ir para o login
          </Link>
        </section>
      </main>
    </>
  );
};

export default ResetPassword;
