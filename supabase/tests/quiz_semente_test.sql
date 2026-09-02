-- pgTAP — a semente do quiz-feriado.
--
-- A fase 1 provou o MOTOR com um quiz montado para o teste. Este arquivo prova
-- o CONTEÚDO REAL: as 6 perguntas que a agência usa hoje, com os pesos que
-- estão em src/lib/quiz/feriado.ts, entrando no banco e pontuando igual.
--
-- Se a semente divergir do código, é aqui que aparece — e não depois, com o
-- editor pronto e alguém tendo publicado o quiz errado.

begin;
select plan(13);

grant usage on schema public to anon;
grant select on all tables in schema public to anon;

-- Conferido ANTES de publicar: a semente tem que nascer fechada. Publicar é
-- decisão de quem toca a campanha, não efeito de rodar uma migration.
select is(
  (select status from public.quizzes where slug = 'feriado'),
  'draft',
  'a semente nasce como rascunho');

-- E rascunho não responde — a mesma regra que o quiz_test já prende.
select throws_ok(
  $$ select public.responder_quiz('feriado', '[]'::jsonb) $$,
  'P0001',
  'quiz nao encontrado ou nao publicado',
  'a semente, sendo rascunho, recusa resposta');

-- Publicado aqui dentro da transação (que sofre rollback no fim) só para
-- exercitar a pontuação com o conteúdo real.
update public.quizzes set status = 'published' where slug = 'feriado';

create or replace function pg_temp.r(p jsonb)
returns text language sql as $$
  select public.responder_quiz('feriado', p) ->> 'resultado';
$$;

-- ===========================================================================
-- A semente chegou inteira
-- ===========================================================================
select is(
  (select jsonb_array_length(perguntas) from public.quizzes where slug = 'feriado'),
  6,
  'as 6 perguntas do quiz real entraram');

select is(
  (select jsonb_array_length(resultados) from public.quizzes where slug = 'feriado'),
  3,
  'os 3 resultados entraram');

select is(
  (select eixos::text from public.quizzes where slug = 'feriado'),
  '["relaxar", "aventura"]',
  'os dois eixos do quiz real');

-- Contagem de opcoes por pergunta, na ordem: 4, 2, 5, 3, 4, 3.
select is(
  (select jsonb_agg(jsonb_array_length(p -> 'opcoes'))::text
     from public.quizzes q, jsonb_array_elements(q.perguntas) p
    where q.slug = 'feriado'),
  '[4, 2, 5, 3, 4, 3]',
  'cada pergunta manteve o numero de opcoes do codigo');

select is(
  (select captura_ativa from public.quizzes where slug = 'feriado'),
  true,
  'o quiz pede contato, como a versao em codigo');

-- ===========================================================================
-- Pontuação com o conteúdo REAL
-- ===========================================================================
-- Escolhendo sempre a primeira opção: R, R, R(silencio), R, neutra, R -> 5x R.
select is(
  pg_temp.r('[{"pergunta":0,"opcao":0},{"pergunta":1,"opcao":0},
              {"pergunta":2,"opcao":0},{"pergunta":3,"opcao":0},
              {"pergunta":4,"opcao":0},{"pergunta":5,"opcao":0}]'::jsonb),
  'relaxar-dominante',
  'so as primeiras opcoes levam a relaxar-dominante');

-- Segunda opção em todas: A, A, A, A, neutra, R+A.
select is(
  pg_temp.r('[{"pergunta":0,"opcao":1},{"pergunta":1,"opcao":1},
              {"pergunta":2,"opcao":1},{"pergunta":3,"opcao":1},
              {"pergunta":4,"opcao":1},{"pergunta":5,"opcao":1}]'::jsonb),
  'aventura-dominante',
  'so as segundas opcoes levam a aventura-dominante');

-- A quinta pergunta é inteira neutra no quiz real: seja qual for a escolha, o
-- resultado não pode mudar. É a regra que o teste do codigo tambem prende.
select is(
  pg_temp.r('[{"pergunta":4,"opcao":0}]'::jsonb),
  pg_temp.r('[{"pergunta":4,"opcao":3}]'::jsonb),
  'a pergunta neutra nao muda o resultado, escolha qual escolher');

select is(
  (public.responder_quiz('feriado', '[{"pergunta":4,"opcao":2}]'::jsonb) -> 'pontuacao')::text,
  '{"relaxar": 0, "aventura": 0}',
  'a pergunta neutra nao soma para nenhum eixo');

-- Uma de cada lado: empate exato.
select is(
  pg_temp.r('[{"pergunta":0,"opcao":0},{"pergunta":1,"opcao":1}]'::jsonb),
  'equilibrio',
  'uma de cada lado cai em equilibrio');

-- "Um pouco de tudo" (pergunta 3, opcao 5) soma meio para cada.
select is(
  (public.responder_quiz('feriado', '[{"pergunta":2,"opcao":4}]'::jsonb) -> 'pontuacao')::text,
  '{"relaxar": 0.5, "aventura": 0.5}',
  '"um pouco de tudo" soma meio ponto para cada eixo');

select * from finish();
rollback;
