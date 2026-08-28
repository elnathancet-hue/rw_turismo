-- leads.position precisa caber um timestamp em milissegundos.
-- Rodar no SQL Editor. Idempotente.
--
-- POR QUE ESTA MIGRATION EXISTE, EM UMA FRASE:
-- todo caminho que cria lead grava `position: Date.now()`, e a coluna e
-- `integer` — o valor nao cabe, o Postgres recusa a linha inteira, e o lead
-- some sem deixar rastro na tela.
--
-- A CONTA:
--   Date.now()            ~ 1.787.930.007.235
--   teto de integer (int4)~     2.147.483.647
--   excede em                        ~833 vezes
-- O Postgres devolve 22003 (numeric value out of range) e DESCARTA o insert.
-- Nao e erro parcial: nenhuma linha entra.
--
-- QUEM ESTAVA QUEBRADO (os quatro caminhos que inserem lead):
--   src/lib/leads/client.ts:31   formulario publico do site — o bloco de
--                                formulario das paginas, o NewsletterSignup e
--                                agora o quiz de captacao
--   src/lib/admin/crm.ts:129     lead criado a mao no painel
--   src/lib/admin/crm.ts:267     importacao da lista de espera para o CRM
--
-- POR QUE MEXER NA COLUNA E NAO NOS CHAMADORES:
-- consertar so um dos lados criaria uma ordenacao mentirosa. `position` e o
-- que ordena o kanban; se o formulario do site passasse a gravar segundos
-- (~1,7 bilhao) e o painel continuasse gravando milissegundos (~1,7 trilhao),
-- todo lead criado no painel apareceria eternamente depois de todo lead vindo
-- do site, sem ninguem ter arrastado nada. Um milissegundo em bigint mantem os
-- quatro caminhos na mesma escala e nao pede mudanca de codigo nenhuma.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'position'
      and data_type = 'integer'
  ) then
    alter table public.leads
      alter column position type bigint;

    raise notice 'leads.position convertida de integer para bigint';
  else
    raise notice 'leads.position ja e bigint, nada a fazer';
  end if;
end
$$;

-- O default continua 0 e o not null continua valendo: a conversao de tipo nao
-- mexe em nenhum dos dois, e nao existe linha para reescrever quando a tabela
-- so tem leads criados por caminhos que ja cabiam.

comment on column public.leads.position is
  'Ordem do lead dentro da etapa do kanban. Recebe Date.now() em milissegundos, por isso bigint: em integer o valor estourava e o insert era recusado inteiro.';

-- O indice leads_stage_idx(stage_id, position) e reconstruido sozinho pelo
-- ALTER TYPE. Nao precisa recriar na mao.
