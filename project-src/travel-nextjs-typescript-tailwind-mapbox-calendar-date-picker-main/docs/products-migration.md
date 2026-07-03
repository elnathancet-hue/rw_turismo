# Products Migration

## Current State

Internal tourism products now come from Supabase tables:

- `products`
- `product_dates`
- `categories`
- `product_categories`

The homepage uses Supabase products as the main storefront source and falls back to local minimal products if Supabase is unavailable during build.

## New Helpers

Product helpers live in:

- `src/lib/products/client.ts`
- `src/lib/products/server.ts`
- `src/lib/products/types.ts`

They use the public Supabase client and RLS. No service role key is used for public product reads.

## Pages

The new internal product page is:

- `/products/[slug]`

It displays product details, available dates, pricing and a future reservation button. It does not call Stripe, create bookings or change reservation state.

## Legacy Flow

The old `src/pages/details.tsx` page remains in place for the external RapidAPI hotel flow and old checkout path.
RapidAPI search is not migrated in this step.
Checkout, webhook, bookings and payments are unchanged.

## Next Steps

The next migration step can prepare internal bookings for Supabase products or begin an admin surface for product/date management.
