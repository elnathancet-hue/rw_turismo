import { describe, expect, it } from "vitest";
import {
  CIDADE_PADRAO,
  calcularPerfil,
  digitosDoTelefone,
  FOTOS,
  FOTOS_POR_PERFIL,
  POSICAO_NA_REGUA,
  ROTULO_DA_REGUA,
  mascararTelefone,
  montarLinkWhatsApp,
  montarMensagem,
  nomeValido,
  PERFIL_TEXTO,
  PERGUNTAS,
  telefoneValido,
  type Peso,
} from "./feriado";

describe("tabela de pesos das perguntas", () => {
  // A espec fixa quantas alternativas de cada peso cada pergunta tem. Um peso
  // trocado não quebra nada visível: só entrega o perfil errado para o lead.
  const esperado: Record<string, number>[] = [
    { R: 2, A: 2 },
    { R: 1, A: 1 },
    { R: 2, A: 2, "R+A": 1 },
    { R: 1, A: 1, "R+A": 1 },
    // Pergunta 5 nao pontua: as opcoes dizem com QUEM se viaja, e isso nao
    // torna ninguem mais "descanso" ou mais "aventura". E segmentacao de
    // venda, nao medicao de perfil.
    { neutra: 4 },
    { R: 1, "R+A": 1, A: 1 },
  ];

  it("são 6 perguntas", () => {
    expect(PERGUNTAS).toHaveLength(6);
  });

  it.each(esperado.map((e, i) => [i + 1, e] as const))(
    "pergunta %i tem a distribuição de pesos da espec",
    (numero, distribuicao) => {
      const contagem: Record<string, number> = {};
      for (const opcao of PERGUNTAS[numero - 1]!.opcoes) {
        contagem[opcao.peso] = (contagem[opcao.peso] ?? 0) + 1;
      }
      expect(contagem).toEqual(distribuicao);
    }
  );

  it("nenhuma alternativa tem texto vazio", () => {
    for (const pergunta of PERGUNTAS) {
      expect(pergunta.texto.trim().length).toBeGreaterThan(0);
      for (const opcao of pergunta.opcoes) {
        expect(opcao.texto.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("calcularPerfil", () => {
  it("só relaxar vira relaxar-dominante", () => {
    expect(calcularPerfil(["R", "R", "R", "R", "R", "R"])).toBe("relaxar-dominante");
  });

  it("só aventura vira aventura-dominante", () => {
    expect(calcularPerfil(["A", "A", "A", "A", "A", "A"])).toBe("aventura-dominante");
  });

  // Empate exato é o caso que a espec resolve explicitamente: cai em equilíbrio,
  // nunca num dos dois lados.
  it("empate exato cai em equilíbrio", () => {
    expect(calcularPerfil(["R", "R", "R", "A", "A", "A"])).toBe("equilibrio");
  });

  it("'neutra' não soma para nenhum lado", () => {
    expect(calcularPerfil(["R", "A", "neutra", "neutra", "neutra", "neutra"])).toBe(
      "equilibrio"
    );
    expect(calcularPerfil(["R", "neutra", "neutra", "neutra", "neutra", "neutra"])).toBe(
      "relaxar-dominante"
    );
  });

  it("'R+A' vale meio ponto para cada lado", () => {
    // Dois "R+A" contra um R: 1 + 1 = 2 relaxar contra 1 aventura.
    expect(calcularPerfil(["R+A", "R+A", "R"])).toBe("relaxar-dominante");
    // Um "R+A" sozinho é empate perfeito.
    expect(calcularPerfil(["R+A"])).toBe("equilibrio");
  });

  // O corte é em 0,5 ponto — abaixo disso, equilíbrio nos dois sentidos.
  it("meio ponto de diferença já define o dominante", () => {
    expect(calcularPerfil(["R", "R+A"])).toBe("relaxar-dominante");
    expect(calcularPerfil(["A", "R+A"])).toBe("aventura-dominante");
  });

  it("lista vazia é equilíbrio, sem estourar", () => {
    expect(calcularPerfil([])).toBe("equilibrio");
  });
});

describe("varredura de todas as respostas possíveis", () => {
  const todas = (): Peso[][] => {
    let combinacoes: Peso[][] = [[]];
    for (const pergunta of PERGUNTAS) {
      const proxima: Peso[][] = [];
      for (const parcial of combinacoes) {
        for (const opcao of pergunta.opcoes) proxima.push([...parcial, opcao.peso]);
      }
      combinacoes = proxima;
    }
    return combinacoes;
  };

  // 4 x 2 x 5 x 3 x 4 x 3 = 1440 caminhos. Vale rodar todos: é barato e prova
  // que nenhuma combinação cai fora dos 3 perfis nem trava.
  it("os 1440 caminhos produzem sempre um dos 3 perfis", () => {
    const combinacoes = todas();
    expect(combinacoes).toHaveLength(1440);

    const contagem: Record<string, number> = {};
    for (const respostas of combinacoes) {
      const perfil = calcularPerfil(respostas);
      expect(POSICAO_NA_REGUA[perfil]).toBeGreaterThanOrEqual(0);
      expect(POSICAO_NA_REGUA[perfil]).toBeLessThanOrEqual(100);
      expect(ROTULO_DA_REGUA[perfil]).toBeTruthy();
      contagem[perfil] = (contagem[perfil] ?? 0) + 1;
    }

    // Nenhum perfil pode ser inalcançável: uma leitura que nunca aparece é
    // trabalho de copy jogado fora e um sintoma de peso trocado.
    expect(Object.keys(contagem).sort()).toEqual([
      "aventura-dominante",
      "equilibrio",
      "relaxar-dominante",
    ]);
    for (const total of Object.values(contagem)) expect(total).toBeGreaterThan(0);
  });
});

describe("mensagem do WhatsApp", () => {
  it("bate com o exemplo preenchido da espec", () => {
    expect(montarMensagem("aventura-dominante", "Marina Costa Lima", "Teresina")).toBe(
      "Oi! Fiz o quiz do feriado de 7 de setembro e minha leitura pediu mais adrenalina. " +
        "Meu resultado foi a Serra da Ibiapaba, Sítio do Bosco, Lapa e Ubajara, saída dia 5 de setembro. " +
        "Meu nome é Marina Costa Lima e embarco em Teresina. " +
        "Me conta como garanto minha poltrona e como fica o pagamento?"
    );
  });

  it("cidade em branco vira 'a confirmar'", () => {
    expect(montarMensagem("equilibrio", "Ana Lima", "")).toContain(
      `embarco em ${CIDADE_PADRAO}.`
    );
    expect(montarMensagem("equilibrio", "Ana Lima", "   ")).toContain(
      `embarco em ${CIDADE_PADRAO}.`
    );
  });

  it("nunca sobra placeholder por preencher", () => {
    for (const perfil of ["relaxar-dominante", "aventura-dominante", "equilibrio"] as const) {
      const texto = montarMensagem(perfil, "Ana Lima", "Teresina");
      expect(texto).not.toMatch(/\{perfil\}|\{nome\}/);
      expect(texto).toContain(PERFIL_TEXTO[perfil]);
    }
  });

  // String.replace interpreta $&, $', $` e $$ na string de substituição. Com
  // três .replace() encadeados, um nome com esses caracteres duplicava trechos
  // da mensagem e vazava o placeholder seguinte para dentro do WhatsApp.
  it.each([["Ana $& Silva"], ["Ana $' Silva"], ["Ana $` Silva"], ["Ana $$ Silva"], ["Ana $1 Silva"]])(
    "nome com cifrão (%s) entra literal e não corrompe o resto",
    (nome) => {
      const texto = montarMensagem("aventura-dominante", nome, "Teresina");
      expect(texto).toContain(`Meu nome é ${nome} e embarco em Teresina.`);
      expect(texto).toMatch(/pagamento\?$/);
      expect(texto.match(/Me conta como garanto/g)).toHaveLength(1);
    }
  );

  // O outro sintoma do mesmo bug: .replace troca só a primeira ocorrência, e um
  // nome contendo "{cidade}" consumia o lugar do campo seguinte.
  it("nome contendo um placeholder não rouba o campo seguinte", () => {
    const texto = montarMensagem("equilibrio", "Ana {cidade}", "Teresina");
    expect(texto).toContain("Meu nome é Ana {cidade} e embarco em Teresina.");
  });

  it("o link sai codificado e apontando para o número certo", () => {
    const link = montarLinkWhatsApp("relaxar-dominante", "Ana Lima", "Teresina");
    expect(link.startsWith("https://wa.me/5586999207088?text=")).toBe(true);
    expect(link).not.toContain(" ");
    expect(decodeURIComponent(link.split("?text=")[1]!)).toBe(
      montarMensagem("relaxar-dominante", "Ana Lima", "Teresina")
    );
  });
});

describe("validação do formulário", () => {
  it.each([
    ["Marina Costa Lima", true],
    ["Ana Sá", true],
    ["Ana", false],
    ["", false],
    ["   ", false],
    [" Ana  Lima ", true],
  ] as const)("nomeValido(%s) = %s", (valor, esperado) => {
    expect(nomeValido(valor)).toBe(esperado);
  });

  it.each([
    ["(86) 99920-7088", true],
    ["86999207088", true],
    ["8632211234", true],
    ["+55 86 99920-7088", true],
    ["5586999207088", true],
    ["86 9992-070", false],
    ["999207088", false],
    ["86", false],
    ["", false],
    ["abc", false],
  ] as const)("telefoneValido(%s) = %s", (valor, esperado) => {
    expect(telefoneValido(valor)).toBe(esperado);
  });

  it("DDD 55 não é confundido com código do país", () => {
    expect(digitosDoTelefone("55999207088")).toBe("55999207088");
    expect(telefoneValido("(55) 99920-7088")).toBe(true);
  });

  it("a máscara monta o número digitado dígito a dígito", () => {
    let campo = "";
    for (const caractere of "86999207088") campo = mascararTelefone(campo + caractere);
    expect(campo).toBe("(86) 99920-7088");
    expect(telefoneValido(campo)).toBe(true);
  });

  it("colar com código do país não trunca o número", () => {
    expect(mascararTelefone("+55 86 99920-7088")).toBe("(86) 99920-7088");
  });

  it("fixo de 10 dígitos também é aceito", () => {
    expect(mascararTelefone("8632211234")).toBe("(86) 3221-1234");
  });
});

describe("fotos por perfil", () => {
  it("cada perfil aponta para descrições que existem", () => {
    for (const letras of Object.values(FOTOS_POR_PERFIL)) {
      expect(letras.length).toBeGreaterThan(0);
      for (const letra of letras) expect(FOTOS[letra]).toBeTruthy();
    }
  });
});
