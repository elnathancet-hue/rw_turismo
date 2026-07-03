import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";
import Drawer from "../components/Drawer";
import Header from "../components/Header";
import {
  signInWithSupabaseGoogle,
  signOutFromSupabase,
} from "../lib/auth/client";
import { ISuggestionFormatted } from "../types/typings";

const getSafeNextPath = (value: string | string[] | undefined): string => {
  const nextPath = Array.isArray(value) ? value[0] : value;

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  return nextPath;
};

const SignIn = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    const { error: signInError } = await signInWithSupabaseGoogle(
      getSafeNextPath(router.query.next)
    );

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
    }
  };

  const handleSupabaseLogout = async () => {
    const { error: logoutError } = await signOutFromSupabase();

    if (logoutError) {
      setError(logoutError.message);
    }
  };

  return (
    <div className="h-screen">
      <Head>
        <title>Entrar | RW Turismo</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {/* Header */}
      <Header
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />
      {/* Main */}
      <main className="h-[80%]">
        <div className="relative h-[80%]">
          <Image
            className="-translate-y-[55px] max-w-xl p-5 mx-auto"
            src="/travel-signin.svg"
            fill
            alt="RW Turismo"
          />
          <div className="absolute top-[78%] w-full px-4 text-center">
            <button
              className="text-red-600 bg-white border px-10 py-4 shadow-md rounded-full font-bold my-3 hover:shadow-xl active:scale-90 transition duration-150 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isLoading}
              onClick={handleGoogleSignIn}
              type="button"
            >
              {isLoading ? "Redirecionando..." : "Entrar com Google"}
            </button>
            {error && (
              <p className="mx-auto max-w-md rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      </main>
      {/* Drawer */}
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-item">Meus favoritos</p>
        <p className="drawer-item">Minhas reservas</p>
        <p onClick={handleSupabaseLogout} className="drawer-item">
          Sair
        </p>
      </Drawer>
    </div>
  );
};

export default SignIn;
