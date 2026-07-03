# Production Checklist

Use este checklist para homologar o fluxo interno Supabase + Stripe em modo
teste antes de publicar em producao.

## Auth

- [ ] Login Google via Supabase funciona em dev/staging.
- [ ] `users_profiles` e criado para o usuario autenticado.
- [ ] Promocao manual de admin em `users_profiles.role = 'admin'` funciona.
- [ ] Usuario `customer` recebe acesso negado em `/admin`.
- [ ] Usuario `admin` acessa dashboard, produtos, datas, reservas e pagamentos.

## Produtos

- [ ] Admin cria produto interno.
- [ ] Admin edita produto interno.
- [ ] Admin desativa produto e ele sai da vitrine publica.
- [ ] Admin cria datas disponiveis em `product_dates`.
- [ ] Produto aparece na home quando ativo.
- [ ] `/products/[slug]` carrega produto, datas, preco e disponibilidade.

## Favoritos

- [ ] Usuario autenticado favorita produto.
- [ ] Usuario autenticado remove favorito.
- [ ] `/favorites` lista favoritos do usuario logado.
- [ ] Usuario A nao ve favoritos do usuario B.

## Booking

- [ ] Usuario cria booking `pending` pelo fluxo interno.
- [ ] `product_dates.available_slots` reduz na criacao da booking.
- [ ] `expires_at` e gravado com janela de 30 minutos.
- [ ] `/account/bookings/[id]` mostra resumo da reserva.
- [ ] `/account/bookings` lista reservas do usuario logado.
- [ ] Usuario A nao ve booking do usuario B.
- [ ] Frontend nao envia preco, status ou `payment_status`.

## Expiracao

- [ ] Booking vencida pode ser expirada via `/api/bookings/expire`.
- [ ] `expire_pending_booking` muda booking para `expired`.
- [ ] `payment_status` vira `cancelled` quando a reserva pending expira.
- [ ] Vagas sao devolvidas em `product_dates.available_slots`.
- [ ] Chamar expiracao duas vezes nao devolve vaga em dobro.
- [ ] `slots_released` impede dupla liberacao.

## Stripe Interno

- [ ] `/api/payments/create-checkout-session` cria Checkout interno.
- [ ] Frontend envia somente `booking_id`.
- [ ] Checkout usa `bookings.total_amount` do banco.
- [ ] Pagamento com cartao teste aprovado recebe webhook interno.
- [ ] `checkout.session.completed` confirma `payments.status = paid`.
- [ ] `checkout.session.completed` confirma `bookings.status = confirmed`.
- [ ] Frontend nao confirma booking nem payment.
- [ ] `checkout.session.expired` marca payment pending como `cancelled`.
- [ ] `checkout.session.expired` expira booking pending e devolve vaga.
- [ ] `payment_intent.payment_failed` marca payment pending como `failed`.
- [ ] `payment_intent.payment_failed` expira booking pending quando metadata existe.
- [ ] Pagamento recebido depois de `expires_at` vira `requires_review`.
- [ ] Valor/moeda divergente vira `requires_review`.
- [ ] Webhook interno e idempotente em eventos repetidos.

## Admin

- [ ] `/admin/bookings` lista reservas internas.
- [ ] `/admin/bookings/[id]` mostra booking, produto, data, pagamentos,
  passageiros e logs.
- [ ] `/admin/payments` lista pagamentos internos.
- [ ] `/admin/payments/[id]` mostra payment, booking relacionada e logs.
- [ ] Pagamentos `requires_review` aparecem destacados.
- [ ] Dashboard mostra reservas, pagamentos, revisoes e receita paga.
- [ ] `paid` vem do webhook, nao de acao manual no frontend.

## Variaveis E Infra

- [ ] Variaveis Supabase configuradas.
- [ ] Variaveis Stripe internas configuradas.
- [ ] `NEXT_PUBLIC_SITE_URL` aponta para a URL correta do ambiente.
- [ ] Webhook interno configurado no Stripe com eventos corretos.
- [ ] Stripe Dashboard nao aponta mais para o webhook legado `/api/webhook`.
- [ ] Checkout legado nao possui ponto de entrada publico em `details.tsx`.
- [ ] Variaveis legadas `STRIPE_PUBLIC_KEY`, `STRIPE_SIGNING_SECRET` e
  `STRIPE_WEBHOOK_SECRET` foram removidas dos ambientes ativos.
- [ ] Redirect URLs do Supabase Auth configuradas.
- [ ] Build passa com `npm run build`.

## Riscos Pendentes Antes Da Producao

- [ ] NextAuth/Prisma foram removidos; auth oficial e Supabase Auth.
- [ ] `details.tsx`/RapidAPI ainda existe como vitrine externa, mas checkout
  legado foi removido.
- [ ] APIs antigas de favoritos foram removidas; favoritos atuais usam
  Supabase.
- [ ] Chave publica RapidAPI antiga nao existe em envs, docs ou codigo runtime.
- [ ] RapidAPI usa apenas `RAPIDAPI_KEY` no backend.
- [ ] Webhook legado `/api/webhook`, checkout legado
  `/api/create-checkout-session` e writer legado `/api/post-booking` foram
  removidos; confirmar que nao existem webhooks Stripe antigos apontando para
  eles.
- [ ] Nao ha cron automatico definitivo para expirar bookings pending antigas.
- [ ] Nao ha fluxo de refund/reembolso.
- [ ] Nao ha upload Supabase Storage implementado.
- [ ] Passageiros completos no checkout interno ainda podem precisar de
  evolucao operacional.
- [ ] Telas admin de acao/resolucao manual ainda sao leitura operacional.
