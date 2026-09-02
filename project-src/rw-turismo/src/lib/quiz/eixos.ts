import type { Quiz } from "./types";

// Renomear e remover eixo, migrando o que aponta para ele.
//
// POR QUE ISTO EXISTE: os pesos são gravados POR NOME dentro de cada opção
// (`pesos: { "relaxar": 1 }`), e o resultado guarda o nome do eixo dominante.
// Trocar o nome só na lista `eixos` deixava tudo órfão — e `responder_quiz`
// descarta peso de eixo não declarado, então a pontuação ia a zero e TODA
// pessoa caía no resultado de empate. Sem erro em lugar nenhum: o quiz parecia
// pronto e dava sempre a mesma resposta.
//
// Vive fora da tela porque é transformação de dado, não interface — e porque
// era o tipo de coisa que precisa de teste.

/** Renomeia o eixo na posição dada e leva junto pesos e resultados. */
export const renomearEixo = (
  quiz: Quiz,
  indice: number,
  novoNome: string
): Quiz => {
  const antigo = quiz.eixos[indice];
  if (antigo === undefined || antigo === novoNome) {
    return { ...quiz, eixos: quiz.eixos.map((e, i) => (i === indice ? novoNome : e)) };
  }

  return {
    ...quiz,
    eixos: quiz.eixos.map((e, i) => (i === indice ? novoNome : e)),
    perguntas: quiz.perguntas.map((pergunta) => ({
      ...pergunta,
      opcoes: pergunta.opcoes.map((opcao) => {
        if (!(antigo in (opcao.pesos ?? {}))) return opcao;

        // Reconstrói preservando a ORDEM das chaves: o editor mostra os campos
        // na ordem dos eixos, e reordenar embaralharia a tela a cada letra.
        const pesos: Record<string, number> = {};
        for (const [chave, valor] of Object.entries(opcao.pesos ?? {})) {
          pesos[chave === antigo ? novoNome : chave] = valor;
        }
        return { ...opcao, pesos };
      }),
    })),
    resultados: quiz.resultados.map((r) =>
      r.eixo === antigo ? { ...r, eixo: novoNome } : r
    ),
  };
};

/**
 * Remove o eixo e limpa o que apontava para ele. O resultado que dependia dele
 * vira o de empate — some do mapa de eixos, mas continua existindo para quem
 * já caiu nele; apagar o resultado apagaria o texto que a pessoa escreveu.
 */
export const removerEixo = (quiz: Quiz, indice: number): Quiz => {
  const alvo = quiz.eixos[indice];
  if (alvo === undefined) return quiz;

  return {
    ...quiz,
    eixos: quiz.eixos.filter((_, i) => i !== indice),
    perguntas: quiz.perguntas.map((pergunta) => ({
      ...pergunta,
      opcoes: pergunta.opcoes.map((opcao) => {
        if (!(alvo in (opcao.pesos ?? {}))) return opcao;
        const pesos = { ...opcao.pesos };
        delete pesos[alvo];
        return { ...opcao, pesos };
      }),
    })),
    resultados: quiz.resultados.map((r) =>
      r.eixo === alvo ? { ...r, eixo: null } : r
    ),
  };
};

/**
 * Pesos apontando para eixo que não existe mais. A pontuação os descarta em
 * silêncio, então o editor precisa dizer em voz alta — é o que transforma
 * "meu quiz parou de funcionar" em "falta acertar isto aqui".
 */
export const eixosOrfaos = (quiz: Quiz): string[] => {
  const declarados = new Set(quiz.eixos);
  const orfaos = new Set<string>();

  for (const pergunta of quiz.perguntas) {
    for (const opcao of pergunta.opcoes) {
      for (const chave of Object.keys(opcao.pesos ?? {})) {
        if (!declarados.has(chave)) orfaos.add(chave);
      }
    }
  }
  for (const r of quiz.resultados) {
    if (r.eixo && !declarados.has(r.eixo)) orfaos.add(r.eixo);
  }

  return Array.from(orfaos);
};
