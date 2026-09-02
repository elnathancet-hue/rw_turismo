import { describe, expect, it } from "vitest";
import { analisarQuiz, avisos, erros } from "./validacao";
import type { Quiz } from "./types";

const base = (troca: Partial<Quiz> = {}): Quiz =>
  ({
    id: "1",
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
        texto: "P1",
        opcoes: [
          { texto: "a", pesos: { descanso: 1 } },
          { texto: "b", pesos: { aventura: 1 } },
        ],
      },
    ],
    resultados: [
      { chave: "r1", eixo: "descanso", rotulo: "Descanso" },
      { chave: "r2", eixo: "aventura", rotulo: "Aventura" },
      { chave: "r3", eixo: null, rotulo: "Empate" },
    ],
    ...troca,
  }) as Quiz;

const textos = (q: Quiz) => analisarQuiz(q).map((a) => a.texto).join(" | ");

describe("quiz saudável", () => {
  it("não gera erro nem aviso", () => {
    expect(analisarQuiz(base())).toEqual([]);
  });
});

describe("pergunta informativa", () => {
  const semPeso = {
    texto: "Quantas pessoas viajam com você?",
    opcoes: [
      { texto: "sozinho", pesos: {} },
      { texto: "com família", pesos: {} },
    ],
  };

  it("pergunta sem pontos vira AVISO, não erro — pode ser de propósito", () => {
    const q = base({ perguntas: [...base().perguntas, semPeso] });
    const a = analisarQuiz(q);
    expect(erros(a)).toEqual([]);
    expect(avisos(a).map((x) => x.texto).join()).toMatch(/não muda o resultado/);
  });

  // O ponto central: declarar a intenção tem de calar o aviso SEM inventar
  // pesos. Inventar peso mudaria o resultado de quem responde.
  it("marcada como informativa, o aviso some e os pesos continuam vazios", () => {
    const informativa = { ...semPeso, informativa: true };
    const q = base({ perguntas: [...base().perguntas, informativa] });

    expect(analisarQuiz(q)).toEqual([]);
    expect(q.perguntas[1]!.opcoes.every((o) => Object.keys(o.pesos).length === 0)).toBe(
      true
    );
  });

  it("informativa não isenta de ter enunciado e alternativas", () => {
    const q = base({
      perguntas: [{ texto: "", opcoes: [], informativa: true }],
    });
    expect(erros(q ? analisarQuiz(q) : []).length).toBe(2);
  });
});

describe("erros que bloqueiam", () => {
  it("quiz sem nome e sem link", () => {
    expect(textos(base({ title: "", slug: "" }))).toMatch(/sem nome/);
    expect(textos(base({ title: "", slug: "" }))).toMatch(/sem link/);
  });

  it("perfil sem nome", () => {
    expect(textos(base({ eixos: ["descanso", "  "] }))).toMatch(/sem nome/);
  });

  it("peso apontando para perfil que não existe mais", () => {
    const q = base({ eixos: ["aventura"] });
    expect(textos(q)).toMatch(/não existem mais/);
    expect(erros(analisarQuiz(q)).length).toBeGreaterThan(0);
  });

  it("perfil sem resultado", () => {
    const q = base({
      resultados: [{ chave: "r1", eixo: "descanso", rotulo: "D" }],
    });
    expect(textos(q)).toMatch(/Não há resultado para "aventura"/);
  });

  it("dois resultados para o mesmo perfil: o segundo nunca aparece", () => {
    const q = base({
      resultados: [
        ...base().resultados,
        { chave: "r4", eixo: "aventura", rotulo: "Outro" },
      ],
    });
    expect(textos(q)).toMatch(/nunca vai aparecer/);
  });

  it("WhatsApp ligado sem número", () => {
    expect(textos(base({ cta: { tipo: "whatsapp" } }))).toMatch(/sem número/);
  });
});

describe("avisos que não bloqueiam", () => {
  it("falta o resultado de empate", () => {
    const q = base({
      resultados: base().resultados.filter((r) => r.eixo),
    });
    const a = analisarQuiz(q);
    expect(avisos(a).map((x) => x.texto).join()).toMatch(/empate/);
    expect(erros(a)).toEqual([]);
  });

  it("resultado sem rótulo", () => {
    const q = base({
      resultados: base().resultados.map((r, i) =>
        i === 0 ? { ...r, rotulo: "" } : r
      ),
    });
    expect(avisos(analisarQuiz(q)).map((x) => x.texto).join()).toMatch(
      /sem rótulo/
    );
  });
});

describe("cada apontamento sabe para onde levar", () => {
  it("aponta a seção, e o item quando é de um item só", () => {
    const q = base({
      perguntas: [
        ...base().perguntas,
        { texto: "sem peso", opcoes: [{ texto: "a", pesos: {} }, { texto: "b", pesos: {} }] },
      ],
    });
    const aviso = analisarQuiz(q).find((a) => /não muda o resultado/.test(a.texto));
    expect(aviso?.secao).toBe("perguntas");
    expect(aviso?.item).toBe(1);
  });
});
