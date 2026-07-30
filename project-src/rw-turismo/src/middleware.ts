import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessAdminRoute,
  DEFAULT_ROUTE_BY_ROLE,
  isStaffRole,
  type StaffRole,
} from "./lib/auth/roles";

// Camada server-side de proteção do painel (/admin/*), além do RLS e do
// AdminGuard client-side. Valida a sessão Supabase pelos cookies e exige um
// papel de equipe ativo, aplicando também o mapa rota→papel de lib/auth/roles.
// Funciona mesmo com JavaScript desativado.
export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem env pública não há como validar a sessão aqui; o AdminGuard e o RLS
  // continuam protegendo. Evita quebrar o painel em ambiente mal configurado.
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const redirectToSignin = () => {
    const signinUrl = new URL("/signin", request.url);
    signinUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(signinUrl);
  };

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return redirectToSignin();
    }

    // select("*") em vez de listar colunas: assim o painel não quebra se o app
    // subir antes da migration que adiciona `active`.
    const { data: profile } = await supabase
      .from("users_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const row = profile as { role?: string; active?: boolean } | null;
    const isActive = row?.active !== false;
    const role: StaffRole | null =
      isActive && isStaffRole(row?.role) ? row.role : null;

    if (!role) {
      return redirectToSignin();
    }

    // Papel válido, mas área de outro papel: manda para a área dele em vez de
    // jogar para o login (o cara ESTÁ logado — cair no /signin confundiria).
    if (!canAccessAdminRoute(request.nextUrl.pathname, role)) {
      return NextResponse.redirect(
        new URL(DEFAULT_ROUTE_BY_ROLE[role], request.url)
      );
    }
  } catch (error) {
    // Falha ao validar (rede/Supabase indisponível) → nega o acesso (fail closed).
    console.error("admin middleware auth check failed", error);
    return redirectToSignin();
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
