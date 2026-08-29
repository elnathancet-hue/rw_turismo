-- Cliente sem login.
-- Rodar no SQL Editor. Idempotente. Aditiva: nenhuma linha existente muda.
--
-- O ERRO DE MODELO QUE ISTO CORRIGE:
-- o sistema tratava "cliente" e "usuário" como a mesma coisa. users_profiles
-- exigia user_id, que aponta para uma conta de autenticação — então cadastrar
-- alguém obrigava a criar um login para essa pessoa, e login exige e-mail.
--
-- Só que a agência tem cliente antigo sem e-mail nenhum, e esse cliente não
-- precisa de login: ele precisa estar na agenda, com telefone, CPF e
-- aniversário, para ser encontrado e reconhecido. Login é o que uma PARTE dos
-- clientes usa, não o que define um cliente.
--
-- A alternativa seria inventar e-mail ("fulano@sememail.local"), o que enche a
-- base de endereço falso que um dia recebe disparo de marketing.
--
-- POR QUE É SEGURO: as policies de users_profiles comparam `user_id =
-- auth.uid()`. Com user_id nulo essa comparação é nula, ou seja, falsa — então
-- um contato sem login fica invisível para qualquer cliente do site e visível
-- só para a equipe (profiles_admin_all e profiles_staff_select), que é
-- exatamente o comportamento desejado. Nenhuma policy precisa mudar.
--
-- O unique de user_id continua valendo: no Postgres, várias linhas com NULL
-- convivem num índice único. O mesmo vale para o unique de email, que é o que
-- permite muitos contatos sem e-mail.
--
-- O QUE ISTO NÃO FAZ: contato sem login não pode ser dono de uma reserva.
-- bookings.user_id continua NOT NULL apontando para auth.users, porque todo o
-- RLS de reserva e pagamento é ancorado nele. Quando esse cliente comprar, aí
-- sim é hora de pedir um e-mail — que é o mesmo momento em que ele precisaria
-- receber o voucher.

alter table public.users_profiles
  alter column user_id drop not null;

comment on column public.users_profiles.user_id is
  'Conta de autenticação, quando existe. NULO para cliente que a agência cadastrou mas que nunca fez login — cliente antigo, venda no balcão, lista de parceiro. Sem conta, a pessoa não enxerga nada no site e não pode ser dona de uma reserva; ela existe para a equipe encontrar, reconhecer e entrar em contato.';

-- Índice para achar contato por documento, que passa a ser a chave prática de
-- quem não tem e-mail. Não é unique de propósito: a base legada tem CPF
-- repetido por erro de digitação (a lista de passageiros real tem um caso), e
-- um unique aqui recusaria a importação inteira por causa de uma linha.
create index if not exists users_profiles_document_idx
  on public.users_profiles(document)
  where document is not null;

create index if not exists users_profiles_phone_idx
  on public.users_profiles(phone)
  where phone is not null;
