# Supabase Setup

## Ordem Dos SQLs

No SQL Editor do Supabase, rode nesta ordem:

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/seed.sql`

`schema.sql` cria tabelas, constraints, indices, triggers e RPCs.
`rls.sql` habilita RLS e policies.
`seed.sql` cria dados iniciais de categorias, produtos e datas.

## Google Auth

1. Acesse `Authentication > Providers`.
2. Ative Google.
3. Configure Google Client ID e Client Secret.
4. No Google Cloud Console, adicione a callback URL informada pelo Supabase.
5. Em `Authentication > URL Configuration`, configure `Site URL`.
6. Adicione redirects locais e de producao, por exemplo:

`http://localhost:3000/auth/callback`
`https://travel-nextjs-typescript-tailwind-m.vercel.app/auth/callback`

## Email Auth, cadastro e códigos de acesso

1. Acesse `Authentication > Providers > Email`.
2. Mantenha o provedor Email habilitado para login com e-mail e senha.
3. Em produção, mantenha `Confirm email` habilitado para exigir a confirmação
   antes da primeira sessão.
4. Revise os templates em `Authentication > Email Templates`, especialmente:
   confirmação de cadastro, Magic Link e recuperação de senha.
5. Se o projeto estiver configurado para OTP numérico, inclua `{{ .Token }}` no
   template. Para Magic Link, use `{{ .ConfirmationURL }}`.

A opção `Receber código por e-mail` usa o mesmo provedor Email do Supabase. O
formato recebido pelo usuário — link mágico ou código — depende do template e
das configurações do projeto.

## URLs de autenticação e recuperação

Em `Authentication > URL Configuration`, configure a URL pública em `Site URL`
e inclua em `Redirect URLs`:

```text
http://localhost:3000/auth/callback
http://localhost:3000/reset-password
https://travel-nextjs-typescript-tailwind-m.vercel.app/auth/callback
https://travel-nextjs-typescript-tailwind-m.vercel.app/reset-password
```

O fluxo de recuperação começa em `/forgot-password`. O link enviado pelo
Supabase abre `/reset-password`, onde a nova senha é salva diretamente no
Supabase Auth.

## Segurança dos usuários

- Senhas são administradas exclusivamente pelo Supabase Auth e não são salvas
  nas tabelas da aplicação.
- O cadastro público envia somente o nome como metadata.
- O frontend nunca recebe nem envia `role`.
- `ensureUserProfile()` cria perfis novos explicitamente com
  `role = 'customer'`.
- Administradores continuam sendo promovidos apenas por uma operação segura no
  backend ou no SQL Editor.
- `SUPABASE_SERVICE_ROLE_KEY` nunca pode ser exposta em variável
  `NEXT_PUBLIC_*`.
- Parâmetros `next` aceitam somente caminhos internos iniciados por `/` e
  rejeitam URLs iniciadas por `//`.

## Promover Admin

Depois que o usuario fizer login e tiver perfil em `users_profiles`, promova via
SQL Editor:

```sql
update public.users_profiles
set role = 'admin'
where email = 'admin@example.com';
```

Confirme que o usuario comum continua sem acesso a `/admin` e que o admin
consegue acessar dashboard, produtos, datas, reservas, pagamentos e logs.

## Conferir RLS

Teste com dois usuarios diferentes:

1. Usuario A cria favorito e booking.
2. Usuario B cria favorito e booking.
3. Usuario A nao deve ver dados privados do Usuario B.
4. Usuario comum nao deve inserir booking diretamente em `bookings`.
5. Usuario comum nao deve atualizar `bookings.status`.
6. Usuario comum nao deve atualizar `payments.status`.
7. Admin deve conseguir ler dados operacionais pelo painel.

## RPCs Importantes

`create_pending_booking_transaction`

Cria booking pending, calcula preco no banco e reduz vagas de forma
transacional.

`expire_pending_booking`

Expira booking pending vencida, marca payment status da booking como cancelado e
devolve vagas apenas uma vez usando `slots_released`.

## Storage Futuro

Buckets sugeridos:

`product-images`
Imagens publicas de produtos e experiencias.

`avatars`
Fotos de perfil.

`booking-documents`
Documentos privados de reservas.

Ainda nao ha upload Supabase Storage implementado no fluxo atual.
