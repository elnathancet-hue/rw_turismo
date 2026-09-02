import { describe, expect, it } from "vitest";
import {
  destinoDoPainel,
  navigation,
  type NavGroup,
} from "../../components/admin/AdminLayout";

// Trocar de painel leva a alguma tela. Antes o destino era "o primeiro item do
// menu daquele painel" — e o primeiro do painel do site e a Home, quando quem
// troca para la quase sempre quer Paginas.

const grupo = (
  panel: NavGroup["panel"],
  hrefs: string[]
): NavGroup => ({
  section: "s",
  panel,
  items: hrefs.map((href) => ({
    href,
    label: href,
    icon: (() => null) as unknown as NavGroup["items"][number]["icon"],
  })),
});

describe("destinoDoPainel", () => {
  it("o painel do site abre Páginas, e não a Home", () => {
    expect(destinoDoPainel(navigation, "site")).toBe("/admin/pages");
  });

  it("a Home continua no menu — ela só deixou de ser o destino padrão", () => {
    const doSite = navigation
      .filter((g) => g.panel === "site")
      .flatMap((g) => g.items.map((i) => i.href));
    expect(doSite).toContain("/admin/home");
    expect(doSite[0]).toBe("/admin/home");
  });

  it("o painel de operações abre o Dashboard", () => {
    expect(destinoDoPainel(navigation, "operacoes")).toBe("/admin");
  });

  // `groups` chega filtrado por papel. Mandar alguem para uma tela que o RLS
  // nega seria trocar um incomodo por uma tela de erro.
  it("papel sem acesso a Páginas cai na primeira tela que ele enxerga", () => {
    const restrito = [grupo("site", ["/admin/blog", "/admin/quizzes"])];
    expect(destinoDoPainel(restrito, "site")).toBe("/admin/blog");
  });

  it("papel que enxerga Páginas vai para Páginas mesmo que não seja a primeira", () => {
    const restrito = [grupo("site", ["/admin/blog", "/admin/pages"])];
    expect(destinoDoPainel(restrito, "site")).toBe("/admin/pages");
  });

  it("painel sem nenhum item não devolve destino", () => {
    expect(destinoDoPainel([grupo("operacoes", ["/admin"])], "site")).toBeUndefined();
  });
});
