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
`https://rw-turismo.vercel.app/auth/callback`

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
https://rw-turismo.vercel.app/auth/callback
https://rw-turismo.vercel.app/reset-password
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
- Papéis de equipe são atribuídos só pela tela `/admin/users` (rota de API
  restrita a Administrador) ou pelo SQL Editor. O frontend nunca envia `role`
  em nome do próprio usuário, e o trigger
  `prevent_customer_profile_identity_changes` bloqueia quem não é admin de
  alterar `role`/`email` — ou seja, ninguém se autopromove.
- Desativar um usuário (`active = false`) tira o acesso na hora, sem apagar o
  perfil nem o histórico.
- `SUPABASE_SERVICE_ROLE_KEY` nunca pode ser exposta em variável
  `NEXT_PUBLIC_*`.
- Parâmetros `next` aceitam somente caminhos internos iniciados por `/` e
  rejeitam URLs iniciadas por `//`.

## Usuários do sistema (equipe do painel)

Rode a migration `supabase/migrations/20260730000000_usuarios_do_sistema.sql`
no SQL Editor. Ela adiciona os papéis de equipe, a coluna `active` e as policies
por papel. Depois disso, criar e gerenciar acesso é feito em `/admin/users` —
sem SQL.

### Papéis

| Papel | `role` | Enxerga |
|---|---|---|
| Administrador | `admin` | Tudo, incluindo usuários, integrações e configurações |
| Operações | `operacoes` | Reservas, passageiros/check-in, saídas, fornecedores, lista de espera, CRM, clientes. Lê pagamentos, não confirma |
| Financeiro | `financeiro` | Pagamentos (confirmar), despesas, recebíveis, cupons. Lê reservas, não mexe no catálogo |
| Conteúdo | `conteudo` | Catálogo, home, páginas, blog, aparência, avaliações, cupons. Não vê caixa nem reservas |

A separação é aplicada em dois lugares, e os dois precisam concordar:

- **Banco:** policies por papel em `supabase/rls.sql` (helpers `is_staff()`,
  `has_staff_role()`, `staff_role_of()`). É o que realmente impede o acesso.
- **Navegação:** `src/lib/auth/roles.ts` decide quais telas aparecem na sidebar
  e o que o `AdminGuard` libera. Rota nova que ninguém mapeou nasce como
  admin-only.

Ao criar uma tela nova em `/admin`, adicione a rota em `ROUTE_ROLES` e a
policy correspondente — senão ela fica visível só para o Administrador.

### Primeiro admin

O primeiro administrador ainda sai do SQL Editor (não existe ninguém para criar
o primeiro acesso):

```sql
update public.users_profiles
set role = 'admin', active = true
where email = 'admin@example.com';
```

A partir dele, todos os outros são criados em `/admin/users` com senha
provisória. O sistema recusa remover o último administrador ativo, e ninguém
altera o próprio papel nem desativa a própria conta.

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

## Home, blog e Storage

Os scripts SQL criam as tabelas editoriais `home_sections`, `home_banners`,
`site_settings`, `blog_posts`, `blog_categories`, `blog_tags`,
`blog_post_tags` e `newsletter_subscribers`.

Também são criados os buckets públicos:

- `site-assets`: banners, logo e favicon;
- `product-images`: imagens de produtos;
- `blog-images`: capas e imagens editoriais.

Arquivos publicados têm leitura pública. Upload, alteração e exclusão exigem
uma sessão autenticada cujo perfil possua `role = 'admin'`. O componente
administrativo aceita apenas imagens conhecidas e limita o upload a 5 MB. A
chave `service_role` não é utilizada pelo navegador.

Depois de atualizar o projeto, execute novamente, nesta ordem:

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/seed.sql`

O seed cria um banner, seções padrão, configurações básicas, uma categoria de
blog e um post em rascunho. O rascunho não é exposto pelas políticas públicas.
