# Plano — Fase 5 restante (Robustez)

> Continuação do `PLANO_IMPLEMENTACAO.md`. Fases 0–4 já estão no ar (prod = `1532798`).
> Da Fase 5 já foi feito: **5.3 rate limit** (`checkRateLimit` isolado) e **5.2 slug**
> nos forms de produto e categoria. Este doc detalha o que falta, com decisões já
> tomadas, para executar em sessões dedicadas.
>
> Caminho base: `project-src/travel-nextjs-typescript-tailwind-mapbox-calendar-date-picker-main/` (`APP/`).

## Ordem sugerida
1. 5.1 paginação (isolado, sem migration) — **em andamento nesta sessão**.
2. 5.2 slug nas formas restantes (pequeno).
3. 5.4 soft delete (grande, migration + muitas queries) — sessão dedicada.
4. 5.5 testes + pgTAP + CI (infra) — sessão dedicada.

---

## 5.1 — Paginação nas listas do admin

**Decisão:** função **aditiva** `searchAdminXxx({ page, limit })` retornando `{ items, count }`
(via `.select("*", { count: "exact" }).range(...)`), **mantendo** a `listAdminXxx()` atual
que devolve tudo — porque ela é usada em dropdowns (ProductForm, cupons, categorias,
nova reserva, rebook). Trocar o tipo de retorno da list quebraria esses callers.

Padrão de página: reusar o de `admin/bookings/index.tsx` (state `page`, `PAGE_SIZE=25`,
`.range((page-1)*limit, page*limit-1)`, botões Anterior/Próxima + "Página X de Y · N").

| Lista | Função (em `lib/admin/client.ts`, salvo nota) | Página |
|-------|-----------------------------------------------|--------|
| Produtos | `listAdminProducts` → add `searchAdminProducts` | `admin/products/index.tsx` |
| Datas de saída | `listAdminProductDates` → add `searchAdminProductDates` | `admin/product-dates/index.tsx` |
| Fornecedores | `listAdminSuppliers` → add `searchAdminSuppliers` | `admin/suppliers.tsx` |
| Lista de espera | `listAdminWaitlist` → add `searchAdminWaitlist` | `admin/waitlist.tsx` |
| Leads | `listLeads` (`lib/admin/crm.ts`) | `admin/crm.tsx` — **é kanban**, não tabela |

**Nota leads/CRM:** o CRM é um quadro kanban que carrega todos os leads para montar as
colunas. Paginação clássica não encaixa. Opções: (a) limitar o kanban aos N mais recentes
por coluna + "carregar mais"; (b) deixar como está e paginar só se virar problema. Recomendo
(a) só quando o volume crescer.

**Aceite:** lista com 1.000+ registros carrega < 2s, 25 por página; dropdowns continuam
funcionando (não regrediram).

---

## 5.2 — Slug único nas formas restantes

Já pronto em produto e categoria. Falta aplicar o mesmo hook nas outras formas com slug:
- **Página** (`admin/pages/index.tsx` — form inline) → tabela `pages`.
- **Post do blog** (`admin/blog/new.tsx` / `[id].tsx` ou form compartilhado) → `blog_posts`.
- **Blog categorias/tags** (`admin/blog/categories.tsx`, `admin/blog/tags.tsx`) → `blog_categories`, `blog_tags`.

**Como:** `const status = useSlugStatus("<tabela>", values.slug, editingId)` +
`slugFieldProps(status)` no Field (ou texto manual se for `<input>` cru) + `disabled={status==="taken"}`
no submit + `isUniqueViolation(err)` no catch. Helpers já existem em
`hooks/useSlugStatus.ts` e `lib/admin/slugs.ts`.

**Aceite:** impossível salvar slug duplicado sem feedback claro, em todas as formas.

---

## 5.4 — Soft delete completo (5 entidades + lixeira)

> **Grande e invasivo.** Migration + filtro `deleted_at is null` em TODAS as leituras
> públicas/admin dessas entidades + troca dos hard deletes por update + tela de lixeira.
> Risco principal: esquecer um filtro → item "excluído" reaparece. Fazer com calma.

### Passos

1. **Migration** `supabase/migrations/YYYYMMDD_fase5_soft_delete.sql` (+ sync no `schema.sql`):
   ```sql
   alter table public.products       add column if not exists deleted_at timestamptz;
   alter table public.categories     add column if not exists deleted_at timestamptz;
   alter table public.product_dates  add column if not exists deleted_at timestamptz;
   alter table public.suppliers      add column if not exists deleted_at timestamptz;
   alter table public.leads          add column if not exists deleted_at timestamptz;
   create index if not exists products_deleted_at_idx      on public.products(deleted_at);
   -- (idem para as outras 4)
   ```

2. **Trocar hard delete por soft delete** em `lib/admin/client.ts` (e onde mais deletar):
   - `deleteAdminProduct`, `deleteAdminCategory`, `deleteAdminProductDate`, `deleteAdminSupplier`,
     e o delete de leads (`lib/admin/crm.ts`). Trocar `.delete()` por `.update({ deleted_at: new Date().toISOString() })`.
   - Adicionar `restoreAdminXxx(id)` → `update({ deleted_at: null })`.

3. **Filtrar `deleted_at is null`** em TODA leitura dessas entidades. Mapear os call sites:
   - **Admin** (`lib/admin/client.ts`): listAdminProducts, searchAdminProducts, getAdminProduct,
     listAdminProductDates, listAdminCategories, listAdminSuppliers, listAdminWaitlist (waitlist NÃO
     é uma das 5 — ignorar), searchAdminBookings (joina products/product_dates — decidir se filtra),
     departures/finance (usam product_dates), etc.
   - **Público** (`lib/products/client.ts` + `server.ts`): getActiveProducts, getProductBySlug,
     getActiveProductDates, getProductsByCategory, searchPackages, getActiveCategories,
     getActiveProductsServer, getProductBySlugServer, getActiveProductDatesServer,
     getFutureDateProductIdsServer.
   - **CRM** (`lib/admin/crm.ts`): listLeads, contadores por estágio.
   - **Cupom RPC**: `create_pending_booking_transaction` e `admin_create_booking` selecionam
     `products`/`product_dates` `for update` — adicionar `and deleted_at is null` (senão dá pra
     reservar produto "excluído"). **Mexe em RPC de dinheiro — cuidado.**
   - **RLS** (`rls.sql`): as policies de SELECT público de products/product_dates/categories
     devem exigir `deleted_at is null` (defesa no banco, não só no app).

4. **Tela de lixeira / restaurar**: um filtro "mostrar excluídos" nas listagens admin OU uma
   página `admin/trash.tsx` simples listando excluídos por tipo com botão "Restaurar". Mínimo:
   toggle nas listas de produtos/categorias/datas/fornecedores/leads.

**Aceite:** produto excluído some do site e do admin, mas é restaurável; não some das
reservas históricas (bookings referenciam product_id — manter o join funcionando mesmo
excluído, mostrando "(excluído)").

**Atenção:** decidir o comportamento em `bookings`/`payments`/`finance` que fazem join com
products/product_dates — provavelmente NÃO filtrar lá (histórico precisa ver o produto mesmo
excluído), só rotular. Este é o ponto mais delicado.

---

## 5.5 — Testes + CI

> **Infra.** Vitest + Testing Library, testes TS, pgTAP das RPCs, e GitHub Actions.

### Vitest (unit TS)
1. `npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react`.
2. `vitest.config.ts` (environment jsdom, setup file com jest-dom).
3. Script `"test": "vitest run"` no `package.json`.
4. **Prioridade 1 (dinheiro):**
   - `confirmInternalPayment` — mockar `createSupabaseAdminClient`; casos: idempotência
     (pago→duplicate), valor divergente → `requires_review`, reserva expirada → `requires_review`,
     caminho feliz → confirmed + incrementa cupom.
   - Extrair helpers puros onde der (ex.: cálculo de total, mapeamento de erros RPC) e testar direto.
   - `mapRpcError` (createPendingBooking / manualBookings) — testes puros de mapeamento.
   - `checkRateLimit` — testes puros (6ª chamada bloqueia; janela reseta).
5. **Prioridade 2:** componentes chave (ProductGallery, useSlugStatus com fetch mockado).

### pgTAP (RPCs SQL)
1. Testes em `supabase/tests/*.sql` usando pgTAP: criar/expirar/cancelar/remarcar booking com
   contagem de vagas; validação de cupom (percent/fixed/expirado/esgotado/produto errado);
   `admin_confirm_manual_payment` (idempotência ALREADY_PAID).
2. Rodar com Supabase CLI (`supabase test db`) OU `pg_prove` contra um Postgres do CI.

### CI (GitHub Actions) — `.github/workflows/ci.yml`
- Job **web**: `node-version 20`, `working-directory` no subdir do APP, `npm ci` →
  `npm run lint` (adicionar script lint se não houver) → `npm run build` → `npm run test`.
  Precisa das envs públicas mockadas (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY dummy) para o build.
- Job **db** (pgTAP): service `postgres:16`, instalar pgTAP, aplicar `schema.sql`+`rls.sql`,
  rodar `pg_prove supabase/tests/*.sql`.
- Bloquear merge com teste vermelho (branch protection — config manual no GitHub).

**Aceite:** `npm test` verde; CI roda lint+build+test em PR; pgTAP cobre as RPCs de reserva/cupom.

**Setup manual do usuário:** proteção de branch no GitHub (exigir CI verde) e, se usar Supabase
CLI no CI, o `SUPABASE_ACCESS_TOKEN`/project ref como secrets.

---

## Diferidos (fora da Fase 5, decisão do usuário)
- **GA4**: falta o Measurement ID `G-XXXXXXXXXX` → setar `NEXT_PUBLIC_GA_ID` no Vercel.
- **Sentry (3.2)**: dependência `@sentry/nextjs` + DSN.
- **Login backoff (parte do 5.3)**: backoff client-side no `AuthPage` após N falhas (o rate
  limit de servidor do create-pending já está feito).
