import type { ReactNode } from "react";

type Props = {
  status: "loading" | "ready" | "error";
  error?: string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  onRetry?: () => void;
  children: ReactNode;
};

// Standard loading / error / empty states for admin list screens, so a fetch
// in progress never looks like "no data".
const AdminListState = ({
  status,
  error,
  isEmpty,
  emptyTitle = "Nada por aqui ainda",
  emptyHint,
  onRetry,
  children,
}: Props) => {
  if (status === "loading") {
    return (
      <div
        aria-busy="true"
        className="overflow-hidden rounded-lg border bg-white shadow-sm"
      >
        <div className="divide-y">
          {[0, 1, 2, 3, 4].map((row) => (
            <div className="flex items-center gap-4 p-4" key={row}>
              <div className="h-4 flex-1 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
        <p className="text-red-700">
          {error ?? "Não foi possível carregar os dados."}
        </p>
        {onRetry && (
          <button
            className="mt-3 rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            onClick={onRetry}
            type="button"
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-lg border bg-white p-10 text-center">
        <p className="text-lg font-semibold">{emptyTitle}</p>
        {emptyHint && <p className="mt-1 text-gray-500">{emptyHint}</p>}
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminListState;
