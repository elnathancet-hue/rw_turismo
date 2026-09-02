import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TelaResultado, {
  fotosDoResultado,
  montarTitulo,
  primeiroNome,
} from "./TelaResultado";
import type { Quiz, QuizResultado } from "../../lib/quiz/types";

// O que estes testes prendem: a tela de resultado de um quiz criado no painel
// tinha DOIS elementos (rótulo e texto) enquanto a página feita à mão tem dez.
// E, mais importante, que nenhum bloco derrube a tela quando o dado não vem —
// quiz nasce vazio, e o jsonb não promete forma nenhuma.

const quiz = (troca: Partial<Quiz> = {}): Quiz =>
  ({
    id: "1",
    title: "T",
    slug: "t",
    status: "published",
    seo_title: null,
    seo_description: null,
    intro: {},
    eixos: ["descanso", "aventura"],
    margem_empate: 0.5,
    cta: {},
    captura_ativa: true,
    perguntas: [],
    resultados: [],
    resultado_layout: {
      olho: "Sua leitura",
      titulo_motivos: "Por que essa viagem combina com você?",
      titulo_destino: "Seu destino",
      selo: "Mais de 25 anos de estrada.",
      assinatura: "@rwturismo.pi",
    },
    ...troca,
  }) as Quiz;

const resultado = (troca: Partial<QuizResultado> = {}): QuizResultado => ({
  chave: "r",
  eixo: "aventura",
  rotulo: "Serra da Ibiapaba",
  titulo: "{{nome}}, suas respostas mostram que a Serra combina com você.",
  texto: "Você quer sair da rotina.",
  posicao: 82,
  regua_rotulo: "Mais aventura",
  motivos: ["Paisagens e serra.", "Aventura na medida."],
  fotos: [
    { url: "https://ex.com/a.jpg", legenda: "Teleférico", selo: "Simulação" },
    { url: "https://ex.com/b.jpg", legenda: "Mirante" },
  ],
  destino: {
    nome: "Serra da Ibiapaba",
    subtitulo: "Sítio do Bosco + Lapa",
    itens: ["Saída sábado", "Guia exclusivo"],
  },
  ...troca,
});

const desenhar = (q: Quiz, r: QuizResultado, nome = "Elnathan Silva") =>
  render(
    <TelaResultado linkCta="https://wa.me/5586999207088" nome={nome} quiz={q} resultado={r} />
  );

describe("a tela completa", () => {
  it("desenha os dez elementos da página feita à mão", () => {
    desenhar(quiz(), resultado());

    expect(screen.getByText("Sua leitura")).toBeTruthy();
    expect(
      screen.getByText(/Elnathan, suas respostas mostram/)
    ).toBeTruthy();
    expect(screen.getByText("Você quer sair da rotina.")).toBeTruthy();
    expect(screen.getByText("Mais aventura")).toBeTruthy();
    expect(screen.getByText("descanso")).toBeTruthy();
    expect(screen.getByText("aventura")).toBeTruthy();
    expect(screen.getByText("Por que essa viagem combina com você?")).toBeTruthy();
    expect(screen.getByText("Paisagens e serra.")).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByText("Simulação")).toBeTruthy();
    expect(screen.getByText("Teleférico")).toBeTruthy();
    expect(screen.getByText("Seu destino")).toBeTruthy();
    expect(screen.getByText("Sítio do Bosco + Lapa")).toBeTruthy();
    expect(screen.getByText("Guia exclusivo")).toBeTruthy();
    expect(screen.getByText("Mais de 25 anos de estrada.")).toBeTruthy();
    expect(screen.getByText("@rwturismo.pi")).toBeTruthy();
  });

  // Quiz recém-criado tem só rótulo. Meia tela desenhada, com cabeçalhos
  // pendurados sobre listas vazias, seria pior que uma tela curta e inteira.
  it("resultado pelado não quebra e não deixa cabeçalho órfão", () => {
    const { container } = desenhar(
      quiz(),
      { chave: "r", eixo: null, rotulo: "Só o rótulo" } as QuizResultado
    );

    expect(screen.getByText("Só o rótulo")).toBeTruthy();
    expect(screen.queryByText("Por que essa viagem combina com você?")).toBeNull();
    expect(screen.queryByText("Seu destino")).toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});

describe("a régua", () => {
  it("não aparece com três eixos — barra de uma dimensão mentiria", () => {
    const { container } = desenhar(
      quiz({ eixos: ["a", "b", "c"] }),
      resultado()
    );
    expect(screen.queryByText("Mais aventura")).toBeNull();
    expect(container.textContent).not.toContain("😍");
  });

  it("aparece com dois eixos, e os polos são os próprios eixos", () => {
    const { container } = desenhar(quiz(), resultado());
    expect(container.textContent).toContain("😍");
    expect(screen.getByText("descanso")).toBeTruthy();
  });

  it("posição fora de 0–100 é grampeada, senão o marcador sai do trilho", () => {
    const { container } = desenhar(quiz(), resultado({ posicao: 999 }));
    const marca = container.querySelector('[style*="left"]') as HTMLElement;
    expect(marca.style.left).toBe("100%");
  });
});

describe("segurança", () => {
  it("javascript: numa foto não vira <img>", () => {
    const { container } = desenhar(
      quiz(),
      resultado({
        fotos: [{ url: "javascript:alert(1)" }, { url: "https://ex.com/ok.jpg" }],
      })
    );
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs).toHaveLength(1);
    expect(imgs[0]!.getAttribute("src")).toBe("https://ex.com/ok.jpg");
  });

  it("o texto vai como texto, não como HTML", () => {
    const { container } = desenhar(
      quiz(),
      resultado({ texto: "<img src=x onerror=alert(1)>" })
    );
    // Uma só: a do resultado seria a segunda se o texto tivesse virado markup.
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
  });
});

describe("dado torto vindo do jsonb", () => {
  it("motivos que não é array não derruba a tela", () => {
    expect(() =>
      desenhar(quiz(), resultado({ motivos: "não sou array" as never }))
    ).not.toThrow();
  });

  it("fotos que não é array não derruba a tela", () => {
    expect(() =>
      desenhar(quiz(), resultado({ fotos: 42 as never }))
    ).not.toThrow();
  });

  it("linha vazia na lista não vira item em branco", () => {
    desenhar(quiz(), resultado({ motivos: ["Vale", "   ", ""] }));
    expect(screen.getByText("Vale")).toBeTruthy();
    expect(screen.getAllByRole("listitem").length).toBeLessThan(4);
  });
});

describe("montarTitulo", () => {
  it("sem nome, não deixa a frase começar com vírgula", () => {
    expect(montarTitulo("{{nome}}, suas respostas mostram", "", "R")).toBe(
      "suas respostas mostram"
    );
  });

  it("com nome, encaixa o nome", () => {
    expect(montarTitulo("{{nome}}, suas respostas", "Ana", "R")).toBe(
      "Ana, suas respostas"
    );
  });

  it("troca {{rotulo}}", () => {
    expect(montarTitulo("Você é {{rotulo}}", "", "Aventureiro")).toBe(
      "Você é Aventureiro"
    );
  });
});

describe("primeiroNome", () => {
  it("pega só o primeiro e capitaliza", () => {
    expect(primeiroNome("elnathan silva costa")).toBe("Elnathan");
  });
  it("vazio continua vazio", () => {
    expect(primeiroNome("   ")).toBe("");
  });
});

describe("fotosDoResultado", () => {
  it("aceita o modelo antigo de uma foto só", () => {
    const r = { chave: "r", eixo: null, rotulo: "R", foto: "https://ex.com/x.jpg" };
    expect(fotosDoResultado(r as QuizResultado)).toEqual([
      { url: "https://ex.com/x.jpg" },
    ]);
  });

  it("fotos[] tem precedência sobre a foto antiga", () => {
    const r = {
      chave: "r",
      eixo: null,
      rotulo: "R",
      foto: "https://ex.com/velha.jpg",
      fotos: [{ url: "https://ex.com/nova.jpg" }],
    };
    expect(fotosDoResultado(r as QuizResultado)[0]!.url).toBe(
      "https://ex.com/nova.jpg"
    );
  });
});
