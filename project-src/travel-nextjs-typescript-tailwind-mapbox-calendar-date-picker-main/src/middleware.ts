import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Camada server-side de proteção do painel (/admin/*), além do RLS e do
// AdminGuard client-side. Valida a sessão Supabase pelos cookies e exige
// users_profiles.role === 'admin'. Funciona mesmo com JavaScript desativado.
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

    const { data: profile } = await supabase
      .from("users_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return redirectToSignin();
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
