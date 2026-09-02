import type { Quiz } from "./types";

// O que impede o quiz de funcionar, e o que só merece um aviso.
//
// A separação importa: erro é o que quebra — publicar assim entrega ao público
// um quiz que não decide nada. Aviso é o que provavelmente não é o que a pessoa
// queria, mas pode ser de propósito. Misturar os dois faz quem edita ignorar os
// dois.
//
// Cada item aponta para a SEÇÃO e, quando dá, para o ITEM exato, para o editor
// poder levar a pessoa até lá em vez de só reclamar.

export type Secao =
  | "geral"
  | "perguntas"
  | "perfis"
  | "resultados"
  | "aparencia"
  | "contato";

export type Apontamento = {
  /** Erro bloqueia a publicação; aviso não. */
  nivel: "erro" | "aviso";
  texto: string;
  secao: Secao;
  /** Índice do item dentro da seção, quando o problema é de um item só. */
  item?: number;
};

/**
 * Pergunta que não decide nada. Ou é informativa declarada — e aí está tudo
 * certo — ou é um esquecimento, e aí o quiz ficou mais longo sem ficar mais
 * preciso.
 */
const naoPontua = (pergunta: Quiz["perguntas"][number]): boolean =>
  (pergunta.opcoes ?? []).every(
    (o) => Object.keys(o.pesos ?? {}).length === 0
  );

export const analisarQuiz = (quiz: Quiz): Apontamento[] => {
  const fora: Apontamento[] = [];
  const eixos = quiz.eixos ?? [];
  const perguntas = quiz.perguntas ?? [];
  const resultados = quiz.resultados ?? [];

  if (!quiz.title?.trim()) {
    fora.push({ nivel: "erro", texto: "O quiz está sem nome.", secao: "geral" });
  }
  if (!quiz.slug?.trim()) {
    fora.push({
      nivel: "erro",
      texto: "O quiz está sem link. Sem ele a página não existe.",
      secao: "geral",
    });
  }

  eixos.forEach((eixo, i) => {
    if (!eixo.trim()) {
      fora.push({
        nivel: "erro",
        texto: `O perfil ${i + 1} está sem nome. Perfil sem nome nunca recebe resultado.`,
        secao: "perfis",
        item: i,
      });
    }
  });

  if (perguntas.length === 0) {
    fora.push({
      nivel: "erro",
      texto: "O quiz não tem nenhuma pergunta.",
      secao: "perguntas",
    });
  }

  perguntas.forEach((pergunta, i) => {
    if (!pergunta.texto?.trim()) {
      fora.push({
        nivel: "erro",
        texto: `A pergunta ${i + 1} está sem enunciado.`,
        secao: "perguntas",
        item: i,
      });
    }
    if ((pergunta.opcoes ?? []).length < 2) {
      fora.push({
        nivel: "erro",
        texto: `A pergunta ${i + 1} tem menos de duas alternativas.`,
        secao: "perguntas",
        item: i,
      });
    }
    // Aviso, e não erro: pode ser informativa e a pessoa ainda não marcou.
    // Marcada, some — é o que permite declarar a intenção em vez de inventar
    // pesos só para calar o alerta.
    if (!pergunta.informativa && naoPontua(pergunta)) {
      fora.push({
        nivel: "aviso",
        texto: `A pergunta ${i + 1} não muda o resultado: nenhuma alternativa dela pontua. Marque como informativa se for de propósito.`,
        secao: "perguntas",
        item: i,
      });
    }
  });

  // Todo peso aponta para um perfil pelo NOME. Nome que não existe mais é
  // descartado pela pontuação em silêncio — e o quiz passa a dar quase sempre
  // o mesmo resultado.
  const declarados = new Set(eixos);
  const orfaos = new Set<string>();
  perguntas.forEach((pergunta) =>
    (pergunta.opcoes ?? []).forEach((o) =>
      Object.keys(o.pesos ?? {}).forEach((k) => {
        if (!declarados.has(k)) orfaos.add(k);
      })
    )
  );
  resultados.forEach((r) => {
    if (r.eixo && !declarados.has(r.eixo)) orfaos.add(r.eixo);
  });
  if (orfaos.size > 0) {
    fora.push({
      nivel: "erro",
      texto: `Há pontos para perfis que não existem mais (${Array.from(orfaos).join(", ")}). Eles são descartados, e o quiz tende a dar sempre a mesma resposta.`,
      secao: "perfis",
    });
  }

  eixos
    .filter((e) => e.trim() && !resultados.some((r) => r.eixo === e))
    .forEach((eixo) =>
      fora.push({
        nivel: "erro",
        texto: `Não há resultado para "${eixo}". Quem cair nele recebe o primeiro da lista.`,
        secao: "resultados",
      })
    );

  if (resultados.length > 0 && !resultados.some((r) => !r.eixo)) {
    fora.push({
      nivel: "aviso",
      texto: "Falta o resultado de empate — o que aparece quando nenhum perfil vence por margem.",
      secao: "resultados",
    });
  }

  // Dois resultados para o mesmo perfil: o segundo nunca aparece, porque a
  // pontuação pega o primeiro que casa.
  const vistos = new Set<string>();
  resultados.forEach((r, i) => {
    const chave = r.eixo ?? "(empate)";
    if (vistos.has(chave)) {
      fora.push({
        nivel: "erro",
        texto: `O resultado ${i + 1} nunca vai aparecer: já existe um para ${r.eixo ? `"${r.eixo}"` : "empate"}.`,
        secao: "resultados",
        item: i,
      });
    }
    vistos.add(chave);
    if (!r.rotulo?.trim()) {
      fora.push({
        nivel: "aviso",
        texto: `O resultado ${i + 1} está sem rótulo.`,
        secao: "resultados",
        item: i,
      });
    }
  });

  if (quiz.cta?.tipo === "whatsapp" && !quiz.cta?.numero?.trim()) {
    fora.push({
      nivel: "erro",
      texto: "O botão de WhatsApp está ligado mas sem número.",
      secao: "contato",
    });
  }

  return fora;
};

export const erros = (a: Apontamento[]) => a.filter((x) => x.nivel === "erro");
export const avisos = (a: Apontamento[]) => a.filter((x) => x.nivel === "aviso");
