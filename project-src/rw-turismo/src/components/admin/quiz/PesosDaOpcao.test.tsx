import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PesosDaOpcao from "./PesosDaOpcao";

// A regra que este arquivo protege: peso ausente NAO e peso zero.
// A pontuacao no banco so soma chave presente em `pesos`, entao "nao pontua" e
// a ausencia da chave. Gravar 0 apagaria a distincao — e mudaria o resultado de
// quem responde sem ninguem pedir.

const desenhar = (pesos: Record<string, number>) => {
  const onChange = vi.fn();
  render(
    <PesosDaOpcao
      eixos={["descanso", "aventura"]}
      onChange={onChange}
      pesos={pesos}
    />
  );
  return onChange;
};

describe("o que a pessoa ve", () => {
  it("mostra quais perfis a alternativa favorece, com o valor", () => {
    desenhar({ descanso: 0.5 });
    // O valor vai no rotulo: o estado nao depende so da cor, e da para ver que
    // "ativo" pode ser 1, 0,5 ou 2.
    expect(screen.getByRole("button", { name: "descanso, 0,5 ponto(s)" })).toBeTruthy();
  });

  it("diz 'nao pontua' quando nao ha peso nenhum", () => {
    desenhar({});
    expect(screen.getByText("não pontua")).toBeTruthy();
  });

  it("os atalhos dizem o peso que aplicam", () => {
    desenhar({});
    expect(screen.getByText(/nenhum ponto/)).toBeTruthy();
    expect(screen.getByText(/descanso 0,5 · aventura 0,5/)).toBeTruthy();
  });
});

describe("nada muda em silencio", () => {
  it("desligar um perfil REMOVE a chave, e nao grava zero", () => {
    const onChange = desenhar({ descanso: 1, aventura: 2 });
    fireEvent.click(screen.getByRole("button", { name: "descanso, 1 ponto(s)" }));
    expect(onChange).toHaveBeenCalledWith({ aventura: 2 });
  });

  it("ligar um perfil nao toca no peso dos outros", () => {
    const onChange = desenhar({ descanso: 0.7 });
    fireEvent.click(screen.getByRole("button", { name: "aventura, não pontua" }));
    expect(onChange).toHaveBeenCalledWith({ descanso: 0.7, aventura: 1 });
  });

  it("peso quebrado escrito a mao sobrevive — nada e arredondado", () => {
    const onChange = desenhar({ descanso: 0.7, aventura: 1.25 });
    fireEvent.click(screen.getByText("Ajustar pontos"));
    const campo = screen.getByLabelText?.("descanso") as HTMLInputElement | null;
    // Sem label associado, cai no valor exibido — o que importa e que o valor
    // chegou intacto na tela.
    expect(
      campo?.value ??
        (screen.getAllByRole("textbox").find((i) =>
          (i as HTMLInputElement).value === "0.7"
        ) as HTMLInputElement | undefined)?.value
    ).toBe("0.7");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("apagar o campo numerico remove a chave, e nao grava zero", () => {
    const onChange = desenhar({ descanso: 1 });
    fireEvent.click(screen.getByText("Ajustar pontos"));
    const campos = screen.getAllByRole("textbox") as HTMLInputElement[];
    const doDescanso = campos.find((c) => c.value === "1")!;
    fireEvent.change(doDescanso, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({});
  });

  it("aceita virgula como separador decimal", () => {
    const onChange = desenhar({ descanso: 1 });
    fireEvent.click(screen.getByText("Ajustar pontos"));
    const campos = screen.getAllByRole("textbox") as HTMLInputElement[];
    fireEvent.change(campos.find((c) => c.value === "1")!, {
      target: { value: "0,5" },
    });
    expect(onChange).toHaveBeenCalledWith({ descanso: 0.5 });
  });

  it("texto que nao e numero e ignorado — nao vira NaN no jsonb", () => {
    const onChange = desenhar({ descanso: 1 });
    fireEvent.click(screen.getByText("Ajustar pontos"));
    const campos = screen.getAllByRole("textbox") as HTMLInputElement[];
    fireEvent.change(campos.find((c) => c.value === "1")!, {
      target: { value: "abc" },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("'Nao pontua' zera a lista removendo as chaves", () => {
    const onChange = desenhar({ descanso: 1, aventura: 1 });
    fireEvent.click(screen.getByText(/Não pontua/));
    expect(onChange).toHaveBeenCalledWith({});
  });
});
