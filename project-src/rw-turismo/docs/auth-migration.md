# Auth Migration

## Estado Atual

Supabase Auth e agora o fluxo oficial de autenticacao.

NextAuth foi removido na Etapa 22:

- `src/pages/api/auth/[...nextauth].ts` removido.
- `SessionProvider` removido de `src/pages/_app.tsx`.
- `getSession`, `signOut`, `Session` e wrappers NextAuth removidos do runtime.
- Dependencias `next-auth` e `@next-auth/prisma-adapter` removidas.
- Variaveis `NEXTAUTH_URL` e `NEXTAUTH_SECRET` removidas dos exemplos de env.

Prisma tambem foi removido na Etapa 22:

- `src/server/db/prismadb.ts` removido.
- Pasta `prisma/` removida.
- Script `vercel-build` nao executa mais `prisma generate` nem
  `prisma migrate deploy`.
- Dependencias `@prisma/client` e `prisma` removidas.
- Variaveis `DATABASE_URL` e `SHADOW_DATABASE_URL` removidas dos exemplos de
  env.

## Fluxo Oficial

Os helpers oficiais de auth vivem em:

- `src/lib/auth/client.ts`
- `src/lib/auth/server.ts`
- `src/lib/auth/profile.ts`
- `src/lib/auth/admin.ts`

`/signin` inicia login Google via Supabase Auth.
`/auth/callback` finaliza a sessao Supabase.
`users_profiles` guarda o perfil e o papel do usuario.

Google OAuth deve ser configurado no painel do Supabase, nao por variaveis
NextAuth no app.

## Areas Relacionadas

Favoritos usam Supabase Auth e RLS.
Admin usa `users_profiles.role = 'admin'`.
Bookings internos e pagamentos internos usam Supabase Auth e Supabase
PostgreSQL.

`search.tsx` e `details.tsx` continuam existindo como fluxo RapidAPI externo,
mas nao usam NextAuth e nao iniciam checkout legado.
