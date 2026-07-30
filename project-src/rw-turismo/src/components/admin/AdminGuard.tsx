import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import useSupabaseSession from "../../hooks/useSupabaseSession";
import {
  canAccessAdminRoute,
  DEFAULT_ROUTE_BY_ROLE,
  ROLE_LABELS,
} from "../../lib/auth/roles";

type Props = {
  children: ReactNode;
};

const Blocked = ({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
    <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      <div className="mt-5 flex justify-center">{action}</div>
    </div>
  </div>
);

// Portão das telas do /admin. A permissão real está no banco (policies por papel
// em supabase/rls.sql); aqui é só para a pessoa não bater numa tela vazia sem
// entender o porquê.
const AdminGuard = ({ children }: Props) => {
  const router = useRouter();
  const { isLoading, isAuthenticated, staffRole } = useSupabaseSession();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Verificando acesso...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Blocked
        action={
          <Link
            className="inline-flex rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600"
            href="/signin?next=/admin"
          >
            Entrar
          </Link>
        }
        description="Entre com uma conta da equipe para acessar o painel."
        title="Login necessario"
      />
    );
  }

  if (!staffRole) {
    return (
      <Blocked
        action={
          <Link
            className="inline-flex rounded border px-4 py-2 font-semibold hover:bg-gray-100"
            href="/"
          >
            Voltar para home
          </Link>
        }
        description="Sua conta não tem acesso ao painel. Se isso está errado, peça a um administrador para liberar em Usuários do sistema."
        title="Acesso negado"
      />
    );
  }

  if (!canAccessAdminRoute(router.pathname, staffRole)) {
    return (
      <Blocked
        action={
          <Link
            className="inline-flex rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600"
            href={DEFAULT_ROUTE_BY_ROLE[staffRole]}
          >
            Ir para a minha área
          </Link>
        }
        description={`Esta tela não faz parte do acesso de ${ROLE_LABELS[staffRole]}. Peça a um administrador se precisar dela.`}
        title="Área restrita"
      />
    );
  }

  return <>{children}</>;
};

export default AdminGuard;
