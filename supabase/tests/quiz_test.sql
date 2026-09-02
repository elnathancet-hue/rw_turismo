-- pgTAP — o motor de quiz no banco.
--
-- O TESTE QUE IMPORTA: o quiz que existe hoje está fixo no código
-- (src/lib/quiz/feriado.ts) e tem seus próprios testes em Vitest. Aqui os
-- MESMOS CASOS são reproduzidos contra o motor genérico do banco. Se a
-- pontuação divergir, o modelo está errado — e é melhor descobrir agora, antes
-- de existir editor e quiz publicado em cima dele.
--
-- Casos vindos de src/lib/quiz/feriado.test.ts:
--   ["R","R","R","R","R","R"] -> relaxar-dominante
--   ["A","A","A","A","A","A"] -> aventura-dominante
--   ["R","R","R","A","A","A"] -> equilibrio (empate exato)
--   "neutra" não soma para nenhum lado
--   "R+A" soma 0,5 para cada

begin;
select plan(27);

grant usage on schema public to authenticated, anon;
grant select, insert, update on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

-- ---------------------------------------------------------------------------
-- Um quiz DO TESTE, com slug proprio: o banco ja tem a semente do feriado
-- (migration 20260907), e reusar aquele slug faria este arquivo colidir com
-- ela — e quebrar por motivo nenhum a ver com o que ele quer provar.
-- Cada pergunta oferece as quatro naturezas de peso do quiz original:
--   opcao 0 = "R"      opcao 1 = "A"      opcao 2 = "R+A"      opcao 3 = neutra
-- ---------------------------------------------------------------------------
insert into public.quizzes (
  id, title, slug, status, eixos, margem_empate, perguntas, resultados
) values (
  '11110000-0000-0000-0000-000000000001',
  'Motor de teste', 'motor-de-teste', 'published',
  '["relaxar","aventura"]'::jsonb,
  0.5,
  (
    select jsonb_agg(
      jsonb_build_object(
        'texto', 'Pergunta ' || n,
        'opcoes', jsonb_build_array(
          jsonb_build_object('texto', 'R',      'pesos', '{"relaxar":1}'::jsonb),
          jsonb_build_object('texto', 'A',      'pesos', '{"aventura":1}'::jsonb),
          jsonb_build_object('texto', 'R+A',    'pesos', '{"relaxar":0.5,"aventura":0.5}'::jsonb),
          jsonb_build_object('texto', 'neutra', 'pesos', '{}'::jsonb)
        )
      )
    )
    from generate_series(1, 6) as n
  ),
  '[{"chave":"relaxar-dominante","eixo":"relaxar","rotulo":"Relaxar"},
    {"chave":"aventura-dominante","eixo":"aventura","rotulo":"Aventura"},
    {"chave":"equilibrio","eixo":null,"rotulo":"Equilibrio"}]'::jsonb
);

insert into public.quizzes (title, slug, status, eixos, perguntas, resultados)
values ('Rascunho', 'rascunho', 'draft', '["a"]'::jsonb, '[]'::jsonb,
        '[{"chave":"x","eixo":null}]'::jsonb);

-- Monta a lista de respostas escolhendo a MESMA opção em todas as 6 perguntas.
create or replace function pg_temp.responder_tudo(p_opcao int)
returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('pergunta', n - 1, 'opcao', p_opcao))
    from generate_series(1, 6) as n;
$$;

-- Metade de uma opção, metade de outra — para o empate exato.
create or replace function pg_temp.metade_metade(p_a int, p_b int)
returns jsonb language sql as $$
  select jsonb_agg(
           jsonb_build_object('pergunta', n - 1,
                              'opcao', case when n <= 3 then p_a else p_b end))
    from generate_series(1, 6) as n;
$$;

create or replace function pg_temp.resultado(p_respostas jsonb)
returns text language sql as $$
  select public.responder_quiz('motor-de-teste', p_respostas) ->> 'resultado';
$$;


-- ===========================================================================
-- Paridade com o quiz que já existe
-- ===========================================================================
select is(pg_temp.resultado(pg_temp.responder_tudo(0)), 'relaxar-dominante',
  'so relaxar vira relaxar-dominante');

select is(pg_temp.resultado(pg_temp.responder_tudo(1)), 'aventura-dominante',
  'so aventura vira aventura-dominante');

select is(pg_temp.resultado(pg_temp.metade_metade(0, 1)), 'equilibrio',
  'empate exato cai em equilibrio, nunca num dos lados');

select is(pg_temp.resultado(pg_temp.responder_tudo(3)), 'equilibrio',
  'neutra nao soma para nenhum lado');

-- R+A soma meio ponto para cada: continua empatado.
select is(pg_temp.resultado(pg_temp.responder_tudo(2)), 'equilibrio',
  'R+A soma para os dois lados e mantem o empate');

-- Uma resposta a mais de um lado já passa a margem de 0,5.
select is(
  pg_temp.resultado('[{"pergunta":0,"opcao":0},{"pergunta":1,"opcao":0},
                      {"pergunta":2,"opcao":0},{"pergunta":3,"opcao":1},
                      {"pergunta":4,"opcao":1},{"pergunta":5,"opcao":3}]'::jsonb),
  'relaxar-dominante',
  'diferenca de um ponto passa a margem e define o dominante');

select is(
  (public.responder_quiz('motor-de-teste', pg_temp.responder_tudo(0)) -> 'pontuacao')::text,
  '{"relaxar": 6, "aventura": 0}',
  'a pontuacao por eixo volta junto com o resultado');


-- ===========================================================================
-- O resultado é do banco, não do navegador
-- ===========================================================================
-- A função nem aceita "resultado" como parâmetro — não há por onde mandar.
-- Este teste prende isso: se alguém acrescentar o parâmetro, ele quebra.
select is(
  (select count(*)::int
     from information_schema.parameters
    where specific_schema = 'public'
      and specific_name like 'responder_quiz%'
      and parameter_name ilike '%resultado%'),
  0,
  'responder_quiz NAO aceita o resultado por parametro');

select is(
  (select count(*)::int from public.quiz_responses
    where resultado = 'aventura-dominante'),
  1,
  'a resposta fica gravada com o resultado calculado');


-- ===========================================================================
-- Quiz não publicado não responde
-- ===========================================================================
select throws_ok(
  $$ select public.responder_quiz('rascunho', '[]'::jsonb) $$,
  'P0001',
  'quiz nao encontrado ou nao publicado',
  'rascunho nao aceita resposta');

select throws_ok(
  $$ select public.responder_quiz('nao-existe', '[]'::jsonb) $$,
  'P0001',
  'quiz nao encontrado ou nao publicado',
  'slug inexistente nao aceita resposta');


-- ===========================================================================
-- RLS
-- ===========================================================================
set local role anon;

select is(
  (select count(*)::int from public.quizzes where slug = 'motor-de-teste'),
  1,
  'anonimo le o quiz publicado');

select is(
  (select count(*)::int from public.quizzes where slug = 'rascunho'),
  0,
  'anonimo NAO le rascunho');

-- As respostas sao o dado de quem respondeu: nao sao publicas.
select is(
  (select count(*)::int from public.quiz_responses),
  0,
  'anonimo NAO le as respostas de ninguem');

reset role;
create or replace function pg_temp.pontuacao(p jsonb)
returns text language plpgsql as $$
begin
  return (public.responder_quiz('motor-de-teste', p) -> 'pontuacao')::text;
exception when others then
  return 'ERRO: ' || sqlerrm;
end;
$$;

-- ===========================================================================
-- O QUE VEM DO NAVEGADOR NAO E CONFIAVEL (achados da revisao)
-- ===========================================================================
-- A funcao nunca aceitou o resultado por parametro — isso ja era verdade. Mas
-- ela aceitava qualquer CAMINHO ate ele, e caminho controlado e resultado
-- controlado.

-- Repetir a mesma pergunta somava de novo: mandando 6x a mesma escolha, o
-- visitante forcava o desfecho. Agora vale a primeira e o resto e ignorado.
select is(
  pg_temp.pontuacao('[{"pergunta":0,"opcao":0},{"pergunta":0,"opcao":0},
                      {"pergunta":0,"opcao":0},{"pergunta":0,"opcao":0}]'::jsonb),
  '{"relaxar": 1, "aventura": 0}',
  'pergunta repetida conta UMA vez, nao quatro');

-- O comentario da funcao sempre prometeu que indice fora da faixa e ignorado
-- "e nao derruba o resto". Com "abc" o ::int estourava antes de checar nada.
select lives_ok(
  $$ select public.responder_quiz('motor-de-teste',
       '[{"pergunta":"abc","opcao":"x"},{"pergunta":0,"opcao":0}]'::jsonb) $$,
  'indice nao numerico e ignorado em vez de derrubar a resposta');

select is(
  pg_temp.pontuacao('[{"pergunta":"abc","opcao":"x"},{"pergunta":0,"opcao":0}]'::jsonb),
  '{"relaxar": 1, "aventura": 0}',
  'a linha valida ao lado da invalida continua pontuando');

-- Em jsonb, -1 conta do FIM do array: pegava a ultima opcao.
select is(
  pg_temp.pontuacao('[{"pergunta":0,"opcao":-3}]'::jsonb),
  '{"relaxar": 0, "aventura": 0}',
  'indice negativo nao pontua (nao conta do fim do array)');

select is(
  pg_temp.pontuacao('[{"pergunta":999,"opcao":0}]'::jsonb),
  '{"relaxar": 0, "aventura": 0}',
  'pergunta alem do fim nao pontua');

-- A fronteira exata da margem: e `>=`, entao diferenca IGUAL a margem ja
-- define o dominante. Nenhum teste cobria isso, e trocar >= por > passava.
select is(
  pg_temp.resultado('[{"pergunta":0,"opcao":2},{"pergunta":1,"opcao":0}]'::jsonb),
  'relaxar-dominante',
  'diferenca IGUAL a margem (0,5) ja define o dominante');


-- ===========================================================================
-- QUIZ SEM CAPTURA NAO GUARDA CONTATO
-- ===========================================================================
-- Era trava so do React: bastava mandar nome e telefone no corpo.
reset role;
insert into public.quizzes (title, slug, status, eixos, margem_empate, captura_ativa, perguntas, resultados)
values ('Sem captura', 'sem-captura', 'published', '["a"]'::jsonb, 0.5, false,
        '[{"texto":"p","opcoes":[{"texto":"o","pesos":{"a":1}}]}]'::jsonb,
        '[{"chave":"x","eixo":"a","rotulo":"X"}]'::jsonb);

select lives_ok(
  $$ select public.responder_quiz('sem-captura','[{"pergunta":0,"opcao":0}]'::jsonb,
       'Fulano de Tal','86999998888','fulano@x.test') $$,
  'quiz sem captura aceita a resposta normalmente');

select is(
  (select coalesce(name,'-') || '|' || coalesce(phone,'-') || '|' || coalesce(email,'-')
     from public.quiz_responses r
     join public.quizzes q on q.id = r.quiz_id
    where q.slug = 'sem-captura'),
  '-|-|-',
  'mas NAO guarda nome, telefone nem e-mail');

-- E o quiz COM captura guarda, senao o teste acima passaria por nao guardar nada.
select is(
  (select public.responder_quiz('motor-de-teste','[{"pergunta":0,"opcao":0}]'::jsonb,
     'Ciclana Silva','86988887777') ->> 'capturou'),
  'false',
  'a resposta diz se o contato foi guardado');


-- ===========================================================================
-- AUTORIZACAO — o furo que a revisao encontrou
-- ===========================================================================
-- A suite passava 27/27 mesmo depois de abrir a RPC para o anon e afrouxar as
-- policies do editor. Provava a pontuacao, nao a permissao.
select is(
  (select count(*)::int from information_schema.role_routine_grants
    where routine_name = 'responder_quiz' and grantee in ('anon','authenticated','public')),
  0,
  'responder_quiz NAO e executavel por anon nem authenticated');

select is(
  (select count(*)::int from pg_policies
    where tablename = 'quizzes' and 'anon' = any(roles) and cmd <> 'SELECT'),
  0,
  'anon nao tem policy de escrita em quizzes');

select is(
  (select count(*)::int from pg_policies
    where tablename = 'quiz_responses' and 'anon' = any(roles)),
  0,
  'anon nao tem policy nenhuma em quiz_responses');

-- Quem edita quiz e conteudo/admin — os mesmos papeis que a UI mapeia.
select is(
  (select count(*)::int from pg_policies
    where tablename = 'quizzes' and policyname = 'quizzes_conteudo_all'
      and qual like '%conteudo%'),
  1,
  'a policy do editor exige o papel conteudo, e nao apenas estar logado');

select * from finish();
rollback;
