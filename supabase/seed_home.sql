-- ============================================================================
-- RW TURISMO — Home cheia (viagens + seções + banner).
-- Cole este arquivo no SQL Editor do Supabase e execute. É idempotente:
--   • produtos: só inserem se o slug ainda não existir (respeita suas edições);
--   • seções/banner: refletem este layout (podem ser reeditados no admin).
-- Não depende das outras migrations (não usa a coluna origin).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Viagens (produtos) — vitrine pelo Brasil, várias com preço promocional.
-- ---------------------------------------------------------------------------
insert into public.products
  (title, slug, description, type, destination, price, promotional_price, cover_image, gallery, active)
values
  (
    'Chapada das Mesas',
    'chapada-das-mesas-carolina',
    'Cachoeiras, cânions e o Portal da Chapada em Carolina (MA). Pacote de 4 dias com hospedagem, passeios e traslado.',
    'package', 'Carolina, MA', 1490.00, 1290.00,
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e',
    '["https://images.unsplash.com/photo-1469474968028-56623f02e42e"]'::jsonb, true
  ),
  (
    'Delta do Parnaíba',
    'delta-do-parnaiba-experiencia',
    'Passeio de barco pelo único delta em mar aberto das Américas, com dunas, mangue e pôr do sol no Piauí.',
    'experience', 'Parnaíba, PI', 690.00, 590.00,
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
    '["https://images.unsplash.com/photo-1507525428034-b723cf961d3e"]'::jsonb, true
  ),
  (
    'Fernando de Noronha — 4 dias',
    'fernando-de-noronha-4-dias',
    'O paraíso brasileiro: praias premiadas, mergulho e trilhas. Pacote com aéreo, hospedagem e taxa de preservação.',
    'package', 'Fernando de Noronha, PE', 4890.00, null,
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5',
    '["https://images.unsplash.com/photo-1544551763-46a013bb70d5"]'::jsonb, true
  ),
  (
    'Gramado e Serra Gaúcha',
    'gramado-serra-gaucha',
    'Charme, gastronomia e frio da serra. Pacote de 5 dias com hospedagem, city tour e vinícolas do Vale dos Vinhedos.',
    'package', 'Gramado, RS', 2790.00, 2490.00,
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e',
    '["https://images.unsplash.com/photo-1469474968028-56623f02e42e"]'::jsonb, true
  ),
  (
    'Porto de Galinhas',
    'porto-de-galinhas',
    'Piscinas naturais, praias de águas mornas e passeio de jangada. Pacote de 5 dias com hospedagem e traslados.',
    'package', 'Ipojuca, PE', 1990.00, 1690.00,
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
    '["https://images.unsplash.com/photo-1507525428034-b723cf961d3e"]'::jsonb, true
  ),
  (
    'Chapada Diamantina',
    'chapada-diamantina',
    'Trilhas, grutas e o Poço Azul na Bahia. Pacote de 5 dias com hospedagem em Lençóis e guias credenciados.',
    'package', 'Lençóis, BA', 1890.00, null,
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828',
    '["https://images.unsplash.com/photo-1488646953014-85cb44e25828"]'::jsonb, true
  ),
  (
    'Bonito — Ecoturismo',
    'bonito-ecoturismo',
    'Flutuação em rios de água cristalina, grutas e cachoeiras no Mato Grosso do Sul. Experiência de 4 dias com passeios.',
    'experience', 'Bonito, MS', 2390.00, 1990.00,
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5',
    '["https://images.unsplash.com/photo-1544551763-46a013bb70d5"]'::jsonb, true
  )
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Datas de saída (futuras) para as viagens acima — deixa reservável e no
--    topo da vitrine. "do nothing" evita duplicar em nova execução.
-- ---------------------------------------------------------------------------
insert into public.product_dates
  (product_id, start_date, end_date, available_slots, price_override, active)
select p.id, current_date + d.ini, current_date + d.fim, d.vagas, null, true
from public.products p
join (values
  ('chapada-das-mesas-carolina', 25, 29, 20),
  ('chapada-das-mesas-carolina', 55, 59, 20),
  ('delta-do-parnaiba-experiencia', 12, 13, 16),
  ('delta-do-parnaiba-experiencia', 40, 41, 16),
  ('fernando-de-noronha-4-dias', 35, 39, 12),
  ('gramado-serra-gaucha', 30, 35, 24),
  ('porto-de-galinhas', 21, 26, 22),
  ('porto-de-galinhas', 60, 65, 22),
  ('chapada-diamantina', 45, 50, 18),
  ('bonito-ecoturismo', 28, 32, 14)
) as d(slug, ini, fim, vagas) on d.slug = p.slug
on conflict (product_id, start_date, end_date) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Banner principal (hero). Remove o placeholder do seed base e insere um
--    hero melhor apenas se não houver banner ativo (respeita um seu).
-- ---------------------------------------------------------------------------
delete from public.home_banners where image_url = '/banner1200x600.jpg';

insert into public.home_banners
  (title, subtitle, image_url, mobile_image_url, button_text, button_url, overlay_strength, active, display_order)
select
  'Sua próxima viagem começa em Teresina',
  'Pacotes e experiências pelo Brasil, com a curadoria da RW Turismo.',
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5',
  null, 'Ver pacotes', '#pacotes', 0.45, true, 0
where not exists (select 1 from public.home_banners where active);

-- ---------------------------------------------------------------------------
-- 4) Seções da home (ordem define o layout). Upsert por section_key.
-- ---------------------------------------------------------------------------
insert into public.home_sections (section_key, title, subtitle, content, active, display_order)
values
  (
    'featured_products',
    'Pacotes em destaque',
    'Escolhidos a dedo para a sua próxima viagem.',
    '{"product_ids":[],"limit":6}'::jsonb, true, 10
  ),
  (
    'product_collection__promocoes',
    'Ofertas imperdíveis',
    'Vagas limitadas com preço especial.',
    '{"mode":"promo","product_type":"package","limit":6,"cta_label":"Ver todas as promoções"}'::jsonb,
    true, 20
  ),
  (
    'destinations',
    'Destinos que amamos',
    'Inspire-se para a próxima viagem.',
    '{"items":[{"title":"Lençóis Maranhenses","subtitle":"Maranhão","image":"https://images.unsplash.com/photo-1544551763-46a013bb70d5","url":"/products/lencois-maranhenses-essencial","active":true,"order":1},{"title":"Jericoacoara","subtitle":"Ceará","image":"https://images.unsplash.com/photo-1507525428034-b723cf961d3e","url":"/products/jericoacoara-sunset-experience","active":true,"order":2},{"title":"Chapada das Mesas","subtitle":"Maranhão","image":"https://images.unsplash.com/photo-1469474968028-56623f02e42e","url":"/products/chapada-das-mesas-carolina","active":true,"order":3},{"title":"Fernando de Noronha","subtitle":"Pernambuco","image":"https://images.unsplash.com/photo-1544551763-46a013bb70d5","url":"/products/fernando-de-noronha-4-dias","active":true,"order":4},{"title":"Porto de Galinhas","subtitle":"Pernambuco","image":"https://images.unsplash.com/photo-1488646953014-85cb44e25828","url":"/products/porto-de-galinhas","active":true,"order":5},{"title":"Gramado","subtitle":"Rio Grande do Sul","image":"https://images.unsplash.com/photo-1469474968028-56623f02e42e","url":"/products/gramado-serra-gaucha","active":true,"order":6}]}'::jsonb,
    true, 30
  ),
  (
    'product_collection__experiencias',
    'Experiências',
    'Para viver o destino de perto.',
    '{"mode":"type","product_type":"experience","limit":6,"cta_label":"Ver experiências"}'::jsonb,
    true, 40
  ),
  (
    'benefits',
    'Por que viajar com a RW Turismo',
    '',
    '{"items":[{"icon":"🛡️","title":"Reserva segura","description":"Pagamento protegido e confirmação na hora.","active":true,"order":1},{"icon":"🤝","title":"Atendimento humano","description":"Você fala com gente de verdade, do orçamento ao retorno.","active":true,"order":2},{"icon":"⭐","title":"Roteiros testados","description":"Cada viagem é conferida pela nossa equipe antes de entrar no site.","active":true,"order":3}]}'::jsonb,
    true, 50
  ),
  (
    'testimonials',
    'Quem viaja com a gente recomenda',
    '',
    '{"items":[{"name":"Ana Beatriz","city":"Teresina, PI","text":"Melhor viagem que já fiz! Organização impecável nos Lençóis.","active":true,"order":1},{"name":"Marcos Vinícius","city":"Timon, MA","text":"Reservei em minutos e tive suporte no WhatsApp até o embarque.","active":true,"order":2},{"name":"Juliana Rocha","city":"Teresina, PI","text":"Equipe atenciosa e roteiro perfeito. Já quero a próxima!","active":true,"order":3}]}'::jsonb,
    true, 60
  ),
  (
    'promotional_banner',
    'Não encontrou a viagem ideal?',
    '',
    '{"text":"A gente monta um roteiro sob medida pra você: destino, datas e orçamento do seu jeito.","button_text":"Falar com um consultor","button_url":"/paginas/contato"}'::jsonb,
    true, 70
  )
on conflict (section_key) do update
set title = excluded.title,
    subtitle = excluded.subtitle,
    content = excluded.content,
    active = excluded.active,
    display_order = excluded.display_order;
