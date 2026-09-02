import { describe, expect, it } from "vitest";
import { eixosOrfaos, removerEixo, renomearEixo } from "./eixos";
import type { Quiz } from "./types";

// O bug que estes testes prendem: os pesos são gravados POR NOME dentro de
// cada opção. Renomear o eixo só na lista `eixos` deixava tudo órfão, e a
// pontuação no banco descarta peso de eixo não declarado — resultado: todos os
// eixos em zero e TODA pessoa caindo no empate. Sem erro em lugar nenhum.

const base = (): Quiz =>
  ({
    id: "1",
    title: "T",
    slug: "t",
    status: "draft",
    seo_title: null,
    seo_description: null,
    intro: {},
    eixos: ["relaxar", "aventura"],
    margem_empate: 0.5,
    cta: {},
    captura_ativa: false,
    perguntas: [
      {
        texto: "p1",
        opcoes: [
          { texto: "a", pesos: { relaxar: 1 } },
          { texto: "b", pesos: { aventura: 1 } },
          { texto: "c", pesos: { relaxar: 0.5, aventura: 0.5 } },
          { texto: "d", pesos: {} },
        ],
      },
    ],
    resultados: [
      { chave: "r", eixo: "relaxar", rotulo: "R" },
      { chave: "a", eixo: "aventura", rotulo: "A" },
      { chave: "e", eixo: null, rotulo: "E" },
    ],
  } as Quiz);

describe("renomearEixo", () => {
  it("leva os pesos junto — é o bug que zerava o quiz em silêncio", () => {
    const q = renomearEixo(base(), 0, "descanso");

    expect(q.eixos).toEqual(["descanso", "aventura"]);
    expect(q.perguntas[0]!.opcoes[0]!.pesos).toEqual({ descanso: 1 });
    expect(q.perguntas[0]!.opcoes[2]!.pesos).toEqual({
      descanso: 0.5,
      aventura: 0.5,
    });
    expect(eixosOrfaos(q)).toEqual([]);
  });

  it("leva o resultado que apontava para o eixo", () => {
    const q = renomearEixo(base(), 1, "acao");
    expect(q.resultados.find((r) => r.chave === "a")!.eixo).toBe("acao");
    // O de empate não tem eixo e não pode ganhar um.
    expect(q.resultados.find((r) => r.chave === "e")!.eixo).toBeNull();
  });

  it("não toca em opção que não pontuava aquele eixo", () => {
    const q = renomearEixo(base(), 0, "descanso");
    expect(q.perguntas[0]!.opcoes[1]!.pesos).toEqual({ aventura: 1 });
    expect(q.perguntas[0]!.opcoes[3]!.pesos).toEqual({});
  });

  // O dano acontecia letra por letra: apagar "relaxar" para digitar "descanso"
  // passa por "relaxa", "relax", "rela"… cada estado com os pesos órfãos.
  it("sobrevive a ser chamado a cada tecla", () => {
    let q = base();
    for (const parcial of ["relaxa", "relax", "rela", "d", "de", "desc", "descanso"]) {
      q = renomearEixo(q, 0, parcial);
    }
    expect(q.eixos).toEqual(["descanso", "aventura"]);
    expect(q.perguntas[0]!.opcoes[0]!.pesos).toEqual({ descanso: 1 });
    expect(eixosOrfaos(q)).toEqual([]);
  });

  it("preserva a ordem das chaves de peso", () => {
    const q = renomearEixo(base(), 0, "zzz");
    expect(Object.keys(q.perguntas[0]!.opcoes[2]!.pesos)).toEqual([
      "zzz",
      "aventura",
    ]);
  });

  it("índice inexistente não quebra", () => {
    expect(renomearEixo(base(), 9, "x").eixos).toEqual(["relaxar", "aventura"]);
  });
});

describe("removerEixo", () => {
  it("tira o peso das opções e solta o resultado para empate", () => {
    const q = removerEixo(base(), 0);

    expect(q.eixos).toEqual(["aventura"]);
    expect(q.perguntas[0]!.opcoes[0]!.pesos).toEqual({});
    expect(q.perguntas[0]!.opcoes[2]!.pesos).toEqual({ aventura: 0.5 });
    expect(eixosOrfaos(q)).toEqual([]);
  });

  // Apagar o resultado apagaria o texto que alguém escreveu, e as respostas
  // já gravadas apontam para a chave dele.
  it("nao apaga o resultado, so tira o eixo dele", () => {
    const q = removerEixo(base(), 0);
    expect(q.resultados).toHaveLength(3);
    expect(q.resultados.find((r) => r.chave === "r")!.eixo).toBeNull();
  });
});

describe("eixosOrfaos", () => {
  it("acha peso apontando para eixo que nao existe mais", () => {
    const q = { ...base(), eixos: ["aventura"] };
    expect(eixosOrfaos(q).sort()).toEqual(["relaxar"]);
  });

  it("acha resultado apontando para eixo que nao existe mais", () => {
    const q = {
      ...base(),
      eixos: ["relaxar", "aventura"],
      resultados: [{ chave: "x", eixo: "fantasma", rotulo: "X" }],
    } as Quiz;
    expect(eixosOrfaos(q)).toEqual(["fantasma"]);
  });

  it("quiz consistente nao tem orfao", () => {
    expect(eixosOrfaos(base())).toEqual([]);
  });
});
