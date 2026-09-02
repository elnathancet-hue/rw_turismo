-- A moldura da tela de resultado vira dado do quiz.
-- Rodar no SQL Editor. Idempotente.
--
-- POR QUE: a tela de resultado do /quiz-feriado tem dez elementos — olho,
-- titulo com o nome, paragrafo, regua entre os dois eixos, lista com check,
-- fotos legendadas, bloco de destino, selo de confianca, botao e microcopy.
-- O quiz criado pelo painel desenhava dois: rotulo e texto. Quem montava um
-- quiz no sistema recebia "uma frase" no lugar da pagina.
--
-- Os campos que VARIAM por desfecho (regua, motivos, fotos, destino) entram em
-- resultados[], que ja e jsonb sem CHECK — nao precisam de coluna.
-- Os que sao IGUAIS para todos os desfechos ficam aqui, para quem edita nao ter
-- de repetir a mesma frase em cada resultado.

alter table public.quizzes
  add column if not exists resultado_layout jsonb not null default '{}'::jsonb;

comment on column public.quizzes.resultado_layout is
  'Rotulos fixos da tela de resultado, iguais para todos os desfechos: olho, titulo_motivos, titulo_destino, selo, assinatura. O que muda por desfecho mora em resultados[].';
