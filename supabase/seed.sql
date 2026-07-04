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

insert into public.home_banners (
  title, subtitle, image_url, button_text, button_url, overlay_strength, active, display_order
)
values (
  'Sua próxima viagem começa aqui',
  'Pacotes e experiências escolhidos para você.',
  '/banner1200x600.jpg',
  'Ver pacotes',
  '#pacotes',
  0.35,
  true,
  0
)
on conflict do nothing;

insert into public.home_sections (section_key, title, subtitle, content, active, display_order)
values
  ('featured_products', 'Pacotes em destaque', 'As melhores experiências da RW Turismo.', '{"limit": 6}'::jsonb, true, 10),
  ('destinations', 'Destinos mais procurados', 'Inspire-se para sua próxima viagem.', '{"items": [{"title":"Lençóis Maranhenses","subtitle":"Maranhão","image":"/get-inspired1200x600.jpg","url":"/products/lencois-maranhenses-essencial"}]}'::jsonb, true, 20),
  ('benefits', 'Viaje com tranquilidade', null, '{"items":[{"title":"Atendimento próximo","text":"Conte com nossa equipe em cada etapa."},{"title":"Experiências selecionadas","text":"Roteiros pensados para aproveitar melhor cada destino."},{"title":"Reserva segura","text":"Seus dados e pagamentos protegidos."}]}'::jsonb, true, 30),
  ('latest_blog_posts', 'Conteúdos para inspirar sua viagem', null, '{"limit": 3}'::jsonb, true, 40),
  ('newsletter', 'Receba ofertas e novidades', 'Novos destinos e oportunidades direto no seu e-mail.', '{}'::jsonb, true, 50)
on conflict (section_key) do update
set title = excluded.title,
    subtitle = excluded.subtitle,
    content = excluded.content,
    active = excluded.active,
    display_order = excluded.display_order;

insert into public.site_settings (setting_key, value)
values
  ('site_identity', '{"name":"RW Turismo","description":"Pacotes, experiências e destinos para sua próxima viagem.","logo":null,"favicon":"/favicon.ico"}'::jsonb),
  ('home_seo', '{"title":"RW Turismo","description":"Pacotes, experiências e destinos para sua próxima viagem.","og_image":"/banner1200x600.jpg"}'::jsonb),
  ('contact', '{"whatsapp":null,"email":null,"city":null,"state":null,"address":null}'::jsonb),
  ('social_links', '{}'::jsonb),
  ('footer', '{"description":"Viaje com a RW Turismo."}'::jsonb),
  ('default_seo', '{"title_suffix":" | RW Turismo","description":"Pacotes, experiências e destinos para sua próxima viagem."}'::jsonb)
on conflict (setting_key) do update set value = excluded.value;

insert into public.blog_categories (name, slug, description, active)
values ('Dicas de viagem', 'dicas-de-viagem', 'Conteúdos para planejar viagens melhores.', true)
on conflict (slug) do update
set name = excluded.name, description = excluded.description, active = excluded.active;

insert into public.blog_posts (
  title, slug, excerpt, content, category_id, status, featured, seo_title, seo_description
)
select
  'Como planejar sua próxima viagem',
  'como-planejar-sua-proxima-viagem',
  'Um guia inicial para organizar sua próxima experiência.',
  E'Escolha o destino com antecedência.\n\nDefina datas, orçamento e as experiências que deseja viver.\n\nEste conteúdo é um rascunho editorial.',
  id,
  'draft',
  false,
  'Como planejar sua próxima viagem',
  'Dicas práticas para começar a planejar sua próxima viagem.'
from public.blog_categories
where slug = 'dicas-de-viagem'
on conflict (slug) do nothing;

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
