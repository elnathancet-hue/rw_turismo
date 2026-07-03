# Favorites Migration

## Current State

Favorites now use Supabase Auth and the `public.favorites` table.
The migrated `/favorites` page reads the authenticated user's favorites directly through Supabase RLS.
The favorite action in legacy external hotel cards writes RapidAPI hotels as external favorites with `provider = 'rapidapi'` through the Supabase browser client.

## Data Model

The `favorites` table supports two favorite types:

- internal products through `product_id`
- external hotels through `external_hotel_id` and `provider`

External hotel details are stored in `metadata` so the old RapidAPI search flow can keep working until products are fully migrated.

## Security

Client code uses the browser Supabase client only.
No service role key is used in the frontend.
RLS requires `user_id = auth.uid()` for insert, select, update and delete by regular users.

## Removed Legacy APIs

The old Prisma/NextAuth API routes for favorites were removed in Etapa 16:

- `src/pages/api/post-favorite`
- `src/pages/api/get-favorites`
- `src/pages/api/delete-favorite`

Favorites now use `src/lib/favorites/client.ts`.
Prisma and NextAuth were removed in Etapa 22. Favorites continue using
Supabase Auth and RLS.

## Still Pending

- Bookings still use the old flow.
- Checkout and webhook still use the old flow.
- Prisma and NextAuth were removed after the remaining runtime usage was
  cleared.
