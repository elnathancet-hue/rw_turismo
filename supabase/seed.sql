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
  ('footer', '{"columns":[{"title":"RW Turismo","links":[{"label":"Como funciona","url":"/paginas/como-funciona"},{"label":"Quem somos","url":"/paginas/quem-somos"}]},{"title":"Sua viagem","links":[{"label":"Ver pacotes","url":"/search"},{"label":"Dicas para viajantes","url":"/blog"},{"label":"Minhas reservas","url":"/account/bookings"}]},{"title":"Suporte","links":[{"label":"Contato e atendimento","url":"/paginas/contato"},{"label":"Termos e condições","url":"/paginas/termos"},{"label":"Política de privacidade","url":"/paginas/privacidade"}]}],"copyright":"© RW Turismo. Todos os direitos reservados."}'::jsonb),
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

-- ---------------------------------------------------------------------------
-- Institutional CMS pages (match the footer links). "do nothing" on conflict:
-- re-seeding never overwrites pages edited in the admin page builder.
-- ---------------------------------------------------------------------------

insert into public.pages (title, slug, content, status, seo_title, seo_description, blocks)
values
  (
    'Como funciona',
    'como-funciona',
    '',
    'published',
    'Como funciona a RW Turismo',
    'Da escolha do destino ao embarque: veja como reservar sua viagem com a RW Turismo em 4 passos.',
    '[{"id":"b_seed_cf_1","type":"banner","image":"https://images.unsplash.com/photo-1488646953014-85cb44e25828","title":"Como funciona a RW Turismo","subtitle":"Da escolha do destino ao embarque: viajar com a gente é simples.","button_label":"Ver pacotes","button_url":"/#pacotes"},{"id":"b_seed_cf_2","type":"text","markdown":"## Sua viagem em 4 passos\n\n**1. Escolha o destino** — explore os pacotes e experiências no site e compare datas e valores.\n\n**2. Reserve online** — selecione a data de saída, informe os viajantes e finalize o pagamento com segurança.\n\n**3. Receba a confirmação** — enviamos a confirmação e todas as orientações da viagem por e-mail e WhatsApp.\n\n**4. Boa viagem!** — nossa equipe acompanha você antes e durante a viagem, do embarque ao retorno."},{"id":"b_seed_cf_3","type":"quote","text":"Reservei em poucos minutos e tive atendimento pelo WhatsApp até o dia do embarque.","author":"Cliente RW Turismo"},{"id":"b_seed_cf_4","type":"faq","items":[{"question":"Posso parcelar a viagem?","answer":"Sim — as condições de parcelamento aparecem na etapa de pagamento de cada pacote."},{"question":"E se eu precisar remarcar?","answer":"Fale com o atendimento o quanto antes. As regras e prazos de remarcação estão nos Termos e condições."},{"question":"Como acompanho a minha reserva?","answer":"Depois de entrar na sua conta, acesse Minhas reservas para ver status, pagamentos e orientações."}]},{"id":"b_seed_cf_5","type":"cta","title":"Pronto para escolher o destino?","text":"Explore os pacotes ou fale com a nossa equipe para montar a viagem ideal.","button_label":"Ver pacotes","button_url":"/#pacotes"}]'::jsonb
  ),
  (
    'Quem somos',
    'quem-somos',
    '',
    'published',
    'Quem somos | RW Turismo',
    'Conheça a história da RW Turismo e o que nos move a criar viagens com cuidado em cada detalhe.',
    '[{"id":"b_seed_qs_1","type":"banner","image":"https://images.unsplash.com/photo-1469474968028-56623f02e42e","title":"Sobre a RW Turismo","subtitle":"Gente que viaja cuidando de gente que viaja.","button_label":"","button_url":""},{"id":"b_seed_qs_2","type":"text","markdown":"## Nossa história\n\nA RW Turismo nasceu em Teresina com um objetivo simples: tirar a viagem dos sonhos do papel sem dor de cabeça. Começamos organizando saídas em grupo para os Lençóis Maranhenses e, destino a destino, fomos crescendo junto com os nossos viajantes.\n\nHoje montamos pacotes completos — transporte, hospedagem e passeios — com atendimento próximo do início ao fim. Cada roteiro é testado pela nossa equipe antes de entrar no site.\n\n## No que acreditamos\n\n- **Cuidado em cada detalhe** — do embarque ao retorno, você fala com gente de verdade.\n- **Transparência** — preço claro, sem surpresa no final.\n- **Experiências que valem a memória** — roteiros pensados para aproveitar o melhor de cada destino."},{"id":"b_seed_qs_3","type":"quote","text":"Nossa missão é levar você aos destinos dos seus sonhos com segurança e cuidado.","author":"Equipe RW Turismo"},{"id":"b_seed_qs_4","type":"cta","title":"Vamos viajar juntos?","text":"Conheça os pacotes e escolha o seu próximo destino.","button_label":"Ver pacotes","button_url":"/#pacotes"}]'::jsonb
  ),
  (
    'Contato e atendimento',
    'contato',
    '',
    'published',
    'Contato e atendimento | RW Turismo',
    'Fale com a equipe da RW Turismo: canais de atendimento, horários e dúvidas frequentes.',
    '[{"id":"b_seed_ct_1","type":"banner","image":"https://images.unsplash.com/photo-1507525428034-b723cf961d3e","title":"Fale com a gente","subtitle":"Atendimento humano, do orçamento ao pós-viagem.","button_label":"","button_url":""},{"id":"b_seed_ct_2","type":"text","markdown":"## Canais de atendimento\n\n**WhatsApp** — atendimento rápido em horário comercial.\n\n**E-mail** — contato@rwturismo.com.br\n\n**Horário** — segunda a sexta, das 9h às 18h; sábado, das 9h às 12h.\n\nSe preferir, envie sua dúvida por qualquer canal e retornamos o quanto antes."},{"id":"b_seed_ct_3","type":"faq","items":[{"question":"Qual o prazo de resposta?","answer":"Em horário comercial, respondemos em poucas horas. Fora dele, retornamos no próximo dia útil."},{"question":"Como acompanho a minha reserva?","answer":"Acesse Minhas reservas com o e-mail usado na compra para ver status e pagamentos."},{"question":"Vocês montam roteiros sob medida?","answer":"Sim. Conte o que você procura — destino, datas e orçamento — e a equipe monta uma proposta."}]},{"id":"b_seed_ct_4","type":"cta","title":"Prefere escrever agora?","text":"Envie um e-mail e um consultor de viagens responde você.","button_label":"Enviar e-mail","button_url":"mailto:contato@rwturismo.com.br"}]'::jsonb
  ),
  (
    'Termos e condições',
    'termos',
    '',
    'published',
    'Termos e condições | RW Turismo',
    'Condições de reserva, pagamento, cancelamento e remarcação das viagens da RW Turismo.',
    '[{"id":"b_seed_tm_1","type":"text","markdown":"_Atualizado em julho de 2026._\n\n## 1. Sobre estes termos\n\nEstes termos regulam a compra de pacotes, hospedagens e experiências oferecidos pela RW Turismo. Ao concluir uma reserva, o viajante declara ter lido e aceito estas condições.\n\n## 2. Reservas e pagamentos\n\n- A reserva é confirmada após a aprovação do pagamento.\n- Os valores exibidos são por pessoa, salvo indicação em contrário na página do pacote.\n- As formas de pagamento disponíveis aparecem na etapa de finalização da compra.\n\n## 3. Cancelamento e remarcação\n\n- Cancelamentos e remarcações devem ser solicitados ao atendimento com a maior antecedência possível.\n- Os prazos e valores de reembolso variam conforme o pacote e constam na confirmação da reserva.\n- Se a agência precisar cancelar (clima, força maior ou grupo mínimo não atingido), o viajante escolhe entre reembolso integral ou remarcação sem custo.\n\n## 4. Responsabilidades do viajante\n\n- Apresentar documento de identificação válido no embarque.\n- Verificar requisitos de saúde e documentação exigidos pelo destino.\n- Comparecer ao ponto de embarque no horário informado.\n\n## 5. Responsabilidades da agência\n\n- Prestar os serviços descritos na página do pacote.\n- Comunicar com antecedência qualquer alteração de roteiro.\n- Oferecer suporte ao viajante durante toda a viagem.\n\n## 6. Dúvidas\n\nFale com a nossa equipe pela [página de contato](/paginas/contato) antes de concluir a reserva."},{"id":"b_seed_tm_2","type":"cta","title":"Ficou com alguma dúvida?","text":"Fale com a nossa equipe antes de concluir a reserva.","button_label":"Falar com a equipe","button_url":"/paginas/contato"}]'::jsonb
  ),
  (
    'Política de privacidade',
    'privacidade',
    '',
    'published',
    'Política de privacidade | RW Turismo',
    'Como a RW Turismo coleta, usa e protege os seus dados pessoais, conforme a LGPD.',
    '[{"id":"b_seed_pv_1","type":"text","markdown":"_Atualizado em julho de 2026._\n\n## 1. Quais dados coletamos\n\n- **Dados de cadastro** — nome, e-mail e telefone informados ao criar conta ou reservar.\n- **Dados da reserva** — nomes dos viajantes, documentos, datas e pacote escolhido.\n- **Dados de navegação** — cookies e estatísticas de uso do site.\n\n## 2. Como usamos\n\n- Processar reservas e pagamentos.\n- Enviar confirmações e orientações da viagem.\n- Divulgar ofertas, apenas com o seu consentimento.\n\n## 3. Com quem compartilhamos\n\nCompartilhamos dados apenas com os parceiros necessários à operação da viagem — hotéis, transportadoras e meios de pagamento — e quando exigido por lei. Não vendemos dados pessoais.\n\n## 4. Seus direitos (LGPD)\n\nVocê pode solicitar a qualquer momento o acesso, a correção ou a exclusão dos seus dados, além de revogar consentimentos. Basta falar com o nosso atendimento.\n\n## 5. Cookies\n\nUsamos cookies para manter a sua sessão e entender como o site é usado. Você pode limpá-los ou bloqueá-los nas configurações do navegador.\n\n## 6. Fale conosco\n\nPara qualquer assunto sobre dados pessoais, use a [página de contato](/paginas/contato)."},{"id":"b_seed_pv_2","type":"cta","title":"Dúvidas sobre os seus dados?","text":"Fale com o nosso atendimento e responderemos o quanto antes.","button_label":"Falar com a equipe","button_url":"/paginas/contato"}]'::jsonb
  )
on conflict (slug) do nothing;

-- Site menu ("abas" no topo do site), linked to the pages above by id so the
-- page builder recognises them. "do nothing": never overwrites a custom menu.
insert into public.site_settings (setting_key, value)
select 'menu', jsonb_build_object('items', jsonb_build_array(
  jsonb_build_object('id', 'm_seed_1', 'label', 'Como funciona', 'url', '/paginas/como-funciona', 'page_id', (select id::text from public.pages where slug = 'como-funciona')),
  jsonb_build_object('id', 'm_seed_2', 'label', 'Quem somos', 'url', '/paginas/quem-somos', 'page_id', (select id::text from public.pages where slug = 'quem-somos')),
  jsonb_build_object('id', 'm_seed_3', 'label', 'Contato', 'url', '/paginas/contato', 'page_id', (select id::text from public.pages where slug = 'contato'))
))
on conflict (setting_key) do nothing;

-- Editorial example: a complete, published blog post tied to the seeded
-- Lençóis product, so the blog and the home "latest posts" section look real.
insert into public.blog_posts (
  title, slug, excerpt, content, cover_image, category_id, status, published_at, featured, seo_title, seo_description, og_image
)
select
  'Lençóis Maranhenses: quando ir, o que levar e como aproveitar',
  'lencois-maranhenses-quando-ir-o-que-levar',
  'As lagoas mais bonitas do Brasil têm hora certa: veja a melhor época, o checklist da mochila e um roteiro de 4 dias testado pela nossa equipe.',
  E'![Lagoas dos Lençóis Maranhenses](https://images.unsplash.com/photo-1544551763-46a013bb70d5)\n\nDunas brancas a perder de vista e lagoas de água doce em tons de azul e verde: os Lençóis Maranhenses parecem outro planeta — mas têm hora certa para mostrar o espetáculo completo. Este guia resume o que aprendemos levando grupos para lá.\n\n## Quando ir: a época das lagoas cheias\n\nAs lagoas são formadas pela chuva, então o calendário manda:\n\n- **Janeiro a maio** — período de chuvas. As lagoas vão enchendo, mas alguns passeios podem sofrer alteração.\n- **Junho a setembro** — o auge: lagoas cheias, céu aberto e clima seco. É a melhor janela para conhecer.\n- **Outubro a dezembro** — as lagoas secam gradualmente; a paisagem de dunas continua linda, mas com menos pontos de banho.\n\nSe o objetivo é nadar nas lagoas, mire entre **junho e setembro** e reserve com antecedência: é alta procura.\n\n## Como chegar\n\nA porta de entrada é **Barreirinhas (MA)**, a cerca de 4 horas de São Luís. Nos nossos pacotes, o traslado sai de Teresina ou São Luís com transporte incluído — você embarca e deixa a logística com a gente.\n\n## O que levar na mochila\n\n- Protetor solar e labial (o sol é forte o ano todo)\n- Óculos escuros, boné ou chapéu\n- Roupas leves e roupa de banho\n- Tênis ou papete para as trilhas na areia\n- Garrafa de água reutilizável\n- Dinheiro em espécie — o sinal de celular e as maquininhas falham na região\n- Capa ou saco impermeável para proteger o celular na travessia\n\n## Roteiro de 4 dias que funciona\n\n**Dia 1** — chegada a Barreirinhas, check-in na pousada e passeio de fim de tarde pelo Rio Preguiças.\n\n**Dia 2** — dia inteiro no circuito clássico: Lagoa Azul e Lagoa Bonita, com pôr do sol nas dunas.\n\n**Dia 3** — travessia até Atins ou passeio a Santo Amaro, as áreas mais preservadas do parque.\n\n**Dia 4** — manhã livre para compras e retorno.\n\n## Dicas de quem já foi\n\n- Chegue às lagoas antes das 9h ou depois das 15h: menos calor e fotos muito melhores.\n- O passeio é em veículo 4x4 por estradas de areia — leve o mínimo e deixe as malas na pousada.\n- Respeite as áreas de preservação e não deixe lixo: o parque é um patrimônio de todos.\n\n## Bora ver isso de perto?\n\nO nosso [pacote Lençóis Maranhenses Essencial](/products/lencois-maranhenses-essencial) já inclui hospedagem, traslados e os passeios deste roteiro. Ficou com dúvida sobre datas ou parcelamento? [Fale com a nossa equipe](/paginas/contato) — a gente monta a viagem com você.',
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5',
  id,
  'published',
  now(),
  true,
  'Lençóis Maranhenses: quando ir, o que levar e como aproveitar',
  'Melhor época para ver as lagoas cheias, checklist do que levar e roteiro de 4 dias nos Lençóis Maranhenses.',
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5'
from public.blog_categories
where slug = 'dicas-de-viagem'
on conflict (slug) do nothing;
