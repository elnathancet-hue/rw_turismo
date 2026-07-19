# RW Turismo

Plataforma de reservas de viagens da **RW Turismo** — site público (catálogo,
busca, checkout) + painel administrativo (reservas, pagamentos, CRM, financeiro,
conteúdo). Next.js (Pages Router) + TypeScript + Tailwind + Supabase.

## Stack

- **Next.js** / React / TypeScript
- **Tailwind CSS**
- **Supabase** (Postgres + Auth + Storage + RLS) — schema em `../../supabase/`
- **Stripe** (checkout) e integrações opcionais (Mapbox, Resend, UAZAPI)

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local   # preencher as variáveis (ver docs/env.md)
npm run dev                        # http://localhost:3000
```

## Scripts

- `npm run dev` — desenvolvimento
- `npm run build` — build de produção
- `npm run lint` — ESLint (next/core-web-vitals)
- `npm test` — testes unitários (Vitest)

## Banco de dados

O schema, RLS e migrations ficam em `../../supabase/` (raiz do repo). Aplicar
`schema.sql` + `rls.sql` num projeto Supabase novo, ou rodar as `migrations/`
em ordem. Testes pgTAP em `../../supabase/tests/`.

## Documentação

Guias em [`docs/`](docs/): variáveis de ambiente, setup do Supabase e notas de
migração de reservas/admin.
