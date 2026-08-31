-- Achar o cliente por telefone e por CPF, para a reserva parar de duplicar ficha.
-- Rodar no SQL Editor. Idempotente. Aditiva.
--
-- O PROBLEMA:
-- a busca de cliente do /admin procura só por nome e e-mail
-- (src/lib/admin/client.ts:838). Só que o contato da base antiga entra SEM
-- e-mail — o único dado que ele informa por telefone é o telefone. Quem atende
-- digita o número, não acha nada, conclui "não está cadastrado" e preenche a
-- ficha na mão. Nasce a segunda ficha da mesma pessoa, e a antiga — com o
-- histórico e o CPF — fica órfã para sempre.
--
-- A incoerência é interna ao projeto: a IMPORTAÇÃO já trata telefone e
-- documento como identificadores (src/lib/import/clientes.ts:158-161 monta
-- `email || documentoDigitos || telefone`), e a migration 20260831 já criou
-- índice em document e em phone dizendo, no comentário, que o documento "passa
-- a ser a chave prática de quem não tem e-mail". A intenção já estava escrita.
-- Só a busca nunca foi atualizada.
--
-- POR QUE NÃO BASTA ACRESCENTAR phone E document NO ILIKE:
-- os formatos estão misturados, e isso é verificável no código.
--   - A importação grava telefone com soDigitos (clientes.ts:148) mas documento
--     CRU, com a pontuação da planilha (clientes.ts:151).
--   - O checkout não normaliza nenhum dos dois: passa o que o cliente digitou
--     (create-pending.ts:43 -> customerAccount.ts:105).
--   - A tela de reserva sugere "+55 11 90000-0000" (new.tsx:346).
-- Ou seja: "(11) 98888-7777" e "11988887777" são a mesma pessoa e um ilike
-- nunca casaria os dois. Buscar por dígito exige ter o dígito guardado.
--
-- A SOLUÇÃO: duas colunas GERADAS, que o Postgres mantém sozinho a partir de
-- phone e document. Nada no app precisa lembrar de normalizar — nem hoje, nem
-- no próximo lugar que gravar um telefone. É por isso que são geradas, e não
-- preenchidas por trigger ou pelo código.
--
-- NULLIF no fim: telefone vazio ou só com pontuação vira NULL em vez de string
-- vazia, para o índice parcial não guardar lixo e para a busca não casar todo
-- mundo quando alguém procura por "".

alter table public.users_profiles
  add column if not exists phone_digits text
    generated always as (
      nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')
    ) stored;

alter table public.users_profiles
  add column if not exists document_digits text
    generated always as (
      nullif(regexp_replace(coalesce(document, ''), '[^0-9]', '', 'g'), '')
    ) stored;

comment on column public.users_profiles.phone_digits is
  'Telefone so com digitos, mantido pelo proprio Postgres. Existe porque a base tem o mesmo numero gravado em formatos diferentes conforme a origem (planilha grava digitos, checkout grava o que a pessoa digitou), e sem isso a busca do balcao nao acha o cliente — e quem atende cadastra a pessoa de novo.';

comment on column public.users_profiles.document_digits is
  'CPF/RG so com digitos, mantido pelo proprio Postgres. Mesma razao do phone_digits: "072.074.233-14" e "07207423314" sao a mesma pessoa.';

-- Índices parciais, no mesmo estilo dos que a 20260831 criou. Não são unique de
-- propósito, pelo motivo que aquela migration já explicou: a base legada tem
-- CPF repetido por erro de digitação, e um unique recusaria a importação
-- inteira por causa de uma linha.
create index if not exists users_profiles_phone_digits_idx
  on public.users_profiles(phone_digits)
  where phone_digits is not null;

create index if not exists users_profiles_document_digits_idx
  on public.users_profiles(document_digits)
  where document_digits is not null;


-- =====================================================================
-- Diagnóstico: quem já está duplicado hoje (não altera nada)
-- =====================================================================
-- Enquanto a busca não achava por telefone/CPF, cada cliente antigo que ligou
-- ou comprou online virou uma segunda ficha. Estas consultas mostram quais.
--
-- Não existe tela de fundir cliente. O caminho é manual e deliberado: olhar
-- cada par, decidir qual ficha fica, e mover o que interessa. Por isso aqui
-- entra só o diagnóstico — fusão automática por telefone juntaria marido e
-- mulher que dividem o número.
--
--   -- Mesmo telefone, fichas diferentes:
--   select phone_digits,
--          count(*) as fichas,
--          array_agg(id order by created_at) as ids,
--          array_agg(coalesce(name, '(sem nome)') order by created_at) as nomes,
--          array_agg(coalesce(email, '(sem e-mail)') order by created_at) as emails
--     from public.users_profiles
--    where phone_digits is not null
--      and role = 'customer'
--    group by phone_digits
--   having count(*) > 1
--    order by count(*) desc;
--
--   -- Mesmo CPF, fichas diferentes (sinal mais forte que telefone):
--   select document_digits,
--          count(*) as fichas,
--          array_agg(id order by created_at) as ids,
--          array_agg(coalesce(name, '(sem nome)') order by created_at) as nomes
--     from public.users_profiles
--    where document_digits is not null
--      and role = 'customer'
--    group by document_digits
--   having count(*) > 1
--    order by count(*) desc;
--
-- Ao fundir, a ficha que FICA deve ser a que tem user_id (a que tem conta e
-- reservas). Da outra, aproveite o que estiver faltando — telefone, documento,
-- nascimento — e depois apague. Reservas ficam presas ao user_id, então mover
-- reserva entre fichas exige mexer em bookings.user_id, o que não é rotina de
-- atendimento: se aparecer esse caso, trate um a um.
