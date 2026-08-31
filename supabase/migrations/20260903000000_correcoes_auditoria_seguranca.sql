-- Correções da auditoria de segurança de 2026-08-30.
-- Rodar no SQL Editor. Idempotente. Ver docs/security-audit/relatorio-auditoria-seguranca.md
--
-- Esta migration fecha 11 achados. O fio que liga quase todos é o mesmo:
-- boa parte do /admin grava DIRETO no Supabase pelo navegador
-- (src/lib/admin/*.ts, src/lib/content/client.ts). Nesse caminho não existe
-- servidor no meio — a policy de RLS É o backend. Toda vez que a tela restringe
-- mais do que o banco, a restrição da tela não vale nada.
--
-- Duas técnicas se repetem aqui:
--   1. WITH CHECK amarrando a coluna que decide identidade ou moderação.
--   2. Trigger por COLUNA, quando o RLS não basta — porque RLS no Postgres é
--      linha inteira, não sabe filtrar coluna. O projeto já usava exatamente
--      isso em passengers_protect_document_columns(); aqui o padrão só é
--      estendido para as colunas de dinheiro, preço e HTML.


-- =====================================================================
-- A-01 (CRÍTICA) — Sequestro de reserva por plantio de e-mail
-- =====================================================================
-- O perfil do cliente é criado PELO NAVEGADOR (src/lib/auth/profile.ts:93),
-- então a policy era a única barreira. Ela amarrava user_id e role, mas deixava
-- `email` livre — e o e-mail é a chave de identidade do checkout sem cadastro
-- (src/lib/auth/customerAccount.ts:132 faz `.eq("email", email)` e devolve o
-- dono da linha encontrada).
--
-- O ataque: cria-se conta com e-mail descartável, insere-se um perfil com o
-- e-mail da VÍTIMA, e quando ela compra sem cadastro a reserva nasce em nome do
-- atacante — que passa a ler reserva, pagamentos, access_token e o documento
-- dos passageiros, inclusive de menores.
--
-- A correção amarra o e-mail ao token de quem insere. `email is null` continua
-- aceito: é o contato importado pela agência, que não tem e-mail ainda.
drop policy if exists "profiles_insert_own_customer" on public.users_profiles;
create policy "profiles_insert_own_customer"
on public.users_profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'customer'
  and (email is null or email = lower(auth.jwt() ->> 'email'))
);

-- O trigger de identidade era BEFORE UPDATE — não cobria INSERT, e era
-- exatamente por essa fresta que o perfil plantado entrava. Passa a cobrir os
-- dois comandos. Em INSERT não existe OLD, então a checagem é outra: o e-mail
-- precisa ser o do próprio token.
create or replace function public.prevent_customer_profile_identity_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role. Estas travas existem para conter a EQUIPE
  -- agindo pelo navegador; listar nomes de role aqui quebrava tanto o CI (onde o
  -- dono e "runner") quanto as RPCs internas.
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

drop trigger if exists prevent_customer_profile_identity_changes on public.users_profiles;
create trigger prevent_customer_profile_identity_changes
before insert or update on public.users_profiles
for each row execute function public.prevent_customer_profile_identity_changes();


-- =====================================================================
-- A-07 (ALTA) — pages.custom_html executa JavaScript na origem do site
-- =====================================================================
-- custom_html é servido como HTML CRU na origem do site
-- (src/pages/paginas/[slug].tsx:153) e num iframe srcDoc — que sem `sandbox`
-- herda a origem do pai. Quem escreve a coluna executa script na origem, lê o
-- token de qualquer visitante no localStorage e, se esse visitante for admin,
-- exfiltra integration_secrets (Stripe, Resend, UAZAPI).
--
-- Escrever HTML cru na origem do site é poder de administrador, não de
-- redação. RLS não filtra coluna, então a trava é por trigger — e só dispara
-- quando o valor MUDA, para o papel `conteudo` continuar editando texto, SEO e
-- blocos de uma página que já tenha HTML.
create or replace function public.pages_protect_custom_html()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role. Estas travas existem para conter a EQUIPE
  -- agindo pelo navegador; listar nomes de role aqui quebrava tanto o CI (onde o
  -- dono e "runner") quanto as RPCs internas.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Recusar TODO insert com HTML quebrava a duplicacao de pagina: a tela
    -- copia custom_html da pagina original (src/pages/admin/pages/index.tsx),
    -- entao `conteudo` deixava de conseguir duplicar qualquer landing.
    --
    -- O que precisa ser barrado e HTML NOVO. HTML que ja existe em outra pagina
    -- ja passou por um admin uma vez, entao copiar nao aumenta o poder de
    -- ninguem — e o caminho legitimo volta a funcionar.
    if new.custom_html is not null and btrim(new.custom_html) <> ''
       and not exists (
         select 1 from public.pages p where p.custom_html = new.custom_html
       )
    then
      raise exception 'only admins can publish custom HTML';
    end if;
    return new;
  end if;

  if new.custom_html is distinct from old.custom_html
     or new.custom_html_chrome is distinct from old.custom_html_chrome
  then
    raise exception 'only admins can change custom HTML';
  end if;

  return new;
end;
$$;

drop trigger if exists pages_protect_custom_html on public.pages;
create trigger pages_protect_custom_html
before insert or update on public.pages
for each row execute function public.pages_protect_custom_html();

comment on function public.pages_protect_custom_html() is
  'Reserva a escrita de pages.custom_html ao admin. O HTML e servido cru na origem do site, entao quem escreve a coluna executa script na origem e alcanca a sessao de quem visitar — inclusive a de um admin. So dispara quando o valor muda, para o papel conteudo seguir editando o resto da pagina.';


-- =====================================================================
-- A-08 (ALTA) — operacoes marcava reserva como PAGA direto na tabela
-- =====================================================================
-- bookings_operacoes_all era `for all` sem restrição de coluna. As duas travas
-- que reservam a confirmação de dinheiro ao financeiro
-- (api/admin/bookings/[id]/confirm-payment.ts:23 e o guard interno de
-- admin_confirm_manual_payment) eram contornáveis com um PATCH direto na
-- PostgREST, pelo console do navegador.
--
-- A policy continua existindo — operacoes precisa mesmo trabalhar a reserva.
-- O que muda é que as colunas de dinheiro passam a ser protegidas por trigger.
create or replace function public.bookings_protect_financial_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role. Estas travas existem para conter a EQUIPE
  -- agindo pelo navegador; listar nomes de role aqui quebrava tanto o CI (onde o
  -- dono e "runner") quanto as RPCs internas.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
    or public.has_staff_role(array['financeiro'])
  then
    return new;
  end if;

  -- INSERT tambem, e nao so UPDATE. Sem este ramo, `operacoes` simplesmente
  -- CRIAVA a reserva ja com payment_status='paid' — mesma fraude do UPDATE,
  -- por outra porta. Reserva nasce pendente; confirmar e do financeiro.
  if tg_op = 'INSERT' then
    if new.payment_status is distinct from 'pending'
      or new.status is distinct from 'pending'
    then
      raise exception 'new bookings must start pending; only finance confirms payment';
    end if;

    return new;
  end if;

  if new.payment_status is distinct from old.payment_status
    or new.total_amount is distinct from old.total_amount
    or new.status is distinct from old.status
  then
    raise exception 'only finance can change payment status, booking status or amount';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_protect_financial_columns on public.bookings;
create trigger bookings_protect_financial_columns
before insert or update on public.bookings
for each row execute function public.bookings_protect_financial_columns();

comment on function public.bookings_protect_financial_columns() is
  'Reserva payment_status, status e total_amount ao financeiro/admin e ao service_role. A policy bookings_operacoes_all e FOR ALL, e sem esta trava o papel operacoes confirmava pagamento por um PATCH direto na PostgREST, contornando a rota de API e o guard da RPC.';


-- =====================================================================
-- A-09 (MÉDIA) — product_dates: operacoes reprecificava a saída
-- =====================================================================
-- O comentário da policy prometia "sem poder reprecificar", mas a policy não
-- restringia coluna nenhuma. Na UI o catálogo é de `conteudo`
-- (src/lib/auth/roles.ts:61). A promessa do comentário passa a ser verdade.
--
-- A coluna de preço da SAÍDA é price_override (schema.sql:70) — o preço-base
-- fica em products.price, e essa tabela já é conteudo-only. `operacoes` segue
-- ajustando available_slots, horários e active, que é a logística dele.
create or replace function public.product_dates_protect_price()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role. Estas travas existem para conter a EQUIPE
  -- agindo pelo navegador; listar nomes de role aqui quebrava tanto o CI (onde o
  -- dono e "runner") quanto as RPCs internas.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
    or public.has_staff_role(array['conteudo'])
  then
    return new;
  end if;

  if new.price_override is distinct from old.price_override then
    raise exception 'only content role can change departure prices';
  end if;

  return new;
end;
$$;

drop trigger if exists product_dates_protect_price on public.product_dates;
create trigger product_dates_protect_price
before update on public.product_dates
for each row execute function public.product_dates_protect_price();


-- =====================================================================
-- A-10 (MÉDIA) — conteudo lia a base inteira de clientes
-- =====================================================================
-- is_staff() é "qualquer papel de equipe". /admin/clients é de
-- ["admin","operacoes","financeiro"] (src/lib/auth/roles.ts:52) — `conteudo`
-- não tem a tela, mas tinha a leitura: nome, e-mail, telefone e nascimento de
-- toda a base.
drop policy if exists "profiles_staff_select" on public.users_profiles;
create policy "profiles_staff_select"
on public.users_profiles
for select
to authenticated
using (public.has_staff_role(array['admin', 'operacoes', 'financeiro']));


-- =====================================================================
-- A-11 (BAIXA) — trilha de auditoria era legível por toda a equipe
-- =====================================================================
-- /admin/logs é admin-only na UI (src/lib/auth/roles.ts:82), mas o banco
-- entregava a trilha completa a qualquer papel — inclusive os registros de
-- view_passenger_document, que dizem quem abriu documento de menor.
drop policy if exists "system_logs_staff_select" on public.system_logs;
create policy "system_logs_staff_select"
on public.system_logs
for select to authenticated
using (public.is_admin());


-- =====================================================================
-- A-02 (MÉDIA) — depoimento anônimo entrava já aprovado
-- =====================================================================
-- O WITH CHECK validava só a nota. `approved` ficava livre, e um depoimento com
-- approved = true ia direto para a home (src/lib/content/server.ts:29), sem
-- passar pela moderação que a coluna existe para impor.
drop policy if exists "survey_responses_public_insert" on public.survey_responses;
create policy "survey_responses_public_insert" on public.survey_responses
for insert to anon, authenticated
with check (rating >= 0 and rating <= 10 and approved = false);


-- =====================================================================
-- A-04 (BAIXA) — waitlist e leads: escrita anônima em nome de outro usuário
-- =====================================================================
-- Sem amarrar user_id, um anônimo gravava linha em nome de terceiro. Em
-- waitlist a vítima passava a ver na conta dela (waitlist_select_own_or_admin)
-- uma inscrição que nunca fez. Em leads ficavam livres também as colunas de
-- controle do funil.
drop policy if exists "waitlist_public_insert" on public.waitlist;
create policy "waitlist_public_insert" on public.waitlist
for insert to anon, authenticated
with check (
  status = 'pending'
  and (user_id is null or user_id = auth.uid())
);

-- As duas amarras que já existiam (source e stage_id) FICAM: sem elas, o
-- anônimo escolheria a etapa do funil em que o lead nasce. O que se acrescenta
-- é o vínculo de user_id e o fecho das colunas de controle que o formulário
-- público nunca preenche (src/lib/leads/client.ts:24-34).
-- `position` continua livre de propósito: o cliente envia Date.now() nele.
drop policy if exists "leads_public_insert" on public.leads;
create policy "leads_public_insert" on public.leads
for insert to anon, authenticated
with check (
  source = 'site_form'
  and stage_id = 'new'
  and (user_id is null or user_id = auth.uid())
  and deleted_at is null
  and waitlist_id is null
);


-- =====================================================================
-- A-05 (BAIXA) — newsletter virava oráculo de "este e-mail é assinante?"
-- =====================================================================
-- O insert direto é aberto e a tabela tem unique(email): o código 23505
-- distingue "já existe" de "inserido". Passa a existir uma RPC que responde
-- igual nos dois casos, e o insert direto do anônimo é removido.
create or replace function public.assinar_newsletter(p_email text, p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  email_limpo text := lower(btrim(coalesce(p_email, '')));
begin
  if email_limpo = '' or email_limpo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email';
  end if;

  if coalesce(p_source, '') not in ('home', 'blog') then
    raise exception 'invalid source';
  end if;

  insert into public.newsletter_subscribers (email, source, active)
  values (email_limpo, p_source, true)
  on conflict (email) do nothing;
  -- Sem RETURNING e sem contagem: quem chama não distingue "assinou agora" de
  -- "já era assinante". É essa indistinção que fecha o oráculo.
end;
$$;

revoke all on function public.assinar_newsletter(text, text) from public;
grant execute on function public.assinar_newsletter(text, text) to anon;
grant execute on function public.assinar_newsletter(text, text) to authenticated;

comment on function public.assinar_newsletter(text, text) is
  'Inscreve na newsletter sem revelar se o e-mail ja era assinante. Substitui o insert direto do anonimo, cujo erro 23505 do unique(email) permitia enumerar a base.';

drop policy if exists "newsletter_public_insert" on public.newsletter_subscribers;


-- =====================================================================
-- A-06 (INFORMATIVA) + A-12 (BAIXA) — site_settings
-- =====================================================================
-- A tabela é um key/value genérico lido por anon com using (true). Hoje não
-- vaza segredo, mas o formato é aberto: a primeira pessoa que gravar um token
-- aqui o publica para a internet, sem nenhum aviso. Passa a valer lista branca.
--
-- crm_stages fica DE FORA da lista — é configuração interna do funil. E, de
-- quebra, isso conserta A-12: quem abre /admin/crm é ["admin","operacoes"], mas
-- só `conteudo` tinha escrita na tabela. Sem a policy abaixo, fechar a leitura
-- pública deixaria `operacoes` sem enxergar o próprio funil.
drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read" on public.site_settings
for select to anon, authenticated
using (
  setting_key in (
    'site_identity', 'home_seo', 'contact', 'social_links',
    'footer', 'default_seo', 'menu', 'whatsapp_widget'
  )
);

drop policy if exists "site_settings_operacoes_crm" on public.site_settings;
create policy "site_settings_operacoes_crm" on public.site_settings
for all to authenticated
using (
  setting_key = 'crm_stages'
  and public.has_staff_role(array['admin', 'operacoes'])
)
with check (
  setting_key = 'crm_stages'
  and public.has_staff_role(array['admin', 'operacoes'])
);


-- =====================================================================
-- A-03 (MÉDIA, parcial) — access_token em texto puro no log
-- =====================================================================
-- notification_log.body guarda o texto integral da mensagem, e a mensagem
-- carrega o link com ?t=<access_token>. O log não expira, então o segredo
-- entra em qualquer dump ou backup. Mascarar o que já está gravado e o que vier
-- a ser gravado é barato; tirar a coluna access_token de bookings (o resto
-- deste achado) é refatoração maior e ficou no backlog.
update public.notification_log
   set body = regexp_replace(body, '(\?|&)t=[A-Za-z0-9_-]+', '\1t=REDACTED', 'g')
 where body like '%t=%';


-- =====================================================================
-- A-16 (BAIXA) — chave de integração em claro no navegador do admin
-- =====================================================================
-- A policy integration_secrets_admin_all está CERTA (só is_admin()). O problema
-- é de superfície: /admin/integracoes fazia select("key, value, updated_at")
-- pelo navegador, então stripe_secret_key, resend_api_key e uazapi_token
-- trafegavam inteiros e ficavam no estado do React — visíveis na aba de rede,
-- para qualquer extensão instalada, e para qualquer script rodando na origem.
--
-- E a tela nem precisava do valor: o único uso era mostrar os 4 últimos
-- caracteres. Esta RPC devolve exatamente isso e nada mais.
create or replace function public.listar_integracoes()
returns table (key text, updated_at timestamptz, ultimos4 text)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.key,
    s.updated_at,
    right(s.value, 4) as ultimos4
  from public.integration_secrets s
  -- O security definer passa por cima do RLS, entao o filtro de papel precisa
  -- estar AQUI dentro. Sem esta linha a funcao entregaria os segredos a
  -- qualquer authenticated.
  where public.is_admin();
$$;

revoke all on function public.listar_integracoes() from public;
grant execute on function public.listar_integracoes() to authenticated;

comment on function public.listar_integracoes() is
  'Lista as integracoes configuradas SEM devolver o segredo: so a chave, a data e os 4 ultimos caracteres. Existe para a tela /admin/integracoes parar de trazer stripe_secret_key e afins inteiros para o navegador.';


-- =====================================================================
-- A-08 (parte 2) — `operacoes` apagava a reserva paga, e o pagamento ia junto
-- =====================================================================
-- Encontrado sondando a PROPRIA correcao acima. Travar payment_status por
-- trigger nao bastava: bookings_operacoes_all era `for all`, e `for all` inclui
-- DELETE — que nao passa por trigger BEFORE UPDATE nenhum. Apagar a reserva
-- levava junto `payments` e `passengers` por `on delete cascade`
-- (schema.sql:113 e :133), sem deixar registro em lugar nenhum.
--
-- Apagar reserva ja era para ser poder de admin: `bookings_admin_delete` existe
-- desde sempre, e /admin/trash e admin-only na UI (src/lib/auth/roles.ts:83).
-- Nenhum codigo da aplicacao apaga booking pelo navegador, entao isto nao tira
-- funcao de ninguem — so fecha uma porta que nunca deveria ter ficado aberta.
drop policy if exists "bookings_operacoes_all" on public.bookings;

drop policy if exists "bookings_operacoes_select" on public.bookings;
create policy "bookings_operacoes_select"
on public.bookings
for select to authenticated
using (public.has_staff_role(array['operacoes']));

drop policy if exists "bookings_operacoes_insert" on public.bookings;
create policy "bookings_operacoes_insert"
on public.bookings
for insert to authenticated
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "bookings_operacoes_update" on public.bookings;
create policy "bookings_operacoes_update"
on public.bookings
for update to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));


-- =====================================================================
-- A-11 (ajuste) — fechei mais do que a UI precisava
-- =====================================================================
-- Trocar is_staff() por is_admin() em system_logs deixou o painel "Historico"
-- das telas de reserva e de pagamento VAZIO para operacoes e financeiro — sem
-- erro, sem aviso: a consulta simplesmente volta sem linhas.
--
-- O que a auditoria queria proteger era a trilha COMPLETA (/admin/logs,
-- admin-only), e em especial os registros de view_passenger_document. Nao era
-- esconder o historico da propria reserva de quem trabalha nela.
--
-- Entao: a policy admin-only continua, e esta aqui devolve a fatia por entidade.
drop policy if exists "system_logs_staff_entity_select" on public.system_logs;
create policy "system_logs_staff_entity_select"
on public.system_logs
for select to authenticated
using (
  public.has_staff_role(array['operacoes', 'financeiro'])
  -- Sao os valores que o app grava de fato (src/lib/admin/client.ts e as RPCs):
  -- 'booking' e 'payment'. `passengers` fica DE FORA de proposito: e ali que
  -- mora o registro de view_passenger_document, que diz quem abriu documento de
  -- menor — exatamente o que o A-11 queria manter admin-only.
  and entity in ('booking', 'payment')
);
