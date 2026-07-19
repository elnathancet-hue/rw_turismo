# Bookings Migration

## Current State

Internal Supabase products can now create a `pending` booking through a backend API route.
This flow is separate from the legacy RapidAPI hotel checkout and does not call Stripe yet.

## Flow

1. User opens `/products/[slug]`.
2. User selects an available `product_dates` row.
3. User enters traveler count and customer details.
4. The frontend calls `POST /api/bookings/create-pending`.
5. The API validates the Supabase Auth user with the server anon client.
6. `src/lib/bookings/createPendingBooking.ts` calls the Supabase RPC `create_pending_booking_transaction`.
7. The RPC validates product, date, ownership between product/date, slot count and price inside the database.
8. The booking is created with `status = pending`, `payment_status = pending`, and `expires_at = now() + 30 minutes`.
9. `product_dates.available_slots` is reduced in the same database transaction.
10. The user is redirected to `/account/bookings/[id]`.

## Security

Regular users still cannot insert bookings directly because RLS blocks client-side inserts.
The frontend does not send or control the booking price.
The backend does not accept `total_amount`, `status` or `payment_status` from the client.
The database RPC calculates `total_amount` using `price_override`, then `promotional_price`, then `price`.
Service role is used only inside backend API routes/helpers.

## Availability

Pending bookings now hold inventory for 30 minutes.
The slot decrement happens atomically in `create_pending_booking_transaction` using row locks, preventing two simultaneous users from consuming the same slots.

Expired pending bookings are handled by `expire_pending_booking`.
The function changes `status` to `expired`, changes `payment_status` to `cancelled`, and returns the held slots to `product_dates.available_slots`.
The `slots_released` flag prevents double slot release if the function is called more than once.

There is no automatic cron/job yet.
For now, `/account/bookings/[id]` can call `POST /api/bookings/expire` when the user opens an expired pending booking.
The internal Stripe webhook also calls `expire_pending_booking` when it receives
`checkout.session.expired` or a valid `payment_intent.payment_failed` event for
an internal booking that is still pending and unpaid.
A future backend job or Vercel Cron endpoint should periodically expire stale
pending bookings that never receive a Stripe event and are not opened by the
user.

## Payments

Internal Stripe Checkout now creates or reuses a `payments` row with
`status = pending`.
The internal webhook confirms a booking only after a signed
`checkout.session.completed` event validates against Supabase.
Negative Stripe events can mark payments as `cancelled` or `failed` and expire
the booking through the same RPC that returns inventory safely.
Late or inconsistent successful payments are marked as `requires_review` instead
of confirming the booking automatically.

## Legacy Flow

The old `/api/get-bookings` route was removed after `/bookings` became a bridge
to `/account/bookings`.
In Etapa 21, the old Stripe checkout API, legacy webhook and legacy
`/api/post-booking` writer were removed after `details.tsx` stopped exposing a
public checkout entry point.

The official booking history is `/account/bookings`.
New bookings use Supabase RPCs and do not use Prisma.

## Removed `/api/post-booking`

`/api/post-booking` was the last known active legacy booking writer using
Prisma. It was called only by the legacy `/api/webhook` after a legacy Stripe
`checkout.session.completed` event. Both routes were removed together in Etapa
21.

Current legacy Prisma fields:

`sessionId`, `hotelId`, `description`, `startDate`, `endDate`, `img`, `lat`,
`location`, `long`, `price`, `star`, `title`, `total`, `userEmail`, `cityId`.

The route does not perform the same validations as the Supabase booking flow.
It does not calculate price in the database, does not manage inventory, does
not create `payments`, and does not use the transactional booking RPC.

Post-removal checks:

1. Confirm no production Stripe endpoint still sends events to `/api/webhook`.
2. Preserve or export old Prisma booking history if needed.
3. Preserve/export old Prisma booking history only from backups or the old
   database, if the business still needs it.
