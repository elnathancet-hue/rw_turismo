# Supabase Setup

Esta pasta prepara o banco Supabase sem alterar a logica atual do app.

## Ordem de Execucao

Execute os arquivos no SQL Editor do Supabase nesta ordem:

1. `schema.sql`
2. `rls.sql`
3. `seed.sql`

`schema.sql` cria extensoes, tabelas, constraints, indices e triggers de `updated_at`.
`rls.sql` ativa Row Level Security e cria as politicas de acesso.
`seed.sql` cria categorias, produtos e datas de exemplo.

## Variaveis

No projeto Next.js, as proximas etapas devem configurar:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_SITE_URL=
```

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend. Ela deve ser usada apenas em rotas backend, server actions seguras e webhooks.

## Google Auth

No painel do Supabase:

1. Acesse `Authentication > Providers`.
2. Ative `Google`.
3. Configure `Client ID` e `Client Secret` do Google Cloud.
4. No Google Cloud Console, adicione a callback URL indicada pelo Supabase.
5. Configure `Site URL` e redirects permitidos em `Authentication > URL Configuration`.

## Storage

### O que EXISTE hoje (criado por schema.sql)

Tres buckets, **todos publicos** (`public = true`), limite de 5 MB:

- `site-assets`: logo, favicon e banners. Aceita JPG, PNG, WEBP, SVG e ICO.
- `product-images`: capa e galeria dos pacotes. Aceita JPG, PNG e WEBP.
- `blog-images`: capas do blog. Aceita JPG, PNG e WEBP.

Policies em `rls.sql`: leitura publica (`for select to public`), escrita para
`is_admin()` e para o papel `conteudo`. **Nenhum bucket aceita PDF.**

### Bucket privado de documentos

`booking-documents` **existe** desde a migration
`20260803050000_documentos_passageiro.sql`. Ele e o unico bucket **privado**
(`public = false`) e o unico que aceita `application/pdf`. Limite de 10 MB.

Caminho dos arquivos: `{booking_id}/{passenger_id}/{arquivo}`. A estrutura de
pastas nao e enfeite — e o que permite a policy escopar "so o dono desta
reserva", lendo o `booking_id` da primeira pasta. Caminho plano, como o dos
buckets de imagem, tornaria essa regra impossivel de escrever.

Quem le (policies em `rls.sql`):

- `booking_documents_owner_read`: o titular da reserva.
- `booking_documents_staff_read`: **somente** `is_admin()` e o papel
  `operacoes`. Financeiro e Conteudo ficam de fora de proposito — nenhuma
  tarefa deles precisa do documento de uma crianca.

**Ninguem escreve por policy.** O upload usa URL assinada emitida pelo servidor
(`src/lib/bookings/passengerDocuments.ts`), porque na compra sem cadastro o
cliente nao tem sessao para o RLS avaliar: nao existe `auth.uid()` para uma
policy comparar. O servidor confere a posse da reserva e so entao emite uma
permissao de escrita curta, para um caminho especifico.

Leitura tambem nunca sai por URL publica: sempre `createSignedUrl` com
validade curta. Cada abertura pelo painel fica registrada em `system_logs`.

Retencao: `expire_booking_documents(dias)` limpa os registros de viagens
encerradas ha mais de 90 dias e devolve os caminhos; o cron diario
(`/api/cron/daily`) apaga os arquivos no Storage. Guardar documento depois do
embarque e o oposto do principio da necessidade.

### O que NAO existe

`avatars` **nao existe** — nao ha SQL, policy nem codigo para ele. Versoes
anteriores deste README o descreviam como se ja estivesse pronto e protegido;
nao estava.

> **Atencao ao implementar qualquer novo upload de dado pessoal.**
> Nao reaproveite `src/lib/admin/uploadImage.ts`: ele envia para os buckets
> **publicos** acima e devolve `getPublicUrl()`. Documento de passageiro —
> ainda mais de menor de idade — publicado numa URL publica permanente e
> vazamento de dado pessoal, sem revogacao possivel.
>
> Use `src/lib/bookings/passengerDocuments.ts` como modelo: bucket privado,
> `createSignedUpload`/`createSignedUrl` com expiracao curta, caminho com
> pasta por dono (para a policy conseguir escopar quem le) e expurgo depois que
> o dado cumpriu a finalidade.
>
> Criar bucket pelo painel sem policy NAO resolve: as policies existentes
> filtram por `bucket_id` e nao incluem o novo, entao com RLS ativo ninguem
> alem do service_role consegue ler ou escrever.

## Teste de RLS

Teste minimo:

1. Com usuario anonimo, rode `select * from products;` e confirme que somente produtos ativos aparecem.
2. Com usuario autenticado comum, tente inserir em `bookings`: deve falhar, porque reservas serao criadas pelo backend/service role.
3. Com usuario autenticado comum, confirme que `select * from bookings;` retorna apenas as proprias reservas.
4. Com usuario autenticado comum, tente atualizar `payments.status`: deve falhar.
5. Com usuario autenticado comum, tente alterar `users_profiles.role`: deve falhar.
6. Promova um usuario para admin alterando `users_profiles.role = 'admin'` via SQL Editor ou service role.
7. Com esse admin autenticado, confirme que produtos, datas, categorias, reservas, passageiros e logs ficam acessiveis conforme as politicas.

## Observacoes de Seguranca

- `is_admin()` usa `security definer` para consultar `users_profiles` sem causar recursao de RLS.
- Usuarios comuns nao possuem politica para atualizar pagamentos.
- Usuarios comuns nao possuem politica para confirmar reservas manualmente.
- Usuarios comuns nao criam reservas diretamente; a API backend deve validar preco, vagas e datas antes de usar service role.
- O webhook Stripe deve usar service role em backend para confirmar pagamentos e reservas apos validar a assinatura real do Stripe.
