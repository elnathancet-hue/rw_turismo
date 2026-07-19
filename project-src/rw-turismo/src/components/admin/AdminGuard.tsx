import Link from "next/link";
import type { ReactNode } from "react";
import useSupabaseSession from "../../hooks/useSupabaseSession";

type Props = {
  children: ReactNode;
};

const AdminGuard = ({ children }: Props) => {
  const { isLoading, isAuthenticated, isAdmin } = useSupabaseSession();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Verificando acesso...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Login necessario</h1>
          <p className="mt-2 text-sm text-gray-500">
            Entre com uma conta administradora para acessar o painel.
          </p>
          <Link
            className="mt-5 inline-flex rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600"
            href="/signin?next=/admin"
          >
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Acesso negado</h1>
          <p className="mt-2 text-sm text-gray-500">
            Sua conta nao possui permissao de administrador.
          </p>
          <Link
            className="mt-5 inline-flex rounded border px-4 py-2 font-semibold hover:bg-gray-100"
            href="/"
          >
            Voltar para home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminGuard;
