import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useState } from "react";
import {
  getFriendlyAuthError,
  getSafeInternalPath,
  signInWithEmailOtp,
  signInWithEmailPassword,
  signInWithSupabaseGoogle,
  signUpWithEmailPassword,
} from "../../lib/auth/client";
import { gaEvent } from "../../lib/analytics/gtag";

type Mode = "signin" | "signup";
type Action = "password" | "google" | "otp" | null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fieldClass =
  "mt-1 w-full rounded-lg border px-3 py-2.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";

const AuthPage = () => {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [action, setAction] = useState<Action>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const nextPath = getSafeInternalPath(router.query.next);
  const isLoading = action !== null;

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };
  const hasValidEmail = () => {
    if (emailPattern.test(email.trim())) return true;
    setError("Informe um e-mail válido.");
    return false;
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    clearMessages();
    if (!hasValidEmail()) return;
    if (!password) return setError("Informe sua senha.");
    if (mode === "signup" && !name.trim()) return setError("Informe seu nome.");
    if (mode === "signup" && password.length < 8)
      return setError("A senha deve ter pelo menos 8 caracteres.");
    if (mode === "signup" && password !== confirmation)
      return setError("As senhas não coincidem.");

    setAction("password");
    try {
      if (mode === "signin") {
        const result = await signInWithEmailPassword(email, password);
        if (result.error) return setError(getFriendlyAuthError(result.error));
        await router.replace(nextPath);
      } else {
        const result = await signUpWithEmailPassword(
          name,
          email,
          password,
          nextPath
        );
        if (result.error) return setError(getFriendlyAuthError(result.error));
        gaEvent("sign_up", { method: "email" });
        if (result.data.session) await router.replace(nextPath);
        else
          setSuccess(
            "Cadastro realizado. Confira seu e-mail para confirmar a conta."
          );
      }
    } catch {
      setError("Não foi possível concluir o login. Tente novamente.");
    } finally {
      setAction(null);
    }
  };

  const continueWithGoogle = async () => {
    clearMessages();
    setAction("google");
    try {
      const result = await signInWithSupabaseGoogle(nextPath);
      if (result.error) setError(getFriendlyAuthError(result.error));
    } catch {
      setError("Não foi possível concluir o login. Tente novamente.");
    } finally {
      setAction(null);
    }
  };

  const sendOtp = async () => {
    clearMessages();
    if (!hasValidEmail()) return;
    setAction("otp");
    try {
      await signInWithEmailOtp(email, nextPath);
      setSuccess(
        "Se o e-mail estiver habilitado, você receberá um código ou link de acesso."
      );
    } catch {
      setError("Não foi possível enviar o e-mail agora. Tente novamente.");
    } finally {
      setAction(null);
    }
  };

  const changeMode = () => {
    clearMessages();
    setMode((current) => (current === "signin" ? "signup" : "signin"));
    setPassword("");
    setConfirmation("");
  };

  return (
    <>
      <Head>
        <title>{mode === "signin" ? "Entrar" : "Criar conta"} | RW Turismo</title>
        <meta name="description" content="Acesse sua conta na RW Turismo." />
      </Head>
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
        <div className="mx-auto grid max-w-4xl overflow-hidden rounded-2xl border bg-white shadow-lg md:grid-cols-[0.9fr_1.1fr]">
          <section className="hidden bg-orange-50 p-10 md:flex md:flex-col md:justify-between">
            <Link className="text-xl font-bold text-orange-600" href="/">
              RW Turismo
            </Link>
            <div className="relative mx-auto h-64 w-full max-w-xs">
              <Image
                alt="Planeje sua viagem com a RW Turismo"
                className="object-contain"
                fill
                src="/travel-signin.svg"
              />
            </div>
            <p className="text-sm text-slate-600">
              Pacotes, experiências e destinos para sua próxima viagem.
            </p>
          </section>

          <section className="p-6 sm:p-10">
            <div className="mb-8 flex items-center justify-between md:hidden">
              <span className="text-xl font-bold text-orange-600">RW Turismo</span>
              <Link className="text-sm text-slate-600" href="/">
                Voltar para o início
              </Link>
            </div>
            <Link
              className="mb-8 hidden text-sm text-slate-600 hover:text-orange-600 md:inline-flex"
              href="/"
            >
              ← Voltar para o início
            </Link>
            <h1 className="text-3xl font-semibold">
              {mode === "signin" ? "Entre na sua conta" : "Crie sua conta"}
            </h1>
            <p className="mt-2 text-slate-600">
              Acesse suas reservas, favoritos e viagens.
            </p>

            <form className="mt-8 space-y-4" onSubmit={submitPassword}>
              {mode === "signup" && (
                <label className="block text-sm font-medium">
                  Nome
                  <input
                    autoComplete="name"
                    className={fieldClass}
                    disabled={isLoading}
                    onChange={(event) => setName(event.target.value)}
                    value={name}
                  />
                </label>
              )}
              <label className="block text-sm font-medium">
                E-mail
                <input
                  autoComplete="email"
                  className={fieldClass}
                  disabled={isLoading}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  value={email}
                />
              </label>
              <label className="block text-sm font-medium">
                Senha
                <input
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className={fieldClass}
                  disabled={isLoading}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </label>
              {mode === "signup" && (
                <label className="block text-sm font-medium">
                  Confirmar senha
                  <input
                    autoComplete="new-password"
                    className={fieldClass}
                    disabled={isLoading}
                    onChange={(event) => setConfirmation(event.target.value)}
                    type="password"
                    value={confirmation}
                  />
                </label>
              )}
              {mode === "signin" && (
                <div className="text-right">
                  <Link className="text-sm font-medium text-orange-600" href="/forgot-password">
                    Esqueceu sua senha?
                  </Link>
                </div>
              )}
              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
              )}
              {success && (
                <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                  {success}
                </p>
              )}
              <button
                className="w-full rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                disabled={isLoading}
                type="submit"
              >
                {action === "password"
                  ? "Aguarde..."
                  : mode === "signin"
                  ? "Entrar"
                  : "Criar conta"}
              </button>
            </form>

            {mode === "signin" && (
              <>
                <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" /> ou
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="space-y-3">
                  <button
                    className="w-full rounded-lg border px-4 py-3 font-semibold hover:bg-slate-50 disabled:opacity-60"
                    disabled={isLoading}
                    onClick={continueWithGoogle}
                    type="button"
                  >
                    {action === "google" ? "Redirecionando..." : "Continuar com Google"}
                  </button>
                  <button
                    className="w-full rounded-lg border px-4 py-3 font-semibold hover:bg-slate-50 disabled:opacity-60"
                    disabled={isLoading}
                    onClick={sendOtp}
                    type="button"
                  >
                    {action === "otp" ? "Enviando..." : "Receber código por e-mail"}
                  </button>
                </div>
              </>
            )}
            <p className="mt-7 text-center text-sm text-slate-600">
              {mode === "signin"
                ? "Ainda não possui uma conta?"
                : "Já possui uma conta?"}{" "}
              <button
                className="font-semibold text-orange-600"
                disabled={isLoading}
                onClick={changeMode}
                type="button"
              >
                {mode === "signin" ? "Criar conta" : "Entrar"}
              </button>
            </p>
          </section>
        </div>
      </main>
    </>
  );
};

export default AuthPage;
