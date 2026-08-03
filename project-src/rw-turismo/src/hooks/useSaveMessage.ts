import { useCallback, useEffect, useState } from "react";

// Retorno de "salvou / não salvou" com sumiço automático — mesmo comportamento
// que HomeBuilder e PageBuilder já usavam, extraído para os demais formulários
// não precisarem reinventar.
//
// Por que isso existe: um formulário que grava e não diz nada faz o usuário
// clicar em Salvar de novo achando que não pegou. O botão volta ao normal em
// silêncio e não dá para distinguir "salvou" de "não fez nada".

export type SaveMessage = { tone: "ok" | "error"; text: string };

const DISMISS_MS = 4000;

export const useSaveMessage = () => {
  const [message, setMessage] = useState<SaveMessage | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const showOk = useCallback(
    (text: string) => setMessage({ tone: "ok", text }),
    []
  );
  const showError = useCallback(
    (text: string) => setMessage({ tone: "error", text }),
    []
  );
  const clearMessage = useCallback(() => setMessage(null), []);

  return { message, showOk, showError, clearMessage };
};

export default useSaveMessage;
