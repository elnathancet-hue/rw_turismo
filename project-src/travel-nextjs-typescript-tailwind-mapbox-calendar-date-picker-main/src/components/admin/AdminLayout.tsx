import {
  Bars3Icon,
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
  TruckIcon,
  CakeIcon,
  UsersIcon,
  UserPlusIcon,
  BuildingStorefrontIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

const navigation = [
  {
    section: "Vendas",
    items: [
      { href: "/admin", label: "Dashboard", icon: HomeIcon },
      { href: "/admin/bookings", label: "Reservas", icon: ClipboardDocumentListIcon },
      { href: "/admin/payments", label: "Pagamentos", icon: CreditCardIcon },
      { href: "/admin/waitlist", label: "Lista de espera", icon: UserPlusIcon },
      { href: "/admin/clients", label: "Clientes", icon: UsersIcon },
    ],
  },
  {
    section: "Operação",
    items: [
      { href: "/admin/departures", label: "Saídas", icon: TruckIcon },
      { href: "/admin/birthdays", label: "Aniversariantes", icon: CakeIcon },
      { href: "/admin/suppliers", label: "Fornecedores", icon: BuildingStorefrontIcon },
    ],
  },
  {
    section: "Catálogo",
    items: [
      { href: "/admin/products", label: "Produtos", icon: Squares2X2Icon },
      { href: "/admin/product-dates", label: "Datas", icon: CalendarDaysIcon },
      { href: "/admin/categories", label: "Categorias", icon: TagIcon },
    ],
  },
  {
    section: "Conteúdo",
    items: [
      { href: "/admin/home", label: "Home", icon: PhotoIcon },
      { href: "/admin/pages", label: "Páginas", icon: DocumentTextIcon },
      { href: "/admin/blog", label: "Blog", icon: NewspaperIcon },
      { href: "/admin/menu", label: "Menu", icon: Bars3Icon },
      { href: "/admin/footer", label: "Rodapé", icon: QueueListIcon },
    ],
  },
  {
    section: "Sistema",
    items: [
      { href: "/admin/settings", label: "Configurações", icon: Cog6ToothIcon },
    ],
  },
];

const allNavItems = navigation.flatMap((group) => group.items);

const AdminLayout = ({ children, title, description, action }: Props) => {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-white px-4 py-6 lg:block print:hidden">
        <Link className="flex items-center gap-3 px-3" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 font-bold text-white">
            RW
          </span>
          <span>
            <span className="block text-sm font-semibold">RW Turismo Admin</span>
            <span className="block text-xs text-gray-500">Operações</span>
          </span>
        </Link>
        <nav className="mt-6 space-y-5">
          {navigation.map((group) => (
            <div key={group.section}>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {group.section}
              </p>
              <div className="mt-1 space-y-1">
                {group.items.map((item) => {
                  const isActive =
                    router.pathname === item.href ||
                    (item.href !== "/admin" &&
                      router.pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                        isActive
                          ? "bg-orange-50 text-orange-700"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                      href={item.href}
                      key={item.href}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64 print:pl-0">
        <header className="border-b bg-white px-6 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{title}</h1>
              {description && (
                <p className="mt-1 text-sm text-gray-500">{description}</p>
              )}
            </div>
            {action}
          </div>
          <nav className="mt-5 flex gap-2 overflow-x-auto lg:hidden print:hidden">
            {allNavItems.map((item) => (
              <Link
                className="whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="px-6 py-6">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
