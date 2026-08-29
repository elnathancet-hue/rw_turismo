import { describe, expect, it } from "vitest";
import {
  acharCabecalho,
  acharDocumentosRepetidos,
  lerPassageiros,
} from "./passageiros";

// Os casos abaixo saíram da lista de verdade — "Lista Passageiros Sítio do
// Bosco x Ubajara x Lapa". Não são hipóteses: cada um apareceu no arquivo.
const CABECALHO = [
  "N°",
  "Nome do passageiro",
  "Documento",
  "Local de Embarque",
  "Contato",
];

const TITULO = ["DESTINO: SÍTIO DO BOSCO X LAPA X UBAJARA DATA: 05 a 07/09/2026"];

const ler = (linhas: string[][]) => {
  const cabecalho = acharCabecalho(linhas);
  if (!cabecalho) throw new Error("cabeçalho não encontrado");
  return lerPassageiros(linhas, cabecalho);
};

describe("acharCabecalho", () => {
  // A lista tem uma linha de título antes da tabela.
  it("pula a linha de título e acha a tabela", () => {
    const achado = acharCabecalho([TITULO, CABECALHO]);
    expect(achado?.indice).toBe(1);
    expect(achado?.mapa.nome).toBe(1);
    expect(achado?.mapa.documento).toBe(2);
    expect(achado?.mapa.contato).toBe(4);
  });

  it("devolve nulo quando não há coluna de nome", () => {
    expect(acharCabecalho([["A", "B"], ["1", "2"]])).toBeNull();
  });
});

describe("lerPassageiros", () => {
  it("lê a linha simples", () => {
    const [pax] = ler([
      TITULO,
      CABECALHO,
      ["01", "Roberto Willame Furtado de Matos Sousa", "CPF 428.554.973-53", "Juju Magazine/ Geovane Prado", "(86) 99478-7182"],
    ]);

    expect(pax?.nome).toBe("Roberto Willame Furtado de Matos Sousa");
    expect(pax?.documento).toBe("428.554.973-53");
    expect(pax?.telefone).toBe("86994787182");
    expect(pax?.embarque).toBe("Juju Magazine/ Geovane Prado");
  });

  // As 16 linhas do fim da lista são o gabarito do ônibus: têm número e nada
  // mais. Virariam 16 passageiros sem nome.
  it("ignora as linhas vazias do gabarito do ônibus", () => {
    const passageiros = ler([
      TITULO,
      CABECALHO,
      ["01", "Roberto Sousa", "CPF 428.554.973-53", "", ""],
      ["46", "", "", "", ""],
      ["47", "", "", "", ""],
    ]);
    expect(passageiros).toHaveLength(1);
  });

  // A observação vira campo próprio: pedido de poltrona não é parte do nome.
  it("separa a observação de dentro do nome", () => {
    const [pax] = ler([
      TITULO,
      CABECALHO,
      ["03", "Vanessa Alves dos Santos Assunção(Quer os glampings mais próximos do banheiro) (poltronas perto da entrada do ônibus)", "CPF 072.074.233-14", "", ""],
    ]);

    expect(pax?.nome).toBe("Vanessa Alves dos Santos Assunção");
    expect(pax?.observacoes).toEqual([
      "Quer os glampings mais próximos do banheiro",
      "poltronas perto da entrada do ônibus",
    ]);
  });

  it("separa aviso de pagamento escrito no nome", () => {
    const [pax] = ler([
      TITULO,
      CABECALHO,
      ["05", "Helenicia Rosana de Sousa Silva (pg 04/09)", "CPF 600.361.163-43", "", ""],
    ]);
    expect(pax?.nome).toBe("Helenicia Rosana de Sousa Silva");
    expect(pax?.observacoes).toEqual(["pg 04/09"]);
  });

  // Duas pessoas na mesma linha: o adulto e a criança, uma embaixo da outra,
  // com dois CPFs na célula do documento.
  it("desdobra duas pessoas escritas na mesma linha", () => {
    const passageiros = ler([
      TITULO,
      CABECALHO,
      [
        "04",
        "Denilson Nascimento de Sousa\nMaria Cecilia Alves Nascimento DN10/09/2025",
        "CPF 053.192.033.06\nCPF 133.837.913-51",
        "Juju Magazine/ Geovane Prado",
        "",
      ],
    ]);

    expect(passageiros).toHaveLength(2);
    expect(passageiros[0]?.nome).toBe("Denilson Nascimento de Sousa");
    expect(passageiros[1]?.nome).toBe("Maria Cecilia Alves Nascimento");
    // A data colada no nome é a de nascimento — é assim que a lista marca
    // criança de colo.
    expect(passageiros[1]?.nascimento).toBe("2025-09-10");
    expect(passageiros[1]?.numero).toBe("04.2");
  });

  // "053.192.033.06" tem ponto onde deveria ter traço. O número está certo, a
  // pontuação não — reformatar e avisar é melhor que recusar.
  it("conserta a pontuação do CPF e avisa", () => {
    const [pax] = ler([
      TITULO,
      CABECALHO,
      ["04", "Denilson Nascimento de Sousa", "CPF 053.192.033.06", "", ""],
    ]);
    expect(pax?.documento).toBe("053.192.033-06");
    expect(pax?.avisos.join(" ")).toContain("reformatado");
  });

  it("avisa quando o telefone tem 10 dígitos", () => {
    const [pax] = ler([
      TITULO,
      CABECALHO,
      ["03", "Vanessa Alves", "", "", "(86) 9478-7182"],
    ]);
    expect(pax?.telefone).toBe("8694787182");
    expect(pax?.avisos.join(" ")).toContain("pode faltar o 9");
  });

  it("descarta o telefone de preenchimento do modelo", () => {
    const [pax] = ler([
      TITULO,
      CABECALHO,
      ["01", "Roberto Sousa", "", "", "DD 90000-0000"],
    ]);
    expect(pax?.telefone).toBeNull();
    expect(pax?.avisos.join(" ")).toContain("modelo");
  });
});

describe("acharDocumentosRepetidos", () => {
  // Na lista real, duas pessoas diferentes aparecem com o mesmo CPF. Não
  // impede a importação, mas quem confere precisa ver antes de gravar.
  it("aponta o CPF que aparece em duas pessoas", () => {
    const passageiros = ler([
      TITULO,
      CABECALHO,
      ["08", "Jessica Rafaela dos Santos Silva", "CPF 082.482.343-55", "", ""],
      ["09", "Maria das Graças Pereira dos Santos", "CPF 082.482.343-55", "", ""],
      ["10", "Outra Pessoa", "CPF 111.222.333-44", "", ""],
    ]);

    const repetidos = acharDocumentosRepetidos(passageiros);
    expect(repetidos.size).toBe(1);
    expect(repetidos.get("08248234355")).toEqual([
      "Jessica Rafaela dos Santos Silva",
      "Maria das Graças Pereira dos Santos",
    ]);
  });
});
