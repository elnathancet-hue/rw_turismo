-- pgTAP — fluxo de reserva (Fase 5.5). Roda com `supabase test db` (aplica as
-- migrations e executa este arquivo numa transação que sofre rollback no fim).
-- Cobre: contagem de vagas, guarda de soft delete (5.4), expiração e a
-- idempotência do pagamento manual (ALREADY_PAID).
begin;
select plan(9);

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
       'Cliente TAP', 'cliente@tap.test', null, 2) $$,
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
       'Cliente TAP', 'cliente@tap.test', null, 99) $$,
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
       'Cliente TAP', 'cliente@tap.test', null, 1) $$,
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

select * from finish();
rollback;
