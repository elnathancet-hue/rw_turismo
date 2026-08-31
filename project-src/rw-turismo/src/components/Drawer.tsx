import Link from "next/link";
import { useRouter } from "next/router";
import { Dispatch, SetStateAction, useEffect } from "react";
import { signOutFromSupabase } from "../lib/auth/client";
import useSiteMenu from "../hooks/useSiteMenu";
import { menuIconComponent } from "../lib/content/menuIcons";
import { eLinkInterno, hrefSeguro } from "../lib/security/url";
import useSupabaseSession from "../hooks/useSupabaseSession";

type Props = {
  children: React.ReactNode;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

const Drawer = ({ children, isOpen, setIsOpen }: Props) => {
  const router = useRouter();
  const { user, profile, isAuthenticated, isLoading } = useSupabaseSession();
  const { items: menuItems } = useSiteMenu();

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
          {/* Site navigation — visible for everyone, managed in /admin/menu */}
          {menuItems.length > 0 && (
            <div className="border-b border-gray-100 pb-3">
              <p className="text-xs font-semibold uppercase text-gray-400">
                Navegação
              </p>
              <div className="mt-2 flex flex-col space-y-1">
                {menuItems.map((item) => {
                  const Icon = menuIconComponent(item.icon);
                  const content = (
                    <>
                      {Icon && (
                        <Icon
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-gray-400"
                        />
                      )}
                      <span className="truncate">{item.label}</span>
                    </>
                  );
                  // Mesmo endereço do menu do topo, mesma checagem de esquema
                  // (ver Header.tsx e lib/security/url.ts).
                  const href = hrefSeguro(item.url);
                  if (!href) {
                    return (
                      <span
                        className="drawer-item flex items-center gap-2"
                        key={item.id}
                      >
                        {content}
                      </span>
                    );
                  }
                  return eLinkInterno(item.url) ? (
                    <Link
                      className="drawer-item flex items-center gap-2"
                      href={href}
                      key={item.id}
                      onClick={() => setIsOpen(false)}
                    >
                      {content}
                    </Link>
                  ) : (
                    <a
                      className="drawer-item flex items-center gap-2"
                      href={href}
                      key={item.id}
                      onClick={() => setIsOpen(false)}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {content}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          {!isAuthenticated ? (
            <>
              <header className="py-3">
                <h2 className="text-lg font-semibold">
                  Boas-vindas à RW Turismo!
                </h2>
              </header>
              <div className="flex flex-col gap-2">
                <button
                  className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                  onClick={goToSignIn}
                  type="button"
                >
                  {isLoading ? "Verificando sessão…" : "Login"}
                </button>
                <Link
                  className="rounded-full border border-orange-500 px-4 py-2 text-center text-sm font-semibold text-orange-600 transition hover:bg-orange-50"
                  href="/signin?modo=cadastro"
                  onClick={() => setIsOpen(false)}
                >
                  Cadastre-se
                </Link>
              </div>
              <p className="text-sm text-gray-500">
                Crie sua conta para acompanhar reservas e favoritos.
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
