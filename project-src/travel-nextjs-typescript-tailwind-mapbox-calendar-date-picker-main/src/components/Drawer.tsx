import { useRouter } from "next/router";
import { Dispatch, SetStateAction } from "react";
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
        className={
          " w-screen max-w-[225px] right-0 absolute bg-white h-full shadow-xl delay-400 duration-500 ease-in-out transition-all transform  " +
          (isOpen ? " translate-x-0 " : " translate-x-full ")
        }
      >
        <article className="relative w-screen max-w-[240px] px-5 py-[85px] flex flex-col space-y-3 overflow-y-scroll h-full">
          {!isAuthenticated ? (
            <>
              <header className="py-3">
                <h2 className="text-lg font-semibold">Welcome to Travel!</h2>
              </header>
              <p>
                <span
                  onClick={goToSignIn}
                  className="font-bold text-orange-500 active:text-orange-600 cursor-pointer"
                >
                  {isLoading ? "Checking session" : "Sign in"}
                </span>{" "}
                to have a better experience
              </p>
            </>
          ) : (
            <>
              <header className="py-3">
                <h2 className="text-lg font-semibold">
                  {profile?.name || user?.email || "Traveler"}
                </h2>
                <p className="text-xs font-light">{user?.email}</p>
              </header>
              {[children]}
              <p onClick={handleLogout} className="drawer-item">
                Sign out
              </p>
            </>
          )}
        </article>
      </section>
      <section
        className=" w-screen h-full cursor-pointer "
        onClick={() => {
          setIsOpen(false);
        }}
      ></section>
    </main>
  );
};

export default Drawer;
