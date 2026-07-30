import { describe, expect, it } from "vitest";
import {
  canAccessAdminRoute,
  isStaffRole,
  rolesForAdminRoute,
  STAFF_ROLES,
} from "./roles";

describe("isStaffRole", () => {
  it("aceita os papéis de equipe e recusa cliente", () => {
    for (const role of STAFF_ROLES) {
      expect(isStaffRole(role)).toBe(true);
    }
    expect(isStaffRole("customer")).toBe(false);
    expect(isStaffRole("")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
    expect(isStaffRole("Admin")).toBe(false);
  });
});

describe("rolesForAdminRoute", () => {
  it("usa o prefixo mais específico, não o primeiro que casa", () => {
    // /admin também casa com /admin/finance/expenses; a regra de finance vence.
    expect(rolesForAdminRoute("/admin/finance/expenses")).toEqual([
      "admin",
      "financeiro",
    ]);
  });

  it("cobre as subrotas de uma tela mapeada", () => {
    expect(rolesForAdminRoute("/admin/bookings/[id]")).toEqual(
      rolesForAdminRoute("/admin/bookings")
    );
    expect(rolesForAdminRoute("/admin/departures/[id]/seats")).toEqual([
      "admin",
      "operacoes",
    ]);
  });

  it("fecha rota não mapeada em admin-only", () => {
    expect(rolesForAdminRoute("/admin/tela-que-ainda-nao-existe")).toEqual([
      "admin",
    ]);
  });

  it("não confunde prefixo parcial com subrota", () => {
    // /admin/products não deve capturar /admin/product-dates.
    expect(rolesForAdminRoute("/admin/product-dates")).toEqual([
      "admin",
      "conteudo",
    ]);
  });
});

describe("canAccessAdminRoute", () => {
  it("deixa todo papel de equipe entrar na raiz do painel", () => {
    for (const role of STAFF_ROLES) {
      expect(canAccessAdminRoute("/admin", role)).toBe(true);
    }
  });

  it("guarda o gerenciamento de usuários só para admin", () => {
    expect(canAccessAdminRoute("/admin/users", "admin")).toBe(true);
    expect(canAccessAdminRoute("/admin/users", "operacoes")).toBe(false);
    expect(canAccessAdminRoute("/admin/users", "financeiro")).toBe(false);
    expect(canAccessAdminRoute("/admin/users", "conteudo")).toBe(false);
  });

  it("mantém a separação que o usuário pediu: atendimento não vê preço nem caixa", () => {
    expect(canAccessAdminRoute("/admin/finance", "operacoes")).toBe(false);
    expect(canAccessAdminRoute("/admin/products", "operacoes")).toBe(false);
    expect(canAccessAdminRoute("/admin/product-dates", "operacoes")).toBe(false);
  });

  it("financeiro cuida do caixa e não do catálogo", () => {
    expect(canAccessAdminRoute("/admin/finance/receivables", "financeiro")).toBe(
      true
    );
    expect(canAccessAdminRoute("/admin/payments", "financeiro")).toBe(true);
    expect(canAccessAdminRoute("/admin/products", "financeiro")).toBe(false);
    expect(canAccessAdminRoute("/admin/home", "financeiro")).toBe(false);
  });

  it("conteúdo cuida do site e não vê reserva nem caixa", () => {
    expect(canAccessAdminRoute("/admin/home", "conteudo")).toBe(true);
    expect(canAccessAdminRoute("/admin/blog/new", "conteudo")).toBe(true);
    expect(canAccessAdminRoute("/admin/products", "conteudo")).toBe(true);
    expect(canAccessAdminRoute("/admin/bookings", "conteudo")).toBe(false);
    expect(canAccessAdminRoute("/admin/finance", "conteudo")).toBe(false);
  });

  it("admin abre tudo que está mapeado", () => {
    const routes = [
      "/admin",
      "/admin/bookings",
      "/admin/payments",
      "/admin/finance",
      "/admin/products",
      "/admin/home",
      "/admin/users",
      "/admin/settings",
      "/admin/trash",
    ];
    for (const route of routes) {
      expect(canAccessAdminRoute(route, "admin")).toBe(true);
    }
  });

  it("cliente e conta sem papel não entram em nada", () => {
    expect(canAccessAdminRoute("/admin", "customer")).toBe(false);
    expect(canAccessAdminRoute("/admin", null)).toBe(false);
    expect(canAccessAdminRoute("/admin", undefined)).toBe(false);
  });
});
