-- Adoção de perfil órfão: parar de depender do NOME DO DONO da função.
-- Rodar no SQL Editor. Idempotente. Aditiva.
--
-- O QUE ESTA MIGRATION CONSERTA:
-- `adotar_perfil_sem_login()` faz `update users_profiles set user_id = auth.uid()`
-- — e trocar user_id é exatamente o que o trigger
-- prevent_customer_profile_identity_changes existe para barrar.
--
-- Hoje isso funciona por um acidente feliz: a função é SECURITY DEFINER, e
-- dentro dela `current_user` vira o DONO da função. Criada pelo SQL Editor, ela
-- pertence a `postgres`, que é justamente um dos nomes na lista de escape do
-- trigger. Ou seja: a adoção só passa porque o dono se chama `postgres`.
--
-- POR QUE ISSO É RUIM:
--   1. É invisível. Nada no código diz "isto depende do dono da função".
--   2. Quebra em silêncio. Recriar a função por outro caminho (CLI, migration
--      aplicada por outro papel, restore) muda o dono e a adoção passa a
--      falhar — com a mensagem "customers can update only name, phone and
--      avatar_url" aparecendo no login do cliente.
--   3. O estrago é exatamente o bug que a adoção foi escrita para consertar: a
--      pessoa importada que cria conta no site fica TRANCADA PARA FORA.
--   4. Nenhum teste pegava, porque no CI o dono é `runner` — e lá a adoção
--      falhava desde sempre, sem ninguém perceber.
--
-- A CORREÇÃO: em vez de escapar por quem executa, o trigger passa a reconhecer
-- a OPERAÇÃO legítima. Adoção é uma transição muito específica — um perfil sem
-- dono ganhando como dono o próprio usuário logado, sem mexer em mais nada.
-- Descrever isso é mais honesto do que confiar num nome de papel.
--
-- POR QUE CONTINUA SEGURO:
--   - `old.user_id is null` — só perfil SEM dono. Não há como tomar o perfil de
--     alguém que já tem conta.
--   - `new.user_id = auth.uid()` — o novo dono é quem está chamando. Não dá
--     para atribuir o perfil a um terceiro.
--   - id, role e email têm que permanecer IGUAIS. Sem isso, alguém usaria esta
--     porta para se promover a admin ou trocar o e-mail do perfil.
--   - E o caminho direto continua fechado pelo RLS: a policy
--     profiles_update_own_customer_fields usa `using (user_id = auth.uid())`,
--     que para um órfão é NULL — logo o cliente não enxerga a linha para
--     atualizar. Quem alcança a linha é só a RPC, que exige e-mail igual ao do
--     token.

create or replace function public.prevent_customer_profile_identity_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Perfil sem e-mail é o contato que a agência cadastrou e que ainda não
    -- tem endereço nenhum; quem insere com e-mail tem que ser o dono dele.
    if new.email is not null
       and new.email is distinct from lower(coalesce(auth.jwt() ->> 'email', ''))
    then
      raise exception 'profile email must match the authenticated user email';
    end if;

    return new;
  end if;

  -- ADOÇÃO DE PERFIL ÓRFÃO — a exceção que faz adotar_perfil_sem_login()
  -- funcionar sem depender de como o dono da função se chama.
  -- Um perfil SEM dono ganha como dono o PRÓPRIO usuário logado, e nada mais
  -- muda. Qualquer desvio disso cai nas regras normais abaixo.
  if old.user_id is null
     and new.user_id = auth.uid()
     and new.id = old.id
     and new.role = old.role
     and new.email is not distinct from old.email
  then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.role is distinct from old.role
    or new.email is distinct from old.email
  then
    raise exception 'customers can update only name, phone and avatar_url';
  end if;

  return new;
end;
$$;

comment on function public.prevent_customer_profile_identity_changes() is
  'Impede que cliente ou equipe troquem id, user_id, role ou email do perfil, e que alguem insira perfil com e-mail que nao e o do proprio token. Abre UMA excecao explicita: perfil orfao (user_id null) ganhando como dono o proprio usuario logado, que e a adocao feita por adotar_perfil_sem_login().';


-- =====================================================================
-- A invariante que segura a base em transicao: SEM LOGIN => SEM E-MAIL
-- =====================================================================
-- Enquanto a agencia migra a base antiga, existe perfil sem conta de login.
-- Isso e seguro HOJE por um motivo especifico: a importacao so cria orfao
-- QUANDO A LINHA NAO TEM E-MAIL (api/admin/clients/import.ts:169-182). Se a
-- planilha traz e-mail, a conta e criada junto e o perfil ja nasce com dono.
--
-- Essa invariante nunca foi escrita no banco — e apenas um habito do codigo.
-- E ela e o que impede o seguinte: um perfil ORFAO COM E-MAIL pode ser
-- reivindicado por QUALQUER PESSOA que consiga um token com aquele e-mail,
-- porque e assim que adotar_perfil_sem_login() escolhe o alvo. Quem reivindica
-- herda nome, telefone, documento e data de nascimento daquela pessoa.
--
-- Subir cliente por INSERT direto no SQL Editor e exatamente o caminho que
-- quebraria isso sem ninguem notar. A constraint abaixo transforma o habito em
-- regra: o banco passa a recusar a linha em vez de aceitar em silencio.
--
-- NOT VALID de proposito: a constraint vale para tudo que entrar de agora em
-- diante, sem travar a migration caso ja exista alguma linha antiga assim.
-- Rode a consulta do bloco seguinte para saber se existe, e depois valide.
alter table public.users_profiles
  drop constraint if exists users_profiles_orfao_sem_email_check;

alter table public.users_profiles
  add constraint users_profiles_orfao_sem_email_check
  check (user_id is not null or email is null)
  not valid;

comment on constraint users_profiles_orfao_sem_email_check on public.users_profiles is
  'Perfil sem dono nao pode ter e-mail. E-mail e a chave que adotar_perfil_sem_login() usa para escolher quem adota, entao um orfao COM e-mail e reivindicavel por quem provar aquele e-mail. A importacao ja respeita isso; a constraint impede que um INSERT manual quebre.';

-- =====================================================================
-- Existe alguma linha assim hoje? (diagnostico, nao altera nada)
-- =====================================================================
-- Se esta consulta devolver linhas, cada uma e um perfil que pode ser
-- reivindicado por quem provar o e-mail. Decida caso a caso: ou criar a conta
-- para a pessoa (o que a importacao faria), ou limpar o e-mail do perfil.
--
--   select id, name, email, phone
--     from public.users_profiles
--    where user_id is null and email is not null;
--
-- Depois de resolver, valide a constraint para ela passar a valer no passado
-- tambem:
--
--   alter table public.users_profiles
--     validate constraint users_profiles_orfao_sem_email_check;
