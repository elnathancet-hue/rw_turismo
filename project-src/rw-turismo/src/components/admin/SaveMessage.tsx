import type { SaveMessage as Message } from "../../hooks/useSaveMessage";

// Faixa de confirmação/erro dos formulários do painel. role="status" faz o
// leitor de tela anunciar o "salvo" — sem isso, quem não enxerga a faixa não
// recebe retorno nenhum.
const SaveMessage = ({ message }: { message: Message | null }) => {
  if (!message) return null;

  const isOk = message.tone === "ok";

  return (
    <p
      className={`rounded border p-3 text-sm ${
        isOk
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
      role={isOk ? "status" : "alert"}
    >
      {isOk ? "✓ " : ""}
      {message.text}
    </p>
  );
};

export default SaveMessage;
