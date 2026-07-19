-- pgTAP — validação e aplicação de cupom dentro da RPC de reserva (Fase 5.5).
-- O desconto é sempre calculado no servidor; o client nunca informa o total.
begin;
select plan(5);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'cupom@tap.test', '', now(), now());

insert into public.products (id, title, slug, type, destination, price, active)
values
  ('ddddddd1-0000-0000-0000-000000000001', 'Produto Cupom', 'produto-cupom', 'package', 'Bonito', 1000, true),
  ('ddddddd2-0000-0000-0000-000000000002', 'Outro Produto', 'outro-produto', 'package', 'Búzios', 1000, true);

insert into public.product_dates (id, product_id, start_date, end_date, available_slots, active)
values ('eeeeeee1-0000-0000-0000-000000000001', 'ddddddd1-0000-0000-0000-000000000001',
        current_date + 30, current_date + 33, 50, true);

insert into public.coupons (code, discount_type, discount_value, product_id, max_uses, active, expires_at)
values
  ('PERC10',  'percent', 10,   null, null, true, null),
  ('FIXA100', 'fixed',   100,  null, null, true, null),
  ('VENCIDO', 'percent', 50,   null, null, true, current_date - 1),
  ('ESGOTADO','percent', 20,   null, 0,    true, null),
  ('SOOUTRO', 'percent', 30,   'ddddddd2-0000-0000-0000-000000000002', null, true, null);

-- 1) Percentual: 1000 → 900 (is() do pgTAP é tipado; casta os literais p/ numeric)
select is(
  (select total_amount from public.create_pending_booking_transaction(
     '33333333-3333-3333-3333-333333333333', 'ddddddd1-0000-0000-0000-000000000001',
     'eeeeeee1-0000-0000-0000-000000000001', 'C', 'cupom@tap.test', null, 1, 'PERC10')),
  900::numeric(12,2),
  'cupom percentual (10%) aplica 900'
);

-- 2) Fixo: 1000 → 900
select is(
  (select total_amount from public.create_pending_booking_transaction(
     '33333333-3333-3333-3333-333333333333', 'ddddddd1-0000-0000-0000-000000000001',
     'eeeeeee1-0000-0000-0000-000000000001', 'C', 'cupom@tap.test', null, 1, 'FIXA100')),
  900::numeric(12,2),
  'cupom fixo (R$100) aplica 900'
);

-- 3) Expirado → COUPON_EXPIRED
select throws_ok(
  $$ select public.create_pending_booking_transaction(
       '33333333-3333-3333-3333-333333333333', 'ddddddd1-0000-0000-0000-000000000001',
       'eeeeeee1-0000-0000-0000-000000000001', 'C', 'cupom@tap.test', null, 1, 'VENCIDO') $$,
  'P0001', 'COUPON_EXPIRED', 'cupom vencido é recusado'
);

-- 4) Esgotado (max_uses 0) → COUPON_EXHAUSTED
select throws_ok(
  $$ select public.create_pending_booking_transaction(
       '33333333-3333-3333-3333-333333333333', 'ddddddd1-0000-0000-0000-000000000001',
       'eeeeeee1-0000-0000-0000-000000000001', 'C', 'cupom@tap.test', null, 1, 'ESGOTADO') $$,
  'P0001', 'COUPON_EXHAUSTED', 'cupom esgotado é recusado'
);

-- 5) Produto errado → COUPON_WRONG_PRODUCT
select throws_ok(
  $$ select public.create_pending_booking_transaction(
       '33333333-3333-3333-3333-333333333333', 'ddddddd1-0000-0000-0000-000000000001',
       'eeeeeee1-0000-0000-0000-000000000001', 'C', 'cupom@tap.test', null, 1, 'SOOUTRO') $$,
  'P0001', 'COUPON_WRONG_PRODUCT', 'cupom de outro produto é recusado'
);

select * from finish();
rollback;
