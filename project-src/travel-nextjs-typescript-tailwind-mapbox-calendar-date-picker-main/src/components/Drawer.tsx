import { useRouter } from "next/router";
import { Dispatch, SetStateAction, useEffect } from "react";
import { signOutFromSupabase } from "../lib/auth/client";
import useSupabaseSession from "../hooks/useSupabaseSession";

type Props = {
  children: React.ReactNode;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

const Drawer = ({ children, isOpen, setIsOpen }: Props) => {
  const router = useRouter();
  const { user, profile, isAuthenticated, isLoading } = useSupabaseSession();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, setIsOpen]);

  const goToSignIn = () => {
    setIsOpen(false);
    router.push("/signin");
  };

  const handleLogout = async () => {
    await signOutFromSupabase();
    setIsOpen(false);
  };

  return (
    <main
      className={
        "h-screen fixed overflow-hidden z-10 bg-gray-900 bg-opacity-25 inset-0 transform ease-in-out" +
        (isOpen
          ? "opacity-100 translate-x-0 ease-out"
          : "transition-all delay-500 opacity-0 translate-x-full")
      }
    >
      <section
        aria-label="Menu"
        className={
          " w-screen max-w-[225px] right-0 absolute bg-white h-full shadow-xl delay-400 duration-500 ease-in-out transition-all transform  " +
          (isOpen ? " translate-x-0 " : " translate-x-full ")
        }
      >
        <nav className="relative w-screen max-w-[240px] px-5 py-[85px] flex flex-col space-y-3 overflow-y-scroll h-full">
          {!isAuthenticated ? (
            <>
              <header className="py-3">
                <h2 className="text-lg font-semibold">
                  Boas-vindas à RW Turismo!
                </h2>
              </header>
              <p>
                <button
                  className="font-bold text-orange-600 hover:text-orange-700"
                  onClick={goToSignIn}
                  type="button"
                >
                  {isLoading ? "Verificando sessão" : "Entrar"}
                </button>{" "}
                para aproveitar uma experiência completa
              </p>
            </>
          ) : (
            <>
              <header className="py-3">
                <h2 className="text-lg font-semibold">
                  {profile?.name || user?.email || "Viajante"}
                </h2>
                <p className="text-xs font-light">{user?.email}</p>
              </header>
              {[children]}
              <button
                className="drawer-item text-left"
                onClick={handleLogout}
                type="button"
              >
                Sair
              </button>
            </>
          )}
        </nav>
      </section>
      <div
        aria-hidden="true"
        className="h-full w-screen"
        onClick={() => setIsOpen(false)}
      />
    </main>
  );
};

export default Drawer;
