import {
  ArrowUpTrayIcon,
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
  ShieldCheckIcon,
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
import { canAccessAdminRoute, type StaffRole } from "../../lib/auth/roles";

type Props = {
  children: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

// Dois "painéis" (workspaces) — o operacional do dia-a-dia e o do site/CMS. O
// seletor no topo da sidebar troca qual conjunto de grupos aparece.
export type PanelId = "operacoes" | "site";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};
export type NavGroup = { section: string; panel: PanelId; items: NavItem[] };

const PANELS: { id: PanelId; label: string; inicio: string }[] = [
  // `inicio` e a tela em que a pessoa cai ao trocar de painel. E explicito, e
  // nao "o primeiro item do menu": o primeiro do painel do site e a Home, e
  // quem troca para la quase sempre quer Paginas.
  { id: "operacoes", label: "Painel de operações", inicio: "/admin" },
  { id: "site", label: "Painel do site", inicio: "/admin/pages" },
];

/**
 * A cor de fundo diz em que painel voce esta, sem precisar ler o seletor.
 *
 * O ITEM ATIVO VIRA CARTAO BRANCO nos dois. Ele era laranja sobre laranja-50, o
 * que desapareceria sobre um fundo laranja; branco contrasta com os dois tons e
 * a cor da borda continua dizendo de qual painel se trata.
 */
const TEMA: Record<
  PanelId,
  { fundo: string; ativo: string; icone: string }
> = {
  operacoes: {
    fundo: "bg-blue-50",
    ativo: "border-blue-500 bg-white text-blue-800 shadow-sm",
    icone: "text-blue-600",
  },
  site: {
    fundo: "bg-orange-50",
    ativo: "border-orange-500 bg-white text-orange-800 shadow-sm",
    icone: "text-orange-600",
  },
};

export const navigation: NavGroup[] = [
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
      { href: "/admin/import/clientes", label: "Importar clientes", icon: ArrowUpTrayIcon },
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
      { href: "/admin/import/saidas", label: "Importar saídas", icon: ArrowUpTrayIcon },
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
      { href: "/admin/users", label: "Usuários", icon: ShieldCheckIcon },
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
      { href: "/admin/quizzes", label: "Quizzes", icon: NewspaperIcon },
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

/**
 * Onde a pessoa cai ao trocar de painel.
 *
 * Prefere o `inicio` declarado do painel, mas so se o papel puder abri-lo:
 * `groups` ja chega filtrado por permissao, entao quem nao enxerga Paginas cai
 * no primeiro item que enxerga, em vez de numa tela que o RLS negaria.
 */
export const destinoDoPainel = (
  groups: NavGroup[],
  panel: PanelId
): string | undefined => {
  const doPainel = groups.filter((group) => group.panel === panel);
  const declarado = PANELS.find((p) => p.id === panel)?.inicio;
  const podeAbrir = doPainel.some((group) =>
    group.items.some((item) => item.href === declarado)
  );
  return podeAbrir ? declarado : doPainel[0]?.items[0]?.href;
};

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

// Menu do papel: cada item só aparece se o papel abre aquela rota (mesma regra
// do AdminGuard, em lib/auth/roles.ts). Grupo que ficou sem item desaparece.
const visibleGroupsForRole = (role: StaffRole | null): NavGroup[] =>
  role === null
    ? []
    : navigation
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            canAccessAdminRoute(item.href, role)
          ),
        }))
        .filter((group) => group.items.length > 0);

// Esqueleto enquanto o papel não chegou — evita a lateral piscar vazia.
const NavSkeleton = () => (
  <div className="space-y-2" aria-hidden="true">
    {[...Array(6)].map((_, index) => (
      <div className="h-8 animate-pulse rounded-lg bg-gray-100" key={index} />
    ))}
  </div>
);

const NavGroups = ({
  activeHref,
  groups,
  isLoading,
  panel,
  onNavigate,
}: {
  activeHref: string | null;
  groups: NavGroup[];
  isLoading?: boolean;
  panel: PanelId;
  onNavigate?: () => void;
}) => {
  if (isLoading) return <NavSkeleton />;

  return (
  <div className="space-y-5">
    {groups
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
                    ? TEMA[panel].ativo
                    : "border-transparent text-gray-600 hover:bg-white/70 hover:text-gray-900"
                }`}
                href={item.href}
                key={item.href}
                onClick={onNavigate}
              >
                <Icon
                  className={`h-5 w-5 ${
                    isActive ? TEMA[panel].icone : "text-gray-500"
                  }`}
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
};

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
  panels,
  onChange,
}: {
  panel: PanelId;
  panels: { id: PanelId; label: string }[];
  onChange: (panel: PanelId) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = panels.find((option) => option.id === panel) ?? panels[0];

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

  if (!current) return null;

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
          {panels.map((option) => {
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
  const { user, staffRole, isLoading } = useSupabaseSession();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const activeHref = findActiveHref(router.pathname);
  const groups = visibleGroupsForRole(staffRole);
  // Painel só aparece no seletor se o papel tem algo dentro dele. Papel com um
  // painel só (Financeiro, por exemplo) nem vê o seletor.
  //
  // Enquanto o papel não chegou, mostramos os dois: o AdminGuard e o AdminLayout
  // carregam a sessão em instâncias separadas, então existe um instante em que o
  // Guard já liberou a página e o Layout ainda não sabe o papel. Filtrar nesse
  // intervalo fazia o seletor sumir e a lateral ficar só com a logo.
  const availablePanels = isLoading
    ? PANELS
    : PANELS.filter((option) =>
        groups.some((group) => group.panel === option.id)
      );
  // Painel visível. Inicia pela rota (SSR-safe); no mount restaura a última
  // escolha (localStorage) e, ao navegar, acompanha o painel da rota.
  const [panel, setPanel] = useState<PanelId>(
    () => panelForHref(findActiveHref(router.pathname)) ?? "operacoes"
  );
  const prevPathRef = useRef(router.pathname);

  // Só guarda a escolha. Usado quando quem manda é a ROTA (a pessoa clicou num
  // link do outro painel e o seletor precisa acompanhar) — navegar aqui jogaria
  // ela para fora da tela que acabou de abrir.
  const rememberPanel = (next: PanelId) => {
    setPanel(next);
    try {
      window.localStorage.setItem("admin.panel", next);
    } catch {
      // localStorage indisponível — segue sem lembrar.
    }
  };

  // Escolha feita no seletor: além de trocar o menu, leva para a primeira tela
  // do painel. Trocar de painel e continuar na mesma página não dá sensação
  // nenhuma de mudança — parece que o clique não pegou.
  //
  // O destino sai do próprio menu já filtrado por papel, então cai sempre numa
  // tela que a pessoa pode abrir: Administrador vai para o Dashboard, e quem só
  // tem Catálogo no painel de operações cai no Catálogo em vez de um dashboard
  // que o RLS deixaria zerado.
  const choosePanel = (next: PanelId) => {
    rememberPanel(next);
    const destination = destinoDoPainel(groups, next);
    if (destination && destination !== router.pathname) {
      void router.push(destination);
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
    if (routePanel) rememberPanel(routePanel);
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

  // O painel salvo/da rota pode não existir para este papel — cai no primeiro
  // que ele enxerga, para a sidebar nunca aparecer vazia.
  const effectivePanel =
    availablePanels.find((option) => option.id === panel)?.id ??
    availablePanels[0]?.id ??
    "operacoes";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar desktop */}
      <aside
        className={`fixed inset-y-0 left-0 hidden w-64 flex-col border-r lg:flex print:hidden ${TEMA[effectivePanel].fundo}`}
      >
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
          {availablePanels.length > 1 && (
            <PanelSwitcher
              onChange={choosePanel}
              panel={effectivePanel}
              panels={availablePanels}
            />
          )}
        </div>
        <nav className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
          <NavGroups
            activeHref={activeHref}
            groups={groups}
            isLoading={isLoading}
            panel={effectivePanel}
          />
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
            className={`flex h-full w-72 flex-col shadow-xl ${TEMA[effectivePanel].fundo}`}
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
            {availablePanels.length > 1 && (
              <div className="px-4 pb-2">
                <PanelSwitcher
                  onChange={choosePanel}
                  panel={effectivePanel}
                  panels={availablePanels}
                />
              </div>
            )}
            <nav className="flex-1 overflow-y-auto px-4 pb-4">
              <NavGroups
                activeHref={activeHref}
                groups={groups}
                isLoading={isLoading}
                onNavigate={() => setIsMobileNavOpen(false)}
                panel={effectivePanel}
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
