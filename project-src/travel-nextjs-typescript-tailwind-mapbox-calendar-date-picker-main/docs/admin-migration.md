# Admin Migration

## Internal Operations

The admin panel now includes read-only operational screens for internal
Supabase bookings and Stripe payments:

`/admin/bookings`
`/admin/bookings/[id]`
`/admin/payments`
`/admin/payments/[id]`

These screens use the browser Supabase anon client and rely on RLS admin
policies through `users_profiles.role = admin`.
No service role key is used in frontend code.

## Bookings

Admins can list bookings with customer, product, product date, traveler count,
amount, booking status, payment status, expiration and creation timestamps.

The detail page shows booking data, product/date data, related payments,
passengers and direct `system_logs` entries for the booking.

Administrative write actions are intentionally not implemented in this step.
Bookings should not be marked confirmed manually from the frontend; paid
confirmation must come from the signed internal Stripe webhook.

## Payments

Admins can list payments with booking id, customer, amount, currency, status,
provider, Stripe Checkout Session id, Stripe Payment Intent id, paid timestamp
and creation timestamp.

The detail page shows payment data, related booking/product data and direct
`system_logs` entries for the payment.

Payments with `requires_review` are highlighted for manual analysis. Refunds,
manual reconciliation notes and operational resolution actions are not
implemented yet.

## Dashboard

The admin dashboard now includes internal booking and payment metrics:

Total bookings
Pending bookings
Confirmed bookings
Bookings requiring review
Paid payments
Failed/review payments
Paid revenue total

## Limits

The admin screens use Supabase Auth/RLS. The legacy checkout/webhook were
removed in Etapa 21, and NextAuth/Prisma were removed in Etapa 22.

Future admin steps can add safe actions such as cancellation notes,
requires-review resolution workflows and refund tracking, but payment should
not be marked `paid` manually without Stripe reconciliation.
