import { useEffect, useState, type ReactNode } from "react";

type Props = {
  onConfirm: () => Promise<unknown>;
  onDone?: () => unknown | Promise<unknown>;
  children?: ReactNode;
  title?: string;
  message?: string;
  confirmLabel?: string;
  className?: string;
};

// Delete trigger with a confirmation dialog, loading state and visible error.
// Replaces one-click deletes so an accidental click can't destroy data.
const ConfirmButton = ({
  onConfirm,
  onDone,
  children = "Excluir",
  title = "Confirmar exclusão",
  message = "Tem certeza? Esta ação não pode ser desfeita.",
  confirmLabel = "Excluir",
  className,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isBusy]);

  const handleConfirm = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
      if (onDone) await onDone();
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "Não foi possível concluir a ação. Tente novamente."
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <button
        className={className ?? "text-red-600 hover:text-red-700"}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        type="button"
      >
        {children}
      </button>

      {open && (
        <div
          aria-labelledby="confirm-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!isBusy) setOpen(false);
          }}
          role="dialog"
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold" id="confirm-dialog-title">
              {title}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
            {error && (
              <p
                className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                autoFocus
                className="rounded border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                disabled={isBusy}
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                disabled={isBusy}
                onClick={handleConfirm}
                type="button"
              >
                {isBusy ? "Excluindo…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ConfirmButton;
