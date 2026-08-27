import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export type PassengerDocument = {
  id: string;
  full_name: string;
  document_status: string;
};

type Props = {
  bookingId: string;
  accessToken: string;
  passengers: PassengerDocument[];
  onUploaded: () => void;
};

const BUCKET = "booking-documents";
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

const STATUS_LABEL: Record<string, string> = {
  pending: "Documento pendente",
  uploaded: "Enviado, em conferência",
  verified: "Documento conferido",
  resend: "Precisa reenviar",
  purged: "Arquivo removido (prazo de guarda)",
};

const STATUS_TONE: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  uploaded: "border-blue-200 bg-blue-50 text-blue-800",
  verified: "border-green-200 bg-green-50 text-green-800",
  resend: "border-red-200 bg-red-50 text-red-700",
  purged: "border-gray-200 bg-gray-50 text-gray-500",
};

// Envio do documento obrigatório.
//
// O arquivo NÃO passa pelo nosso servidor e NÃO vai para bucket público: o
// servidor emite uma permissão de escrita curta para um caminho específico, e o
// navegador envia direto para o Storage privado. É o que permite funcionar
// também na compra sem cadastro, em que não há sessão para o RLS avaliar.
const DocumentUpload = ({
  bookingId,
  accessToken,
  passengers,
  onUploaded,
}: Props) => {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendentes = passengers.filter(
    (passenger) => passenger.document_status !== "not_required"
  );

  if (pendentes.length === 0) return null;

  const enviar = async (passengerId: string, file?: File) => {
    if (!file) return;
    setError(null);

    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" passa de 10 MB.`);
      return;
    }

    setBusyId(passengerId);
    try {
      const pedido = await fetch(`/api/bookings/${bookingId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload-url",
          access_token: accessToken,
          passenger_id: passengerId,
          content_type: file.type,
        }),
      });
      const permissao = await pedido.json();
      if (!pedido.ok) {
        throw new Error(permissao?.error ?? "Não foi possível enviar.");
      }

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(permissao.path, permissao.token, file);
      if (uploadError) throw new Error("Falha ao enviar o arquivo.");

      // Só depois do arquivo no lugar é que o registro muda de status — assim
      // um envio interrompido não libera o pagamento.
      const confirma = await fetch(`/api/bookings/${bookingId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          access_token: accessToken,
          passenger_id: passengerId,
          path: permissao.path,
        }),
      });
      if (!confirma.ok) {
        const payload = await confirma.json();
        throw new Error(payload?.error ?? "Não foi possível registrar.");
      }

      onUploaded();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível enviar."
      );
    } finally {
      setBusyId(null);
      const input = inputRefs.current[passengerId];
      if (input) input.value = "";
    }
  };

  return (
    <section className="mt-6 rounded-lg border bg-white p-4">
      <h2 className="font-semibold">Documentos obrigatórios</h2>
      <p className="mt-1 text-sm text-gray-500">
        Enviamos ao setor de operações. O pagamento libera assim que o arquivo
        chegar — a conferência é feita depois.
      </p>

      {error && (
        <p
          className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}

      <ul className="mt-3 space-y-3">
        {pendentes.map((passenger) => {
          const enviando = busyId === passenger.id;
          const precisaEnviar =
            passenger.document_status === "pending" ||
            passenger.document_status === "resend";

          return (
            <li className="rounded border p-3" key={passenger.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{passenger.full_name}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                    STATUS_TONE[passenger.document_status] ??
                    "border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                >
                  {STATUS_LABEL[passenger.document_status] ??
                    passenger.document_status}
                </span>
              </div>

              {precisaEnviar && (
                <>
                  <button
                    className="mt-2 text-sm font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-60"
                    disabled={enviando}
                    onClick={() => inputRefs.current[passenger.id]?.click()}
                    type="button"
                  >
                    {enviando ? "Enviando…" : "Escolher arquivo"}
                  </button>
                  <p className="text-xs text-gray-400">
                    JPG, PNG, WEBP ou PDF, até 10 MB
                  </p>
                  <input
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(event) =>
                      void enviar(passenger.id, event.target.files?.[0])
                    }
                    ref={(element) => {
                      inputRefs.current[passenger.id] = element;
                    }}
                    type="file"
                  />
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default DocumentUpload;
