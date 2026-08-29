import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fica fora de src/pages de propósito: qualquer .tsx dentro de pages vira rota,
// e /quiz-feriado.test não deve existir no site.

const enviarLead = vi.hoisted(() => vi.fn());

vi.mock("../leads/client", () => ({
  submitSiteLead: (...argumentos: unknown[]) => enviarLead(...argumentos),
}));

vi.mock("next/head", () => ({
  default: () => null,
}));

import QuizFeriado from "../../pages/quiz-feriado";
import { PERGUNTAS } from "./feriado";

// ---------------------------------------------------------------------------
// A copy aprovada mora no quiz-feriado.html da raiz, que já passou pela
// auditoria de fidelidade contra a espec. Este teste lê aquele arquivo e exige
// que tudo que a página React mostra exista lá. É o que impede as duas versões
// de divergirem em silêncio enquanto forem mantidas em paralelo.
// ---------------------------------------------------------------------------

const ENTIDADES: Record<string, string> = {
  "&middot;": "·",
  "&amp;": "&",
  "&nbsp;": " ",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
};

const normalizar = (valor: string): string =>
  valor
    .replace(/&[a-z]+;/g, (entidade) => ENTIDADES[entidade] ?? entidade)
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    // Trocar as tags do standalone por espaço deixa " ." onde o HTML tinha
    // "<span>...</span>." — some dos dois lados para a comparação ser justa.
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();

const textoDoStandalone = (): string => {
  const arquivo = path.resolve(process.cwd(), "../../quiz-feriado.html");
  const html = fs.readFileSync(arquivo, "utf8");
  return normalizar(
    html
      .replace(/<style>[\s\S]*?<\/style>/g, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      // O <script> fica: é de lá que vem a copy das perguntas e das leituras.
      .replace(/<[^>]+>/g, " ")
  );
};

const STANDALONE = textoDoStandalone();

// textContent do container inteiro cola blocos vizinhos sem separador e cria
// "frases" que nunca existiram ("...pra verAs respostas já..."). Por isso a
// comparação é bloco a bloco, do jeito que o texto realmente é lido.
const blocosDe = (raiz: HTMLElement): string[] =>
  Array.from(raiz.querySelectorAll("p,h1,h2,h3,li,label,button,a,strong,span"))
    // O aviso de leitor de tela é montado em runtime ("Pergunta 2 de 6. " + o
    // enunciado), então não existe literal em arquivo nenhum. O enunciado em si
    // já é conferido contra PERGUNTAS logo abaixo.
    .filter((elemento) => elemento.getAttribute("role") !== "status")
    .map((elemento) => normalizar(elemento.textContent ?? ""))
    .filter((texto) => texto.length >= 25);

const exigirCopyAprovada = (tela: string, raiz: HTMLElement) => {
  const blocos = blocosDe(raiz);
  expect(blocos.length).toBeGreaterThan(0);
  for (const bloco of blocos) {
    // O título do resultado é personalizado ("Marina, suas respostas...") e
    // nunca vai existir como literal em arquivo nenhum. A parte que precisa
    // estar aprovada é a que vem depois do nome — o resto é o nome que a
    // própria pessoa digitou.
    const semNome = bloco.replace(/^[^,]{1,40}, /, "");
    if (!STANDALONE.includes(bloco) && !STANDALONE.includes(semNome)) {
      throw new Error(
        `Copy da tela "${tela}" não existe no quiz-feriado.html aprovado:\n  ${bloco}`
      );
    }
  }
};

// A regra mudou em 2026-08-29, por decisão do cliente: a página passou a ser
// assinada pela marca — logo no topo, logo dentro da imagem de abertura e a
// assinatura no resultado. A antiga "seção 7", que proibia nome e logo em
// qualquer lugar, não vale mais.
//
// O que continua guardado é outra coisa, e mais concreta: a marca aparece como
// IMAGEM, e não como texto solto no meio do conteúdo. Nome da agência escrito
// à mão dentro de um SVG (foi o que aconteceu aqui uma vez) cria uma marca
// falsa, com outra fonte, e ainda entra no texto da página como se fosse copy.
const semAssinatura = (texto: string): string => texto.split("@rwturismo.pi").join(" ");

const responderTudo = (escolha: (total: number) => number) => {
  for (let pergunta = 0; pergunta < PERGUNTAS.length; pergunta++) {
    const botoes = screen.getAllByRole("button");
    const alternativas = botoes.filter((botao) =>
      PERGUNTAS[pergunta]!.opcoes.some((opcao) => botao.textContent === opcao.texto)
    );
    expect(alternativas.length).toBe(PERGUNTAS[pergunta]!.opcoes.length);
    fireEvent.click(alternativas[escolha(alternativas.length)]!);
    act(() => {
      vi.advanceTimersByTime(400);
    });
  }
};

const passarPelaTransicao = () => {
  act(() => {
    vi.advanceTimersByTime(3000);
  });
};

const preencher = (nome: string, fone: string, cidade = "") => {
  fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: nome } });
  fireEvent.change(screen.getByLabelText(/whatsapp, com ddd/i), {
    target: { value: fone },
  });
  if (cidade) {
    fireEvent.change(screen.getByLabelText(/cidade de embarque/i), {
      target: { value: cidade },
    });
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  enviarLead.mockReset();
  enviarLead.mockResolvedValue(undefined);
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  window.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("o arquivo de referência", () => {
  it("é o standalone aprovado, com a copy dentro", () => {
    expect(STANDALONE).toContain("Qual destino combina com você e com seu bolso");
    expect(STANDALONE).toContain(
      "a Serra da Ibiapaba combina com o feriado que você quer viver"
    );
  });
});

describe("paridade de copy com o standalone aprovado", () => {
  it("a abertura só mostra copy que existe no arquivo aprovado", () => {
    const { container } = render(<QuizFeriado />);
    exigirCopyAprovada("abertura", container);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Qual destino combina com você e com seu bolso no feriado 7 de setembro?"
    );
  });

  it("cada uma das 6 perguntas só mostra copy aprovada", () => {
    const { container } = render(<QuizFeriado />);
    fireEvent.click(screen.getByRole("button", { name: /começar o teste/i }));

    for (let pergunta = 0; pergunta < PERGUNTAS.length; pergunta++) {
      exigirCopyAprovada(`pergunta ${pergunta + 1}`, container);
      expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
        PERGUNTAS[pergunta]!.texto
      );
      const alternativas = screen
        .getAllByRole("button")
        .filter((botao) =>
          PERGUNTAS[pergunta]!.opcoes.some((opcao) => botao.textContent === opcao.texto)
        );
      fireEvent.click(alternativas[0]!);
      act(() => {
        vi.advanceTimersByTime(400);
      });
    }
  });

  it("captura e resultado só mostram copy aprovada", () => {
    const { container } = render(<QuizFeriado />);
    fireEvent.click(screen.getByRole("button", { name: /começar o teste/i }));
    responderTudo(() => 0);
    passarPelaTransicao();

    exigirCopyAprovada("captura", container);

    preencher("Marina Costa Lima", "86999207088", "Teresina");
    fireEvent.click(screen.getByRole("button", { name: /revelar meu feriado/i }));

    exigirCopyAprovada("resultado", container);
  });
});

describe("regras bloqueantes na página renderizada", () => {
  it("a marca aparece como logo, nunca como texto solto", () => {
    const { container } = render(<QuizFeriado />);
    const visto: string[] = [];

    const anotar = () => visto.push(container.textContent ?? "");

    anotar();
    fireEvent.click(screen.getByRole("button", { name: /começar o teste/i }));
    responderTudo(() => 0);
    anotar();
    passarPelaTransicao();
    anotar();
    preencher("Marina Costa Lima", "86999207088");
    fireEvent.click(screen.getByRole("button", { name: /revelar meu feriado/i }));
    anotar();

    for (const texto of visto) {
      expect(semAssinatura(texto)).not.toMatch(/rw\s*turismo/i);
      expect(texto).not.toMatch(/435|quatrocentos/i);
    }
  });

  it("a única cifra exibida é a parcela aprovada", () => {
    const { container } = render(<QuizFeriado />);
    fireEvent.click(screen.getByRole("button", { name: /começar o teste/i }));
    responderTudo(() => 0);
    passarPelaTransicao();
    preencher("Marina Costa Lima", "86999207088");
    fireEvent.click(screen.getByRole("button", { name: /revelar meu feriado/i }));

    const cifras = (container.textContent ?? "").match(/R\$\s?[\d.,]+/g) ?? [];
    // NENHUMA cifra na página, de propósito: enquanto a cobrança não parcelar
    // de verdade, anunciar "10x de R$ X" aqui é prometer o que não se cumpre.
    expect(cifras).toEqual([]);
  });

  it("a assinatura aparece só no resultado", () => {
    const { container } = render(<QuizFeriado />);
    const contar = () => (container.textContent ?? "").split("@rwturismo.pi").length - 1;

    expect(contar()).toBe(0); // abertura: quem assina é a logo do topo
    fireEvent.click(screen.getByRole("button", { name: /começar o teste/i }));
    expect(contar()).toBe(0); // bloco de perguntas

    responderTudo(() => 0);
    expect(contar()).toBe(0); // transição

    passarPelaTransicao();
    expect(contar()).toBe(0); // captura

    preencher("Marina Costa Lima", "86999207088");
    fireEvent.click(screen.getByRole("button", { name: /revelar meu feriado/i }));
    expect(contar()).toBe(1); // resultado: a única tela que assina
  });
});

describe("o portão da captura", () => {
  const chegarNaCaptura = () => {
    render(<QuizFeriado />);
    fireEvent.click(screen.getByRole("button", { name: /começar o teste/i }));
    responderTudo(() => 0);
    passarPelaTransicao();
  };

  it("sem nome e telefone válidos, o resultado não aparece", () => {
    chegarNaCaptura();
    fireEvent.click(screen.getByRole("button", { name: /revelar meu feriado/i }));

    expect(screen.queryByText(/combina com o feriado que você quer viver/i)).toBeNull();
    expect(screen.getByText("Escreva seu nome e o sobrenome.")).toBeInTheDocument();
    expect(enviarLead).not.toHaveBeenCalled();
  });

  it("nome sem sobrenome não passa", () => {
    chegarNaCaptura();
    preencher("Marina", "86999207088");
    fireEvent.click(screen.getByRole("button", { name: /revelar meu feriado/i }));

    expect(screen.queryByText(/combina com o feriado que você quer viver/i)).toBeNull();
    expect(enviarLead).not.toHaveBeenCalled();
  });

  it("telefone curto não passa", () => {
    chegarNaCaptura();
    preencher("Marina Costa Lima", "8699920");
    fireEvent.click(screen.getByRole("button", { name: /revelar meu feriado/i }));

    expect(screen.queryByText(/combina com o feriado que você quer viver/i)).toBeNull();
    expect(enviarLead).not.toHaveBeenCalled();
  });

  // O form usa noValidate, então required não muda o submit — muda o que o
  // leitor de tela anuncia. Sem ele, o campo opcional soa igual aos obrigatórios.
  it("os dois campos obrigatórios são anunciados como obrigatórios", () => {
    chegarNaCaptura();
    expect(screen.getByLabelText(/nome completo/i)).toBeRequired();
    expect(screen.getByLabelText(/whatsapp, com ddd/i)).toBeRequired();
    expect(screen.getByLabelText(/cidade de embarque/i)).not.toBeRequired();
  });

  it("cidade em branco nunca bloqueia", () => {
    chegarNaCaptura();
    preencher("Marina Costa Lima", "86999207088");
    fireEvent.click(screen.getByRole("button", { name: /revelar meu feriado/i }));

    expect(screen.getByText(/combina com o feriado que você quer viver/i)).toBeInTheDocument();
  });
});

describe("o lead no CRM", () => {
  const concluir = (cidade = "Teresina") => {
    render(<QuizFeriado />);
    fireEvent.click(screen.getByRole("button", { name: /começar o teste/i }));
    // Índice 1 em toda pergunta puxa para o lado da aventura.
    responderTudo((total) => Math.min(1, total - 1));
    passarPelaTransicao();
    preencher("Marina Costa Lima", "86999207088", cidade);
    fireEvent.click(screen.getByRole("button", { name: /revelar meu feriado/i }));
  };

  // O ponto todo da integração: o contato entra no CRM no submit, e não no
  // clique do WhatsApp. Quem fecha a aba sem tocar no botão já é lead.
  it("é gravado no submit, antes de qualquer clique no WhatsApp", () => {
    concluir();

    expect(enviarLead).toHaveBeenCalledTimes(1);
    expect(enviarLead).toHaveBeenCalledWith({
      name: "Marina Costa Lima",
      phone: "(86) 99920-7088",
      interest: "Quiz Feriado 7 de Setembro",
      message: "Perfil: adrenalina · Embarque: Teresina",
    });
  });

  it("cidade em branco vira 'a confirmar' também no CRM", () => {
    concluir("");
    expect(enviarLead.mock.calls[0]![0]).toMatchObject({
      message: "Perfil: adrenalina · Embarque: a confirmar",
    });
  });

  // Falha de rede não pode segurar a revelação: o link do WhatsApp continua
  // sendo o caminho garantido da venda.
  it("se o CRM falhar, o resultado aparece do mesmo jeito", () => {
    enviarLead.mockRejectedValue(new Error("supabase fora do ar"));
    concluir();
    expect(screen.getByText(/combina com o feriado que você quer viver/i)).toBeInTheDocument();
  });
});

describe("o CTA do WhatsApp", () => {
  it("abre em nova aba com a mensagem do perfil calculado", () => {
    render(<QuizFeriado />);
    fireEvent.click(screen.getByRole("button", { name: /começar o teste/i }));
    responderTudo(() => 0);
    passarPelaTransicao();
    preencher("Marina Costa Lima", "86999207088", "Teresina");
    fireEvent.click(screen.getByRole("button", { name: /revelar meu feriado/i }));

    const cta = screen.getByRole("link", { name: /quero conhecer a viagem/i });
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noopener noreferrer");

    const href = cta.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/5586999207088?text=")).toBe(true);

    const mensagem = decodeURIComponent(href.split("?text=")[1] ?? "");
    expect(mensagem).toContain("Meu nome é Marina Costa Lima e embarco em Teresina.");
    expect(mensagem).not.toMatch(/\{perfil\}|\{nome\}|\{cidade\}/);
  });
});
