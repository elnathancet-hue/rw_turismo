import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Quiz } from "./types";

// O editor inteiro, com o router e a persistência trocados por dublês.
//
// Cobre o que a lista de verificação pede e nenhum teste unitário alcança:
// trocar de seção sem perder edição, e os estados de salvamento não mentirem.

const quizBase: Quiz = {
  id: "q1",
  title: "Que feriado combina com você?",
  slug: "feriado",
  status: "draft",
  seo_title: null,
  seo_description: null,
  intro: {},
  eixos: ["descanso", "aventura"],
  margem_empate: 0.5,
  cta: {},
  captura_ativa: true,
  resultado_layout: {},
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
    { chave: "r1", eixo: "descanso", rotulo: "Sossego" },
    { chave: "r2", eixo: "aventura", rotulo: "Serra" },
    { chave: "r3", eixo: null, rotulo: "Meio a meio" },
  ],
} as Quiz;

const getAdminQuiz = vi.fn();
const saveAdminQuiz = vi.fn();

vi.mock("./client", () => ({
  getAdminQuiz: (...a: unknown[]) => getAdminQuiz(...a),
  saveAdminQuiz: (...a: unknown[]) => saveAdminQuiz(...a),
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    // AdminLayout usa o caminho para marcar o item ativo do menu.
    pathname: "/admin/quizzes/[id]",
    asPath: "/admin/quizzes/q1",
    route: "/admin/quizzes/[id]",
    query: { id: "q1" },
    push: vi.fn(),
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  }),
}));

// next/link busca o router pelo contexto interno do Next, que o mock de
// next/router não fornece. Aqui ele é só uma âncora.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...resto
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

// AdminGuard consulta sessão; aqui só precisa deixar passar.
vi.mock("../../components/admin/AdminGuard", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Fica em lib/, e nao ao lado da pagina: o Next trata TODO arquivo dentro
// de src/pages como rota, e um .test.tsx la quebra o build.
import AdminQuizEditor from "../../pages/admin/quizzes/[id]";

const abrir = async (quiz: Quiz = quizBase) => {
  getAdminQuiz.mockResolvedValue(structuredClone(quiz));
  render(<AdminQuizEditor />);
  await screen.findByRole("button", { name: /Informações gerais/ });
};

beforeEach(() => {
  getAdminQuiz.mockReset();
  saveAdminQuiz.mockReset();
});

describe("navegar sem perder alterações", () => {
  it("edita em Informações gerais, vai a Perguntas e volta: o texto continua lá", async () => {
    await abrir();

    const nome = screen.getByLabelText(/Nome do quiz/) as HTMLInputElement;
    fireEvent.change(nome, { target: { value: "Quiz do feriado 2027" } });

    fireEvent.click(screen.getByRole("button", { name: /^Perguntas/ }));
    // Aparece duas vezes de propósito: na lista e na prévia ao lado.
    expect(
      screen.getAllByText("Como você imagina o feriado?").length
    ).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: /Informações gerais/ }));
    expect(
      (screen.getByLabelText(/Nome do quiz/) as HTMLInputElement).value
    ).toBe("Quiz do feriado 2027");
  });

  it("mantém a pergunta selecionada ao sair e voltar da seção", async () => {
    await abrir({
      ...quizBase,
      perguntas: [
        quizBase.perguntas[0]!,
        { texto: "Segunda pergunta", opcoes: [{ texto: "x", pesos: {} }] },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /^Perguntas/ }));
    fireEvent.click(screen.getByRole("button", { name: /Segunda pergunta/ }));
    fireEvent.click(screen.getByRole("button", { name: /Resultados/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Perguntas/ }));

    expect(
      (screen.getByLabelText(/Enunciado/) as HTMLTextAreaElement).value
    ).toBe("Segunda pergunta");
  });
});

describe("estados de salvamento", () => {
  it('começa em "Tudo salvo" e passa a "Não salvo" ao editar', async () => {
    await abrir();
    expect(screen.getByText("Tudo salvo")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Nome do quiz/), {
      target: { value: "outro" },
    });
    expect(screen.getByText("Não salvo")).toBeTruthy();
  });

  it('só mostra "Salvo" depois que o banco confirma', async () => {
    await abrir();
    let confirmar: (q: Quiz) => void = () => {};
    saveAdminQuiz.mockReturnValue(
      new Promise<Quiz>((r) => {
        confirmar = r;
      })
    );

    fireEvent.change(screen.getByLabelText(/Nome do quiz/), {
      target: { value: "outro" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    // Enquanto a promessa não resolve, NÃO pode dizer que salvou.
    await waitFor(() => expect(screen.getByText("Salvando…")).toBeTruthy());
    expect(screen.queryByText("Salvo")).toBeNull();

    confirmar({ ...quizBase, title: "outro" });
    await waitFor(() => expect(screen.getByText("Salvo")).toBeTruthy());
  });

  it('falha ao salvar mostra "Erro ao salvar" e a mensagem, e nunca "Salvo"', async () => {
    await abrir();
    saveAdminQuiz.mockRejectedValue(new Error("permissão negada"));

    fireEvent.change(screen.getByLabelText(/Nome do quiz/), {
      target: { value: "outro" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.getByText("Erro ao salvar")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toContain("permissão negada");
    expect(screen.queryByText("Salvo")).toBeNull();
  });

  it('"Salvo" some quando a pessoa volta a editar', async () => {
    await abrir();
    saveAdminQuiz.mockResolvedValue(structuredClone(quizBase));

    fireEvent.change(screen.getByLabelText(/Nome do quiz/), {
      target: { value: "a" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.getByText("Salvo")).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/Nome do quiz/), {
      target: { value: "b" },
    });
    expect(screen.queryByText("Salvo")).toBeNull();
    expect(screen.getByText("Não salvo")).toBeTruthy();
  });
});

describe("publicação", () => {
  it("quiz em rascunho oferece Publicar, e não Despublicar", async () => {
    await abrir();
    expect(screen.getByRole("button", { name: "Publicar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Despublicar" })).toBeNull();
  });

  // Não existe versão de rascunho separada da publicada: salvar um quiz
  // publicado vai ao ar na hora, e a tela precisa dizer isso.
  it("quiz publicado com edição pendente avisa que salvar vai ao ar", async () => {
    await abrir({ ...quizBase, status: "published" });
    expect(screen.queryByText(/vão ao ar imediatamente/)).toBeNull();

    fireEvent.change(screen.getByLabelText(/Nome do quiz/), {
      target: { value: "outro" },
    });
    expect(screen.getByText(/vão ao ar imediatamente/)).toBeTruthy();
  });

  it("Visualizar só aparece em quiz publicado", async () => {
    await abrir();
    expect(screen.queryByRole("link", { name: "Visualizar" })).toBeNull();
  });
});

describe("erros e avisos levam ao lugar", () => {
  it("clicar num erro troca para a seção dele", async () => {
    await abrir({ ...quizBase, cta: { tipo: "whatsapp", numero: "" } });

    fireEvent.click(screen.getByText(/1 erro/));
    fireEvent.click(screen.getByText(/sem número/));

    expect(screen.getByText("Ação final")).toBeTruthy();
  });
});
