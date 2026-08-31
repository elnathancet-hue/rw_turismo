import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { downloadCsv } from "./csv";

// downloadCsv escreve num Blob e dispara um <a download>. Para inspecionar o
// conteúdo, o teste intercepta o Blob e lê o texto que foi montado.
let capturado = "";

beforeEach(() => {
  capturado = "";
  vi.stubGlobal(
    "Blob",
    class {
      constructor(partes: string[]) {
        capturado = partes.join("");
      }
    }
  );
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:teste",
    revokeObjectURL: () => undefined,
  });
  // O <a> criado recebe .click(); em happy-dom isso navegaria, então é anulado.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => vi.unstubAllGlobals());

const linhas = (rows: (string | number | null | undefined)[][]) => {
  downloadCsv("t.csv", rows);
  return capturado.replace(/^﻿/, "").split("\r\n");
};

describe("downloadCsv — injeção de fórmula", () => {
  // Nome de passageiro vem de rota pública: quem reserva escolhe o texto.
  it("neutraliza fórmula em nome de passageiro", () => {
    const [linha] = linhas([['=HYPERLINK("https://evil","Ana")']]);
    expect(linha.startsWith("'=") || linha.startsWith("\"'=")).toBe(true);
  });

  it("neutraliza os outros iniciadores de fórmula", () => {
    expect(linhas([["+cmd|' /C calc'!A0"]])[0]).toContain("'+");
    expect(linhas([["@SUM(1+1)"]])[0]).toContain("'@");
    expect(linhas([["=1+1"]])[0]).toContain("'=");
  });

  // A regressão que a primeira versão da correção causou: a coluna Margem do
  // relatório financeiro virava texto e parava de somar no Excel.
  it("NAO estraga numero negativo", () => {
    expect(linhas([[-1234.56]])[0]).toBe("-1234.56");
    expect(linhas([["-1234,56"]])[0]).toBe("-1234,56");
    expect(linhas([["-500"]])[0]).toBe("-500");
  });

  it("preserva texto comum e o separador pt-BR", () => {
    expect(linhas([["Ana", "Silva"]])[0]).toBe("Ana;Silva");
    expect(linhas([["a;b"]])[0]).toBe('"a;b"');
    expect(linhas([[null, undefined]])[0]).toBe(";");
  });

  // Hífen de texto (nome composto, traço solto) ainda precisa ser neutralizado:
  // "-A1" não é número e o Excel trataria como fórmula.
  it("neutraliza hifen que nao e numero", () => {
    expect(linhas([["-A1"]])[0]).toContain("'-A1");
  });
});
