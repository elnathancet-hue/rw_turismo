import { describe, expect, it } from "vitest";
import { lerPlanilha } from "./csv";
import {
  adivinharMapeamento,
  classificarLinhas,
  contarPorClassificacao,
  type PacoteConhecido,
  type SaidaExistente,
} from "./saidas";

const bytes = (texto: string): ArrayBuffer => new TextEncoder().encode(texto).buffer;

const PACOTES: PacoteConhecido[] = [
  { id: "p1", title: "Serra da Ibiapaba", slug: "serra-da-ibiapaba", deleted_at: null },
  { id: "p2", title: "Chapada das Mesas", slug: "chapada-das-mesas", deleted_at: null },
  { id: "p3", title: "Jericoacoara", slug: "jeri-2027", deleted_at: "2026-01-01" },
  // Mesmo título, slugs diferentes: a viagem de dois anos distintos.
  { id: "p4", title: "Réveillon", slug: "reveillon-2027", deleted_at: null },
  { id: "p5", title: "Réveillon", slug: "reveillon-2028", deleted_at: null },
];

const planilha = (corpo: string) =>
  lerPlanilha(bytes(`Pacote;Data de ida;Data de volta;Vagas;Preço da saída\r\n${corpo}`));

const classificar = (corpo: string, existentes: SaidaExistente[] = []) => {
  const lida = planilha(corpo);
  return classificarLinhas(lida, adivinharMapeamento(lida.cabecalho), PACOTES, existentes);
};

describe("mapeamento de colunas", () => {
  it("casa por nome, não por posição", () => {
    // A mesma planilha com as colunas embaralhadas precisa dar no mesmo lugar.
    const lida = lerPlanilha(bytes("Vagas;Pacote;Data de volta;Data de ida\r\n"));
    const mapa = adivinharMapeamento(lida.cabecalho);
    expect(mapa.vagas).toBe(0);
    expect(mapa.pacote).toBe(1);
    expect(mapa.volta).toBe(2);
    expect(mapa.ida).toBe(3);
  });

  it("aceita sinônimo, sem acento e sem caixa", () => {
    const lida = lerPlanilha(bytes("PRODUTO;SAIDA;RETORNO;LUGARES\r\n"));
    const mapa = adivinharMapeamento(lida.cabecalho);
    expect(mapa.pacote).toBe(0);
    expect(mapa.ida).toBe(1);
    expect(mapa.volta).toBe(2);
    expect(mapa.vagas).toBe(3);
  });
});

describe("classificação das linhas", () => {
  it("linha completa e inédita vira 'novo'", () => {
    const [linha] = classificar("serra-da-ibiapaba;05/09/2026;07/09/2026;46;1.200,00\r\n");
    expect(linha?.classificacao).toBe("novo");
    expect(linha?.valores).toMatchObject({
      product_id: "p1",
      start_date: "2026-09-05",
      end_date: "2026-09-07",
      available_slots: 46,
      price_override: 1200,
    });
  });

  it("encontra o pacote pelo título também", () => {
    const [linha] = classificar("Chapada das Mesas;10/10/2026;12/10/2026;30;\r\n");
    expect(linha?.classificacao).toBe("novo");
    expect(linha?.valores?.product_id).toBe("p2");
  });

  // Dois pacotes com o mesmo título são a mesma viagem em anos diferentes.
  // Escolher um seria adivinhar em qual calendário a saída entra.
  it("título ambíguo vira erro, não chute", () => {
    const [linha] = classificar("Réveillon;28/12/2026;02/01/2027;40;\r\n");
    expect(linha?.classificacao).toBe("erro");
    expect(linha?.erros.join(" ")).toContain("mais de um pacote");
  });

  it("pacote inexistente não cria pacote nenhum", () => {
    const [linha] = classificar("Machu Picchu;05/09/2026;07/09/2026;20;\r\n");
    expect(linha?.classificacao).toBe("erro");
    expect(linha?.erros.join(" ")).toContain("não encontrado");
  });

  it("pacote na lixeira é recusado", () => {
    const [linha] = classificar("jeri-2027;05/09/2026;07/09/2026;20;\r\n");
    expect(linha?.classificacao).toBe("erro");
    expect(linha?.erros.join(" ")).toContain("lixeira");
  });

  it("volta antes da ida é recusada", () => {
    const [linha] = classificar("serra-da-ibiapaba;07/09/2026;05/09/2026;46;\r\n");
    expect(linha?.classificacao).toBe("erro");
    expect(linha?.erros.join(" ")).toContain("volta é antes");
  });

  it("linha de total no fim é ignorada, não vira saída", () => {
    const linhas = classificar(
      "serra-da-ibiapaba;05/09/2026;07/09/2026;46;\r\nTOTAL;;;;\r\n"
    );
    expect(linhas[0]?.classificacao).toBe("novo");
    expect(linhas[1]?.classificacao).toBe("ignorada");
  });

  // A primeira gravaria e a segunda estouraria no unique, no meio da
  // importação, com metade das linhas já no banco.
  it("saída repetida dentro do próprio arquivo é pega antes de gravar", () => {
    const linhas = classificar(
      "serra-da-ibiapaba;05/09/2026;07/09/2026;46;\r\nserra-da-ibiapaba;05/09/2026;07/09/2026;50;\r\n"
    );
    expect(linhas[0]?.classificacao).toBe("novo");
    expect(linhas[1]?.classificacao).toBe("erro");
    expect(linhas[1]?.erros.join(" ")).toContain("duas vezes");
  });
});

describe("saída que já existe", () => {
  const existente: SaidaExistente = {
    id: "d1",
    product_id: "p1",
    start_date: "2026-09-05",
    end_date: "2026-09-07",
    available_slots: 24,
    deleted_at: null,
    updated_at: "2026-08-01T10:00:00Z",
  };

  it("é reconhecida pela chave do banco (pacote + ida + volta)", () => {
    const [linha] = classificar(
      "serra-da-ibiapaba;05/09/2026;07/09/2026;46;\r\n",
      [existente]
    );
    expect(linha?.classificacao).toBe("existente");
    expect(linha?.idAlvo).toBe("d1");
  });

  // As vagas atuais viajam para a tela porque é a informação que o operador
  // precisa ver antes de decidir — e porque a gravação NUNCA sobrescreve esse
  // número: ele é estoque vivo, já descontado pelas reservas.
  it("leva as vagas atuais para a prévia", () => {
    const [linha] = classificar(
      "serra-da-ibiapaba;05/09/2026;07/09/2026;46;\r\n",
      [existente]
    );
    expect(linha?.vagasAtuais).toBe(24);
    expect(linha?.updatedAtVisto).toBe("2026-08-01T10:00:00Z");
  });

  // O unique do banco não filtra excluído, mas as listagens do admin filtram.
  // Sem este balde, a linha viria como "nova", o operador aprovaria, e o insert
  // estouraria no meio da importação.
  it("saída na lixeira tem balde próprio, não vira 'novo'", () => {
    const [linha] = classificar("serra-da-ibiapaba;05/09/2026;07/09/2026;46;\r\n", [
      { ...existente, deleted_at: "2026-02-01T00:00:00Z" },
    ]);
    expect(linha?.classificacao).toBe("lixeira");
    expect(linha?.idAlvo).toBe("d1");
  });
});

describe("contagem para a tela", () => {
  it("soma cada balde", () => {
    const linhas = classificar(
      [
        "serra-da-ibiapaba;05/09/2026;07/09/2026;46;",
        "chapada-das-mesas;10/10/2026;12/10/2026;30;",
        "Machu Picchu;01/01/2027;05/01/2027;10;",
        "TOTAL;;;;",
      ].join("\r\n") + "\r\n"
    );

    expect(contarPorClassificacao(linhas)).toEqual({
      novo: 2,
      existente: 0,
      lixeira: 0,
      erro: 1,
      ignorada: 1,
    });
  });
});
