import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PreviaDoQuiz from "./PreviaDoQuiz";
import type { Quiz } from "../../../lib/quiz/types";

// A previa desenha as telas REAIS do quiz publico dentro do painel. O risco
// obvio disso e ela gravar resposta de verdade, criar lead ou disparar
// WhatsApp enquanto alguem so queria conferir o texto. Estes testes prendem
// esse isolamento.

const quiz: Quiz = {
  id: "1",
  title: "Que feriado combina com você?",
  slug: "feriado",
  status: "draft",
  seo_title: null,
  seo_description: null,
  intro: { titulo: "Qual destino combina?", subtitulo: "Feriado de setembro" },
  eixos: ["descanso", "aventura"],
  margem_empate: 0.5,
  cta: { tipo: "whatsapp", numero: "5586999207088" },
  captura_ativa: true,
  resultado_layout: { olho: "Sua leitura" },
  perguntas: [
    {
      texto: "Como você imagina o feriado?",
      opcoes: [
        { texto: "Descansando", pesos: { descanso: 1 } },
        { texto: "Explorando", pesos: { aventura: 1 } },
      ],
    },
  ],
  resultados: [
    { chave: "r1", eixo: "aventura", rotulo: "Serra da Ibiapaba", posicao: 82 },
  ],
} as Quiz;

const fetchFalso = vi.fn();

beforeEach(() => {
  fetchFalso.mockClear();
  vi.stubGlobal("fetch", fetchFalso);
});

describe("isolamento", () => {
  it("não faz nenhuma chamada de rede ao desenhar qualquer tela", () => {
    for (const foco of [
      { tela: "abertura" as const },
      { tela: "pergunta" as const, indice: 0 },
      { tela: "resultado" as const, indice: 0 },
    ]) {
      render(<PreviaDoQuiz foco={foco} quiz={quiz} />);
    }
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("clicar numa alternativa da prévia não dispara nada", () => {
    render(<PreviaDoQuiz foco={{ tela: "pergunta", indice: 0 }} quiz={quiz} />);
    fireEvent.click(screen.getByText("Descansando"));
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("avisa na tela que nada ali é gravado", () => {
    render(<PreviaDoQuiz foco={{ tela: "abertura" }} quiz={quiz} />);
    expect(
      screen.getByText(/Nada respondido aqui é gravado, e nenhum lead é criado/)
    ).toBeTruthy();
  });

  it("o nome usado é fictício e está identificado como exemplo", () => {
    render(<PreviaDoQuiz foco={{ tela: "resultado", indice: 0 }} quiz={quiz} />);
    expect(screen.getByText(/“Maria” é de exemplo/)).toBeTruthy();
  });

  // O botão PRECISA aparecer — é a peça que mais importa conferir — mas não
  // pode apontar para o WhatsApp real da agência.
  it("mostra o botão do resultado, sem apontar para o WhatsApp real", () => {
    const { container } = render(
      <PreviaDoQuiz foco={{ tela: "resultado", indice: 0 }} quiz={quiz} />
    );
    expect(screen.getByText("Falar no WhatsApp")).toBeTruthy();
    expect(container.querySelector('a[href*="wa.me"]')).toBeNull();
  });

  it("desenha a imagem da abertura quando ela existe", () => {
    const comImagem = {
      ...quiz,
      intro: { ...quiz.intro, imagem: "https://ex.com/capa.jpg" },
    } as Quiz;
    const { container } = render(
      <PreviaDoQuiz foco={{ tela: "abertura" }} quiz={comImagem} />
    );
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.some((i) => i.getAttribute("src") === "https://ex.com/capa.jpg")).toBe(
      true
    );
  });

  it("javascript: na imagem da abertura não vira <img>", () => {
    const perigosa = {
      ...quiz,
      intro: { ...quiz.intro, imagem: "javascript:alert(1)" },
    } as Quiz;
    const { container } = render(
      <PreviaDoQuiz foco={{ tela: "abertura" }} quiz={perigosa} />
    );
    // Só a logo do topo.
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });
});

describe("mostra a tela certa para o que está sendo editado", () => {
  it("abertura", () => {
    render(<PreviaDoQuiz foco={{ tela: "abertura" }} quiz={quiz} />);
    expect(screen.getByText("Qual destino combina?")).toBeTruthy();
  });

  it("a pergunta selecionada", () => {
    render(<PreviaDoQuiz foco={{ tela: "pergunta", indice: 0 }} quiz={quiz} />);
    expect(screen.getByText("Como você imagina o feriado?")).toBeTruthy();
  });

  it("o resultado selecionado", () => {
    render(<PreviaDoQuiz foco={{ tela: "resultado", indice: 0 }} quiz={quiz} />);
    expect(screen.getByText("Sua leitura")).toBeTruthy();
    expect(screen.getByText("Serra da Ibiapaba")).toBeTruthy();
  });

  it("índice que não existe não quebra a tela", () => {
    expect(() =>
      render(<PreviaDoQuiz foco={{ tela: "pergunta", indice: 9 }} quiz={quiz} />)
    ).not.toThrow();
    expect(screen.getByText(/Selecione uma pergunta/)).toBeTruthy();
  });
});

describe("a abertura completa", () => {
  const cheia = {
    ...quiz,
    intro: {
      ...quiz.intro,
      texto: "Responda essas perguntas rápidas e descubra.",
      texto_botao: "Começar o teste",
      imagem: "https://ex.com/capa.jpg",
      imagem_legenda: "Piscina com vista da Serra",
      imagem_selo: "Simulação",
      micro: ["Leva menos de 2 minutos.", "Sem e-mail, sem pegadinha."],
    },
  } as Quiz;

  it("desenha paragrafo, imagem com legenda e selo, e as linhas do rodape", () => {
    render(<PreviaDoQuiz foco={{ tela: "abertura" }} quiz={cheia} />);
    expect(screen.getByText(/Responda essas perguntas rápidas/)).toBeTruthy();
    expect(screen.getByText("Piscina com vista da Serra")).toBeTruthy();
    expect(screen.getByText("Simulação")).toBeTruthy();
    expect(screen.getByText("Começar o teste")).toBeTruthy();
    expect(screen.getByText("Leva menos de 2 minutos.")).toBeTruthy();
    expect(screen.getByText("Sem e-mail, sem pegadinha.")).toBeTruthy();
  });

  // Quiz recem-criado tem so o titulo. Cabecalho pendurado sobre nada seria
  // pior que uma tela curta e inteira.
  it("abertura pelada nao deixa peca vazia na tela", () => {
    const { container } = render(
      <PreviaDoQuiz
        foco={{ tela: "abertura" }}
        quiz={{ ...quiz, intro: { titulo: "So o titulo" } } as Quiz}
      />
    );
    expect(screen.getByText("So o titulo")).toBeTruthy();
    // So a logo do topo: nenhuma figura de abertura.
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("figcaption")).toBeNull();
  });

  it("legenda e selo nao aparecem sem imagem", () => {
    render(
      <PreviaDoQuiz
        foco={{ tela: "abertura" }}
        quiz={{
          ...quiz,
          intro: { titulo: "T", imagem_legenda: "orfa", imagem_selo: "orfo" },
        } as Quiz}
      />
    );
    expect(screen.queryByText("orfa")).toBeNull();
    expect(screen.queryByText("orfo")).toBeNull();
  });

  it("micro que nao e array nao derruba a tela", () => {
    expect(() =>
      render(
        <PreviaDoQuiz
          foco={{ tela: "abertura" }}
          quiz={{ ...quiz, intro: { micro: "nao sou array" } } as never}
        />
      )
    ).not.toThrow();
  });
});

describe("ampliar", () => {
  it("abre em tela cheia e volta", () => {
    render(<PreviaDoQuiz foco={{ tela: "abertura" }} quiz={quiz} />);
    const botao = screen.getByRole("button", { name: "Ampliar" });
    fireEvent.click(botao);
    expect(screen.getByRole("button", { name: "Reduzir" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reduzir" }));
    expect(screen.getByRole("button", { name: "Ampliar" })).toBeTruthy();
  });

  it("Esc fecha a tela cheia", () => {
    render(<PreviaDoQuiz foco={{ tela: "abertura" }} quiz={quiz} />);
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Ampliar" })).toBeTruthy();
  });

  it("ampliada, some o Recolher — não faz sentido em tela cheia", () => {
    render(
      <PreviaDoQuiz foco={{ tela: "abertura" }} onFechar={() => {}} quiz={quiz} />
    );
    expect(screen.getByRole("button", { name: "Recolher" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    expect(screen.queryByRole("button", { name: "Recolher" })).toBeNull();
  });
});

describe("computador e celular", () => {
  it("alterna entre os dois e marca o ativo sem depender só de cor", () => {
    render(<PreviaDoQuiz foco={{ tela: "abertura" }} quiz={quiz} />);
    const celular = screen.getByRole("button", { name: "Celular" });
    expect(celular.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(celular);
    expect(celular.getAttribute("aria-pressed")).toBe("true");
  });
});
