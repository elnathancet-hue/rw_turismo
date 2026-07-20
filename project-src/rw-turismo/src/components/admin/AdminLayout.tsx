import {
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  CreditCardIcon,
  HomeIcon,
  Squares2X2Icon,
  TagIcon,
  NewspaperIcon,
  PhotoIcon,
  QueueListIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  TruckIcon,
  CakeIcon,
  UsersIcon,
  UserPlusIcon,
  BuildingStorefrontIcon,
  ViewColumnsIcon,
  PuzzlePieceIcon,
  BanknotesIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ArrowRightOnRectangleIcon,
  GlobeAltIcon,
  StarIcon,
  TicketIcon,
  DocumentMagnifyingGlassIcon,
  TrashIcon,
  ChevronUpDownIcon,
  CheckIcon,
  PaintBrushIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import useSupabaseSession from "../../hooks/useSupabaseSession";
import { signOutFromSupabase } from "../../lib/auth/client";

type Props = {
  children: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

// Dois "painéis" (workspaces) — o operacional do dia-a-dia e o do site/CMS. O
// seletor no topo da sidebar troca qual conjunto de grupos aparece.
type PanelId = "operacoes" | "site";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};
type NavGroup = { section: string; panel: PanelId; items: NavItem[] };

const PANELS: { id: PanelId; label: string }[] = [
  { id: "operacoes", label: "Painel de operações" },
  { id: "site", label: "Painel do site" },
];

const navigation: NavGroup[] = [
  {
    section: "Vendas",
    panel: "operacoes",
    items: [
      { href: "/admin", label: "Dashboard", icon: HomeIcon },
      { href: "/admin/bookings", label: "Reservas", icon: ClipboardDocumentListIcon },
      { href: "/admin/payments", label: "Pagamentos", icon: CreditCardIcon },
      { href: "/admin/crm", label: "CRM", icon: ViewColumnsIcon },
      { href: "/admin/waitlist", label: "Lista de espera", icon: UserPlusIcon },
      { href: "/admin/clients", label: "Clientes", icon: UsersIcon },
    ],
  },
  {
    section: "Operação",
    panel: "operacoes",
    items: [
      { href: "/admin/departures", label: "Saídas", icon: TruckIcon },
      { href: "/admin/birthdays", label: "Aniversariantes", icon: CakeIcon },
      { href: "/admin/suppliers", label: "Fornecedores", icon: BuildingStorefrontIcon },
    ],
  },
  {
    section: "Catálogo",
    panel: "operacoes",
    items: [
      { href: "/admin/products", label: "Produtos", icon: Squares2X2Icon },
      { href: "/admin/product-dates", label: "Datas de saída", icon: CalendarDaysIcon },
      { href: "/admin/categories", label: "Categorias", icon: TagIcon },
    ],
  },
  {
    section: "Financeiro",
    panel: "operacoes",
    items: [
      { href: "/admin/finance", label: "Visão geral", icon: BanknotesIcon },
      { href: "/admin/finance/expenses", label: "Despesas", icon: ArrowTrendingDownIcon },
      { href: "/admin/finance/receivables", label: "Recebíveis", icon: ArrowTrendingUpIcon },
    ],
  },
  {
    section: "Sistema",
    panel: "operacoes",
    items: [
      { href: "/admin/integracoes", label: "Integrações", icon: PuzzlePieceIcon },
      { href: "/admin/logs", label: "Logs", icon: DocumentMagnifyingGlassIcon },
      { href: "/admin/trash", label: "Lixeira", icon: TrashIcon },
      { href: "/admin/settings", label: "Configurações", icon: Cog6ToothIcon },
    ],
  },
  {
    section: "Conteúdo",
    panel: "site",
    items: [
      { href: "/admin/home", label: "Home", icon: PhotoIcon },
      { href: "/admin/pages", label: "Páginas", icon: DocumentTextIcon },
      { href: "/admin/blog", label: "Blog", icon: NewspaperIcon },
      { href: "/admin/menu", label: "Menu", icon: Bars3Icon },
      { href: "/admin/footer", label: "Rodapé", icon: QueueListIcon },
      { href: "/admin/aparencia", label: "Aparência", icon: PaintBrushIcon },
    ],
  },
  {
    section: "Marketing",
    panel: "site",
    items: [
      { href: "/admin/coupons", label: "Cupons", icon: TicketIcon },
      { href: "/admin/surveys", label: "Avaliações", icon: StarIcon },
    ],
  },
];

// Painel a que a rota ativa pertence (para "trocar pela rota").
const panelForHref = (href: string | null): PanelId | null =>
  href
    ? navigation.find((group) => group.items.some((item) => item.href === href))
        ?.panel ?? null
    : null;

// O item ativo é o de href MAIS específico que casa com a rota atual — assim
// /admin/finance/expenses acende "Despesas" (e não também "Visão geral").
const findActiveHref = (pathname: string): string | null => {
  let best: string | null = null;
  for (const group of navigation) {
    for (const item of group.items) {
      const matches =
        pathname === item.href ||
        (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
      if (matches && (!best || item.href.length > best.length)) {
        best = item.href;
      }
    }
  }
  return best;
};

const NavGroups = ({
  activeHref,
  panel,
  onNavigate,
}: {
  activeHref: string | null;
  panel: PanelId;
  onNavigate?: () => void;
}) => (
  <div className="space-y-5">
    {navigation
      .filter((group) => group.panel === panel)
      .map((group) => (
      <div key={group.section}>
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {group.section}
        </p>
        <div className="mt-1 space-y-0.5">
          {group.items.map((item) => {
            const isActive = item.href === activeHref;
            const Icon = item.icon;
            return (
              <Link
                className={`flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
                href={item.href}
                key={item.href}
                onClick={onNavigate}
              >
                <Icon
                  className={`h-5 w-5 ${isActive ? "text-orange-600" : "text-gray-400"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    ))}
  </div>
);

const UserBlock = ({ email }: { email: string | null }) => {
  const router = useRouter();
  return (
    <div className="border-t px-3 pt-3">
      {email && (
        <p className="truncate px-1 text-xs text-gray-400" title={email}>
          {email}
        </p>
      )}
      <div className="mt-2 flex items-center gap-1">
        <Link
          className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          href="/"
        >
          <GlobeAltIcon className="h-4 w-4 text-gray-400" />
          Ver site
        </Link>
        <button
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700"
          onClick={async () => {
            await signOutFromSupabase();
            router.push("/signin");
          }}
          type="button"
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
};

// Dropdown que troca entre "Painel de operações" e "Painel do site".
const PanelSwitcher = ({
  panel,
  onChange,
}: {
  panel: PanelId;
  onChange: (panel: PanelId) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = PANELS.find((option) => option.id === panel) ?? PANELS[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="truncate">{current.label}</span>
        <ChevronUpDownIcon className="h-4 w-4 shrink-0 text-gray-400" />
      </button>
      {open && (
        <ul
          className="absolute inset-x-0 z-40 mt-1 overflow-hidden rounded-lg border bg-white shadow-lg"
          role="listbox"
        >
          {PANELS.map((option) => {
            const selected = option.id === panel;
            return (
              <li key={option.id}>
                <button
                  aria-selected={selected}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    selected ? "font-semibold text-orange-700" : "text-gray-700"
                  }`}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  role="option"
                  type="button"
                >
                  <CheckIcon
                    className={`h-4 w-4 ${
                      selected ? "text-orange-600" : "invisible"
                    }`}
                  />
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const AdminLayout = ({ children, title, description, action }: Props) => {
  const router = useRouter();
  const { user } = useSupabaseSession();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const activeHref = findActiveHref(router.pathname);
  // Painel visível. Inicia pela rota (SSR-safe); no mount restaura a última
  // escolha (localStorage) e, ao navegar, acompanha o painel da rota.
  const [panel, setPanel] = useState<PanelId>(
    () => panelForHref(findActiveHref(router.pathname)) ?? "operacoes"
  );
  const prevPathRef = useRef(router.pathname);

  const selectPanel = (next: PanelId) => {
    setPanel(next);
    try {
      window.localStorage.setItem("admin.panel", next);
    } catch {
      // localStorage indisponível — segue sem lembrar.
    }
  };

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem("admin.panel");
    } catch {
      saved = null;
    }
    if (saved === "operacoes" || saved === "site") setPanel(saved);
    prevPathRef.current = router.pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (router.pathname === prevPathRef.current) return;
    prevPathRef.current = router.pathname;
    const routePanel = panelForHref(findActiveHref(router.pathname));
    if (routePanel) selectPanel(routePanel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname]);

  // Fecha o menu mobile ao navegar e com Esc.
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobileNavOpen]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-white lg:flex print:hidden">
        <div className="border-b px-4 py-4">
          <Link
            aria-label="RW Turismo — Início"
            className="mb-3 flex items-center gap-2"
            href="/admin"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="RW Turismo"
              className="h-10 w-auto shrink-0"
              src="/rw-turismo-logo.png"
            />
          </Link>
          <PanelSwitcher onChange={selectPanel} panel={panel} />
        </div>
        <nav className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
          <NavGroups activeHref={activeHref} panel={panel} />
        </nav>
        <div className="px-4 pb-4">
          <UserBlock email={user?.email ?? null} />
        </div>
      </aside>

      {/* Menu mobile (slide-over) */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/40 lg:hidden print:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        >
          <div
            className="flex h-full w-72 flex-col bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="RW Turismo"
                className="h-8 w-auto"
                src="/rw-turismo-logo.png"
              />
              <button
                aria-label="Fechar menu"
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                onClick={() => setIsMobileNavOpen(false)}
                type="button"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="px-4 pb-2">
              <PanelSwitcher onChange={selectPanel} panel={panel} />
            </div>
            <nav className="flex-1 overflow-y-auto px-4 pb-4">
              <NavGroups
                activeHref={activeHref}
                onNavigate={() => setIsMobileNavOpen(false)}
                panel={panel}
              />
            </nav>
            <div className="px-4 pb-4">
              <UserBlock email={user?.email ?? null} />
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-64 print:pl-0">
        <header className="border-b bg-white px-4 py-4 sm:px-6 sm:py-5 print:hidden">
          <div className="flex items-start gap-3">
            <button
              aria-expanded={isMobileNavOpen}
              aria-label="Abrir menu do painel"
              className="mt-0.5 rounded-lg border p-2 text-gray-600 hover:bg-gray-50 lg:hidden"
              onClick={() => setIsMobileNavOpen(true)}
              type="button"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
                {description && (
                  <p className="mt-0.5 text-sm text-gray-500">{description}</p>
                )}
              </div>
              {action}
            </div>
          </div>
        </header>
        <main className="px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
