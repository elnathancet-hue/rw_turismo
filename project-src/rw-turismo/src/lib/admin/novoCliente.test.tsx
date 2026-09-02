import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A tela de Novo cliente, com router e persistencia dublados.
//
// O TESTE QUE MAIS IMPORTA e o primeiro: o <Button> do projeto tem
// type="button" por padrao — o oposto do <button> cru do HTML —, e sem
// type="submit" explicito o onSubmit do <form> nunca dispara. A tela ficou no
// ar sem cadastrar ninguem, e nenhum teste pegava porque nao havia teste.

const createAdminClient = vi.fn();
const searchAdminClients = vi.fn();
const push = vi.fn();

vi.mock("../../lib/admin/client", async () => {
  const real = await vi.importActual<Record<string, unknown>>(
    "../../lib/admin/client"
  );
  return {
    ...real,
    createAdminClient: (...a: unknown[]) => createAdminClient(...a),
    searchAdminClients: (...a: unknown[]) => searchAdminClients(...a),
  };
});

vi.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    query: {},
    push,
    pathname: "/admin/clients/new",
    asPath: "/admin/clients/new",
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("../../components/admin/AdminGuard", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import NovoCliente from "../../pages/admin/clients/new";

// O e-mail entra junto de proposito: termosParaProcurar descarta o NOME (homonimo
// acusaria dezenas de falsos parecidos), entao so o nome nao dispara consulta.
const preencher = (nome = "Maria Souza", email = "maria@exemplo.com") => {
  render(<NovoCliente />);
  fireEvent.change(screen.getByLabelText(/Nome/), { target: { value: nome } });
  fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: email } });
};

beforeEach(() => {
  createAdminClient.mockReset();
  searchAdminClients.mockReset();
  push.mockReset();
  searchAdminClients.mockResolvedValue({ clients: [] });
});

describe("o botão realmente envia o formulário", () => {
  it("o primeiro clique dispara a conferência de parecidos", async () => {
    preencher();
    fireEvent.click(screen.getByRole("button", { name: /Conferir e continuar/ }));
    await waitFor(() => expect(searchAdminClients).toHaveBeenCalled());
  });

  it("o segundo clique cadastra", async () => {
    createAdminClient.mockResolvedValue({
      client: { id: "abc" },
      criou_conta: false,
    });
    preencher();

    fireEvent.click(screen.getByRole("button", { name: /Conferir e continuar/ }));
    await screen.findByRole("button", { name: /Cadastrar cliente/ });
    fireEvent.click(screen.getByRole("button", { name: /Cadastrar cliente/ }));

    await waitFor(() => expect(createAdminClient).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/clients/abc"));
  });
});

describe("a conferência de parecidos não pode virar luz verde falsa", () => {
  it("quando a busca falha, a tela NÃO diz que pode cadastrar", async () => {
    searchAdminClients.mockRejectedValue(new Error("rede caiu"));
    preencher();
    fireEvent.click(screen.getByRole("button", { name: /Conferir e continuar/ }));

    await waitFor(() =>
      expect(screen.getByText(/Não foi possível conferir/)).toBeTruthy()
    );
    expect(screen.queryByText(/Ninguém parecido na base/)).toBeNull();
  });

  it("quando a busca roda e não acha nada, aí sim libera", async () => {
    preencher();
    fireEvent.click(screen.getByRole("button", { name: /Conferir e continuar/ }));
    await waitFor(() =>
      expect(screen.getByText(/Ninguém parecido na base/)).toBeTruthy()
    );
  });
});

describe("e-mail que já tem ficha", () => {
  const recusa = () => {
    const erro = Object.assign(new Error("Ana Lima já está cadastrada."), {
      existente: { id: "ficha-1", name: "Ana Lima" },
    });
    createAdminClient.mockRejectedValueOnce(erro);
  };

  it("mostra quem é, com link para a ficha, em vez de gravar por cima", async () => {
    recusa();
    preencher();
    fireEvent.click(screen.getByRole("button", { name: /Conferir e continuar/ }));
    await screen.findByRole("button", { name: /Cadastrar cliente/ });
    fireEvent.click(screen.getByRole("button", { name: /Cadastrar cliente/ }));

    await waitFor(() =>
      expect(screen.getByText(/Ana Lima já está cadastrado/)).toBeTruthy()
    );
    expect(
      screen.getByRole("link", { name: /Abrir a ficha/ }).getAttribute("href")
    ).toBe("/admin/clients/ficha-1");
    expect(push).not.toHaveBeenCalled();
  });

  // Atualizar tem de ser escolha do operador — e a segunda tentativa precisa
  // dizer isso ao servidor, senao ele recusa de novo.
  it("só atualiza quando o operador confirma, e aí manda atualizar_existente", async () => {
    recusa();
    createAdminClient.mockResolvedValueOnce({
      client: { id: "ficha-1" },
      criou_conta: false,
    });
    preencher();
    fireEvent.click(screen.getByRole("button", { name: /Conferir e continuar/ }));
    await screen.findByRole("button", { name: /Cadastrar cliente/ });
    fireEvent.click(screen.getByRole("button", { name: /Cadastrar cliente/ }));
    await screen.findByText(/Ana Lima já está cadastrado/);

    // A primeira tentativa NAO pediu atualizacao.
    expect(createAdminClient.mock.calls[0]![0]).toMatchObject({
      atualizar_existente: false,
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Atualizar a ficha com o que preenchi/ })
    );
    await waitFor(() =>
      expect(createAdminClient.mock.calls[1]![0]).toMatchObject({
        atualizar_existente: true,
      })
    );
  });
});
