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

Buckets sugeridos:

- `product-images`: imagens publicas de produtos.
- `avatars`: fotos de perfil dos usuarios.
- `booking-documents`: documentos privados de reservas.

Recomendacao inicial:

- `product-images` pode ser publico se as imagens forem de vitrine.
- `avatars` pode ser publico ou privado conforme a regra de negocio.
- `booking-documents` deve ser privado e acessado somente por politicas ou URLs assinadas.

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
