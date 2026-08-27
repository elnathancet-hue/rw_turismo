-- pgTAP — fluxo de reserva (Fase 5.5). Roda com `supabase test db` (aplica as
-- migrations e executa este arquivo numa transação que sofre rollback no fim).
-- Cobre: contagem de vagas, guarda de soft delete (5.4), expiração e a
-- idempotência do pagamento manual (ALREADY_PAID).
begin;
select plan(11);

-- ---------------------------------------------------------------------------
-- Seeds
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'cliente@tap.test', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'admin@tap.test',   '', now(), now());

insert into public.users_profiles (user_id, name, email, role)
values ('22222222-2222-2222-2222-222222222222', 'Admin TAP', 'admin@tap.test', 'admin');

insert into public.products (id, title, slug, type, destination, price, active)
values ('aaaaaaa1-0000-0000-0000-000000000001', 'Pacote TAP', 'pacote-tap', 'package', 'Gramado', 1000, true);

insert into public.product_dates (id, product_id, start_date, end_date, available_slots, active)
values ('bbbbbbb1-0000-0000-0000-000000000001', 'aaaaaaa1-0000-0000-0000-000000000001',
        current_date + 30, current_date + 33, 10, true);

-- ---------------------------------------------------------------------------
-- 1) Reserva pendente decrementa vagas e nasce pending/pending
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.create_pending_booking_transaction(
       '11111111-1111-1111-1111-111111111111',
       'aaaaaaa1-0000-0000-0000-000000000001',
       'bbbbbbb1-0000-0000-0000-000000000001',
       'Cliente TAP', 'cliente@tap.test', null, 2,
       null, null, '[{"full_name":"TAP 1","birth_date":"1990-01-01"},{"full_name":"TAP 2","birth_date":"1990-01-01"}]'::jsonb) $$,
  'cria reserva pendente sem erro'
);

select is(
  (select available_slots from public.product_dates where id = 'bbbbbbb1-0000-0000-0000-000000000001'),
  8,
  'vagas caíram de 10 para 8'
);

select is(
  (select count(*)::int from public.bookings
   where product_date_id = 'bbbbbbb1-0000-0000-0000-000000000001'
     and status = 'pending' and payment_status = 'pending'),
  1,
  'existe 1 reserva pending/pending'
);

-- ---------------------------------------------------------------------------
-- 2) Sem vagas suficientes → NOT_ENOUGH_SLOTS
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.create_pending_booking_transaction(
       '11111111-1111-1111-1111-111111111111',
       'aaaaaaa1-0000-0000-0000-000000000001',
       'bbbbbbb1-0000-0000-0000-000000000001',
       'Cliente TAP', 'cliente@tap.test', null, 99,
       null, null, '[{"full_name":"TAP 1","birth_date":"1990-01-01"},{"full_name":"TAP 2","birth_date":"1990-01-01"},{"full_name":"TAP 3","birth_date":"1990-01-01"},{"full_name":"TAP 4","birth_date":"1990-01-01"},{"full_name":"TAP 5","birth_date":"1990-01-01"},{"full_name":"TAP 6","birth_date":"1990-01-01"},{"full_name":"TAP 7","birth_date":"1990-01-01"},{"full_name":"TAP 8","birth_date":"1990-01-01"},{"full_name":"TAP 9","birth_date":"1990-01-01"},{"full_name":"TAP 10","birth_date":"1990-01-01"},{"full_name":"TAP 11","birth_date":"1990-01-01"},{"full_name":"TAP 12","birth_date":"1990-01-01"},{"full_name":"TAP 13","birth_date":"1990-01-01"},{"full_name":"TAP 14","birth_date":"1990-01-01"},{"full_name":"TAP 15","birth_date":"1990-01-01"},{"full_name":"TAP 16","birth_date":"1990-01-01"},{"full_name":"TAP 17","birth_date":"1990-01-01"},{"full_name":"TAP 18","birth_date":"1990-01-01"},{"full_name":"TAP 19","birth_date":"1990-01-01"},{"full_name":"TAP 20","birth_date":"1990-01-01"},{"full_name":"TAP 21","birth_date":"1990-01-01"},{"full_name":"TAP 22","birth_date":"1990-01-01"},{"full_name":"TAP 23","birth_date":"1990-01-01"},{"full_name":"TAP 24","birth_date":"1990-01-01"},{"full_name":"TAP 25","birth_date":"1990-01-01"},{"full_name":"TAP 26","birth_date":"1990-01-01"},{"full_name":"TAP 27","birth_date":"1990-01-01"},{"full_name":"TAP 28","birth_date":"1990-01-01"},{"full_name":"TAP 29","birth_date":"1990-01-01"},{"full_name":"TAP 30","birth_date":"1990-01-01"},{"full_name":"TAP 31","birth_date":"1990-01-01"},{"full_name":"TAP 32","birth_date":"1990-01-01"},{"full_name":"TAP 33","birth_date":"1990-01-01"},{"full_name":"TAP 34","birth_date":"1990-01-01"},{"full_name":"TAP 35","birth_date":"1990-01-01"},{"full_name":"TAP 36","birth_date":"1990-01-01"},{"full_name":"TAP 37","birth_date":"1990-01-01"},{"full_name":"TAP 38","birth_date":"1990-01-01"},{"full_name":"TAP 39","birth_date":"1990-01-01"},{"full_name":"TAP 40","birth_date":"1990-01-01"},{"full_name":"TAP 41","birth_date":"1990-01-01"},{"full_name":"TAP 42","birth_date":"1990-01-01"},{"full_name":"TAP 43","birth_date":"1990-01-01"},{"full_name":"TAP 44","birth_date":"1990-01-01"},{"full_name":"TAP 45","birth_date":"1990-01-01"},{"full_name":"TAP 46","birth_date":"1990-01-01"},{"full_name":"TAP 47","birth_date":"1990-01-01"},{"full_name":"TAP 48","birth_date":"1990-01-01"},{"full_name":"TAP 49","birth_date":"1990-01-01"},{"full_name":"TAP 50","birth_date":"1990-01-01"},{"full_name":"TAP 51","birth_date":"1990-01-01"},{"full_name":"TAP 52","birth_date":"1990-01-01"},{"full_name":"TAP 53","birth_date":"1990-01-01"},{"full_name":"TAP 54","birth_date":"1990-01-01"},{"full_name":"TAP 55","birth_date":"1990-01-01"},{"full_name":"TAP 56","birth_date":"1990-01-01"},{"full_name":"TAP 57","birth_date":"1990-01-01"},{"full_name":"TAP 58","birth_date":"1990-01-01"},{"full_name":"TAP 59","birth_date":"1990-01-01"},{"full_name":"TAP 60","birth_date":"1990-01-01"},{"full_name":"TAP 61","birth_date":"1990-01-01"},{"full_name":"TAP 62","birth_date":"1990-01-01"},{"full_name":"TAP 63","birth_date":"1990-01-01"},{"full_name":"TAP 64","birth_date":"1990-01-01"},{"full_name":"TAP 65","birth_date":"1990-01-01"},{"full_name":"TAP 66","birth_date":"1990-01-01"},{"full_name":"TAP 67","birth_date":"1990-01-01"},{"full_name":"TAP 68","birth_date":"1990-01-01"},{"full_name":"TAP 69","birth_date":"1990-01-01"},{"full_name":"TAP 70","birth_date":"1990-01-01"},{"full_name":"TAP 71","birth_date":"1990-01-01"},{"full_name":"TAP 72","birth_date":"1990-01-01"},{"full_name":"TAP 73","birth_date":"1990-01-01"},{"full_name":"TAP 74","birth_date":"1990-01-01"},{"full_name":"TAP 75","birth_date":"1990-01-01"},{"full_name":"TAP 76","birth_date":"1990-01-01"},{"full_name":"TAP 77","birth_date":"1990-01-01"},{"full_name":"TAP 78","birth_date":"1990-01-01"},{"full_name":"TAP 79","birth_date":"1990-01-01"},{"full_name":"TAP 80","birth_date":"1990-01-01"},{"full_name":"TAP 81","birth_date":"1990-01-01"},{"full_name":"TAP 82","birth_date":"1990-01-01"},{"full_name":"TAP 83","birth_date":"1990-01-01"},{"full_name":"TAP 84","birth_date":"1990-01-01"},{"full_name":"TAP 85","birth_date":"1990-01-01"},{"full_name":"TAP 86","birth_date":"1990-01-01"},{"full_name":"TAP 87","birth_date":"1990-01-01"},{"full_name":"TAP 88","birth_date":"1990-01-01"},{"full_name":"TAP 89","birth_date":"1990-01-01"},{"full_name":"TAP 90","birth_date":"1990-01-01"},{"full_name":"TAP 91","birth_date":"1990-01-01"},{"full_name":"TAP 92","birth_date":"1990-01-01"},{"full_name":"TAP 93","birth_date":"1990-01-01"},{"full_name":"TAP 94","birth_date":"1990-01-01"},{"full_name":"TAP 95","birth_date":"1990-01-01"},{"full_name":"TAP 96","birth_date":"1990-01-01"},{"full_name":"TAP 97","birth_date":"1990-01-01"},{"full_name":"TAP 98","birth_date":"1990-01-01"},{"full_name":"TAP 99","birth_date":"1990-01-01"}]'::jsonb) $$,
  'P0001', 'NOT_ENOUGH_SLOTS',
  'reserva além das vagas é recusada'
);

-- ---------------------------------------------------------------------------
-- 3) Guarda de soft delete (5.4): produto excluído não é vendável
-- ---------------------------------------------------------------------------
update public.products set deleted_at = now()
where id = 'aaaaaaa1-0000-0000-0000-000000000001';

select throws_ok(
  $$ select public.create_pending_booking_transaction(
       '11111111-1111-1111-1111-111111111111',
       'aaaaaaa1-0000-0000-0000-000000000001',
       'bbbbbbb1-0000-0000-0000-000000000001',
       'Cliente TAP', 'cliente@tap.test', null, 1,
       null, null, '[{"full_name":"TAP 1","birth_date":"1990-01-01"}]'::jsonb) $$,
  'P0001', 'PRODUCT_NOT_AVAILABLE',
  'produto com deleted_at não pode ser reservado'
);

update public.products set deleted_at = null
where id = 'aaaaaaa1-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- 4) Expirar a reserva pendente devolve as vagas
--    (a RPC só expira quem já passou de expires_at; forçamos o vencimento)
-- ---------------------------------------------------------------------------
update public.bookings
set expires_at = now() - interval '1 minute'
where product_date_id = 'bbbbbbb1-0000-0000-0000-000000000001'
  and status = 'pending';

select lives_ok(
  $$ select public.expire_pending_booking(
       (select id from public.bookings
        where product_date_id = 'bbbbbbb1-0000-0000-0000-000000000001'
          and status = 'pending' limit 1)) $$,
  'expira a reserva pendente sem erro'
);

select is(
  (select available_slots from public.product_dates where id = 'bbbbbbb1-0000-0000-0000-000000000001'),
  10,
  'vagas voltaram para 10 após expirar'
);

-- ---------------------------------------------------------------------------
-- 5) Pagamento manual: idempotência (segunda confirmação → ALREADY_PAID)
-- ---------------------------------------------------------------------------
insert into public.bookings (
  id, user_id, product_id, product_date_id, customer_name, customer_email,
  travelers_count, total_amount, status, payment_status, source
) values (
  'ccccccc1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
  'aaaaaaa1-0000-0000-0000-000000000001', 'bbbbbbb1-0000-0000-0000-000000000001',
  'Cliente TAP', 'cliente@tap.test', 1, 1000, 'confirmed', 'pending', 'manual'
);

select lives_ok(
  $$ select public.admin_confirm_manual_payment(
       '22222222-2222-2222-2222-222222222222',
       'ccccccc1-0000-0000-0000-000000000001', 1000, 'pix', null) $$,
  'primeira confirmação de pagamento manual funciona'
);

select throws_ok(
  $$ select public.admin_confirm_manual_payment(
       '22222222-2222-2222-2222-222222222222',
       'ccccccc1-0000-0000-0000-000000000001', 1000, 'pix', null) $$,
  'P0001', 'ALREADY_PAID',
  'segunda confirmação é bloqueada (idempotência)'
);

-- ---------------------------------------------------------------------------
-- Passageiro é obrigatório na compra online
-- ---------------------------------------------------------------------------
-- Sem esta trava, omitir o campo criava reserva com ZERO passageiros: a
-- exigência de documento não existia (não há linha para exigir) e Quartos,
-- Assentos e Check-in mostravam a saída como se ninguém fosse viajar.
update public.products set deleted_at = null
where id = 'aaaaaaa1-0000-0000-0000-000000000001';

select throws_ok(
  $$ select public.create_pending_booking_transaction(
       '11111111-1111-1111-1111-111111111111',
       'aaaaaaa1-0000-0000-0000-000000000001',
       'bbbbbbb1-0000-0000-0000-000000000001',
       'Cliente TAP', 'cliente@tap.test', null, 1) $$,
  'P0001', 'PASSENGERS_REQUIRED',
  'reserva sem lista de passageiros é recusada'
);

-- A contagem é dos nomes PREENCHIDOS: mandar nome em branco passava pela
-- checagem antiga (que só olhava o tamanho do array) e inseria zero linhas.
select throws_ok(
  $$ select public.create_pending_booking_transaction(
       '11111111-1111-1111-1111-111111111111',
       'aaaaaaa1-0000-0000-0000-000000000001',
       'bbbbbbb1-0000-0000-0000-000000000001',
       'Cliente TAP', 'cliente@tap.test', null, 1,
       null, null, '[{"full_name":"   ","birth_date":"1990-01-01"}]'::jsonb) $$,
  'P0001', 'PASSENGERS_COUNT_MISMATCH',
  'nome em branco não conta como passageiro'
);

select * from finish();
rollback;
