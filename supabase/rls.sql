-- Row Level Security policies for the tourism booking platform.
-- Run this file after schema.sql.

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
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;

create or replace function public.prevent_customer_profile_identity_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_admin()
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
before update on public.users_profiles
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
drop policy if exists "profiles_insert_own_customer" on public.users_profiles;
create policy "profiles_insert_own_customer"
on public.users_profiles
for insert
to authenticated
with check (user_id = auth.uid() and role = 'customer');

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

-- Products: public users can see only active products.
drop policy if exists "products_select_active" on public.products;
create policy "products_select_active"
on public.products
for select
to anon, authenticated
using (active = true);

-- Products: admins can create, edit and delete products.
drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all"
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Product dates: public users can see only active dates for active products.
drop policy if exists "product_dates_select_active_products" on public.product_dates;
create policy "product_dates_select_active_products"
on public.product_dates
for select
to anon, authenticated
using (
  active = true
  and exists (
    select 1
    from public.products
    where products.id = product_dates.product_id
      and products.active = true
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

-- Categories: public users can see active categories.
drop policy if exists "categories_select_active" on public.categories;
create policy "categories_select_active"
on public.categories
for select
to anon, authenticated
using (active = true);

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
  )
  and exists (
    select 1
    from public.categories
    where categories.id = product_categories.category_id
      and categories.active = true
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

drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read" on public.site_settings
for select to anon, authenticated using (true);
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

drop policy if exists "newsletter_public_insert" on public.newsletter_subscribers;
create policy "newsletter_public_insert" on public.newsletter_subscribers
for insert to anon, authenticated with check (active = true and source in ('home', 'blog'));
drop policy if exists "newsletter_admin_read" on public.newsletter_subscribers;
create policy "newsletter_admin_read" on public.newsletter_subscribers
for select to authenticated using (public.is_admin());
drop policy if exists "newsletter_admin_update" on public.newsletter_subscribers;
create policy "newsletter_admin_update" on public.newsletter_subscribers
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public_read_site_assets" on storage.objects;
create policy "public_read_site_assets" on storage.objects
for select to public using (bucket_id in ('site-assets', 'product-images', 'blog-images'));
drop policy if exists "admin_manage_site_assets" on storage.objects;
create policy "admin_manage_site_assets" on storage.objects
for all to authenticated
using (bucket_id in ('site-assets', 'product-images', 'blog-images') and public.is_admin())
with check (bucket_id in ('site-assets', 'product-images', 'blog-images') and public.is_admin());
