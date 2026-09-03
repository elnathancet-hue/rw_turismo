import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lerArquivoDePlanilha } from "./csv";
import {
  colunaDaReferencia,
  lerPlanilhaXlsx,
  serialParaData,
} from "./xlsx";

// O teste roda contra um .xlsx DE VERDADE (gerado em __fixtures__), e nao
// contra um dublê. Um leitor de planilha que so foi testado com XML montado a
// mao nao prova que abre o arquivo que sai do Excel.
//
// A planilha de exemplo tem, de proposito, o que costuma quebrar leitor:
//   - a aba se chama sheet7.xml, nao sheet1.xml (quem chuta o nome erra)
//   - uma entrada do ZIP sem compressao e o resto com deflate
//   - data como numero de serie, que sem consultar o estilo vira "31118"
//   - celula VAZIA no meio da linha, que desloca as colunas se ignorada
//   - acento, string compartilhada partida em pedacos, e inlineStr

const planilha = () => {
  const caminho = join(__dirname, "__fixtures__", "exemplo.xlsx");
  const buffer = readFileSync(caminho);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
};

describe("colunaDaReferencia", () => {
  it("traduz a letra da coluna", () => {
    expect(colunaDaReferencia("A1")).toBe(0);
    expect(colunaDaReferencia("D2")).toBe(3);
    expect(colunaDaReferencia("Z9")).toBe(25);
    expect(colunaDaReferencia("AA1")).toBe(26);
    expect(colunaDaReferencia("BC7")).toBe(54);
  });
});

describe("serialParaData", () => {
  // A época é 30/12/1899 por causa do bug do ano bissexto de 1900, que o Excel
  // copiou do Lotus. Usar 01/01/1900 erra por um dia — e um dia a menos numa
  // data de saída é a pessoa no aeroporto no dia errado.
  it("bate com o que o Excel mostra", () => {
    expect(serialParaData(31118)).toBe("1985-03-12");
    expect(serialParaData(46270)).toBe("2026-09-05");
    expect(serialParaData(1)).toBe("1899-12-31");
  });
});

describe("lerPlanilhaXlsx", () => {
  it("lê o cabeçalho, com acento", async () => {
    const lida = await lerPlanilhaXlsx(planilha());
    expect(lida.cabecalho).toEqual([
      "Nome",
      "Telefone",
      "Nascimento",
      "Observação",
    ]);
  });

  it("acha a aba certa mesmo ela não sendo sheet1.xml", async () => {
    const lida = await lerPlanilhaXlsx(planilha());
    expect(lida.linhas.length).toBeGreaterThan(0);
  });

  it("converte data em aaaa-mm-dd, e não no número de série", async () => {
    const lida = await lerPlanilhaXlsx(planilha());
    expect(lida.linhas[0]![2]).toBe("1985-03-12");
    expect(lida.linhas[1]![2]).toBe("2026-09-05");
  });

  it("número que NÃO é data continua número", async () => {
    const lida = await lerPlanilhaXlsx(planilha());
    expect(lida.linhas[0]![1]).toBe("86999207088");
  });

  // O estrago silencioso: sem preencher o buraco, "2026-09-05" subiria para a
  // coluna B e viraria telefone.
  it("célula vazia no meio não desloca as colunas seguintes", async () => {
    const lida = await lerPlanilhaXlsx(planilha());
    const segunda = lida.linhas[1]!;
    expect(segunda[0]).toBe("Maria Antônia");
    expect(segunda[1]).toBe("");
    expect(segunda[2]).toBe("2026-09-05");
  });

  it("junta string compartilhada partida em pedaços", async () => {
    const lida = await lerPlanilhaXlsx(planilha());
    expect(lida.linhas[0]![3]).toBe("cliente antigo");
  });

  it("lê texto escrito direto na célula (inlineStr)", async () => {
    const lida = await lerPlanilhaXlsx(planilha());
    expect(lida.linhas[2]![0]).toBe("Direto na célula");
  });

  it("descarta linha totalmente vazia", async () => {
    const lida = await lerPlanilhaXlsx(planilha());
    expect(lida.linhas).toHaveLength(3);
  });

  // numeroNoArquivo é o que a tela mostra quando diz "erro na linha 5", e o
  // operador procura essa linha no Excel.
  it("guarda o número da linha como ela aparece no Excel", async () => {
    const lida = await lerPlanilhaXlsx(planilha());
    expect(lida.numeroNoArquivo).toEqual([2, 3, 5]);
  });

  it("iguala o comprimento das linhas ao do cabeçalho", async () => {
    const lida = await lerPlanilhaXlsx(planilha());
    for (const linha of lida.linhas) expect(linha).toHaveLength(4);
  });

  it("arquivo que não é planilha dá erro em português", async () => {
    const lixo = new TextEncoder().encode("isto não é um zip").buffer;
    await expect(lerPlanilhaXlsx(lixo as ArrayBuffer)).rejects.toThrow(
      /não parece uma planilha/
    );
  });
});

// O despachante decide pelos BYTES, e nao pela extensao. Extensao mente: gente
// renomeia .xlsx para .csv achando que converte, e o Excel salva CSV com nome
// .xls. Todo .xlsx comeca com "PK".
describe("lerArquivoDePlanilha", () => {
  it("reconhece xlsx mesmo que o arquivo tenha sido renomeado para .csv", async () => {
    const lida = await lerArquivoDePlanilha(planilha());
    expect(lida.cabecalho[0]).toBe("Nome");
    expect(lida.linhas[0]![2]).toBe("1985-03-12");
  });

  it("continua lendo CSV como antes", async () => {
    const csv = new TextEncoder().encode(
      "Nome;Telefone\r\nJosé;86999207088\r\n"
    ).buffer as ArrayBuffer;
    const lida = await lerArquivoDePlanilha(csv);
    expect(lida.cabecalho).toEqual(["Nome", "Telefone"]);
    expect(lida.linhas[0]).toEqual(["José", "86999207088"]);
    expect(lida.separador).toBe(";");
  });

  it("CSV que comeca com P nao e confundido com ZIP", async () => {
    const csv = new TextEncoder().encode(
      "Pacote;Vagas\r\nUbajara;40\r\n"
    ).buffer as ArrayBuffer;
    const lida = await lerArquivoDePlanilha(csv);
    expect(lida.cabecalho).toEqual(["Pacote", "Vagas"]);
  });
});
