-- pgTAP — REGRESSÃO DE RLS.
--
-- Por que este arquivo existe: até a auditoria de 2026-08-30, o CI aplicava
-- rls.sql mas NENHUM teste exercitava uma policy. As duas suítes existentes
-- (booking_flow, coupons) testam RPCs, que rodam como service_role e portanto
-- passam por cima do RLS. Uma policy afrouxada não quebrava nada — e foi assim
-- que 11 achados de policy puderam existir sem alarme.
--
-- COMO ISTO TESTA RLS DE VERDADE:
-- o pg_prove conecta como `runner`, que é superusuário e DONO das tabelas — as
-- duas condições que fazem o Postgres ignorar RLS. Por isso cada bloco troca de
-- identidade com `set local role`, virando `authenticated` ou `anon`, que não
-- são donos nem superusuários. Só então a policy vale.
--
-- auth.uid() e auth.jwt() são stubs de _bootstrap.sql que leem GUCs, então a
-- sessão é simulada com set_config('request.jwt.*').
--
-- POR QUE ASSERÇÃO DE ESTADO, E NÃO throws_ok:
-- o que interessa é "o ataque não teve efeito", não "o Postgres devolveu tal
-- código". Uma mesma tentativa pode falhar por WITH CHECK (42501) ou pelo
-- trigger de coluna (P0001), e as duas são vitória. Então cada bloco TENTA a
-- operação engolindo o erro e depois AFIRMA que o estado não mudou. Isso também
-- pega o caso pior: a operação "passar" sem erro nenhum.

begin;
select plan(35);

-- ---------------------------------------------------------------------------
-- Privilégios de tabela. Num Supabase real quem concede isto é a própria
-- plataforma; no Postgres puro do CI, ninguém — sem os grants, todo teste
-- falharia por "permission denied" e não pela policy, que é o que interessa.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Seeds (como runner: superusuário, então nem RLS nem trigger atrapalham)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'c1111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'cliente@rls.test',   '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c2222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'atacante@rls.test',  '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a3333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'admin@rls.test',     '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd4444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'conteudo@rls.test',  '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e5555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'operacoes@rls.test', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f6666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated', 'novo@rls.test',      '', now(), now());

insert into public.users_profiles (user_id, name, email, role) values
  ('c1111111-1111-1111-1111-111111111111', 'Cliente RLS',   'cliente@rls.test',   'customer'),
  ('a3333333-3333-3333-3333-333333333333', 'Admin RLS',     'admin@rls.test',     'admin'),
  ('d4444444-4444-4444-4444-444444444444', 'Conteudo RLS',  'conteudo@rls.test',  'conteudo'),
  ('e5555555-5555-5555-5555-555555555555', 'Operacoes RLS', 'operacoes@rls.test', 'operacoes');
-- ATENÇÃO — o atacante (c2222222) e a conta nova (f6666666) ficam SEM perfil de
-- propósito, e isso não é detalhe: users_profiles tem unique(user_id). Se o
-- atacante já tivesse perfil, o insert do perfil plantado bateria na constraint
-- e o teste passaria pelo motivo errado — verde contra o código vulnerável.
-- É exatamente o que acontece no ataque real: quem ataca simplesmente não deixa
-- o app criar o perfil dele antes de plantar o outro.

insert into public.products (id, title, slug, type, destination, price, active)
values ('aaaaaaa2-0000-0000-0000-000000000001', 'Pacote RLS', 'pacote-rls', 'package', 'Bonito', 1000, true);

insert into public.product_dates (id, product_id, start_date, end_date, available_slots, price_override, active)
values ('bbbbbbb2-0000-0000-0000-000000000001', 'aaaaaaa2-0000-0000-0000-000000000001',
        current_date + 30, current_date + 33, 10, 900, true);

-- Reserva do CLIENTE. É a linha que o atacante não pode alcançar.
insert into public.bookings (id, user_id, product_id, product_date_id, customer_name,
                             customer_email, travelers_count, total_amount)
values ('ccccccc2-0000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111',
        'aaaaaaa2-0000-0000-0000-000000000001', 'bbbbbbb2-0000-0000-0000-000000000001',
        'Cliente RLS', 'cliente@rls.test', 2, 2000);

insert into public.passengers (booking_id, full_name, document, birth_date, type)
values ('ccccccc2-0000-0000-0000-000000000001', 'Filho do Cliente', '12345678900', current_date - 3650, 'child');

insert into public.pages (id, title, slug, status, custom_html)
values ('ddddddd2-0000-0000-0000-000000000001', 'Landing RLS', 'landing-rls', 'published', '<b>ok</b>');

insert into public.integration_secrets (key, value) values ('stripe_secret_key', 'sk_test_naovazar');
insert into public.system_logs (action, entity) values ('teste_rls', 'rls');
-- on conflict: estas chaves podem ja ter vindo de migration. O teste so
-- precisa que a linha EXISTA para checar quem enxerga o que.
insert into public.site_settings (setting_key, value) values
  ('site_identity', '{"logo":"x"}'::jsonb),
  ('crm_stages',    '{"stages":["novo"]}'::jsonb)
on conflict (setting_key) do nothing;

-- Assume a identidade de um usuário logado (os stubs de auth leem estes GUCs).
create or replace function pg_temp.entrar(p_uid uuid, p_email text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'email', p_email, 'role', 'authenticated')::text, true);
end;
$$;

-- Vira anônimo (sem sessão).
create or replace function pg_temp.sair()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

-- Executa e engole o erro: o que vai ser afirmado é o ESTADO depois.
create or replace function pg_temp.tentar(p_sql text)
returns void language plpgsql as $$
begin
  execute p_sql;
exception when others then
  null;
end;
$$;


-- ===========================================================================
-- A-01 (CRÍTICA) — perfil com o e-mail de outra pessoa
-- ===========================================================================
set local role authenticated;
do $$ begin perform pg_temp.entrar('c2222222-2222-2222-2222-222222222222', 'atacante@rls.test'); end $$;

do $$ begin perform pg_temp.tentar($q$
  insert into public.users_profiles (user_id, name, email, role)
  values ('c2222222-2222-2222-2222-222222222222', 'Plantado', 'vitima@rls.test', 'customer')
$q$); end $$;

reset role;
select is(
  (select count(*)::int from public.users_profiles where email = 'vitima@rls.test'),
  0,
  'A-01: nao existe perfil plantado com o e-mail de outra pessoa'
);

-- O caminho legítimo tem que continuar funcionando.
set local role authenticated;
do $$ begin perform pg_temp.entrar('f6666666-6666-6666-6666-666666666666', 'novo@rls.test'); end $$;

do $$ begin perform pg_temp.tentar($q$
  insert into public.users_profiles (user_id, name, email, role)
  values ('f6666666-6666-6666-6666-666666666666', 'Novo', 'novo@rls.test', 'customer')
$q$); end $$;

reset role;
select is(
  (select count(*)::int from public.users_profiles where email = 'novo@rls.test'),
  1,
  'A-01: perfil com o proprio e-mail continua sendo criado'
);

-- Porta dos fundos: criar sem e-mail e trocar depois.
set local role authenticated;
do $$ begin perform pg_temp.tentar($q$
  update public.users_profiles set email = 'vitima@rls.test'
   where user_id = 'f6666666-6666-6666-6666-666666666666'
$q$); end $$;

reset role;
select is(
  (select email from public.users_profiles where user_id = 'f6666666-6666-6666-6666-666666666666'),
  'novo@rls.test',
  'A-01: o proprio e-mail nao pode ser trocado depois'
);


-- ===========================================================================
-- Isolamento entre clientes
-- ===========================================================================
set local role authenticated;
do $$ begin perform pg_temp.entrar('c2222222-2222-2222-2222-222222222222', 'atacante@rls.test'); end $$;

select is(
  (select count(*)::int from public.bookings where id = 'ccccccc2-0000-0000-0000-000000000001'),
  0,
  'cliente nao le a reserva de outro cliente'
);

select is(
  (select count(*)::int from public.passengers
    where booking_id = 'ccccccc2-0000-0000-0000-000000000001'),
  0,
  'cliente nao le os passageiros da reserva de outro cliente'
);

do $$ begin perform pg_temp.entrar('c1111111-1111-1111-1111-111111111111', 'cliente@rls.test'); end $$;
select is(
  (select count(*)::int from public.bookings where id = 'ccccccc2-0000-0000-0000-000000000001'),
  1,
  'o dono continua lendo a propria reserva'
);

-- Controle positivo do isolamento de passageiros: sem ele, o "count = 0" acima
-- passaria igual se a policy negasse TUDO — inclusive para o dono.
select is(
  (select count(*)::int from public.passengers
    where booking_id = 'ccccccc2-0000-0000-0000-000000000001'),
  1,
  'o dono continua lendo os passageiros da propria reserva'
);


-- ===========================================================================
-- Autopromoção a admin
-- ===========================================================================
do $$ begin perform pg_temp.tentar($q$
  update public.users_profiles set role = 'admin'
   where user_id = 'c1111111-1111-1111-1111-111111111111'
$q$); end $$;

reset role;
select is(
  (select role from public.users_profiles where user_id = 'c1111111-1111-1111-1111-111111111111'),
  'customer',
  'cliente nao se promove a admin'
);


-- ===========================================================================
-- A-10 — `conteudo` não lê a base de clientes
-- ===========================================================================
set local role authenticated;
do $$ begin perform pg_temp.entrar('d4444444-4444-4444-4444-444444444444', 'conteudo@rls.test'); end $$;

select is(
  (select count(*)::int from public.users_profiles
    where user_id = 'c1111111-1111-1111-1111-111111111111'),
  0,
  'A-10: conteudo nao le o perfil de um cliente'
);

do $$ begin perform pg_temp.entrar('e5555555-5555-5555-5555-555555555555', 'operacoes@rls.test'); end $$;
select is(
  (select count(*)::int from public.users_profiles
    where user_id = 'c1111111-1111-1111-1111-111111111111'),
  1,
  'A-10: operacoes continua lendo a ficha do cliente'
);


-- ===========================================================================
-- A-11 — trilha de auditoria é admin-only
-- ===========================================================================
select is(
  (select count(*)::int from public.system_logs where action = 'teste_rls'),
  0,
  'A-11: operacoes nao le system_logs'
);

do $$ begin perform pg_temp.entrar('a3333333-3333-3333-3333-333333333333', 'admin@rls.test'); end $$;
select is(
  (select count(*)::int from public.system_logs where action = 'teste_rls'),
  1,
  'A-11: admin le system_logs'
);


-- ===========================================================================
-- A-08 — `operacoes` não confirma pagamento, mas segue trabalhando a reserva
-- ===========================================================================
-- Ancora de identidade: a sessao ja esta como `authenticated` desde o bloco
-- A-10, entao este `set local role` e redundante HOJE. Fica de proposito, para
-- o bloco continuar correto se alguem inserir um `reset role` acima.
set local role authenticated;
do $$ begin perform pg_temp.entrar('e5555555-5555-5555-5555-555555555555', 'operacoes@rls.test'); end $$;

do $$ begin perform pg_temp.tentar($q$
  update public.bookings set payment_status = 'paid'
   where id = 'ccccccc2-0000-0000-0000-000000000001'
$q$); end $$;

do $$ begin perform pg_temp.tentar($q$
  update public.bookings set customer_phone = '11999999999'
   where id = 'ccccccc2-0000-0000-0000-000000000001'
$q$); end $$;

reset role;
select is(
  (select payment_status from public.bookings where id = 'ccccccc2-0000-0000-0000-000000000001'),
  'pending',
  'A-08: operacoes nao marca reserva como paga'
);

select is(
  (select customer_phone from public.bookings where id = 'ccccccc2-0000-0000-0000-000000000001'),
  '11999999999',
  'A-08: operacoes continua editando o resto da reserva'
);

-- A porta dos fundos do A-08: a policy bookings_operacoes_all e FOR ALL, entao
-- nao adianta travar so o UPDATE — dava para CRIAR a reserva ja marcada como
-- paga. Foi encontrado sondando a propria correcao.
set local role authenticated;
do $$ begin perform pg_temp.tentar($q$
  insert into public.bookings (user_id, product_id, product_date_id, customer_name,
                               customer_email, travelers_count, total_amount,
                               payment_status, status)
  values ('c1111111-1111-1111-1111-111111111111',
          'aaaaaaa2-0000-0000-0000-000000000001', 'bbbbbbb2-0000-0000-0000-000000000001',
          'Fraude', 'fraude@rls.test', 1, 999, 'paid', 'confirmed')
$q$); end $$;

reset role;
select is(
  (select count(*)::int from public.bookings where customer_email = 'fraude@rls.test'),
  0,
  'A-08: operacoes nao CRIA reserva ja marcada como paga'
);

-- A terceira porta do A-08, e a que passou despercebida por mais tempo: travar
-- as colunas por trigger nao adianta se der para APAGAR a linha inteira. A
-- policy era `for all`, e DELETE nao passa por trigger BEFORE UPDATE. Pior:
-- payments e passengers iam junto por `on delete cascade`.
set local role authenticated;
do $$ begin perform pg_temp.tentar($q$
  delete from public.bookings where id = 'ccccccc2-0000-0000-0000-000000000001'
$q$); end $$;

reset role;
select is(
  (select count(*)::int from public.bookings
    where id = 'ccccccc2-0000-0000-0000-000000000001'),
  1,
  'A-08: operacoes nao APAGA a reserva (o pagamento iria junto por cascade)'
);


-- ===========================================================================
-- A-09 — `operacoes` não reprecifica a saída
-- ===========================================================================
set local role authenticated;
do $$ begin perform pg_temp.tentar($q$
  update public.product_dates set price_override = 1
   where id = 'bbbbbbb2-0000-0000-0000-000000000001'
$q$); end $$;

reset role;
select is(
  (select price_override::int from public.product_dates
    where id = 'bbbbbbb2-0000-0000-0000-000000000001'),
  900,
  'A-09: operacoes nao reprecifica a saida'
);


-- ===========================================================================
-- A-07 — `conteudo` não escreve HTML cru, mas edita o resto da página
-- ===========================================================================
set local role authenticated;
do $$ begin perform pg_temp.entrar('d4444444-4444-4444-4444-444444444444', 'conteudo@rls.test'); end $$;

do $$ begin perform pg_temp.tentar($q$
  update public.pages set custom_html = '<script>roubar()</script>'
   where id = 'ddddddd2-0000-0000-0000-000000000001'
$q$); end $$;

do $$ begin perform pg_temp.tentar($q$
  update public.pages set title = 'Landing renomeada'
   where id = 'ddddddd2-0000-0000-0000-000000000001'
$q$); end $$;

reset role;
select is(
  (select custom_html from public.pages where id = 'ddddddd2-0000-0000-0000-000000000001'),
  '<b>ok</b>',
  'A-07: conteudo nao publica HTML cru'
);

select is(
  (select title from public.pages where id = 'ddddddd2-0000-0000-0000-000000000001'),
  'Landing renomeada',
  'A-07: conteudo continua editando o resto da pagina'
);


-- ===========================================================================
-- A-02 — depoimento anônimo não nasce aprovado
-- ===========================================================================
set local role anon;
do $$ begin perform pg_temp.sair(); end $$;

do $$ begin perform pg_temp.tentar($q$
  insert into public.survey_responses (booking_id, rating, approved)
  values ('ccccccc2-0000-0000-0000-000000000001', 10, true)
$q$); end $$;

reset role;
select is(
  (select count(*)::int from public.survey_responses where approved = true),
  0,
  'A-02: anonimo nao publica depoimento ja aprovado'
);


-- ===========================================================================
-- Anônimo não alcança segredo de integração nem configuração interna
-- ===========================================================================
set local role anon;

select is(
  (select count(*)::int from public.integration_secrets),
  0,
  'anonimo nao le integration_secrets'
);

select is(
  (select count(*)::int from public.site_settings where setting_key = 'crm_stages'),
  0,
  'A-06: anonimo nao le crm_stages'
);

select is(
  (select count(*)::int from public.site_settings where setting_key = 'site_identity'),
  1,
  'A-06: a configuracao publica do site continua legivel'
);


-- Controle positivo do A-02: depoimento legitimo (nao aprovado) tem que entrar.
-- Sem isto, a assercao de cima passaria mesmo se a policy negasse todo insert.
do $$ begin perform pg_temp.tentar($q$
  insert into public.survey_responses (booking_id, rating, approved)
  values ('ccccccc2-0000-0000-0000-000000000001', 9, false)
$q$); end $$;

reset role;
select is(
  (select count(*)::int from public.survey_responses where approved = false),
  1,
  'A-02: depoimento legitimo (nao aprovado) continua entrando'
);


-- ===========================================================================
-- A-04 — insert publico nao grava em nome de outro usuario
-- ===========================================================================
set local role anon;
do $$ begin perform pg_temp.sair(); end $$;

do $$ begin perform pg_temp.tentar($q$
  insert into public.waitlist (product_id, user_id, name, email, status)
  values ('aaaaaaa2-0000-0000-0000-000000000001',
          'c1111111-1111-1111-1111-111111111111',
          'Falso', 'falso@rls.test', 'pending')
$q$); end $$;

reset role;
select is(
  (select count(*)::int from public.waitlist
    where user_id = 'c1111111-1111-1111-1111-111111111111'),
  0,
  'A-04: anonimo nao inscreve outra pessoa na lista de espera'
);

-- Controle positivo: a inscricao legitima (sem dono) continua funcionando.
set local role anon;
do $$ begin perform pg_temp.tentar($q$
  insert into public.waitlist (product_id, name, email, status)
  values ('aaaaaaa2-0000-0000-0000-000000000001', 'Real', 'real@rls.test', 'pending')
$q$); end $$;

reset role;
select is(
  (select count(*)::int from public.waitlist where email = 'real@rls.test'),
  1,
  'A-04: inscricao anonima legitima continua funcionando'
);


-- ===========================================================================
-- A-05 — newsletter pela RPC, sem revelar se o e-mail ja era assinante
-- ===========================================================================
set local role anon;
do $$ begin perform pg_temp.tentar($q$
  insert into public.newsletter_subscribers (email, source, active)
  values ('direto@rls.test', 'home', true)
$q$); end $$;

reset role;
select is(
  (select count(*)::int from public.newsletter_subscribers where email = 'direto@rls.test'),
  0,
  'A-05: insert direto do anonimo foi fechado'
);

set local role anon;
-- Duas chamadas seguidas com o MESMO e-mail: a segunda nao pode estourar, senao
-- o erro volta a ser o oraculo que a RPC existe para fechar.
do $$ begin perform pg_temp.tentar($q$ select public.assinar_newsletter('via-rpc@rls.test','home') $q$); end $$;
do $$ begin perform pg_temp.tentar($q$ select public.assinar_newsletter('via-rpc@rls.test','home') $q$); end $$;

reset role;
select is(
  (select count(*)::int from public.newsletter_subscribers where email = 'via-rpc@rls.test'),
  1,
  'A-05: a RPC inscreve, e repetir o mesmo e-mail nao duplica nem estoura'
);


-- ===========================================================================
-- A-16 — listar_integracoes() nao entrega o segredo
-- ===========================================================================
set local role authenticated;
do $$ begin perform pg_temp.entrar('a3333333-3333-3333-3333-333333333333', 'admin@rls.test'); end $$;
select is(
  (select ultimos4 from public.listar_integracoes() where key = 'stripe_secret_key'),
  'azar',
  'A-16: admin recebe so os 4 ultimos caracteres (sk_test_naovazar)'
);

-- E quem nao e admin nao recebe linha nenhuma, apesar de a funcao ser
-- SECURITY DEFINER (o filtro de papel esta DENTRO dela).
do $$ begin perform pg_temp.entrar('d4444444-4444-4444-4444-444444444444', 'conteudo@rls.test'); end $$;
select is(
  (select count(*)::int from public.listar_integracoes()),
  0,
  'A-16: conteudo nao recebe nada de listar_integracoes'
);


-- ===========================================================================
-- CLIENTE SEM LOGIN (base em transicao) — adocao de perfil orfao
-- ===========================================================================
-- Nada disto era testado, e era justamente onde morava a fragilidade: a adocao
-- so funcionava porque a funcao SECURITY DEFINER pertence a `postgres`, nome
-- que o trigger tinha na lista de escape. No CI o dono e `runner`, entao a
-- adocao falhava aqui desde sempre — sem ninguem ver.
reset role;
do $$ begin perform pg_temp.sair(); end $$;

-- Perfis LEGADOS: orfaos COM e-mail, como podem existir na base antes da
-- constraint (que entra NOT VALID e nao mexe no passado).
alter table public.users_profiles drop constraint if exists users_profiles_orfao_sem_email_check;
insert into public.users_profiles (user_id, name, email, phone, document, role) values
  (null, 'Ana Legada',    'ana@legada.test',    '11955554444', '99988877766', 'customer'),
  (null, 'Carlos Legado', 'carlos@legado.test', '11944443333', '11122200000', 'customer');
alter table public.users_profiles
  add constraint users_profiles_orfao_sem_email_check
  check (user_id is not null or email is null) not valid;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'aaaa1111-1111-1111-1111-111111111111',
        'authenticated', 'authenticated', 'ana@legada.test', '', now(), now());

set local role authenticated;
do $$ begin perform pg_temp.entrar('aaaa1111-1111-1111-1111-111111111111', 'ana@legada.test'); end $$;

-- A dona do e-mail assume o proprio perfil pela RPC (o caminho do app).
do $$ begin perform pg_temp.tentar($q$ select public.adotar_perfil_sem_login() $q$); end $$;

reset role;
select is(
  (select user_id::text from public.users_profiles where name = 'Ana Legada'),
  'aaaa1111-1111-1111-1111-111111111111',
  'orfao: a dona do e-mail assume o proprio perfil'
);

-- E NAO o de outra pessoa: o UPDATE direto nao alcanca a linha, porque a policy
-- de update usa `user_id = auth.uid()` — e para um orfao isso e NULL.
set local role authenticated;
do $$ begin perform pg_temp.tentar($q$
  update public.users_profiles set user_id = auth.uid() where name = 'Carlos Legado'
$q$); end $$;

reset role;
select is(
  (select user_id from public.users_profiles where name = 'Carlos Legado'),
  null::uuid,
  'orfao: ninguem toma o perfil orfao de outra pessoa'
);

-- Nem usa a adocao como carona para virar admin.
set local role authenticated;
do $$ begin perform pg_temp.tentar($q$
  update public.users_profiles set user_id = auth.uid(), role = 'admin'
   where name = 'Carlos Legado'
$q$); end $$;

reset role;
select is(
  (select role from public.users_profiles where name = 'Carlos Legado'),
  'customer',
  'orfao: a adocao nao serve de carona para virar admin'
);

-- A invariante que segura tudo: perfil sem dono nao pode ter e-mail.
do $$ begin perform pg_temp.tentar($q$
  insert into public.users_profiles (user_id, name, email, role)
  values (null, 'Manual', 'manual@vitima.test', 'customer')
$q$); end $$;

select is(
  (select count(*)::int from public.users_profiles where email = 'manual@vitima.test'),
  0,
  'orfao: a constraint recusa perfil sem dono COM e-mail (INSERT manual)'
);

-- E o orfao SEM e-mail — que e como a importacao cria — nao e reivindicavel,
-- simplesmente porque nao ha e-mail para casar.
do $$ begin perform pg_temp.tentar($q$
  insert into public.users_profiles (user_id, name, phone, role)
  values (null, 'Maria Antiga', '11988887777', 'customer')
$q$); end $$;

select is(
  (select count(*)::int from public.users_profiles
    where name = 'Maria Antiga' and user_id is null and email is null),
  1,
  'orfao: contato importado SEM e-mail entra e continua sem dono'
);

reset role;
select * from finish();
rollback;
