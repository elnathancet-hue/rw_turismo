import { describe, expect, it } from "vitest";
import {
  cpfValido,
  mascararCpf,
  nascimentoValido,
  nomeValido,
  validarCliente,
} from "./validacaoCliente";

// O formulario aceitava tudo: nome "A", CPF "123", telefone "abc".
// Estes testes prendem cada regra, e as bordas onde validacao ingenua erra.

describe("cpfValido", () => {
  // CPFs de teste com digito verificador correto.
  it("aceita CPF com digito verificador certo", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });

  it("recusa CPF com um digito trocado", () => {
    expect(cpfValido("529.982.247-26")).toBe(false);
  });

  // O erro que so o digito verificador pega: numero plausivel, pessoa nenhuma.
  it("recusa numero de 11 digitos que nao e CPF", () => {
    expect(cpfValido("12345678901")).toBe(false);
  });

  it("recusa todos os digitos iguais — o que sai de segurar a tecla", () => {
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("00000000000")).toBe(false);
  });

  it("recusa quantidade errada de digitos", () => {
    expect(cpfValido("123")).toBe(false);
    expect(cpfValido("529982247250")).toBe(false);
  });

  it("ignora pontuacao", () => {
    expect(cpfValido("529 982 247 25")).toBe(true);
  });
});

describe("mascararCpf", () => {
  it("formata enquanto se digita", () => {
    expect(mascararCpf("529")).toBe("529");
    expect(mascararCpf("529982")).toBe("529.982");
    expect(mascararCpf("52998224725")).toBe("529.982.247-25");
  });

  it("corta no 11o digito — nao da para passar do tamanho sem perceber", () => {
    expect(mascararCpf("529982247259999")).toBe("529.982.247-25");
  });

  it("ignora letra colada por engano", () => {
    expect(mascararCpf("529a982")).toBe("529.982");
  });
});

describe("nomeValido", () => {
  it("recusa uma letra so, e recusa numero puro", () => {
    expect(nomeValido("A")).toBe(false);
    expect(nomeValido("123")).toBe(false);
    expect(nomeValido("...")).toBe(false);
    expect(nomeValido("   ")).toBe(false);
  });

  // Nao exige sobrenome: bloquear "Madonna" seria recusar cliente de verdade.
  it("aceita nome curto de verdade", () => {
    expect(nomeValido("Ana")).toBe(true);
    expect(nomeValido("Jô")).toBe(true);
  });
});

describe("nascimentoValido", () => {
  it("aceita data real no passado", () => {
    expect(nascimentoValido("1985-03-12")).toBe(true);
  });

  // `new Date("2026-02-30")` NAO estoura — rola para marco. Validacao ingenua
  // aceitaria e gravaria a data errada.
  it("recusa 30 de fevereiro", () => {
    expect(nascimentoValido("2026-02-30")).toBe(false);
  });

  it("recusa data no futuro", () => {
    expect(nascimentoValido("2999-01-01")).toBe(false);
  });

  it("recusa ano digitado errado", () => {
    expect(nascimentoValido("0019-05-02")).toBe(false);
  });

  it("recusa formato solto", () => {
    expect(nascimentoValido("12/03/1985")).toBe(false);
  });
});

describe("validarCliente", () => {
  const ok = { name: "Maria Souza" };

  it("nome sozinho ja basta — a agencia guarda o que tem", () => {
    expect(validarCliente(ok)).toEqual({});
  });

  it("campo em branco nao e erro, menos o nome", () => {
    expect(
      validarCliente({ ...ok, email: "", phone: "", document: "" })
    ).toEqual({});
    expect(validarCliente({ name: "" }).name).toBeTruthy();
  });

  it("aponta o campo errado, e so ele", () => {
    const erros = validarCliente({ ...ok, document: "123" });
    expect(erros.document).toBeTruthy();
    expect(erros.name).toBeUndefined();
    expect(erros.phone).toBeUndefined();
  });

  it("a mensagem do CPF distingue 'faltam digitos' de 'nao existe'", () => {
    expect(validarCliente({ ...ok, document: "123" }).document).toMatch(
      /11 dígitos/
    );
    expect(
      validarCliente({ ...ok, document: "12345678901" }).document
    ).toMatch(/não existe/);
  });

  it("a mensagem do telefone diz quantos digitos vieram", () => {
    expect(validarCliente({ ...ok, phone: "8699" }).phone).toMatch(/digitou 4/);
  });

  it("acusa varios campos de uma vez", () => {
    const erros = validarCliente({
      name: "A",
      email: "nao-e-email",
      phone: "abc",
      document: "1",
      birth_date: "2999-01-01",
    });
    expect(Object.keys(erros).sort()).toEqual([
      "birth_date",
      "document",
      "email",
      "name",
      "phone",
    ]);
  });

  it("telefone com +55 continua valendo", () => {
    expect(validarCliente({ ...ok, phone: "+55 (86) 99920-7088" })).toEqual({});
  });
});
