-- Row Level Security policies for the tourism booking platform.
-- Run this file after schema.sql.

-- is_admin() exige conta ativa: desativar um admin tira o acesso na hora, sem
-- precisar apagar o perfil.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users_profiles
    where user_id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;

-- Papéis de equipe (usuários do sistema). staff_role_of() recebe o id explícito
-- porque as RPCs rodam como service_role e não têm auth.uid(); staff_role() usa
-- o usuário logado e é o que as policies chamam.
create or replace function public.staff_role_of(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users_profiles
  where user_id = p_user_id
    and active = true
    and role <> 'customer'
$$;

create or replace function public.staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_role_of(auth.uid())
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_role() is not null
$$;

create or replace function public.has_staff_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_role() = any(p_roles)
$$;

revoke all on function public.staff_role_of(uuid) from public;
grant execute on function public.staff_role_of(uuid) to authenticated;
grant execute on function public.staff_role_of(uuid) to service_role;

revoke all on function public.staff_role() from public;
grant execute on function public.staff_role() to authenticated;
grant execute on function public.staff_role() to service_role;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_staff() to service_role;

revoke all on function public.has_staff_role(text[]) from public;
grant execute on function public.has_staff_role(text[]) to authenticated;
grant execute on function public.has_staff_role(text[]) to service_role;

create or replace function public.prevent_customer_profile_identity_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role. Estas travas existem para conter a EQUIPE
  -- agindo pelo navegador; listar nomes de role aqui quebrava tanto o CI (onde o
  -- dono e "runner") quanto as RPCs internas.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
  then
    return new;
  end if;

  -- INSERT não tem OLD para comparar: aqui a regra é que o e-mail declarado
  -- seja o do próprio token. Era por esta fresta — o trigger só cobria UPDATE —
  -- que entrava o perfil plantado com o e-mail de outra pessoa (A-01).
  if tg_op = 'INSERT' then
    if new.email is not null
       and new.email is distinct from lower(coalesce(auth.jwt() ->> 'email', ''))
    then
      raise exception 'profile email must match the authenticated user email';
    end if;

    return new;
  end if;

  -- ADOÇÃO DE PERFIL ÓRFÃO — a excecao que faz adotar_perfil_sem_login()
  -- funcionar sem depender de como o DONO da funcao se chama.
  --
  -- Antes, a adocao so passava porque a funcao e SECURITY DEFINER e, criada
  -- pelo SQL Editor, pertence a `postgres` — que esta na lista de escape logo
  -- acima. Dependencia invisivel: recriar a funcao por outro caminho mudava o
  -- dono e o cliente importado voltava a ficar TRANCADO FORA do site.
  --
  -- Um perfil SEM dono ganha como dono o PROPRIO usuario logado, e nada mais
  -- muda. O caminho direto continua fechado pelo RLS: a policy de update usa
  -- `using (user_id = auth.uid())`, que para um orfao e NULL.
  if old.user_id is null
     and new.user_id = auth.uid()
     and new.id = old.id
     and new.role = old.role
     and new.email is not distinct from old.email
  then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.role is distinct from old.role
    or new.email is distinct from old.email
  then
    raise exception 'customers can update only name, phone and avatar_url';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_customer_profile_identity_changes on public.users_profiles;
create trigger prevent_customer_profile_identity_changes
before insert or update on public.users_profiles
for each row execute function public.prevent_customer_profile_identity_changes();

alter table public.users_profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_dates enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.passengers enable row level security;
alter table public.categories enable row level security;
alter table public.product_categories enable row level security;
alter table public.favorites enable row level security;
alter table public.system_logs enable row level security;

-- Profiles: users can read only their own profile; admins can read all profiles.
drop policy if exists "profiles_select_own_or_admin" on public.users_profiles;
create policy "profiles_select_own_or_admin"
on public.users_profiles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Profiles: users can create only their own customer profile.
--
-- O e-mail é amarrado ao token de propósito. Sem isso, um usuário autenticado
-- plantava um perfil com o e-mail de OUTRA pessoa e, quando ela comprasse sem
-- cadastro, a reserva nasceria em nome dele — porque o e-mail é a chave de
-- identidade em src/lib/auth/customerAccount.ts:132. Ver A-01 do relatório de
-- auditoria. `email is null` segue aceito: é o contato que a agência importou.
drop policy if exists "profiles_insert_own_customer" on public.users_profiles;
create policy "profiles_insert_own_customer"
on public.users_profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'customer'
  and (email is null or email = lower(auth.jwt() ->> 'email'))
);

-- Profiles: customers can update their own profile row. A trigger blocks changes to id, user_id, email and role.
drop policy if exists "profiles_update_own_without_role_change" on public.users_profiles;
drop policy if exists "profiles_update_own_customer_fields" on public.users_profiles;
create policy "profiles_update_own_customer_fields"
on public.users_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and role = 'customer');

-- Profiles: admins can manage profiles, including role changes.
drop policy if exists "profiles_admin_all" on public.users_profiles;
create policy "profiles_admin_all"
on public.users_profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Products: public users can see only active, non-deleted products.
drop policy if exists "products_select_active" on public.products;
create policy "products_select_active"
on public.products
for select
to anon, authenticated
using (active = true and deleted_at is null);

-- Products: admins can create, edit and delete products.
drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all"
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Product dates: public users can see only active, non-deleted dates for
-- active, non-deleted products.
drop policy if exists "product_dates_select_active_products" on public.product_dates;
create policy "product_dates_select_active_products"
on public.product_dates
for select
to anon, authenticated
using (
  active = true
  and deleted_at is null
  and exists (
    select 1
    from public.products
    where products.id = product_dates.product_id
      and products.active = true
      and products.deleted_at is null
  )
);

-- Product dates: admins can manage availability and prices.
drop policy if exists "product_dates_admin_all" on public.product_dates;
create policy "product_dates_admin_all"
on public.product_dates
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Bookings: customers do not insert bookings directly. Backend/service role creates pending bookings after validating product, date, slots, price and traveler count.
drop policy if exists "bookings_insert_own_pending" on public.bookings;

-- Bookings: users can see only their own bookings; admins can see all.
drop policy if exists "bookings_select_own_or_admin" on public.bookings;
create policy "bookings_select_own_or_admin"
on public.bookings
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Bookings: customers do not confirm reservations manually. Admin updates are operational; real paid confirmation must come from Stripe webhook/service role.
drop policy if exists "bookings_admin_update" on public.bookings;
create policy "bookings_admin_update"
on public.bookings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Bookings: admins can delete test or invalid bookings when needed.
drop policy if exists "bookings_admin_delete" on public.bookings;
create policy "bookings_admin_delete"
on public.bookings
for delete
to authenticated
using (public.is_admin());

-- Payments: customers can only view their own payments; admins can view all payments.
drop policy if exists "payments_select_own_or_admin" on public.payments;
create policy "payments_select_own_or_admin"
on public.payments
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Payments: customers cannot insert, update or delete payments. Payments are created and updated by backend/webhook using service role.
drop policy if exists "payments_admin_all" on public.payments;

-- Passengers: customers can add passengers only while their booking is still pending and unpaid.
drop policy if exists "passengers_insert_own_booking" on public.passengers;
drop policy if exists "passengers_insert_own_pending_booking" on public.passengers;
create policy "passengers_insert_own_pending_booking"
on public.passengers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.bookings
    where bookings.id = passengers.booking_id
      and bookings.user_id = auth.uid()
      and bookings.status = 'pending'
      and bookings.payment_status = 'pending'
  )
);

-- Passengers: users can see passengers linked to their own bookings; admins can see all.
drop policy if exists "passengers_select_own_booking_or_admin" on public.passengers;
create policy "passengers_select_own_booking_or_admin"
on public.passengers
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.bookings
    where bookings.id = passengers.booking_id
      and bookings.user_id = auth.uid()
  )
);

-- Passengers: customers can edit passengers only while their booking is still pending and unpaid.
drop policy if exists "passengers_update_own_booking" on public.passengers;
drop policy if exists "passengers_update_own_pending_booking" on public.passengers;
create policy "passengers_update_own_pending_booking"
on public.passengers
for update
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = passengers.booking_id
      and bookings.user_id = auth.uid()
      and bookings.status = 'pending'
      and bookings.payment_status = 'pending'
  )
)
with check (
  exists (
    select 1
    from public.bookings
    where bookings.id = passengers.booking_id
      and bookings.user_id = auth.uid()
      and bookings.status = 'pending'
      and bookings.payment_status = 'pending'
  )
);

-- Passengers: admins can manage all passenger records.
drop policy if exists "passengers_admin_all" on public.passengers;
create policy "passengers_admin_all"
on public.passengers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Categories: public users can see active, non-deleted categories.
drop policy if exists "categories_select_active" on public.categories;
create policy "categories_select_active"
on public.categories
for select
to anon, authenticated
using (active = true and deleted_at is null);

-- Categories: admins can manage all categories.
drop policy if exists "categories_admin_all" on public.categories;
create policy "categories_admin_all"
on public.categories
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Product categories: public users can see links only for active products and active categories.
drop policy if exists "product_categories_select_active" on public.product_categories;
create policy "product_categories_select_active"
on public.product_categories
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    where products.id = product_categories.product_id
      and products.active = true
      and products.deleted_at is null
  )
  and exists (
    select 1
    from public.categories
    where categories.id = product_categories.category_id
      and categories.active = true
      and categories.deleted_at is null
  )
);

-- Product categories: admins can manage product/category relationships.
drop policy if exists "product_categories_admin_all" on public.product_categories;
create policy "product_categories_admin_all"
on public.product_categories
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Favorites: authenticated users can create favorites only for their own auth user.
drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
on public.favorites
for insert
to authenticated
with check (user_id = auth.uid());

-- Favorites: authenticated users can list only their own favorites; admins can view all.
drop policy if exists "favorites_select_own_or_admin" on public.favorites;
create policy "favorites_select_own_or_admin"
on public.favorites
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Favorites: authenticated users can update only their own favorites; admins can update all.
drop policy if exists "favorites_update_own_or_admin" on public.favorites;
create policy "favorites_update_own_or_admin"
on public.favorites
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Favorites: authenticated users can delete only their own favorites; admins can delete all.
drop policy if exists "favorites_delete_own_or_admin" on public.favorites;
create policy "favorites_delete_own_or_admin"
on public.favorites
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- System logs: admins can consult logs.
drop policy if exists "system_logs_admin_select" on public.system_logs;
create policy "system_logs_admin_select"
on public.system_logs
for select
to authenticated
using (public.is_admin());

-- System logs: admins can write manual administrative logs. Backend service role can bypass RLS for automated logs.
drop policy if exists "system_logs_admin_insert" on public.system_logs;
create policy "system_logs_admin_insert"
on public.system_logs
for insert
to authenticated
with check (public.is_admin());

-- Editable home, settings, blog and newsletter.
alter table public.home_sections enable row level security;
alter table public.home_banners enable row level security;
alter table public.site_settings enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blog_tags enable row level security;
alter table public.blog_post_tags enable row level security;
alter table public.newsletter_subscribers enable row level security;

drop policy if exists "home_sections_public_read" on public.home_sections;
create policy "home_sections_public_read" on public.home_sections
for select to anon, authenticated using (active = true);
drop policy if exists "home_sections_admin_all" on public.home_sections;
create policy "home_sections_admin_all" on public.home_sections
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "home_banners_public_read" on public.home_banners;
create policy "home_banners_public_read" on public.home_banners
for select to anon, authenticated
using (
  active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);
drop policy if exists "home_banners_admin_all" on public.home_banners;
create policy "home_banners_admin_all" on public.home_banners
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Lista branca, e não using(true). A tabela é um key/value genérico: com
-- leitura aberta, a primeira pessoa que gravasse um token aqui o publicaria
-- para a internet sem nenhum aviso. crm_stages fica DE FORA — é configuração
-- interna do funil, e quem precisa dela tem a policy logo abaixo (A-06/A-12).
drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read" on public.site_settings
for select to anon, authenticated
using (
  setting_key in (
    'site_identity', 'home_seo', 'contact', 'social_links',
    'footer', 'default_seo', 'menu', 'whatsapp_widget'
  )
);

-- /admin/crm é de ["admin","operacoes"], mas só `conteudo` tinha escrita nesta
-- tabela. Sem isto, fechar a leitura pública deixaria operacoes sem enxergar o
-- próprio funil.
drop policy if exists "site_settings_operacoes_crm" on public.site_settings;
create policy "site_settings_operacoes_crm" on public.site_settings
for all to authenticated
using (
  setting_key = 'crm_stages'
  and public.has_staff_role(array['admin', 'operacoes'])
)
with check (
  setting_key = 'crm_stages'
  and public.has_staff_role(array['admin', 'operacoes'])
);
drop policy if exists "site_settings_admin_all" on public.site_settings;
create policy "site_settings_admin_all" on public.site_settings
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "blog_posts_public_read" on public.blog_posts;
create policy "blog_posts_public_read" on public.blog_posts
for select to anon, authenticated
using (status = 'published' and published_at is not null and published_at <= now());
drop policy if exists "blog_posts_admin_all" on public.blog_posts;
create policy "blog_posts_admin_all" on public.blog_posts
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "blog_categories_public_read" on public.blog_categories;
create policy "blog_categories_public_read" on public.blog_categories
for select to anon, authenticated using (active = true);
drop policy if exists "blog_categories_admin_all" on public.blog_categories;
create policy "blog_categories_admin_all" on public.blog_categories
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "blog_tags_public_read" on public.blog_tags;
create policy "blog_tags_public_read" on public.blog_tags
for select to anon, authenticated using (true);
drop policy if exists "blog_tags_admin_all" on public.blog_tags;
create policy "blog_tags_admin_all" on public.blog_tags
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "blog_post_tags_public_read" on public.blog_post_tags;
create policy "blog_post_tags_public_read" on public.blog_post_tags
for select to anon, authenticated using (
  exists (
    select 1 from public.blog_posts
    where blog_posts.id = blog_post_tags.post_id
      and blog_posts.status = 'published'
      and blog_posts.published_at <= now()
  )
);
drop policy if exists "blog_post_tags_admin_all" on public.blog_post_tags;
create policy "blog_post_tags_admin_all" on public.blog_post_tags
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Sem insert direto do anônimo: com unique(email), o código 23505 distinguia
-- "já existe" de "inserido" e a tabela virava oráculo de "este e-mail é
-- assinante?". A inscrição passa pela RPC assinar_newsletter(), que responde
-- igual nos dois casos (A-05).
drop policy if exists "newsletter_public_insert" on public.newsletter_subscribers;
drop policy if exists "newsletter_admin_read" on public.newsletter_subscribers;
create policy "newsletter_admin_read" on public.newsletter_subscribers
for select to authenticated using (public.is_admin());
drop policy if exists "newsletter_admin_update" on public.newsletter_subscribers;
create policy "newsletter_admin_update" on public.newsletter_subscribers
for update to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.pages enable row level security;

drop policy if exists "pages_public_read" on public.pages;
create policy "pages_public_read" on public.pages
for select to anon, authenticated
using (status = 'published');

drop policy if exists "pages_admin_all" on public.pages;
create policy "pages_admin_all" on public.pages
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_admin_all" on public.suppliers;
create policy "suppliers_admin_all" on public.suppliers
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

alter table public.waitlist enable row level security;

drop policy if exists "waitlist_public_insert" on public.waitlist;
create policy "waitlist_public_insert" on public.waitlist
for insert to anon, authenticated
with check (
  status = 'pending'
  -- Sem o vínculo de user_id, um anônimo gravava inscrição em nome de outra
  -- pessoa — e ela a via na própria conta pela policy de select logo abaixo.
  and (user_id is null or user_id = auth.uid())
);

drop policy if exists "waitlist_select_own_or_admin" on public.waitlist;
create policy "waitlist_select_own_or_admin" on public.waitlist
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "waitlist_admin_update" on public.waitlist;
create policy "waitlist_admin_update" on public.waitlist
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "waitlist_admin_delete" on public.waitlist;
create policy "waitlist_admin_delete" on public.waitlist
for delete to authenticated
using (public.is_admin());

alter table public.transfers enable row level security;

drop policy if exists "transfers_admin_all" on public.transfers;
create policy "transfers_admin_all" on public.transfers
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

alter table public.leads enable row level security;

drop policy if exists "leads_admin_all" on public.leads;
create policy "leads_admin_all" on public.leads
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

alter table public.lead_activities enable row level security;

drop policy if exists "lead_activities_admin_all" on public.lead_activities;
create policy "lead_activities_admin_all" on public.lead_activities
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

alter table public.integration_secrets enable row level security;

drop policy if exists "integration_secrets_admin_all" on public.integration_secrets;
create policy "integration_secrets_admin_all" on public.integration_secrets
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

alter table public.notification_log enable row level security;

drop policy if exists "notification_log_admin_read" on public.notification_log;
create policy "notification_log_admin_read" on public.notification_log
for select to authenticated
using (public.is_admin());

alter table public.expenses enable row level security;

drop policy if exists "expenses_admin_all" on public.expenses;
create policy "expenses_admin_all" on public.expenses
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

alter table public.receivables enable row level security;

drop policy if exists "receivables_admin_all" on public.receivables;
create policy "receivables_admin_all" on public.receivables
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "leads_public_insert" on public.leads;
create policy "leads_public_insert" on public.leads
for insert to anon, authenticated
with check (
  source = 'site_form'
  and stage_id = 'new'
  -- user_id amarrado, e as colunas de controle que o formulário público nunca
  -- preenche ficam fechadas. `position` continua livre: o cliente manda
  -- Date.now() nele (src/lib/leads/client.ts:31).
  and (user_id is null or user_id = auth.uid())
  and deleted_at is null
  and waitlist_id is null
);

alter table public.survey_responses enable row level security;

drop policy if exists "survey_responses_public_insert" on public.survey_responses;
create policy "survey_responses_public_insert" on public.survey_responses
for insert to anon, authenticated
-- `approved = false` amarrado: sem isso o próprio autor publicava o depoimento
-- dele na home, pulando a moderação que a coluna existe para impor (A-02).
with check (rating >= 0 and rating <= 10 and approved = false);

drop policy if exists "survey_responses_admin_read" on public.survey_responses;
create policy "survey_responses_admin_read" on public.survey_responses
for select to authenticated
using (public.is_admin());

drop policy if exists "survey_responses_admin_update" on public.survey_responses;
create policy "survey_responses_admin_update" on public.survey_responses
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Fase 2.5 — Cupons: só admin gerencia. A validação em reserva é feita pela RPC
-- create_pending_booking_transaction (security definer), não por leitura pública.
alter table public.coupons enable row level security;

drop policy if exists "coupons_admin_all" on public.coupons;
create policy "coupons_admin_all" on public.coupons
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "public_read_site_assets" on storage.objects;
create policy "public_read_site_assets" on storage.objects
for select to public using (bucket_id in ('site-assets', 'product-images', 'blog-images'));
drop policy if exists "admin_manage_site_assets" on storage.objects;
create policy "admin_manage_site_assets" on storage.objects
for all to authenticated
using (bucket_id in ('site-assets', 'product-images', 'blog-images') and public.is_admin())
with check (bucket_id in ('site-assets', 'product-images', 'blog-images') and public.is_admin());

-- =====================================================================
-- Usuários do sistema — acesso por papel de equipe
--
-- As policies de admin acima ficam intactas: policies permissivas se somam
-- (OR), então o admin continua com acesso total e cada papel ganha só a sua
-- fatia. A sidebar em src/lib/auth/roles.ts espelha esta divisão.
--
--   operacoes  → reservas, passageiros/check-in, saídas, fornecedores,
--                transfers, lista de espera, CRM, clientes. Lê pagamentos.
--   financeiro → pagamentos (confirmar), despesas, recebíveis, cupons.
--                Lê reservas. Não mexe no catálogo.
--   conteudo   → catálogo, home, páginas, blog, aparência, avaliações, cupons.
--                Não vê caixa nem reservas.
-- =====================================================================

-- Perfis: a equipe lê a base de clientes. Alterar papel continua só com admin —
-- o trigger prevent_customer_profile_identity_changes bloqueia mudança de
-- role/email por quem não é admin, então ninguém se autopromove.
drop policy if exists "profiles_staff_select" on public.users_profiles;
create policy "profiles_staff_select"
on public.users_profiles
for select
to authenticated
-- Papéis nomeados, e não is_staff(): /admin/clients é de admin/operacoes/
-- financeiro (src/lib/auth/roles.ts:52). Com is_staff(), `conteudo` não tinha a
-- tela mas lia a base inteira de clientes (A-10).
using (public.has_staff_role(array['admin', 'operacoes', 'financeiro']));

-- Operações edita a ficha do CLIENTE. O filtro role = 'customer' nos dois lados
-- impede que a equipe edite o cadastro de outro membro da equipe.
drop policy if exists "profiles_operacoes_update_customers" on public.users_profiles;
create policy "profiles_operacoes_update_customers"
on public.users_profiles
for update
to authenticated
using (public.has_staff_role(array['operacoes']) and role = 'customer')
with check (public.has_staff_role(array['operacoes']) and role = 'customer');

-- Catálogo: conteudo gerencia, o resto da equipe só lê (precisa ver itens
-- inativos para montar reserva e conferir preço).
drop policy if exists "products_staff_select" on public.products;
create policy "products_staff_select"
on public.products
for select to authenticated
using (public.is_staff());

drop policy if exists "products_conteudo_all" on public.products;
create policy "products_conteudo_all"
on public.products
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "product_dates_staff_select" on public.product_dates;
create policy "product_dates_staff_select"
on public.product_dates
for select to authenticated
using (public.is_staff());

drop policy if exists "product_dates_conteudo_all" on public.product_dates;
create policy "product_dates_conteudo_all"
on public.product_dates
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

-- Operações ajusta a logística da saída (total de assentos) sem poder criar,
-- apagar ou reprecificar datas.
drop policy if exists "product_dates_operacoes_update" on public.product_dates;
create policy "product_dates_operacoes_update"
on public.product_dates
for update to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "categories_staff_select" on public.categories;
create policy "categories_staff_select"
on public.categories
for select to authenticated
using (public.is_staff());

drop policy if exists "categories_conteudo_all" on public.categories;
create policy "categories_conteudo_all"
on public.categories
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "product_categories_conteudo_all" on public.product_categories;
create policy "product_categories_conteudo_all"
on public.product_categories
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

-- Reservas e operação: operacoes gerencia, financeiro só lê.
-- SEM DELETE. A policy era `for all`, e `for all` inclui DELETE — que nao passa
-- por trigger BEFORE UPDATE nenhum. Ou seja: a trava de dinheiro do A-08 era
-- contornavel apagando a reserva inteira, e `payments` e `passengers` iam junto
-- por `on delete cascade` (schema.sql:113 e :133), sem deixar registro.
--
-- Apagar reserva ja era para ser poder de admin: existe `bookings_admin_delete`
-- logo acima, e /admin/trash e admin-only na UI. Nenhum codigo da aplicacao
-- apaga booking pelo navegador, entao fechar isto nao tira funcao de ninguem.
drop policy if exists "bookings_operacoes_all" on public.bookings;
drop policy if exists "bookings_operacoes_select" on public.bookings;
create policy "bookings_operacoes_select"
on public.bookings
for select to authenticated
using (public.has_staff_role(array['operacoes']));

drop policy if exists "bookings_operacoes_insert" on public.bookings;
create policy "bookings_operacoes_insert"
on public.bookings
for insert to authenticated
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "bookings_operacoes_update" on public.bookings;
create policy "bookings_operacoes_update"
on public.bookings
for update to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "bookings_financeiro_select" on public.bookings;
create policy "bookings_financeiro_select"
on public.bookings
for select to authenticated
using (public.has_staff_role(array['financeiro']));

drop policy if exists "passengers_operacoes_all" on public.passengers;
create policy "passengers_operacoes_all"
on public.passengers
for all to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

-- Financeiro NAO le passengers: a tabela guarda documento e nascimento,
-- inclusive de criancas, e nenhuma tarefa financeira precisa disso. RLS e por
-- linha, entao nao da para liberar so o nome — a policy inteira fica de fora.
drop policy if exists "passengers_financeiro_select" on public.passengers;

drop policy if exists "suppliers_operacoes_all" on public.suppliers;
create policy "suppliers_operacoes_all"
on public.suppliers
for all to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "suppliers_financeiro_select" on public.suppliers;
create policy "suppliers_financeiro_select"
on public.suppliers
for select to authenticated
using (public.has_staff_role(array['financeiro']));

drop policy if exists "transfers_operacoes_all" on public.transfers;
create policy "transfers_operacoes_all"
on public.transfers
for all to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "waitlist_operacoes_all" on public.waitlist;
create policy "waitlist_operacoes_all"
on public.waitlist
for all to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "leads_operacoes_all" on public.leads;
create policy "leads_operacoes_all"
on public.leads
for all to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

drop policy if exists "lead_activities_operacoes_all" on public.lead_activities;
create policy "lead_activities_operacoes_all"
on public.lead_activities
for all to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));

-- Caixa: financeiro gerencia, operacoes só consulta o pagamento.
drop policy if exists "payments_financeiro_all" on public.payments;
create policy "payments_financeiro_all"
on public.payments
for all to authenticated
using (public.has_staff_role(array['financeiro']))
with check (public.has_staff_role(array['financeiro']));

drop policy if exists "payments_operacoes_select" on public.payments;
create policy "payments_operacoes_select"
on public.payments
for select to authenticated
using (public.has_staff_role(array['operacoes']));

drop policy if exists "expenses_financeiro_all" on public.expenses;
create policy "expenses_financeiro_all"
on public.expenses
for all to authenticated
using (public.has_staff_role(array['financeiro']))
with check (public.has_staff_role(array['financeiro']));

drop policy if exists "receivables_financeiro_all" on public.receivables;
create policy "receivables_financeiro_all"
on public.receivables
for all to authenticated
using (public.has_staff_role(array['financeiro']))
with check (public.has_staff_role(array['financeiro']));

-- Cupons: financeiro (impacto no caixa) e conteudo (campanha/marketing).
drop policy if exists "coupons_staff_all" on public.coupons;
create policy "coupons_staff_all"
on public.coupons
for all to authenticated
using (public.has_staff_role(array['financeiro', 'conteudo']))
with check (public.has_staff_role(array['financeiro', 'conteudo']));

drop policy if exists "coupons_operacoes_select" on public.coupons;
create policy "coupons_operacoes_select"
on public.coupons
for select to authenticated
using (public.has_staff_role(array['operacoes']));

-- Site e conteúdo editorial: só conteudo (além do admin).
drop policy if exists "home_sections_conteudo_all" on public.home_sections;
create policy "home_sections_conteudo_all" on public.home_sections
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "home_banners_conteudo_all" on public.home_banners;
create policy "home_banners_conteudo_all" on public.home_banners
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "site_settings_conteudo_all" on public.site_settings;
create policy "site_settings_conteudo_all" on public.site_settings
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "pages_conteudo_all" on public.pages;
create policy "pages_conteudo_all" on public.pages
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "blog_posts_conteudo_all" on public.blog_posts;
create policy "blog_posts_conteudo_all" on public.blog_posts
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "blog_categories_conteudo_all" on public.blog_categories;
create policy "blog_categories_conteudo_all" on public.blog_categories
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "blog_tags_conteudo_all" on public.blog_tags;
create policy "blog_tags_conteudo_all" on public.blog_tags
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "blog_post_tags_conteudo_all" on public.blog_post_tags;
create policy "blog_post_tags_conteudo_all" on public.blog_post_tags
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "newsletter_conteudo_read" on public.newsletter_subscribers;
create policy "newsletter_conteudo_read" on public.newsletter_subscribers
for select to authenticated
using (public.has_staff_role(array['conteudo']));

drop policy if exists "newsletter_conteudo_update" on public.newsletter_subscribers;
create policy "newsletter_conteudo_update" on public.newsletter_subscribers
for update to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

-- Avaliações (NPS): conteudo aprova o que vai pro site; operacoes só consulta.
drop policy if exists "survey_responses_conteudo_read" on public.survey_responses;
create policy "survey_responses_conteudo_read" on public.survey_responses
for select to authenticated
using (public.has_staff_role(array['conteudo', 'operacoes']));

drop policy if exists "survey_responses_conteudo_update" on public.survey_responses;
create policy "survey_responses_conteudo_update" on public.survey_responses
for update to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

-- Auditoria: só admin consulta, como /admin/logs sempre prometeu na UI
-- (src/lib/auth/roles.ts:82). Com is_staff(), toda a equipe lia a trilha
-- inteira — inclusive os registros de view_passenger_document, que dizem quem
-- abriu documento de menor (A-11). Escrita segue só admin + service_role.
drop policy if exists "system_logs_staff_select" on public.system_logs;
create policy "system_logs_staff_select"
on public.system_logs
for select to authenticated
using (public.is_admin());

-- A trilha COMPLETA e admin-only (acima). Mas o painel "Historico" das telas de
-- reserva e de pagamento ficava vazio EM SILENCIO para quem trabalha nelas, e
-- nunca foi isso que a auditoria pediu — o alvo era /admin/logs e os registros
-- de view_passenger_document. Esta policy devolve so a fatia por entidade.
drop policy if exists "system_logs_staff_entity_select" on public.system_logs;
create policy "system_logs_staff_entity_select"
on public.system_logs
for select to authenticated
using (
  public.has_staff_role(array['operacoes', 'financeiro'])
  -- Sao os valores que o app grava de fato (src/lib/admin/client.ts e as RPCs):
  -- 'booking' e 'payment'. `passengers` fica DE FORA de proposito: e ali que
  -- mora o registro de view_passenger_document, que diz quem abriu documento de
  -- menor — exatamente o que o A-11 queria manter admin-only.
  and entity in ('booking', 'payment')
);

drop policy if exists "notification_log_staff_read" on public.notification_log;
create policy "notification_log_staff_read"
on public.notification_log
for select to authenticated
using (public.has_staff_role(array['operacoes', 'financeiro']));

-- Upload de imagens (banner, capa de produto, blog) é trabalho de conteúdo.
drop policy if exists "conteudo_manage_site_assets" on storage.objects;
create policy "conteudo_manage_site_assets" on storage.objects
for all to authenticated
using (
  bucket_id in ('site-assets', 'product-images', 'blog-images')
  and public.has_staff_role(array['conteudo'])
)
with check (
  bucket_id in ('site-assets', 'product-images', 'blog-images')
  and public.has_staff_role(array['conteudo'])
);

-- =====================================================================
-- Documentos de passageiro (bucket privado booking-documents)
-- =====================================================================
-- Operação e Admin leem para conferir. Financeiro e Conteúdo NÃO entram:
-- nenhuma tarefa deles precisa do documento de uma criança.
drop policy if exists "booking_documents_staff_read" on storage.objects;
create policy "booking_documents_staff_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'booking-documents'
  and (public.is_admin() or public.has_staff_role(array['operacoes']))
);

-- O titular lê o que enviou. Escrita NÃO passa por policy: o upload usa URL
-- assinada emitida pelo servidor, porque na compra sem cadastro o cliente não
-- tem sessão para o RLS avaliar.
drop policy if exists "booking_documents_owner_read" on storage.objects;
create policy "booking_documents_owner_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'booking-documents'
  and exists (
    select 1
    from public.bookings b
    where b.id = public.safe_uuid((storage.foldername(name))[1])
      and b.user_id = auth.uid()
  )
);


-- =====================================================================
-- Travas por COLUNA (auditoria de segurança, 2026-08-30)
-- =====================================================================
-- RLS no Postgres é linha inteira: ele não sabe dizer "esta role pode editar
-- a reserva, MENOS a coluna do dinheiro". Onde a separação precisa ser por
-- coluna, a trava é trigger. O projeto já usava exatamente isto em
-- passengers_protect_document_columns() (schema.sql); as três funções abaixo
-- estendem o mesmo padrão para dinheiro, preço da saída e HTML de página.
--
-- Todas liberam service_role e admin primeiro, e só reclamam quando o valor
-- MUDA — para o papel legítimo seguir editando o resto da linha.

-- A-08: bookings_operacoes_all é FOR ALL. Sem esta trava, `operacoes`
-- confirmava pagamento com um PATCH direto na PostgREST, contornando a rota
-- api/admin/bookings/[id]/confirm-payment.ts e o guard da RPC.
create or replace function public.bookings_protect_financial_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role. Estas travas existem para conter a EQUIPE
  -- agindo pelo navegador; listar nomes de role aqui quebrava tanto o CI (onde o
  -- dono e "runner") quanto as RPCs internas.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
    or public.has_staff_role(array['financeiro'])
  then
    return new;
  end if;

  -- INSERT tambem, e nao so UPDATE. Sem este ramo, `operacoes` simplesmente
  -- CRIAVA a reserva ja com payment_status='paid' — mesma fraude do UPDATE,
  -- por outra porta. Reserva nasce pendente; confirmar e do financeiro.
  if tg_op = 'INSERT' then
    if new.payment_status is distinct from 'pending'
      or new.status is distinct from 'pending'
    then
      raise exception 'new bookings must start pending; only finance confirms payment';
    end if;

    return new;
  end if;

  if new.payment_status is distinct from old.payment_status
    or new.total_amount is distinct from old.total_amount
    or new.status is distinct from old.status
  then
    raise exception 'only finance can change payment status, booking status or amount';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_protect_financial_columns on public.bookings;
create trigger bookings_protect_financial_columns
before insert or update on public.bookings
for each row execute function public.bookings_protect_financial_columns();

-- A-09: a policy de product_dates prometia no comentário "sem reprecificar",
-- mas não restringia coluna nenhuma. A coluna de preço da saída é
-- price_override; operacoes segue ajustando assentos, horários e active.
create or replace function public.product_dates_protect_price()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role. Estas travas existem para conter a EQUIPE
  -- agindo pelo navegador; listar nomes de role aqui quebrava tanto o CI (onde o
  -- dono e "runner") quanto as RPCs internas.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
    or public.has_staff_role(array['conteudo'])
  then
    return new;
  end if;

  if new.price_override is distinct from old.price_override then
    raise exception 'only content role can change departure prices';
  end if;

  return new;
end;
$$;

drop trigger if exists product_dates_protect_price on public.product_dates;
create trigger product_dates_protect_price
before update on public.product_dates
for each row execute function public.product_dates_protect_price();

-- A-07: custom_html é servido como HTML CRU na origem do site
-- (src/pages/paginas/[slug].tsx:153) e num iframe srcDoc — que sem `sandbox`
-- herda a origem do pai. Quem escreve a coluna executa script na origem e
-- alcança a sessão de quem visitar, inclusive a de um admin. Escrever HTML cru
-- na origem é poder de administrador, não de redação.
create or replace function public.pages_protect_custom_html()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem auth.uid() nao existe requisicao de navegador: e migration, seed, RPC
  -- security definer ou service_role. Estas travas existem para conter a EQUIPE
  -- agindo pelo navegador; listar nomes de role aqui quebrava tanto o CI (onde o
  -- dono e "runner") quanto as RPCs internas.
  if auth.uid() is null
    or current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Recusar TODO insert com HTML quebrava a duplicacao de pagina: a tela
    -- copia custom_html da pagina original (src/pages/admin/pages/index.tsx),
    -- entao `conteudo` deixava de conseguir duplicar qualquer landing.
    --
    -- O que precisa ser barrado e HTML NOVO. HTML que ja existe em outra pagina
    -- ja passou por um admin uma vez, entao copiar nao aumenta o poder de
    -- ninguem — e o caminho legitimo volta a funcionar.
    if new.custom_html is not null and btrim(new.custom_html) <> ''
       and not exists (
         select 1 from public.pages p where p.custom_html = new.custom_html
       )
    then
      raise exception 'only admins can publish custom HTML';
    end if;
    return new;
  end if;

  if new.custom_html is distinct from old.custom_html
     or new.custom_html_chrome is distinct from old.custom_html_chrome
  then
    raise exception 'only admins can change custom HTML';
  end if;

  return new;
end;
$$;

drop trigger if exists pages_protect_custom_html on public.pages;
create trigger pages_protect_custom_html
before insert or update on public.pages
for each row execute function public.pages_protect_custom_html();

-- A-05: inscrição na newsletter sem revelar se o e-mail já era assinante.
-- Substitui o insert direto do anônimo, cujo 23505 do unique(email) permitia
-- enumerar a base.
create or replace function public.assinar_newsletter(p_email text, p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  email_limpo text := lower(btrim(coalesce(p_email, '')));
begin
  if email_limpo = '' or email_limpo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email';
  end if;

  if coalesce(p_source, '') not in ('home', 'blog') then
    raise exception 'invalid source';
  end if;

  insert into public.newsletter_subscribers (email, source, active)
  values (email_limpo, p_source, true)
  on conflict (email) do nothing;
  -- Sem RETURNING e sem contagem: quem chama não distingue "assinou agora" de
  -- "já era assinante". É essa indistinção que fecha o oráculo.
end;
$$;

revoke all on function public.assinar_newsletter(text, text) from public;
grant execute on function public.assinar_newsletter(text, text) to anon;
grant execute on function public.assinar_newsletter(text, text) to authenticated;


-- =====================================================================
-- A-16 (BAIXA) — chave de integração em claro no navegador do admin
-- =====================================================================
-- A policy integration_secrets_admin_all está CERTA (só is_admin()). O problema
-- é de superfície: /admin/integracoes fazia select("key, value, updated_at")
-- pelo navegador, então stripe_secret_key, resend_api_key e uazapi_token
-- trafegavam inteiros e ficavam no estado do React — visíveis na aba de rede,
-- para qualquer extensão instalada, e para qualquer script rodando na origem.
--
-- E a tela nem precisava do valor: o único uso era mostrar os 4 últimos
-- caracteres. Esta RPC devolve exatamente isso e nada mais.
create or replace function public.listar_integracoes()
returns table (key text, updated_at timestamptz, ultimos4 text)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.key,
    s.updated_at,
    right(s.value, 4) as ultimos4
  from public.integration_secrets s
  -- O security definer passa por cima do RLS, entao o filtro de papel precisa
  -- estar AQUI dentro. Sem esta linha a funcao entregaria os segredos a
  -- qualquer authenticated.
  where public.is_admin();
$$;

revoke all on function public.listar_integracoes() from public;
grant execute on function public.listar_integracoes() to authenticated;

comment on function public.listar_integracoes() is
  'Lista as integracoes configuradas SEM devolver o segredo: so a chave, a data e os 4 ultimos caracteres. Existe para a tela /admin/integracoes parar de trazer stripe_secret_key e afins inteiros para o navegador.';


-- Comentarios das funcoes novas (espelhados da migration 20260903000000).
comment on function public.pages_protect_custom_html() is
  'Reserva a escrita de pages.custom_html ao admin. O HTML e servido cru na origem do site, entao quem escreve a coluna executa script na origem e alcanca a sessao de quem visitar — inclusive a de um admin. So dispara quando o valor muda, para o papel conteudo seguir editando o resto da pagina.';

comment on function public.bookings_protect_financial_columns() is
  'Reserva payment_status, status e total_amount ao financeiro/admin e ao service_role. A policy bookings_operacoes_all e FOR ALL, e sem esta trava o papel operacoes confirmava pagamento por um PATCH direto na PostgREST, contornando a rota de API e o guard da RPC.';

comment on function public.assinar_newsletter(text, text) is
  'Inscreve na newsletter sem revelar se o e-mail ja era assinante. Substitui o insert direto do anonimo, cujo erro 23505 do unique(email) permitia enumerar a base.';


-- =====================================================================
-- Adocao de perfil sem login (espelhada das migrations 20260902 e 20260904)
-- =====================================================================
-- Vive aqui, e nao so na migration, porque o CI aplica schema.sql + rls.sql e
-- nunca as migrations: enquanto esta funcao ficou de fora, NENHUM teste tocava
-- nela — e foi assim que a dependencia do nome do dono passou despercebida.
create or replace function public.adotar_perfil_sem_login()
returns public.users_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  perfil public.users_profiles;
  meu_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or meu_email = '' then
    return null;
  end if;

  update public.users_profiles
     set user_id = auth.uid()
   where email = meu_email
     and user_id is null
     and role = 'customer'
  returning * into perfil;

  return perfil;
end;
$$;

revoke all on function public.adotar_perfil_sem_login() from public;
grant execute on function public.adotar_perfil_sem_login() to authenticated;

-- SEM LOGIN => SEM E-MAIL. E-mail e a chave que a adocao usa para escolher o
-- alvo, entao um perfil orfao COM e-mail e reivindicavel por quem provar aquele
-- e-mail. A importacao ja respeita isso (api/admin/clients/import.ts:169-182);
-- a constraint impede que um INSERT manual quebre em silencio.
alter table public.users_profiles
  drop constraint if exists users_profiles_orfao_sem_email_check;
alter table public.users_profiles
  add constraint users_profiles_orfao_sem_email_check
  check (user_id is not null or email is null)
  not valid;


-- =====================================================================
-- Quiz (espelhado da migration 20260906000000)
-- =====================================================================
-- =====================================================================
-- RLS
-- =====================================================================
alter table public.quizzes enable row level security;
alter table public.quiz_responses enable row level security;

-- Leitura pública só do que está publicado — igual a `pages`.
drop policy if exists "quizzes_public_read" on public.quizzes;
create policy "quizzes_public_read" on public.quizzes
for select to anon, authenticated
using (status = 'published');

-- Quem cria quiz é `conteudo`, como paginas e blog. Pode porque NENHUM campo
-- do quiz vira HTML: tudo e texto, renderizado pelo React e portanto escapado.
-- Foi exatamente a falta disso que obrigou a travar pages.custom_html no admin.
drop policy if exists "quizzes_conteudo_all" on public.quizzes;
create policy "quizzes_conteudo_all" on public.quizzes
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "quizzes_admin_all" on public.quizzes;
create policy "quizzes_admin_all" on public.quizzes
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- RESPOSTA NAO TEM POLICY DE INSERT. De proposito.
--
-- Quem grava e a funcao abaixo, que roda como service_role. Se houvesse insert
-- publico, a pessoa mandaria o PROPRIO resultado — e o relatorio viraria
-- ficcao. E o mesmo erro que a auditoria encontrou em survey_responses, onde o
-- anonimo podia gravar `approved = true` e publicar o proprio depoimento.
drop policy if exists "quiz_responses_staff_read" on public.quiz_responses;
create policy "quiz_responses_staff_read" on public.quiz_responses
for select to authenticated
using (public.has_staff_role(array['admin', 'operacoes', 'conteudo']));


-- =====================================================================
-- responder_quiz() — o resultado é decidido AQUI, nunca no navegador
-- =====================================================================
-- Recebe só o que a pessoa escolheu. Soma os eixos, decide o desfecho, grava e
-- devolve. O cliente não tem como dizer em que resultado quer cair.
--
-- Concedida SOMENTE a service_role: quem chama é a rota de API, que aplica
-- limite por IP antes. Assim o quiz não vira mais uma escrita pública sem
-- limite — o projeto já tem quatro delas, e a auditoria registrou isso.
create or replace function public.responder_quiz(
  p_slug text,
  p_respostas jsonb,
  p_nome text default null,
  p_telefone text default null,
  p_email text default null,
  p_utm jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quizzes;
  pontos jsonb := '{}'::jsonb;
  item jsonb;
  pesos jsonb;
  eixo text;
  valor numeric;
  melhor_eixo text;
  melhor numeric;
  segundo numeric;
  chave text;
  resultado_json jsonb;
begin
  select * into q
    from public.quizzes
   where slug = p_slug and status = 'published';

  if not found then
    raise exception 'quiz nao encontrado ou nao publicado';
  end if;

  if jsonb_typeof(p_respostas) is distinct from 'array' then
    raise exception 'respostas invalidas';
  end if;

  -- Todo eixo começa em zero, para o resultado não depender de quem pontuou.
  for eixo in select jsonb_array_elements_text(q.eixos) loop
    pontos := jsonb_set(pontos, array[eixo], to_jsonb(0::numeric));
  end loop;

  for item in select * from jsonb_array_elements(p_respostas) loop
    -- Índice fora da faixa é IGNORADO, e não derruba a resposta inteira: o
    -- quiz pode ter sido editado enquanto a pessoa respondia.
    pesos := q.perguntas
             -> (item ->> 'pergunta')::int
             -> 'opcoes'
             -> (item ->> 'opcao')::int
             -> 'pesos';

    if pesos is null or jsonb_typeof(pesos) is distinct from 'object' then
      continue;
    end if;

    for eixo, valor in
      select chave_peso, (v #>> '{}')::numeric
        from jsonb_each(pesos) as e(chave_peso, v)
    loop
      -- Peso para eixo que o quiz não declarou é descartado.
      if pontos ? eixo then
        pontos := jsonb_set(
          pontos,
          array[eixo],
          to_jsonb(((pontos ->> eixo)::numeric) + coalesce(valor, 0))
        );
      end if;
    end loop;
  end loop;

  select e.chave_peso, (e.v #>> '{}')::numeric
    into melhor_eixo, melhor
    from jsonb_each(pontos) as e(chave_peso, v)
   order by (e.v #>> '{}')::numeric desc, e.chave_peso
   limit 1;

  select (e.v #>> '{}')::numeric
    into segundo
    from jsonb_each(pontos) as e(chave_peso, v)
   order by (e.v #>> '{}')::numeric desc, e.chave_peso
   offset 1 limit 1;

  -- Um eixo só, ou distância suficiente: vence o dominante. Senão, empate.
  if segundo is null or (melhor - segundo) >= q.margem_empate then
    select r ->> 'chave' into chave
      from jsonb_array_elements(q.resultados) r
     where r ->> 'eixo' = melhor_eixo
     limit 1;
  else
    select r ->> 'chave' into chave
      from jsonb_array_elements(q.resultados) r
     where r ->> 'eixo' is null
     limit 1;
  end if;

  -- Quiz mal configurado (sem resultado para o eixo vencedor, ou sem empate
  -- declarado) não pode deixar a pessoa sem resposta na tela.
  if chave is null then
    select r ->> 'chave' into chave
      from jsonb_array_elements(q.resultados) r
     limit 1;
  end if;

  if chave is null then
    raise exception 'quiz sem resultados configurados';
  end if;

  insert into public.quiz_responses (
    quiz_id, resultado, pontuacao, respostas, name, phone, email, utm
  ) values (
    q.id, chave, pontos, p_respostas,
    nullif(btrim(coalesce(p_nome, '')), ''),
    nullif(btrim(coalesce(p_telefone, '')), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    coalesce(p_utm, '{}'::jsonb)
  );

  select r into resultado_json
    from jsonb_array_elements(q.resultados) r
   where r ->> 'chave' = chave
   limit 1;

  return jsonb_build_object(
    'resultado', chave,
    'pontuacao', pontos,
    'conteudo', resultado_json
  );
end;
$$;

revoke all on function public.responder_quiz(text, jsonb, text, text, text, jsonb) from public;
grant execute on function public.responder_quiz(text, jsonb, text, text, text, jsonb) to service_role;

comment on function public.responder_quiz(text, jsonb, text, text, text, jsonb) is
  'Recebe o que a pessoa escolheu, calcula o resultado NO BANCO, grava e devolve. O resultado nunca vem do navegador: se viesse, a pessoa escreveria o proprio desfecho e o relatorio viraria ficcao — o mesmo erro que a auditoria achou em survey_responses.approved. Concedida so a service_role porque quem chama e a rota de API, que aplica limite por IP antes.';
