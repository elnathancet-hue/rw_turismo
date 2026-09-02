import { describe, expect, it } from "vitest";
import { proximaChave } from "../../components/admin/quiz/SecaoResultados";

// A chave do resultado e o que fica gravado em quiz_responses.resultado, e e
// por ela que o relatorio conta quantas pessoas cairam em cada desfecho.
// A formula antiga era `r${resultados.length + 1}` — e ela colide.

describe("proximaChave", () => {
  it("numera na sequencia quando nada foi removido", () => {
    expect(proximaChave([])).toBe("r1");
    expect(proximaChave([{ chave: "r1" }])).toBe("r2");
  });

  // O caso que a formula antiga errava: [r1,r2,r3] menos o do meio deixa
  // length 2, e `length+1` devolve "r3" — que ja existe. As respostas gravadas
  // no r3 antigo passariam a ser contadas junto com as do r3 novo.
  it("nao repete chave depois de remover um do meio", () => {
    const depoisDeRemover = [{ chave: "r1" }, { chave: "r3" }];
    expect(proximaChave(depoisDeRemover)).not.toBe("r3");
    expect(proximaChave(depoisDeRemover)).toBe("r4");
  });

  it("pula quantas colisoes forem precisas", () => {
    expect(
      proximaChave([{ chave: "r3" }, { chave: "r4" }, { chave: "r5" }])
    ).toBe("r6");
  });

  it("ignora chave que a pessoa escreveu a mao", () => {
    expect(proximaChave([{ chave: "aventureiro" }])).toBe("r2");
  });
});
