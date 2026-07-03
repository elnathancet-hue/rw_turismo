-- Initial seed data for local/dev Supabase projects.
-- Run this file after schema.sql and rls.sql.

insert into public.categories (name, slug, active)
values
  ('Pacotes', 'pacotes', true),
  ('Hotéis', 'hoteis', true),
  ('Experiências', 'experiencias', true),
  ('Praias', 'praias', true),
  ('Ecoturismo', 'ecoturismo', true)
on conflict (slug) do update
set name = excluded.name,
    active = excluded.active;

with inserted_products as (
  insert into public.products (
    title,
    slug,
    description,
    type,
    destination,
    price,
    promotional_price,
    cover_image,
    gallery,
    active
  )
  values
    (
      'Lençóis Maranhenses Essencial',
      'lencois-maranhenses-essencial',
      'Pacote de 4 dias com hospedagem, passeio pelas lagoas e traslado compartilhado.',
      'package',
      'Barreirinhas, MA',
      1890.00,
      1690.00,
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5',
      '["https://images.unsplash.com/photo-1544551763-46a013bb70d5"]'::jsonb,
      true
    ),
    (
      'Experiência Pôr do Sol em Jericoacoara',
      'jericoacoara-sunset-experience',
      'Experiência guiada em Jericoacoara com passeio pela Pedra Furada e pôr do sol nas dunas.',
      'experience',
      'Jericoacoara, CE',
      420.00,
      null,
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
      '["https://images.unsplash.com/photo-1507525428034-b723cf961d3e"]'::jsonb,
      true
    ),
    (
      'Hotel Boutique Centro Histórico',
      'hotel-boutique-centro-historico',
      'Hospedagem em hotel boutique com café da manhã e localização central.',
      'hotel',
      'Paraty, RJ',
      780.00,
      690.00,
      'https://images.unsplash.com/photo-1566073771259-6a8506099945',
      '["https://images.unsplash.com/photo-1566073771259-6a8506099945"]'::jsonb,
      true
    )
  on conflict (slug) do update
  set title = excluded.title,
      description = excluded.description,
      type = excluded.type,
      destination = excluded.destination,
      price = excluded.price,
      promotional_price = excluded.promotional_price,
      cover_image = excluded.cover_image,
      gallery = excluded.gallery,
      active = excluded.active
  returning id, slug
)
insert into public.product_dates (
  product_id,
  start_date,
  end_date,
  available_slots,
  price_override,
  active
)
select id, current_date + 20, current_date + 24, 18, null, true
from inserted_products
where slug = 'lencois-maranhenses-essencial'
union all
select id, current_date + 45, current_date + 49, 12, 1790.00, true
from inserted_products
where slug = 'lencois-maranhenses-essencial'
union all
select id, current_date + 15, current_date + 15, 10, null, true
from inserted_products
where slug = 'jericoacoara-sunset-experience'
union all
select id, current_date + 30, current_date + 30, 10, 390.00, true
from inserted_products
where slug = 'jericoacoara-sunset-experience'
union all
select id, current_date + 10, current_date + 12, 6, null, true
from inserted_products
where slug = 'hotel-boutique-centro-historico'
on conflict (product_id, start_date, end_date) do update
set available_slots = excluded.available_slots,
    price_override = excluded.price_override,
    active = excluded.active;

insert into public.product_categories (product_id, category_id)
select products.id, categories.id
from public.products
join public.categories on categories.slug in ('pacotes', 'ecoturismo')
where products.slug = 'lencois-maranhenses-essencial'
on conflict (product_id, category_id) do nothing;

insert into public.product_categories (product_id, category_id)
select products.id, categories.id
from public.products
join public.categories on categories.slug in ('experiencias', 'praias')
where products.slug = 'jericoacoara-sunset-experience'
on conflict (product_id, category_id) do nothing;

insert into public.product_categories (product_id, category_id)
select products.id, categories.id
from public.products
join public.categories on categories.slug in ('hoteis')
where products.slug = 'hotel-boutique-centro-historico'
on conflict (product_id, category_id) do nothing;
