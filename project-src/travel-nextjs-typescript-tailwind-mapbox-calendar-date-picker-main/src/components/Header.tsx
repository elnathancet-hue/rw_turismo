import {
  Bars3Icon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import Link from "next/link";
import { useRouter } from "next/router";
import { Dispatch, FormEvent, SetStateAction } from "react";
import useSiteMenu from "../hooks/useSiteMenu";
import useSupabaseSession from "../hooks/useSupabaseSession";
import { ISuggestionFormatted } from "../types/typings";

type Props = {
  placeholder?: string;
  searchInput: string;
  setSearchInput: Dispatch<SetStateAction<string>>;
  // Kept optional for backward compatibility with pages that still pass them.
  selectedCity?: ISuggestionFormatted | null;
  setSelectedCity?: Dispatch<SetStateAction<ISuggestionFormatted | null>>;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

// Keeps the desktop nav from crowding out the search when the admin adds
// many links; the drawer still lists all of them.
const MAX_HEADER_MENU_ITEMS = 5;

const menuLinkClass =
  "max-w-[9rem] truncate whitespace-nowrap text-sm font-medium text-gray-600 transition hover:text-orange-600";

const Header = ({
  placeholder,
  searchInput,
  setSearchInput,
  isOpen,
  setIsOpen,
}: Props) => {
  const { isAuthenticated } = useSupabaseSession();
  const { isLoading: isMenuLoading, items: menuItems } = useSiteMenu();
  const router = useRouter();

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const destino = searchInput.trim();
    router.push({ pathname: "/search", query: destino ? { destino } : {} });
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-white p-3 shadow-md md:px-10">
      {/* Logo */}
      <Link className="text-xl font-bold text-orange-600" href="/">
        RW Turismo
      </Link>

      {/* Site navigation (managed in /admin/menu) */}
      {!isMenuLoading && menuItems.length > 0 && (
        <nav
          aria-label="Menu do site"
          className="hidden shrink-0 items-center gap-4 lg:flex"
        >
          {menuItems.slice(0, MAX_HEADER_MENU_ITEMS).map((item) =>
            item.url.startsWith("/") ? (
              <Link className={menuLinkClass} href={item.url} key={item.id}>
                {item.label}
              </Link>
            ) : (
              <a
                className={menuLinkClass}
                href={item.url}
                key={item.id}
                rel="noopener noreferrer"
                target="_blank"
              >
                {item.label}
              </a>
            )
          )}
        </nav>
      )}

      {/* Quick destination search */}
      <form
        className="hidden flex-1 items-center justify-between rounded-full border-2 px-4 py-1.5 shadow-sm md:flex md:max-w-md"
        onSubmit={handleSearch}
        role="search"
      >
        <label className="sr-only" htmlFor="header-search">
          Buscar destino
        </label>
        <input
          className="min-w-0 flex-grow bg-transparent text-sm outline-none placeholder-gray-400"
          id="header-search"
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={placeholder || "Para onde você quer viajar?"}
          type="text"
          value={searchInput}
        />
        <button
          aria-label="Buscar"
          className="ml-2 rounded-full bg-orange-500 p-2 text-white transition hover:bg-orange-600"
          type="submit"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
        </button>
      </form>

      {/* User menu */}
      <div className="flex items-center gap-2 rounded-full border-2 p-1.5 text-gray-500">
        <button
          aria-expanded={isOpen}
          aria-label="Abrir menu"
          className="cursor-pointer rounded-full p-1 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          {isOpen ? (
            <XMarkIcon className="h-6 w-6" />
          ) : (
            <Bars3Icon className="h-6 w-6" />
          )}
        </button>
        <UserCircleIcon
          aria-hidden="true"
          className={`h-6 w-6 ${isAuthenticated ? "text-orange-500" : ""}`}
        />
      </div>
    </header>
  );
};

export default Header;
