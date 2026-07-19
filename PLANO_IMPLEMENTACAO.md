# Plano de Implementação — RW Turismo

> Baseado na auditoria de funcionalidades de 16/07/2026.
> Caminho base do app: `project-src/travel-nextjs-typescript-tailwind-mapbox-calendar-date-picker-main/` (abaixo, `APP/`).
>
> **Como usar:** as fases estão em ordem de execução recomendada. Cada tarefa tem
> escopo, arquivos afetados e critério de aceite. Marcar `[x]` conforme concluir.

---

## Visão geral das fases

| Fase | Tema | Objetivo | Esforço estimado |
|------|------|----------|------------------|
| 0 | Segurança e limpeza | Fechar a única brecha real + remover lixo de dev | ~½ dia |
| 1 | Operação manual de reservas | Admin vende por WhatsApp/PIX sem depender do site | 3–5 dias |
| 2 | Conversão no site público | Galeria, itinerário, FAQ, depoimentos, cupom | 3–4 dias |
| 3 | Dados e observabilidade | Analytics, Sentry, relatórios financeiros | 1–2 dias |
| 4 | Pós-venda e comunicação | Voucher PDF, blog extras, newsletter | 2–3 dias |
| 5 | Robustez técnica | Paginação, validações, soft delete, rate limit, testes | 3–4 dias |

---

## FASE 0 — Segurança e limpeza (fazer antes de tudo)

### 0.1 Garantir `CRON_SECRET` em produção
- [ ] Conferir no Vercel (Project Settings → Environment Variables) se `CRON_SECRET` existe em Production.
- [ ] Se não existir: gerar novo secret (`openssl rand -hex 32`), configurar no Vercel e redeployar.
- [x] Endurecer os endpoints para **recusar** requisição quando a env não existir (hoje eles ficam abertos e só logam aviso):
  - `APP/src/pages/api/cron/expire-bookings.ts:10-27`
  - `APP/src/pages/api/cron/daily.ts:10-18`
- **Aceite:** chamada sem `Authorization: Bearer <secret>` retorna 401 em ambos, com e sem env configurada.

### 0.2 Remover páginas de dev
- [x] Deletar `APP/src/pages/supabase-auth-test.tsx` (página pública de debug de auth).
- [x] Deletar `APP/src/pages/api/hello.ts` (scaffold do Next).
- **Aceite:** `/supabase-auth-test` e `/api/hello` retornam 404; build passa.

### 0.3 Check server-side no admin (camada extra além do RLS)
- [x] Criar `APP/src/middleware.ts` que intercepta `/admin/*`: valida sessão Supabase via cookies e `users_profiles.role === 'admin'`; redireciona para `/signin` caso contrário.
- [x] Manter o `AdminGuard` client-side como está (UX de "acesso negado").
- **Aceite:** usuário `customer` logado recebe redirect ao acessar `/admin` mesmo com JS desativado.

---

## FASE 1 — Operação manual de reservas (maior gap funcional)

> Hoje Bookings e Payments são read-only no admin. Esta fase destrava venda por
> WhatsApp/telefone e recebimento por PIX/boleto fora do Stripe.

### 1.1 Banco: suporte a operações manuais
- [x] Migration nova em `supabase/migrations/`:
  - `bookings.source` (`'site' | 'manual'`, default `'site'`).
  - `payments.method` ampliado (`stripe | pix | boleto | dinheiro | transferencia | outro`) e `payments.confirmed_by` (uuid do admin), `payments.notes`.
  - RPC `admin_create_booking(...)` (security definer, service_role): cria booking `confirmed` ou `pending` com validação de vagas — reaproveitar a lógica de `create_pending_booking_transaction` (`supabase/schema.sql:285-410`).
  - RPC `admin_confirm_manual_payment(booking_id, amount, method, notes)`: registra pagamento manual, marca `payment_status = 'paid'`, `status = 'confirmed'`, grava em `system_logs`.
  - RPC `admin_cancel_booking(booking_id, reason)`: cancela e devolve vagas (reusar lógica de `expire_pending_booking`, `supabase/schema.sql:411-468`).
  - RPC `admin_rebook(booking_id, new_product_date_id)`: valida vagas na nova data, transfere, devolve vagas da antiga.
- **Aceite:** RPCs com `revoke all from public` + `grant execute to service_role`; testadas via SQL editor.

### 1.2 API routes admin
- [x] `APP/src/pages/api/admin/bookings/create.ts` — POST, valida admin (padrão de `api/admin/integration-status.ts:10-21`), chama `admin_create_booking`.
- [x] `APP/src/pages/api/admin/bookings/[id]/confirm-payment.ts` — POST manual payment.
- [x] `APP/src/pages/api/admin/bookings/[id]/cancel.ts` — POST cancelamento.
- [x] `APP/src/pages/api/admin/bookings/[id]/rebook.ts` — POST remarcação.
- **Aceite:** todas retornam 403 para não-admin; operações aparecem em `system_logs`.

### 1.3 UI no admin
- [x] `APP/src/pages/admin/bookings/new.tsx` — formulário: buscar cliente existente (ou criar), escolher produto → data (mostra vagas), nº viajantes, passageiros, status inicial (pendente/confirmada), método de pagamento.
- [x] Em `APP/src/pages/admin/bookings/[id].tsx` adicionar ações: **Confirmar pagamento manual** (modal com valor/método/observação), **Cancelar reserva** (modal com motivo + confirmação dupla), **Remarcar data** (dropdown de datas futuras com vagas).
- [x] Botão "Nova reserva" em `APP/src/pages/admin/bookings/index.tsx` + filtro por `source`.
- **Aceite:** fluxo completo por telefone: criar reserva manual → confirmar PIX → cliente vê reserva confirmada em `/account/bookings`; vagas decrementadas corretamente.

### 1.4 Notificações
- [x] Disparar as notificações existentes (`booking_created`, `booking_confirmed`) também nos fluxos manuais.
- **Aceite:** cliente recebe WhatsApp/e-mail ao ter reserva manual confirmada.

---

## FASE 2 — Conversão no site público

### 2.1 Galeria de fotos no produto
> O admin já salva `gallery` (`APP/src/components/admin/ProductForm.tsx`), mas a página pública só mostra `cover_image`.
- [x] Em `APP/src/pages/products/[slug].tsx`: carrossel/lightbox com capa + galeria (thumbnails clicáveis, swipe no mobile, `next/image` + lazy).
- **Aceite:** produto com 5 fotos exibe galeria navegável; produto só com capa mantém layout atual.

### 2.2 Itinerário dia-a-dia
- [x] Migration: `products.itinerary jsonb` (`[{day, title, description}]`).
- [x] Editor no `ProductForm.tsx` (adicionar/remover/reordenar dias).
- [x] Render na página do produto (timeline vertical) + schema.org `itinerary` no `TouristTrip`.
- **Aceite:** admin monta itinerário de 3 dias e ele aparece na página pública.

### 2.3 FAQ por produto
- [x] Migration: `products.faq jsonb` (`[{question, answer}]`) — reusar o visual do bloco FAQ do page builder (`APP/src/components/PageBlocks.tsx`).
- [x] Editor no `ProductForm.tsx` + render com `<details>` + schema.org `FAQPage`.
- **Aceite:** FAQ aparece no produto e no rich snippet (validar no Rich Results Test).

### 2.4 Depoimentos na home (reusar NPS)
- [x] Migration: `surveys.approved boolean default false`, `surveys.display_name text`.
- [x] Em `APP/src/pages/admin/surveys.tsx`: botão "Aprovar para o site" (só notas ≥ 9 com comentário).
- [x] Nova seção `testimonials` no home builder (`APP/src/lib/content/home-registry.ts` + `SectionFields.tsx`) puxando surveys aprovados.
- **Aceite:** depoimento aprovado aparece na home; não aprovado, nunca.

### 2.5 Cupom de desconto
- [x] Migration: tabela `coupons` (code unique, tipo percent/fixed, valor, validade, max_uses, used_count, produto opcional, active) + RLS admin-only para escrita.
- [x] Validação server-side: campo de cupom no produto → validar na RPC de criação de booking e aplicar no `create-checkout-session` (`APP/src/pages/api/payments/create-checkout-session.ts`) via Stripe discount ou ajuste de preço — **nunca confiar no valor vindo do client**.
- [x] CRUD `APP/src/pages/admin/coupons.tsx` (seguir padrão de `suppliers.tsx`).
- **Aceite:** cupom válido desconta no checkout Stripe; expirado/esgotado retorna erro amigável; `used_count` incrementa só após pagamento confirmado (no webhook).

### 2.6 Busca: ordenação e paginação
- [x] Em `APP/src/pages/search.tsx`: select de ordenação (menor preço, maior preço, data mais próxima) + paginação (12/página) via query string.
- [x] Ajustar `searchPackages()` em `APP/src/lib/products/client.ts` para `order()` + `range()`.
- **Aceite:** busca com 30 resultados pagina e ordena; URL compartilhável preserva filtros.

---

## FASE 3 — Dados e observabilidade

### 3.1 Analytics (GA4)
- [ ] `NEXT_PUBLIC_GA_ID` + script gtag em `APP/src/pages/_app.tsx` (route change tracking).
- [ ] Eventos de funil: `view_item` (produto), `begin_checkout` (criar pendente), `purchase` (payment-success), `generate_lead` (form de página), `sign_up`.
- [ ] Configurável: guardar o ID em `site_settings` para o admin trocar sem deploy (aba em `admin/settings.tsx`).
- **Aceite:** funil completo visível no GA4 DebugView.

### 3.2 Sentry
- [ ] `@sentry/nextjs` com DSN via env; capturar erros de API routes (webhook e crons prioritários) e client.
- [ ] Mascarar dados sensíveis (e-mail, telefone) no `beforeSend`.
- **Aceite:** erro forçado em staging aparece no Sentry com stack trace e sem PII.

### 3.3 Relatório financeiro por período
> Hoje `getFinanceSummary()` (`APP/src/lib/admin/finance.ts:247-358`) só cobre o mês atual.
- [ ] Filtro de intervalo (de/até) em `APP/src/pages/admin/finance/index.tsx` + comparativo com período anterior.
- [ ] Exportar CSV do período; gráfico simples de receita × despesa por mês (últimos 12).
- **Aceite:** relatório de trimestre fecha com os mesmos números da soma dos meses.

### 3.4 UI para `system_logs`
- [ ] `APP/src/pages/admin/logs.tsx`: listagem paginada com filtro por tipo/data/busca (tabela e RLS já existem — `supabase/rls.sql:331-345`).
- **Aceite:** ações da Fase 1 (pagamento manual, cancelamento) aparecem no log com autor.

---

## FASE 4 — Pós-venda e comunicação

### 4.1 Voucher/itinerário em PDF
- [x] Endpoint `APP/src/pages/api/bookings/[id]/voucher.ts`: gera PDF (sugestão: `@react-pdf/renderer`) com logo, dados da reserva, passageiros, data, itinerário, contato — autorizado para o dono da reserva ou admin.
- [x] Botão "Baixar voucher" em `/account/bookings/[id]` (só quando `paid`) e no admin.
- [ ] Anexar/linkar no WhatsApp de confirmação.
- **Aceite:** PDF abre com dados corretos; usuário não-dono recebe 403.

### 4.2 Blog: share + newsletter
- [x] Botões de compartilhar (WhatsApp, Facebook, X, copiar link) em `APP/src/pages/blog/[slug].tsx`.
- [x] Bloco de captura de e-mail no fim do post → grava como lead no CRM (tag `newsletter`), reusando o fluxo de leads existente.
- **Aceite:** lead de newsletter aparece no kanban do CRM.

### 4.3 Sitemap: incluir tags e páginas publicadas
- [x] Em `APP/src/pages/sitemap.xml.tsx`: adicionar `/blog/tag/[slug]` e `/paginas/[slug]` publicadas.
- **Aceite:** sitemap lista as novas URLs.

---

## FASE 5 — Robustez técnica

### 5.1 Paginação nas listas do admin
- [ ] Aplicar o padrão range-based já usado em bookings (`APP/src/pages/admin/bookings/index.tsx:24-97`) em: `listLeads()` (`APP/src/lib/admin/crm.ts`), `listAdminSuppliers()`, `listAdminWaitlist()`, `listAdminProducts()`, `listAdminProductDates()` (`APP/src/lib/admin/client.ts`).
- **Aceite:** listas com 1.000+ registros carregam em < 2s, 25 por página.

### 5.2 Validação de slug único
- [ ] Check debounced (500ms) nos forms de produto, categoria, página e post: consulta por slug e mostra "slug já em uso" antes do submit; tratar também o erro 23505 do Postgres no submit com mensagem amigável.
- **Aceite:** impossível salvar slug duplicado sem feedback claro.

### 5.3 Rate limiting
- [ ] Camada simples (Upstash Redis ou `lru-cache` por IP) em: `/api/bookings/create-pending` (5/min por usuário) e tentativa de login (client-side backoff + captcha opcional do Supabase).
- **Aceite:** 6ª tentativa em 1 minuto retorna 429.

### 5.4 Soft delete nas entidades de negócio
- [ ] Migration: `deleted_at timestamptz` em `products`, `categories`, `product_dates`, `suppliers`, `leads` + filtro `deleted_at is null` nas queries e policies RLS.
- [ ] Trocar os hard deletes de `APP/src/lib/admin/client.ts` por update de `deleted_at`; tela "lixeira" simples com restaurar (pode ser filtro nas listagens).
- **Aceite:** produto excluído some do site e do admin, mas é restaurável.

### 5.5 Testes automatizados (mínimo viável)
- [ ] Setup Vitest + Testing Library.
- [ ] Prioridade 1 — dinheiro: testes de `confirmInternalPayment` (idempotência, valor divergente → `requires_review`), validação de cupom, cálculo de total da reserva.
- [ ] Prioridade 2 — RPCs: testes SQL (pgTAP ou script de smoke no CI) para criar/expirar/cancelar/remarcar booking com contagem de vagas.
- [ ] CI: GitHub Actions rodando `lint + build + test` em PR.
- **Aceite:** `npm test` verde; CI bloqueia merge com teste quebrado.

---

## Dependências entre fases

```
Fase 0 ──► independente (fazer primeiro)
Fase 1 ──► pré-requisito para: voucher no admin (4.1), logs úteis (3.4)
Fase 2 ──► 2.4 depende de surveys existentes; 2.5 toca o mesmo código da Fase 1 (RPC de booking) — coordenar
Fase 3 ──► independente
Fase 4 ──► 4.1 depende da Fase 1 (reservas manuais também geram voucher)
Fase 5 ──► 5.5 idealmente antes de mexer em pagamento (2.5), mas pode ser paralelo
```

## Ordem sugerida de execução

1. **Semana 1:** Fase 0 completa + início da Fase 1 (migrations + RPCs + APIs).
2. **Semana 2:** Fase 1 UI + notificações. Entrega: operação manual funcionando.
3. **Semana 3:** Fase 2 (galeria, itinerário, FAQ, depoimentos, cupom, busca).
4. **Semana 4:** Fase 3 + Fase 4. Entrega: dados de conversão + voucher.
5. **Semana 5:** Fase 5 (robustez + testes + CI).

## Fora de escopo (avaliado e adiado conscientemente)

- 2FA para admin — vale revisitar quando houver mais de um operador no painel.
- Multi-idioma / hreflang — site é monolíngue.
- Comparação de pacotes lado a lado — baixo impacto.
- Backup/restore via UI — Supabase já faz backup diário no plano pago; documentar processo manual basta.
