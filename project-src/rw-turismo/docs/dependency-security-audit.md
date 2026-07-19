# Auditoria de segurança de dependências

Data da revisão: 4 de julho de 2026.

## Linha de base

- Build anterior: aprovado com Next.js 13.0.3 e 36 rotas no Pages Router.
- Auditoria anterior: 12 ocorrências (`2 critical`, `3 high`, `7 moderate`).
- Runtime verificado durante a atualização: Node.js 24.12.0 e npm 11.6.2.
- O `package.json` declarava `next: "latest"`, mas o lockfile instalava Next.js 13.0.3. A versão agora está limitada à linha corrigida escolhida.
- Rotas de regressão: `/`, `/signin`, `/auth/callback`, `/forgot-password`,
  `/reset-password`, `/products/[slug]`, `/favorites`, `/account/bookings`,
  `/account/bookings/[id]`, `/admin`, `/admin/products`, `/admin/bookings`,
  `/admin/payments`, `/api/rapidapi/city-suggestions`,
  `/api/bookings/create-pending`, `/api/payments/create-checkout-session` e
  `/api/payments/webhook`.

## Ocorrências iniciais

O npm agrupa vários advisories do mesmo pacote em uma ocorrência. A tabela abaixo
registra as 12 ocorrências por pacote apresentadas pela auditoria inicial.

| Pacote | Severidade agregada | Versão/cadeia anterior | Tipo e ambiente | Correção aplicada | Major exigida |
| --- | --- | --- | --- | --- | --- |
| `axios` | high | 1.2.0, dependência direta | Produção; não havia import ativo no código | 1.18.1 | Não |
| `form-data` | critical | transitiva de `axios` | Produção | resolvida pela atualização do Axios | Não |
| `follow-redirects` | high | transitiva de `axios` | Produção | resolvida pela atualização do Axios | Não |
| `next` | critical | 13.0.3, direta | Produção | 15.5.18 | Sim, atualização controlada 13 → 15 |
| `postcss` | moderate | 8.4.19 direta e cópia antiga do Next | Build/produção | 8.5.16 e override compatível | Não |
| `braces` | high | 3.0.2 via Tailwind/Chokidar | Desenvolvimento/build | 3.0.3 via Tailwind 3.4.19 | Não |
| `micromatch` | moderate | 4.0.5 via Tailwind | Desenvolvimento/build | 4.0.8 via Tailwind 3.4.19 | Não |
| `picomatch` | high | 2.3.1 via Tailwind/Chokidar | Desenvolvimento/build | 2.3.2 via Tailwind 3.4.19 | Não |
| `nanoid` | moderate | transitiva do toolchain CSS | Desenvolvimento/build | versão corrigida após atualização do toolchain | Não |
| `yaml` | moderate | 1.10.2 via `postcss-load-config` | Desenvolvimento/build | removida a cadeia vulnerável com Tailwind 3.4.19 | Não |
| `protocol-buffers-schema` | moderate | 3.6.0 via `mapbox-gl > pbf > resolve-protobuf-schema` | Produção | override 3.6.1 | Não |
| `qs` | moderate | 6.11.0 via Stripe | Produção/backend | Stripe 11.18.0 e override mínimo 6.14.2; resolvido em 6.15.3 | Não |

Os advisories do Next.js incluíam bypass de autorização/middleware, DoS,
cache poisoning, request smuggling e problemas no otimizador de imagens. A
versão 15.5.18 é estável, aceita React 18 e mantém suporte ao Pages Router. Não
foi adotado Next 16 porque isso ampliaria desnecessariamente o risco desta etapa.

Os advisories do Axios incluíam SSRF, vazamento de credenciais, DoS, prototype
pollution, injeção de cabeçalhos e XSRF. A aplicação não possui interceptors nem
imports ativos de Axios; portanto, a atualização não exigiu mudanças de API.

## Versões alteradas

| Dependência | Antes | Depois |
| --- | --- | --- |
| Next.js | 13.0.3 instalado (`latest` no manifesto) | 15.5.18 |
| React / React DOM | 18.2.0 | 18.3.1 |
| Axios | 1.2.0 | 1.18.1 |
| Mapbox GL | 2.11.0 | 2.15.0 |
| Stripe SDK | 11.1.0 | 11.18.0 |
| micro | 10.0.0 | 10.0.1 |
| Tailwind CSS | 3.2.4 instalado | 3.4.19 |
| PostCSS | 8.4.19 | 8.5.16 |
| Autoprefixer | 10.4.13 instalado | 10.4.23 |
| TypeScript | 4.8.4 | 5.9.3 |
| Tipos React / React DOM | 18.0.x | 18.3.x |
| Tipos Node | 18.11.3 | 22.19.15 |

Overrides documentados:

- `postcss ^8.5.16`: substitui a cópia transitiva vulnerável do Next por outra
  versão da mesma major.
- `protocol-buffers-schema ^3.6.1`: corrige a cadeia transitiva do Mapbox sem
  alterar sua API.
- `qs ^6.14.2`: impõe o primeiro patch seguro da mesma major; a resolução atual
  do lockfile é 6.15.3.

## Compatibilidade e segurança

- Pages Router, API Routes, `getStaticProps` e `getServerSideProps` foram
  mantidos; não houve migração para App Router.
- `next.config.js` e o uso atual de `next/image` são compatíveis com Next 15.
- O webhook continua usando `micro.buffer(req)`, `bodyParser: false`, o header
  `stripe-signature` e `stripe.webhooks.constructEvent`.
- `micro` continua necessário para preservar a leitura do corpo bruto e não
  apresentou vulnerabilidade na auditoria.
- Service role, Stripe secret e RapidAPI key continuam sem prefixo
  `NEXT_PUBLIC_` e acessadas apenas por código de servidor.
- Schema, RLS, autenticação, bookings, checkout, pagamentos e regras de negócio
  não foram alterados.

## Resultado final

- `npm run build`: aprovado, 36 rotas geradas com Next.js 15.5.18.
- `npm audit --json`: 0 vulnerabilidades (`0 critical`, `0 high`,
  `0 moderate`, `0 low`).
- Smoke test local: todas as páginas críticas listadas na linha de base
  responderam HTTP 200, inclusive o produto Lençóis Maranhenses e as áreas de
  conta/admin.
- A API de sugestões validou corretamente a ausência/parâmetro curto com HTTP
  400. Com `q=Rio`, o ambiente local retornou 500 porque não possui
  `RAPIDAPI_KEY`; a rota compilou e a chave continua exclusivamente no servidor.
- Endpoints de criação de reserva, checkout e webhook foram validados pelo
  build e por inspeção estática, sem disparar mutações, cobranças ou eventos
  Stripe durante esta auditoria.
- Breaking changes encontrados no código: nenhum.
- Risco operacional restante: os fluxos que dependem de credenciais externas
  ainda devem receber smoke tests autenticados no ambiente de homologação antes
  de uma compra real; esta atualização não executou transações.
