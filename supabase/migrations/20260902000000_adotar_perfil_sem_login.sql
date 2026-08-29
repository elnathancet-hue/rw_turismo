-- Adoção de perfil sem login.
-- Rodar no SQL Editor. Idempotente.
--
-- O PROBLEMA QUE ISTO RESOLVE:
-- desde que users_profiles.user_id passou a aceitar nulo, existe uma pessoa que
-- a agência cadastrou mas que nunca fez login. Se essa pessoa depois criar
-- conta no site com o mesmo e-mail, o caminho de autenticação tenta INSERIR um
-- perfil novo — e bate no unique de e-mail. O erro chega como uma mensagem
-- genérica, e ela fica travada para fora do site PARA SEMPRE: cada tentativa
-- repete o mesmo insert e o mesmo 23505.
--
-- O que deveria acontecer é o contrário: o perfil que já existe deve ser
-- ADOTADO pela conta nova, e não duplicado.
--
-- POR QUE PRECISA SER UMA FUNÇÃO NO BANCO, E NÃO UM UPDATE DA TELA:
-- duas barreiras impedem o cliente de fazer isso sozinho, e as duas estão
-- certas onde estão.
--   1. A policy profiles_update_own_customer_fields usa
--      `using (user_id = auth.uid())`. Para um perfil órfão isso é nulo, ou
--      seja falso: ele não enxerga a própria linha para atualizar.
--   2. O trigger prevent_customer_profile_identity_changes barra troca de
--      user_id — que é exatamente o campo que precisa mudar aqui.
--
-- SEGURANÇA: a função é security definer, mas não aceita parâmetro nenhum. Ela
-- só age sobre a linha cujo e-mail é IGUAL ao e-mail do token de quem chamou, e
-- só quando aquela linha não tem dono. Não há como pedir a adoção do perfil de
-- outra pessoa: quem decide o alvo é o JWT, não o cliente.
--
-- O `role = 'customer'` no WHERE não é decoração: sem ele, um contato importado
-- com o e-mail de um funcionário permitiria que alguém assumisse um perfil de
-- equipe ao criar conta no site.

create or replace function public.adotar_perfil_sem_login()
returns public.users_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  perfil public.users_profiles;
  meu_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or meu_email = '' then
    return null;
  end if;

  update public.users_profiles
     set user_id = auth.uid()
   where email = meu_email
     and user_id is null
     and role = 'customer'
  returning * into perfil;

  return perfil;
end;
$$;

revoke all on function public.adotar_perfil_sem_login() from public;
grant execute on function public.adotar_perfil_sem_login() to authenticated;

comment on function public.adotar_perfil_sem_login() is
  'Liga a conta recem-criada ao perfil que a agencia ja tinha cadastrado com o mesmo e-mail, quando esse perfil nao tem dono. Sem isto, quem foi importado como contato e depois cria conta no site fica travado no unique de e-mail, para sempre. Nao aceita parametro: o alvo sai do e-mail do proprio token.';

-- =====================================================================
-- Reparo do que ja esta gravado
-- =====================================================================
-- Perfil orfao cujo e-mail ja tem conta: liga os dois. Sao os casos criados
-- entre a importacao de clientes e este conserto.
update public.users_profiles p
   set user_id = u.id
  from auth.users u
 where p.user_id is null
   and p.role = 'customer'
   and p.email is not null
   and lower(u.email) = p.email
   -- Nunca roubar o perfil de quem ja tem um: o unique de user_id recusaria,
   -- mas falhar a migration inteira por causa disso seria pior.
   and not exists (
     select 1 from public.users_profiles outro where outro.user_id = u.id
   );
