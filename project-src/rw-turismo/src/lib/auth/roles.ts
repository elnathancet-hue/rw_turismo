// Papéis de equipe ("usuários do sistema"). Fonte única da verdade sobre quem
// abre qual tela do /admin — a sidebar, o AdminGuard e as rotas de API todos
// derivam daqui, para não haver duas listas divergindo.
//
// A separação real acontece no banco (policies por papel em supabase/rls.sql).
// O que está aqui é a mesma divisão aplicada na navegação: sem isso o usuário
// veria menus que o Postgres depois recusaria.

export type StaffRole = "admin" | "operacoes" | "financeiro" | "conteudo";
export type UserRole = "customer" | StaffRole;

export const STAFF_ROLES: StaffRole[] = [
  "admin",
  "operacoes",
  "financeiro",
  "conteudo",
];

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Administrador",
  operacoes: "Operações",
  financeiro: "Financeiro",
  conteudo: "Conteúdo",
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  admin: "Acesso total, incluindo usuários, integrações e configurações.",
  operacoes:
    "Reservas, passageiros, saídas, fornecedores, lista de espera e CRM. Vê pagamentos, mas não confirma.",
  financeiro:
    "Pagamentos, despesas, recebíveis e cupons. Vê reservas, mas não mexe no catálogo.",
  conteudo:
    "Catálogo, home, páginas, blog, aparência e avaliações. Não vê caixa nem reservas.",
};

const ALL_STAFF = STAFF_ROLES;

// A raiz do painel é o ponto de entrada de todo mundo, e casa SÓ exatamente
// "/admin" — se entrasse na lista de prefixos abaixo, qualquer tela nova ainda
// não mapeada herdaria dela e nasceria aberta para a equipe inteira.
const ROOT_ROUTE_ROLES: StaffRole[] = ALL_STAFF;

// Rota do admin → papéis que podem abrir. O prefixo MAIS específico vence, então
// /admin/finance/expenses usa a regra de /admin/finance e não a de /admin/finance
// mais curta que aparecer antes.
const ROUTE_ROLES: Array<[string, StaffRole[]]> = [
  // Vendas
  ["/admin/bookings", ["admin", "operacoes", "financeiro"]],
  ["/admin/payments", ["admin", "financeiro", "operacoes"]],
  ["/admin/crm", ["admin", "operacoes"]],
  ["/admin/waitlist", ["admin", "operacoes"]],
  ["/admin/clients", ["admin", "operacoes", "financeiro"]],

  // Operação
  ["/admin/departures", ["admin", "operacoes"]],
  ["/admin/birthdays", ["admin", "operacoes"]],
  ["/admin/suppliers", ["admin", "operacoes", "financeiro"]],

  // Catálogo
  ["/admin/products", ["admin", "conteudo"]],
  ["/admin/product-dates", ["admin", "conteudo"]],
  ["/admin/categories", ["admin", "conteudo"]],

  // Financeiro
  ["/admin/finance", ["admin", "financeiro"]],

  // Conteúdo do site
  ["/admin/home", ["admin", "conteudo"]],
  ["/admin/pages", ["admin", "conteudo"]],
  ["/admin/blog", ["admin", "conteudo"]],
  ["/admin/menu", ["admin", "conteudo"]],
  ["/admin/footer", ["admin", "conteudo"]],
  ["/admin/aparencia", ["admin", "conteudo"]],

  // Marketing
  ["/admin/coupons", ["admin", "financeiro", "conteudo"]],
  ["/admin/surveys", ["admin", "conteudo", "operacoes"]],

  // Sistema — só admin
  ["/admin/users", ["admin"]],
  ["/admin/integracoes", ["admin"]],
  ["/admin/logs", ["admin"]],
  ["/admin/trash", ["admin"]],
  ["/admin/settings", ["admin"]],
];

// Primeira tela útil de cada papel — usada quando alguém cai numa área que não
// é dele e precisa de um caminho de volta que funcione.
export const DEFAULT_ROUTE_BY_ROLE: Record<StaffRole, string> = {
  admin: "/admin",
  operacoes: "/admin/bookings",
  financeiro: "/admin/finance",
  conteudo: "/admin/home",
};

export const isStaffRole = (role: string | null | undefined): role is StaffRole =>
  typeof role === "string" && (STAFF_ROLES as string[]).includes(role);

// Papéis permitidos numa rota. Rota não mapeada cai em admin-only de propósito:
// uma tela nova nasce fechada em vez de nascer aberta para todo mundo.
export const rolesForAdminRoute = (pathname: string): StaffRole[] => {
  if (pathname === "/admin") return ROOT_ROUTE_ROLES;

  let best: { prefix: string; roles: StaffRole[] } | null = null;

  for (const [prefix, roles] of ROUTE_ROLES) {
    const matches = pathname === prefix || pathname.startsWith(`${prefix}/`);
    if (matches && (!best || prefix.length > best.prefix.length)) {
      best = { prefix, roles };
    }
  }

  return best?.roles ?? ["admin"];
};

export const canAccessAdminRoute = (
  pathname: string,
  role: string | null | undefined
): boolean =>
  isStaffRole(role) && rolesForAdminRoute(pathname).includes(role);
