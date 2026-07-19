# Legacy Audit

Auditoria iniciada na Etapa 15 e atualizada ate a Etapa 22.

## Estado Final Da Etapa 22

Esta secao prevalece sobre o historico das etapas anteriores mantido abaixo
para rastreabilidade.

Resultado da busca final em runtime:

- NextAuth: nenhum uso ativo em `src`.
- Prisma: nenhum uso ativo em `src`.
- Checkout legado: removido.
- Webhook legado: removido.
- `/api/post-booking`: removido.
- Checkout interno `/api/payments/create-checkout-session`: mantido.
- Webhook interno `/api/payments/webhook`: mantido.

Removidos na Etapa 22:

- `src/pages/api/auth/[...nextauth].ts`
- `src/server/common/get-server-auth-session.tsx`
- `src/server/db/prismadb.ts`
- pasta `prisma/`
- `SessionProvider` de `src/pages/_app.tsx`
- imports `next-auth` remanescentes em `search.tsx`, `details.tsx`,
  `InfoCard` e `src/types/typings.d.ts`
- dependencias `next-auth`, `@next-auth/prisma-adapter`, `@prisma/client` e
  `prisma`
- variaveis `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `DATABASE_URL` e `SHADOW_DATABASE_URL`

Fluxo oficial atual:

- Supabase Auth para autenticacao.
- Supabase PostgreSQL/RLS para dados e autorizacao.
- Stripe interno para checkout e webhook.

RapidAPI/search/details continuam temporariamente como vitrine externa sem
checkout legado e sem NextAuth. Na Etapa 23, a chave RapidAPI foi movida para
backend privado via `RAPIDAPI_KEY`.

## Resumo Executivo

O fluxo novo Supabase + Stripe interno ja existe e agora e o unico fluxo de
checkout ativo. O projeto ainda mantem partes legadas com NextAuth, Prisma e
RapidAPI, mas o checkout Stripe antigo, o webhook antigo e o writer legado de
bookings foram removidos na Etapa 21.

Etapa 16 removeu as APIs antigas de favoritos baseadas em Prisma/NextAuth e
migrou o `InfoCard` para usar `src/lib/favorites/client.ts`.

Etapa 17 neutralizou `/success` e transformou `/bookings` em ponte para
`/account/bookings`, removendo dessas duas paginas a dependencia direta de
NextAuth, Prisma e `/api/get-bookings`.

Etapa 18 removeu `/api/get-bookings`, porque nao havia mais chamadas ativas. O
endpoint `/api/post-booking` foi mantido naquela etapa porque ainda era chamado
pelo webhook legado `/api/webhook`.

Etapa 20 isolou o checkout legado: `details.tsx` continua exibindo detalhes
RapidAPI e favoritos Supabase, mas nao carrega Stripe e nao chama mais
`/api/create-checkout-session`. O webhook legado e `/api/post-booking` foram
preservados sem alteracao naquela etapa para compatibilidade com eventos
pendentes.

Etapa 21 removeu `/api/create-checkout-session`, `/api/webhook` e
`/api/post-booking`. O checkout interno `/api/payments/create-checkout-session`
e o webhook interno `/api/payments/webhook` permanecem intactos.

Remover dependencias agora quebraria partes ainda roteaveis:

- `/details`
- `/search`
- `/api/auth/[...nextauth]`

## 1. Dependencias De NextAuth

| Arquivo | Linha aprox. | Funcao atual | Remover agora? |
| --- | ---: | --- | --- |
| `package.json` | 12, 24 | Mantem `@next-auth/prisma-adapter` e `next-auth`. | Nao. Remover so depois de migrar paginas/APIs legadas. |
| `src/pages/_app.tsx` | 2, 20 | Envolve o app com `SessionProvider`. | Nao. Primeiro remover paginas que usam `getSession`/`Session`. |
| `src/pages/api/auth/[...nextauth].ts` | 1-15 | Endpoint NextAuth com GoogleProvider e PrismaAdapter. | Nao. Depende de decisao de desligar login legado. |
| `src/server/common/get-server-auth-session.tsx` | 2, 13 | Wrapper de `unstable_getServerSession`. | Migrar/remover depois; parece infra legado. |
| `src/types/typings.d.ts` | 1 | Importa tipos de `next-auth` e tipos de `Session`. | Remover depois de migrar paginas/componentes legados. |
| `src/pages/details.tsx` | 9-10, 337, 351 | Usa `Session`, `getSession` e `signOut` no fluxo RapidAPI/detalhe legado. | Nao. Precisa migrar/remover `/details`. |
| `src/pages/search.tsx` | 4-5, 111, 125 | Usa `Session`, `getSession` e `signOut` no fluxo de busca externa. | Nao. Precisa migrar/remover busca externa. |
| `src/pages/bookings.tsx` | Etapa 17 | Ponte para `/account/bookings`, sem NextAuth. | Migrado. |
| `src/pages/success.tsx` | Etapa 17 | Pagina neutra de compatibilidade, sem NextAuth e sem confirmacao frontend. | Migrado. |
| `src/components/InfoCard.tsx` | 8 | Tipagem `Session` em card do fluxo de hotel externo. | Migrar junto com RapidAPI/search. |
| `README.md`, `docs/env.md`, `.env.example` | varios | Documentam `NEXTAUTH_URL` e `NEXTAUTH_SECRET`. | Manter enquanto legado existir. |

Observacao: `signInWithSupabaseGoogle`, `signOutFromSupabase` e
`useSupabaseSession` nao sao NextAuth; fazem parte do fluxo Supabase novo.

## 2. Dependencias De Prisma

| Arquivo | Funcao atual | Runtime? | Relacao |
| --- | --- | --- | --- |
| `package.json` | Dependencias `@prisma/client`, `prisma` e script `vercel-build` com `prisma generate && prisma migrate deploy`. | Sim, em build/deploy. | NextAuth e APIs antigas. |
| `prisma/schema.prisma` | Modelos do banco legado, incluindo schema recomendado do NextAuth. | Sim, para gerar client/migrations. | NextAuth adapter e dados legados. |
| `prisma/migrations/*` | Historico de migracoes do banco legado. | Build/deploy se Prisma ainda rodar. | Prisma legado. |
| `src/server/db/prismadb.ts` | Instancia singleton de `PrismaClient`. | Sim. | Usado por NextAuth e APIs antigas. |
| `src/pages/api/auth/[...nextauth].ts` | `PrismaAdapter(prisma)`. | Sim. | NextAuth. |
| `src/pages/api/post-booking/index.ts` | Removido na Etapa 21. Criava booking legado apos webhook antigo. | Nao. | Checkout/webhook legado removido. |
| `.env.example`, `docs/env.md` | `DATABASE_URL`, `SHADOW_DATABASE_URL` documentados/necessarios ao Prisma. | Sim enquanto Prisma existir. | Prisma legado. |

Conclusao: Prisma ainda esta no runtime por causa de NextAuth/PrismaAdapter e
historico/schema legado, mas nao ha mais endpoint ativo de booking legado via
Prisma.

## 3. Checkout E Webhook Legado

| Arquivo/Variavel | Linha aprox. | Uso | Risco de manter | Risco de remover agora |
| --- | ---: | --- | --- | --- |
| `src/pages/api/create-checkout-session.ts` | Etapa 21 | Removido. Criava Stripe Checkout antigo com dados enviados pelo cliente e `NEXTAUTH_URL`. | Nao se aplica. | Removido apos isolamento em `details.tsx`. |
| `src/pages/api/webhook.ts` | Etapa 21 | Removido. Webhook antigo usava `STRIPE_SIGNING_SECRET` e chamava `/api/post-booking`. | Nao se aplica. | Removido junto com `/api/post-booking`. |
| `src/pages/api/post-booking/index.ts` | Etapa 21 | Removido. Gravava booking legado via Prisma. | Nao se aplica. | Removido junto com webhook legado. |
| `src/pages/details.tsx` | Etapa 20 | Busca detalhes RapidAPI e mostra aviso/link para pacotes internos; nao chama checkout legado. | Mantem vitrine externa sem compra externa. | Pode ser migrado/removido depois. |
| `.env.local.example` | Etapa 21 | `STRIPE_PUBLIC_KEY` e `STRIPE_SIGNING_SECRET` removidos. | Reduz ambiguidade com fluxo interno. | Nao remover `STRIPE_SECRET_KEY`, usado pelo interno. |
| `.env.example` | Etapa 21 | `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLIC_KEY` e `STRIPE_SIGNING_SECRET` removidos. | Reduz ambiguidade com fluxo interno. | Nao remover `STRIPE_INTERNAL_WEBHOOK_SECRET`. |
| `src/lib/env.ts` | Etapa 21 | `getStripeEnv()` e `STRIPE_WEBHOOK_SECRET` removidos. | Nao se aplica. | Interno usa `getStripeCheckoutEnv()` e `getStripeInternalWebhookEnv()`. |

Variaveis legadas relacionadas:

- `NEXTAUTH_URL` permanece porque NextAuth ainda existe.
- `STRIPE_PUBLIC_KEY`, `STRIPE_SIGNING_SECRET`, `STRIPE_WEBHOOK_SECRET` e
  `stripe_public_key` foram removidos das referencias ativas da aplicacao na
  Etapa 21.

## 3.1 Contrato `/api/webhook` Para `/api/post-booking`

Status da Etapa 19: auditado e preservado sem alteracao de comportamento.
Status da Etapa 21: removido junto com `/api/create-checkout-session`.

Fluxo historico removido:

1. `src/pages/api/webhook.ts` recebe evento Stripe legado.
2. O webhook valida assinatura com `STRIPE_SIGNING_SECRET`.
3. Em `checkout.session.completed`, chama `fulfillBooking(session)`.
4. `fulfillBooking` monta um body a partir de `session.metadata` e
   `session.amount_total`.
5. O webhook faz `POST ${NEXTAUTH_URL}/api/post-booking`.
6. `src/pages/api/post-booking/index.ts` cria um registro Prisma `Booking`.

Campos enviados pelo webhook legado:

| Campo | Origem no Stripe Session |
| --- | --- |
| `userEmail` | `session.metadata.email` |
| `sessionId` | `session.id` |
| `amountTotal` | `session.amount_total / 100` |
| `images` | `JSON.parse(session.metadata.images)` |
| `hotelId` | `session.metadata.hotelId` |
| `description` | `session.metadata.description` |
| `img` | `session.metadata.img` |
| `location` | `session.metadata.location` |
| `lat` | `session.metadata.lat` |
| `long` | `session.metadata.long` |
| `price` | `session.metadata.price` |
| `star` | `session.metadata.star` |
| `title` | `session.metadata.title` |
| `total` | `session.metadata.total` |
| `cityId` | `session.metadata.cityId` |
| `startDate` | `session.metadata.startDate` |
| `endDate` | `session.metadata.endDate` |

Campos esperados por `/api/post-booking`:

`userEmail`, `sessionId`, `hotelId`, `description`, `img`, `location`, `lat`,
`long`, `price`, `star`, `title`, `total`, `cityId`, `startDate`, `endDate`.

Observacoes:

- `amountTotal` e `images` sao enviados pelo webhook, mas nao sao gravados pelo
  `post-booking` atual.
- `lat`, `long`, `star` e `total` sao convertidos com `Number(...)`.
- Nao ha validacao explicita de metodo HTTP em `/api/post-booking`.
- Nao ha validacao de campos obrigatorios antes de chamar Prisma.
- Nao ha validacao de ownership/autenticacao nesse endpoint; a protecao depende
  do webhook legado chamar a rota depois da verificacao de assinatura Stripe.
- Nao ha validacao de duplicidade alem da constraint Prisma `sessionId @unique`.
- Nao ha tratamento local de erro no `post-booking`.

Modelo Prisma usado:

`Booking` em `prisma/schema.prisma`.

Campos gravados:

`sessionId`, `hotelId`, `description`, `startDate`, `endDate`, `img`, `lat`,
`location`, `long`, `price`, `star`, `title`, `total`, `userEmail`, `cityId`.

Riscos de migrar/remover:

- Remover `/api/post-booking` antes de remover `/api/webhook` quebra a gravacao
  de reservas do checkout legado.
- Alterar nomes de metadata quebra o contrato com `/api/create-checkout-session`.
- Migrar sem historico pode deixar bookings legados somente no banco Prisma.
- O fluxo legado confia em metadata antiga; o equivalente novo precisa validar
  booking/payment no Supabase, como o webhook interno ja faz.

Equivalente futuro em Supabase:

- Encerrar `/api/create-checkout-session` e `/api/webhook` legados.
- Criar reservas somente via `create_pending_booking_transaction`.
- Criar checkout somente via `/api/payments/create-checkout-session`.
- Confirmar reserva somente via `/api/payments/webhook` interno.
- Se reservas externas continuarem, modelar produto/data externa em tabelas
  Supabase ou criar fluxo separado com validacoes de preco, usuario e metadata.

## 3.2 Remocao Do Checkout Legado

Estrategia escolhida na Etapa 20: Opção A/B conservadora.

- Manter `details.tsx` e RapidAPI como vitrine externa temporaria.
- Remover o ponto de entrada do usuario para o checkout legado.
- Substituir o botao `Express Booking` por aviso de que reservas online estao
  disponiveis apenas nos pacotes internos.
- Remover `/api/create-checkout-session`, `/api/webhook` e `/api/post-booking`
  na Etapa 21 depois da confirmacao de que nao havia chamada publica ativa.
- Nao alterar o fluxo novo Supabase/Stripe.

Arquivos removidos na Etapa 21:

- `src/pages/api/create-checkout-session.ts`
- `src/pages/api/webhook.ts`
- `src/pages/api/post-booking/index.ts`

Cuidados pos-remocao:

1. Confirmar no Stripe Dashboard que nao ha endpoint ativo apontando para
   `/api/webhook`.
2. Manter apenas `/api/payments/create-checkout-session` e
   `/api/payments/webhook` para pagamentos.
3. Remover Prisma/NextAuth em etapa propria, sem misturar com a remocao do
   checkout legado.

## 4. RapidAPI, Details E Busca Externa

| Arquivo | Linha aprox. | Funcao atual | Observacao |
| --- | ---: | --- | --- |
| `src/pages/api/rapidapi/city-suggestions.ts` | Etapa 23 | Busca cidades na Hotels4/RapidAPI usando `RAPIDAPI_KEY` no backend. | Chave nao fica no browser. |
| `src/utils/getHotelList.ts` | 52-53 | Busca lista de hoteis externos via RapidAPI. | Fluxo externo ainda alimenta `/search`. |
| `src/utils/getHotelDetails.ts` | 18-19 | Busca detalhes de hotel externo via RapidAPI. | Alimenta `/details`. |
| `src/pages/search.tsx` | 4-125 | Pagina SSR/client do resultado externo com NextAuth. | Precisa decisao produto: remover ou migrar para produtos internos. |
| `src/pages/details.tsx` | Etapa 20 | Detalhe de hotel externo por `hotelId`, sem checkout legado. | Ainda depende de RapidAPI e NextAuth para sessao/tipagem. |
| `src/components/InfoCard.tsx` | 40, 66, 83, 96 | Card de hotel externo, favorito Supabase e link para details. | Ainda depende de NextAuth para tipagem/sessao do fluxo externo, mas favoritos ja usam Supabase. |
| `src/pages/api/post-booking/index.ts` | Etapa 21 | Removido. Criava booking legado apos webhook antigo. | Fluxo encerrado. |

Fluxo atual da busca externa:

1. `search.tsx` recebe parametros de busca e usa utils RapidAPI.
2. Cards externos levam para `details.tsx` com `hotelId`.
3. `details.tsx` busca detalhes externos e permite favorito Supabase.
   O checkout legado foi desabilitado na Etapa 20.
4. Nao ha checkout externo ativo em `/details`.
5. `/bookings` redireciona o usuario para `/account/bookings`.

Decisao de produto pendente: manter busca externa como descoberta complementar
ou substituir por produtos internos Supabase. Se mantiver, a RapidAPI deve sair
do browser e ir para API backend privada.

## 5. Classificacao De Arquivos

| Grupo | Arquivos/itens | Decisao |
| --- | --- | --- |
| A. Pode remover agora | Checkout legado, webhook legado e `/api/post-booking` foram removidos na Etapa 21. | Concluido. |
| B. Nao remover ainda, precisa migrar | `src/pages/details.tsx`, `src/pages/search.tsx`, `src/components/InfoCard.tsx`, `src/utils/getHotelList.ts`, `src/utils/getHotelDetails.ts`, `src/utils/getCitySuggestions.ts`. | Migrar/remover busca externa e detalhes primeiro. |
| C. Manter temporariamente | `src/pages/success.tsx`, `src/pages/bookings.tsx`. | Pontes neutras/compatibilidade de rota; nao criam checkout nem booking. |
| D. Substituido por fluxo Supabase | APIs antigas de favoritos removidas; `InfoCard` usa `src/lib/favorites/client.ts`. | Concluido na Etapa 16. |
| E. Variaveis de ambiente legadas | Possiveis variaveis Firebase antigas. | Variaveis NextAuth/Prisma/Stripe legado e RapidAPI publica foram removidas. |

## 6. Plano De Remocao Controlada

### Etapa 16: Remover APIs antigas de favoritos se nao usadas

Status: concluida.

- `/favorites` usa apenas Supabase.
- `InfoCard` usa `addFavorite` e `removeFavorite` do Supabase.
- `src/pages/api/post-favorite/index.ts` removido.
- `src/pages/api/get-favorites/index.ts` removido.
- `src/pages/api/delete-favorite/index.ts` removido.

### Etapa 17: Migrar/remover paginas NextAuth restantes

Status: concluida para `/bookings` e `/success`.

- `/bookings` virou ponte para `/account/bookings`.
- `/bookings` nao chama mais `/api/get-bookings`.
- `/success` virou pagina neutra de compatibilidade de rota.
- `/success` nao confirma pagamento no frontend.
- `getSession`, `signOut` e `Session` foram removidos dessas duas paginas.
- `getSession`, `signOut` e `Session` ainda existem em `search.tsx`/`details.tsx`
  e devem ser tratados em etapa futura se essas paginas forem mantidas.
- Remover `SessionProvider` de `_app.tsx` quando nenhuma pagina depender de
  NextAuth.

### Etapa 18/20/21: Remover checkout/webhook legado

Status concluido: `/api/get-bookings` removido na Etapa 18. Na Etapa 20,
`details.tsx` deixou de chamar `/api/create-checkout-session`; `/api/post-booking`
foi mantido naquela etapa porque `/api/webhook` ainda chamava esse endpoint para gravar booking
legado via Prisma. Na Etapa 21, `/api/create-checkout-session`, `/api/webhook`
e `/api/post-booking` foram removidos.

- Confirmar que nenhum usuario compra via `/details`. Concluido na Etapa 20.
- Remover ou esconder chamada para `/api/create-checkout-session`. Concluido na
  Etapa 20 para `details.tsx`.
- Desabilitar endpoint Stripe legado no Dashboard.
- Confirmar que nenhum ambiente externo ainda aponta para `/api/webhook`.

### Etapa 19: Remover Prisma e NextAuth do package.json

- Remover `/api/auth/[...nextauth]` e PrismaAdapter.
- Remover `src/server/db/prismadb.ts`.
- Remover `prisma` scripts do deploy.
- Remover `@next-auth/prisma-adapter`, `next-auth`, `@prisma/client` e `prisma`.
- Atualizar `package-lock.json` via install limpo.
- Remover `DATABASE_URL`/`SHADOW_DATABASE_URL` se nao houver outro uso.

### Etapa 20: Remover RapidAPI publica e decidir busca externa

- Se busca externa acabar: remover `search.tsx`, `details.tsx` e utils RapidAPI.
- Se busca externa continuar: manter chamadas RapidAPI em backend privado com
  `RAPIDAPI_KEY` e evoluir rate limit/cache.
- Atualizar docs e env para remover a chave publica.

## 7. Conclusao

O checkout/webhook legado foi removido, mas o legado ainda exige remocao em
fases. A ordem restante mais segura e: paginas NextAuth/RapidAPI, Prisma e
NextAuth no pacote, e por fim RapidAPI publica se a busca externa nao for mais
necessaria.
