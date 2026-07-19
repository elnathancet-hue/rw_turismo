# Payments Migration

## Internal Checkout

Internal Supabase bookings can now start a Stripe Checkout flow from a
`pending` booking.

This checkout is separate from the legacy RapidAPI hotel pages.
The old `/api/create-checkout-session`, `/api/webhook` and `/api/post-booking`
endpoints were removed in Etapa 21. NextAuth and Prisma were removed in Etapa
22. `details.tsx` still exists for RapidAPI browsing, but no longer starts or
confirms Stripe payments.

## Internal Checkout Flow

1. User creates a `pending` booking through the internal booking flow.
2. User opens `/account/bookings/[id]`.
3. If the booking is still `pending`, unpaid and not expired, the page shows
   `Pagar agora`.
4. The frontend calls `POST /api/payments/create-checkout-session` with only
   `booking_id`.
5. The API validates the Supabase Auth user.
6. `src/lib/payments/createInternalCheckoutSession.ts` uses the Supabase
   service role only on the backend.
7. The helper loads the booking from Supabase and validates ownership, status,
   payment status and `expires_at`.
8. The helper creates or reuses a `payments` row with `status = pending`.
9. Stripe Checkout is created using `bookings.total_amount` from the database.
10. The Stripe Checkout Session receives metadata:
   `booking_id`, `payment_id`, `user_id` and `source = internal_booking`.
11. The Checkout Session id is saved on both `bookings` and `payments`.
12. The frontend redirects to the `checkout_url` returned by the backend.

## Security Rules

The frontend never sends price, product information, status or payment status.
The backend uses the booking amount stored in Supabase and converts it to cents
before creating the Stripe session.
The checkout API only creates a session while `expires_at` is still in the
future. The internal webhook must validate expiration again before confirming a
booking, because Stripe's Checkout Session lifetime is separate from the
30-minute booking hold.

The Supabase service role remains restricted to backend helper/API code.
No service role key is used in browser code.

## Payment State

The `payments` row remains `pending` in this step.
The booking is not confirmed by the frontend and is not marked as paid by the
checkout creation API.

The return pages only tell the user that the payment is being processed or that
the checkout was cancelled.

The legacy `/success` page is now a neutral compatibility page. It does not
confirm payment or booking in the frontend and points users to
`/account/bookings`, which is the new reservation history.

## Next Step

An internal Stripe webhook now exists at:

`POST /api/payments/webhook`

This endpoint replaced the legacy `/api/webhook` used by the old RapidAPI hotel
checkout flow.

## Internal Webhook

Configure a separate Stripe webhook endpoint pointing to:

`https://your-site.example/api/payments/webhook`

Use `STRIPE_INTERNAL_WEBHOOK_SECRET` for this endpoint's signing secret.
The endpoint reads the raw body, validates the Stripe signature, and currently
handles:

`checkout.session.completed`
`checkout.session.expired`
`payment_intent.payment_failed`

Future events to handle include:

`charge.refunded`

## Confirmation Rules

The webhook confirms an internal booking only after checking all of the
following against Supabase:

`metadata.source = internal_booking`
`booking_id`, `payment_id` and `user_id` exist
The payment belongs to the booking
The user id matches payment and booking
Stripe `amount_total` matches `bookings.total_amount`
Stripe currency is `BRL`
Booking is still `pending`
Booking `payment_status` is still `pending`
Booking has not passed `expires_at`

When all checks pass, the webhook marks:

`payments.status = paid`
`payments.paid_at = now`
`bookings.status = confirmed`
`bookings.payment_status = paid`
`bookings.confirmed_at = now`

The Stripe Checkout Session id and Payment Intent id are stored on both records
where applicable.

## Idempotency

If Stripe retries `checkout.session.completed` after the payment is already
`paid` and the booking is already `confirmed`, the webhook returns success and
does not duplicate actions, create another payment, or release inventory.

Important events are recorded in `system_logs` when possible:

`payment_confirmed`
`payment_ignored_duplicate`
`payment_requires_review`
`payment_invalid_metadata`

Log write failures do not block payment processing.

## Negative Events

`checkout.session.expired` and `payment_intent.payment_failed` are handled by
the internal webhook.

For `checkout.session.expired`, the webhook validates
`metadata.source = internal_booking`, checks `booking_id`, `payment_id` and
`user_id` against Supabase, and marks a still-pending payment as `cancelled`.

For `payment_intent.payment_failed`, the webhook uses the metadata copied into
`payment_intent_data` by the internal checkout helper. If the metadata is
missing, the event is logged as invalid metadata and ignored safely.
When metadata is valid, a still-pending payment is marked as `failed`.

In both negative event paths, the webhook never cancels a payment already
`paid` and never expires a booking already `confirmed`.
If the booking is still pending and unpaid, the webhook calls the
`expire_pending_booking` RPC. That RPC is responsible for marking the booking
`expired` and returning held inventory exactly once through `slots_released`.

The negative event logs are:

`checkout_expired`
`payment_failed`
`booking_expired`
`booking_expire_skipped_paid`
`booking_expire_duplicate`

## Late Or Invalid Payments

If Stripe reports a completed payment after `bookings.expires_at`, or the
amount/currency/status relationship is not safe to confirm automatically, the
webhook does not confirm the booking.

Instead, it marks:

`payments.status = requires_review`
`bookings.payment_status = requires_review`

The booking remains unconfirmed for manual review or refund handling.

## Admin Review

Admins can inspect bookings and payments from the admin panel:

`/admin/bookings`
`/admin/payments`

The admin screens are read-only for this step and use Supabase RLS admin access
through the browser anon client. They do not use service role in frontend code.
Payments with `requires_review` must be analyzed manually against Stripe before
any refund or operational resolution. Payments should not be marked `paid`
manually; successful payment confirmation comes from the signed internal
webhook.

## Reservation History

The new reservation history is `/account/bookings`.
The legacy `/bookings` route now redirects users to `/account/bookings` and no
longer calls Prisma. The old `/api/get-bookings` endpoint was removed.

Na Etapa 20, o ponto de entrada do checkout legado foi isolado: `details.tsx`
nao carrega mais Stripe e nao chama `/api/create-checkout-session`. Na Etapa
21, `/api/create-checkout-session`, `/api/webhook` e `/api/post-booking` foram
removidos. Os detalhes externos via RapidAPI ainda podem ser visualizados, mas
reservas online usam apenas o fluxo interno de produtos Supabase.

## Next Steps

Implement refund handling, operational resolution actions for `requires_review`
payments, and a cron/job endpoint to expire stale pending bookings that never
receive a Stripe event.
