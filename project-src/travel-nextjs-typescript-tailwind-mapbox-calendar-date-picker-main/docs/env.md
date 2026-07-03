# Environment Variables

## Supabase

`NEXT_PUBLIC_SUPABASE_URL`
URL publica do projeto Supabase. Usada pelo browser e pelo backend.

`NEXT_PUBLIC_SUPABASE_ANON_KEY`
Anon key publica do Supabase. Usada pelo browser com RLS.

`SUPABASE_SERVICE_ROLE_KEY`
Chave privada para backend, webhooks e rotas server-side seguras. Nunca usar no
frontend.

## Stripe Interno

`STRIPE_SECRET_KEY`
Chave secreta Stripe em modo teste/producao. Usada apenas no backend.

`STRIPE_INTERNAL_WEBHOOK_SECRET`
Signing secret do endpoint interno `/api/payments/webhook`.

`NEXT_PUBLIC_SITE_URL`
URL base publica do app. Usada para `success_url`, `cancel_url` e callbacks.

## Auth E Banco

NextAuth e Prisma foram removidos na Etapa 22. Nao use mais:

`NEXTAUTH_URL`
`NEXTAUTH_SECRET`
`GOOGLE_CLIENT_ID`
`GOOGLE_CLIENT_SECRET`
`DATABASE_URL`
`SHADOW_DATABASE_URL`

Google OAuth deve ser configurado no painel do Supabase Auth. O banco oficial e
o PostgreSQL do Supabase, provisionado pelos arquivos em `supabase/`.

Observacao: `STRIPE_PUBLIC_KEY`, `STRIPE_SIGNING_SECRET` e
`STRIPE_WEBHOOK_SECRET` pertenciam ao checkout/webhook legado removido na Etapa
21. O checkout interno atual redireciona usando `checkout_url` vindo do backend
e nao precisa de chave publica Stripe no frontend.

## Mapbox E RapidAPI

`MAPBOX_API_KEY`
Chave privada Mapbox, quando usada no backend.

`NEXT_PUBLIC_MAPBOX_TOKEN`
Token publico Mapbox usado pelo legado no browser.

`RAPIDAPI_KEY`
Chave privada RapidAPI. Usada somente no backend, inclusive pela rota
`/api/rapidapi/city-suggestions`. Nao exponha chave RapidAPI no browser.

## Firebase Legado

As variaveis `FIREBASE_CLIENT_*` ainda podem existir por compatibilidade com o
projeto original. Revisar e remover apenas em etapa dedicada ao legado.
