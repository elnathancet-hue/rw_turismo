import { describe, expect, it } from "vitest";
import { lerPlanilha } from "./csv";
import {
  adivinharMapeamentoDeClientes,
  classificarClientes,
  contarClientes,
  type ClienteConhecido,
} from "./clientes";

const bytes = (texto: string): ArrayBuffer => new TextEncoder().encode(texto).buffer;

const BASE: ClienteConhecido[] = [
  {
    id: "c1",
    email: "maria@exemplo.com",
    name: "Maria Silva",
    phone: "86999990001",
    birth_date: "1985-03-10",
    document: "111.222.333-44",
  },
  {
    // Cliente antigo: sem e-mail, sem login. Existe só na agenda.
    id: "c2",
    email: null,
    name: "João Antigo",
    phone: "86999990002",
    birth_date: null,
    document: "072.074.233-14",
  },
];

const classificar = (corpo: string, base = BASE) => {
  const lida = lerPlanilha(
    bytes(`Nome;E-mail;Telefone;Nascimento;Documento\r\n${corpo}`)
  );
  return classificarClientes(lida, adivinharMapeamentoDeClientes(lida.cabecalho), base);
};

describe("cliente sem e-mail", () => {
  // O ponto todo desta importação: a base antiga não tem e-mail, e essas
  // pessoas não precisam de login para existir na agenda.
  it("entra normalmente, sem e-mail", () => {
    const [linha] = classificar("Pedro Sousa;;86988887777;;\r\n");
    expect(linha?.classificacao).toBe("novo");
    expect(linha?.valores?.email).toBeNull();
    expect(linha?.valores?.name).toBe("Pedro Sousa");
  });

  it("nome continua obrigatório", () => {
    const [linha] = classificar(";;86988887777;;\r\n");
    expect(linha?.classificacao).toBe("erro");
    expect(linha?.erros.join(" ")).toContain("nome");
  });

  it("e-mail preenchido e inválido é recusado", () => {
    const [linha] = classificar("Pedro Sousa;isso-nao-e-email;;;\r\n");
    expect(linha?.classificacao).toBe("erro");
    expect(linha?.erros.join(" ")).toContain("inválido");
  });
});

describe("como a mesma pessoa é reconhecida", () => {
  it("pelo e-mail, quando tem", () => {
    const [linha] = classificar("Maria Silva;maria@exemplo.com;;;\r\n");
    expect(linha?.classificacao).toBe("existente");
    expect(linha?.chave).toBe("e-mail");
    expect(linha?.idAlvo).toBe("c1");
  });

  // "072.074.233-14" e "07207423314" são a mesma pessoa. Comparar o texto cru
  // criaria um segundo cadastro do mesmo cliente.
  it("pelo documento, comparando só os dígitos", () => {
    const [linha] = classificar("Joao Antigo;;;;07207423314\r\n");
    expect(linha?.classificacao).toBe("existente");
    expect(linha?.chave).toBe("documento");
    expect(linha?.idAlvo).toBe("c2");
  });

  it("pelo telefone, quando é tudo que existe", () => {
    const [linha] = classificar("Joao A.;;(86) 99999-0002;;\r\n");
    expect(linha?.classificacao).toBe("existente");
    expect(linha?.chave).toBe("telefone");
    expect(linha?.idAlvo).toBe("c2");
  });

  // Nome igual não é identificação: a base tem homônimo, e juntar dois
  // clientes diferentes é pior do que ter dois cadastros.
  it("sem nenhum identificador, é sempre nova — mesmo com nome idêntico", () => {
    const [linha] = classificar("Maria Silva;;;;\r\n");
    expect(linha?.classificacao).toBe("novo");
    expect(linha?.chave).toBe("sem identificador");
  });

  it("e-mail tem prioridade sobre documento", () => {
    // E-mail aponta para c1, documento aponta para c2. Vale o e-mail.
    const [linha] = classificar("Maria;maria@exemplo.com;;;07207423314\r\n");
    expect(linha?.idAlvo).toBe("c1");
    expect(linha?.chave).toBe("e-mail");
  });
});

describe("atualização de quem já existe", () => {
  // O estrago mais comum de importação de cadastro: a planilha vem sem a
  // coluna preenchida e zera o dado bom que estava no sistema.
  it("célula vazia não conta como mudança", () => {
    const [linha] = classificar("Maria Silva;maria@exemplo.com;;;\r\n");
    expect(linha?.mudancas).toEqual([]);
  });

  it("mostra o de/para de cada campo que muda", () => {
    const [linha] = classificar(
      "Maria Silva Souza;maria@exemplo.com;86988887777;;\r\n"
    );
    expect(linha?.mudancas).toEqual([
      { campo: "Nome", de: "Maria Silva", para: "Maria Silva Souza" },
      { campo: "Telefone", de: "86999990001", para: "86988887777" },
    ]);
  });

  // Completar o e-mail de quem não tinha é o caminho de um contato virar
  // cliente com acesso ao site.
  it("aponta o e-mail novo de quem não tinha", () => {
    const [linha] = classificar("Joao Antigo;joao@exemplo.com;;;07207423314\r\n");
    expect(linha?.classificacao).toBe("existente");
    expect(linha?.mudancas).toContainEqual({
      campo: "E-mail",
      de: "—",
      para: "joao@exemplo.com",
    });
  });
});

describe("problemas dentro do próprio arquivo", () => {
  it("a mesma pessoa duas vezes vira erro na segunda", () => {
    const linhas = classificar(
      "Novo Um;novo@exemplo.com;;;\r\nNovo Um de novo;novo@exemplo.com;;;\r\n"
    );
    expect(linhas[0]?.classificacao).toBe("novo");
    expect(linhas[1]?.classificacao).toBe("erro");
    expect(linhas[1]?.erros.join(" ")).toContain("mais de uma vez");
  });

  it("nascimento no futuro é recusado", () => {
    const [linha] = classificar("Pedro;;;01/01/2099;\r\n");
    expect(linha?.classificacao).toBe("erro");
    expect(linha?.erros.join(" ")).toContain("futuro");
  });

  it("linha de total é ignorada", () => {
    const linhas = classificar("Pedro;;;;\r\nTOTAL;;;;\r\n");
    expect(contarClientes(linhas)).toEqual({
      novo: 1,
      existente: 0,
      erro: 0,
      ignorada: 1,
    });
  });
});
