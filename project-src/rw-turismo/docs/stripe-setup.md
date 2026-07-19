# Stripe Setup

## Endpoints

Endpoint interno novo:

`/api/payments/webhook`

Endpoint legado removido na Etapa 21:

`/api/webhook`

Nao configure novos eventos Stripe para o endpoint legado. O fluxo oficial usa
somente o webhook interno.

## Eventos Do Webhook Interno

Configure o endpoint interno no Stripe para escutar:

`checkout.session.completed`
`checkout.session.expired`
`payment_intent.payment_failed`

O endpoint interno valida assinatura com `STRIPE_INTERNAL_WEBHOOK_SECRET`, le o
raw body e processa apenas eventos com `metadata.source = internal_booking`.

## Stripe CLI Em Desenvolvimento

1. Instale e autentique a Stripe CLI.
2. Rode o app local em `http://localhost:3000`.
3. Encaminhe eventos para o webhook interno:

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

4. Copie o signing secret exibido pela CLI para:

```env
STRIPE_INTERNAL_WEBHOOK_SECRET=whsec_...
```

5. Gere eventos de teste pelo Dashboard Stripe, Checkout real em modo teste ou
Stripe CLI.

## Cartoes Teste Basicos

Pagamento aprovado:

`4242 4242 4242 4242`

Pagamento recusado generico:

`4000 0000 0000 0002`

Autenticacao 3D Secure:

`4000 0025 0000 3155`

Use qualquer data futura, CVC valido e CEP de teste.

## Checkout Interno

O checkout interno nasce de uma booking `pending` do Supabase.
O frontend envia somente `booking_id`.
O backend busca `bookings.total_amount`, cria/reusa `payments.status = pending`
e cria a Stripe Checkout Session.

Metadata enviada:

`booking_id`
`payment_id`
`user_id`
`source = internal_booking`

A mesma metadata tambem e copiada para `payment_intent_data`, permitindo tratar
`payment_intent.payment_failed`.

## Webhook Interno

`checkout.session.completed`:

- valida metadata contra Supabase
- compara valor e moeda
- confirma payment como `paid`
- confirma booking como `confirmed`
- e idempotente para retries

`checkout.session.expired`:

- cancela payment pending
- expira booking pending via RPC
- devolve vaga uma unica vez

`payment_intent.payment_failed`:

- marca payment pending como `failed`
- expira booking pending via RPC quando metadata existir

Pagamentos tardios, expirados ou divergentes viram `requires_review`.

## Checkout Legado

O checkout legado baseado em `/api/create-checkout-session`, `/api/webhook` e
`/api/post-booking` foi removido na Etapa 21. `details.tsx`/RapidAPI pode
continuar como vitrine externa, mas nao inicia pagamento.

O unico checkout ativo e o interno:

`/api/payments/create-checkout-session`

O unico webhook Stripe ativo e o interno:

`/api/payments/webhook`
