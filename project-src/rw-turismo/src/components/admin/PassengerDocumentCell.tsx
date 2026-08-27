import { useState } from "react";
import type { AdminPassenger } from "../../lib/admin/client";

type Props = {
  passenger: AdminPassenger;
  onChanged: () => void;
};

const LABEL: Record<string, string> = {
  not_required: "Não exigido",
  pending: "Aguardando envio",
  uploaded: "Enviado, a conferir",
  verified: "Conferido",
  resend: "Reenvio pedido",
  purged: "Arquivo removido (prazo de guarda)",
};

const TONE: Record<string, string> = {
  not_required: "border-gray-200 bg-gray-50 text-gray-600",
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  uploaded: "border-blue-200 bg-blue-50 text-blue-800",
  verified: "border-green-200 bg-green-50 text-green-800",
  resend: "border-red-200 bg-red-50 text-red-700",
  purged: "border-gray-200 bg-gray-50 text-gray-500",
};

// Conferência do documento no painel.
//
// O arquivo nunca é embutido na tela: cada visualização pede um link novo, que
// vale poucos minutos e fica registrado em `system_logs`. Documento de menor
// não deve viver num `<img>` que qualquer print ou cache do navegador guarda.
const PassengerDocumentCell = ({ passenger, onChanged }: Props) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = passenger.document_status ?? "not_required";
  if (status === "not_required") return null;

  const chamar = async (action: "view" | "verify" | "resend") => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/passengers/${passenger.id}/document`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível concluir.");
      }

      if (action === "view" && payload.url) {
        window.open(payload.url, "_blank", "noopener,noreferrer");
        return;
      }
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível concluir."
      );
    } finally {
      setBusy(false);
    }
  };

  const temArquivo = Boolean(passenger.document_path);

  return (
    <div className="mt-2 border-t pt-2">
      <span
        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
          TONE[status] ?? "border-gray-200 bg-gray-50 text-gray-600"
        }`}
      >
        {LABEL[status] ?? status}
      </span>

      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {temArquivo && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
          <button
            className="text-orange-600 hover:text-orange-700 disabled:opacity-60"
            disabled={busy}
            onClick={() => void chamar("view")}
            type="button"
          >
            Abrir documento
          </button>
          {status !== "verified" && (
            <button
              className="text-green-700 hover:text-green-800 disabled:opacity-60"
              disabled={busy}
              onClick={() => void chamar("verify")}
              type="button"
            >
              Marcar como conferido
            </button>
          )}
          {status !== "resend" && (
            <button
              className="text-red-600 hover:text-red-700 disabled:opacity-60"
              disabled={busy}
              onClick={() => void chamar("resend")}
              type="button"
            >
              Pedir reenvio
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PassengerDocumentCell;
