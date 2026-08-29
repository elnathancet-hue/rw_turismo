-- Consentimento de contato e origem do cadastro.
-- Rodar no SQL Editor. Idempotente. Aditiva.
--
-- POR QUE ESTA MIGRATION EXISTE:
-- o cron diario manda mensagem de aniversario por WhatsApp e e-mail lendo
-- users_profiles inteira, filtrando so quem tem data de nascimento. Isso sempre
-- funcionou porque a tabela so tinha quem criou conta no site — ou seja, quem
-- aceitou a politica de privacidade.
--
-- A importacao de clientes quebrou essa premissa: passou a entrar gente que
-- nunca pediu nada. E filtrar por "tem login" NAO resolve, porque todo
-- importado COM e-mail ganha conta pelo mesmo caminho do checkout.
--
-- Consentimento precisa ser um dado proprio, e nao inferido de outra coisa.
-- O padrao e FALSE: quem chega por importacao nao recebe disparo nenhum ate
-- alguem marcar que pode.
alter table public.users_profiles
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists contact_origin text;

comment on column public.users_profiles.marketing_opt_in is
  'Se esta pessoa aceitou receber mensagem de marketing (aniversario, ofertas). FALSE por padrao: quem entra por importacao de planilha nunca pediu nada. Quem se cadastra no site ou compra aceita a politica de privacidade e entra como true.';
comment on column public.users_profiles.contact_origin is
  'De onde este cadastro veio: "site", "checkout", ou o texto que o operador escreveu ao importar a planilha. E o que permite responder, depois, por que aquele contato esta na base.';

-- Quem ja estava aqui antes da importacao existir chegou pelo site ou pelo
-- checkout, entao aceitou a politica. Preserva o comportamento de hoje para
-- eles e comeca do zero so para os novos.
update public.users_profiles
   set marketing_opt_in = true,
       contact_origin = coalesce(contact_origin, 'site')
 where user_id is not null
   and marketing_opt_in = false
   and contact_origin is null;

create index if not exists users_profiles_marketing_idx
  on public.users_profiles(marketing_opt_in)
  where marketing_opt_in = true;
