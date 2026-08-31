import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarkdownContent from "./MarkdownContent";

// Estes casos NÃO são hipóteses: os três primeiros foram reproduzidos contra o
// markdown-to-jsx 9.8.2 durante a auditoria. O sanitizer padrão da biblioteca
// cobre só o link inline; referência e autolink passavam com o esquema intacto.
const html = (markdown: string) =>
  render(<MarkdownContent content={markdown} />).container.innerHTML;

// O que importa não é a string sumir da página — `javascript:alert(1)` como
// TEXTO visível é inofensivo. O que não pode existir é um href navegável com
// esquema executável. É isso que esta asserção mede.
const semHrefPerigoso = (markdown: string) => {
  const saida = html(markdown);
  expect(saida).not.toMatch(/href\s*=\s*["']?\s*(javascript|vbscript|data):/i);
  return saida;
};

describe("MarkdownContent — esquema de link", () => {
  it("bloqueia javascript: em link inline", () => {
    semHrefPerigoso("[c](javascript:alert(1))");
  });

  it("bloqueia javascript: em link de REFERENCIA", () => {
    semHrefPerigoso("[c][x]\n\n[x]: javascript:alert(1)");
  });

  it("bloqueia javascript: em AUTOLINK", () => {
    // Aqui o link é desfeito e sobra só o texto: nenhum <a> é gerado.
    const saida = semHrefPerigoso("<javascript:alert(1)>");
    expect(saida).not.toContain("<a");
  });

  // A primeira versão destes dois casos usava link INLINE — que o sanitizer do
  // markdown-to-jsx já cobria sozinho. Ou seja: passavam mesmo contra o código
  // vulnerável, sem provar nada. Aqui vão pelas sintaxes que a biblioteca NÃO
  // sanitiza, que é onde a correção deste componente realmente atua.
  it("bloqueia data: e vbscript: nas sintaxes que a lib nao sanitiza", () => {
    semHrefPerigoso("[c][x]\n\n[x]: data:text/html;base64,PHNjcmlwdD4=");
    semHrefPerigoso("[c][y]\n\n[y]: vbscript:msgbox(1)");
    semHrefPerigoso("<vbscript:msgbox(1)>");
  });

  it("nao renderiza HTML cru embutido no markdown", () => {
    const saida = html('<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>');
    expect(saida).not.toContain("<img");
    expect(saida).not.toContain("<script");
  });

  it("continua renderizando link legitimo", () => {
    expect(html("[site](https://rwturismo.com.br)")).toContain(
      'href="https://rwturismo.com.br"'
    );
    expect(html("[pacotes](/pacotes)")).toContain('href="/pacotes"');
  });

  it("preserva o texto do link recusado, sem virar link", () => {
    const saida = html("[clique aqui](javascript:alert(1))");
    expect(saida).toContain("clique aqui");
    expect(saida).not.toContain("<a");
  });
});
