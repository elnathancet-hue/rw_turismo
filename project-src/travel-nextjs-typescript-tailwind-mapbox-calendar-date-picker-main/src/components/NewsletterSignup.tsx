import { FormEvent, useState } from "react";
import { submitSiteLead } from "../lib/leads/client";

// Captação de e-mail no fim do post → vira lead no CRM (interesse "newsletter"),
// reusando o fluxo de leads do site.
const NewsletterSignup = () => {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !email.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    setSending(true);
    try {
      await submitSiteLead({
        name: email.trim(),
        email,
        interest: "newsletter",
      });
      setDone(true);
    } catch {
      setError("Não foi possível cadastrar agora. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-green-800">
        Pronto! Você vai receber nossas novidades. 🎉
      </div>
    );
  }

  return (
    <form className="rounded-xl border bg-white p-6" onSubmit={submit}>
      <h2 className="text-xl font-semibold">Receba nossas novidades</h2>
      <p className="mt-1 text-sm text-gray-600">
        Dicas de viagem e promoções no seu e-mail.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="min-w-[220px] flex-1 rounded-lg border px-3 py-2"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seu@email.com"
          type="email"
          value={email}
        />
        <button
          className="rounded-lg bg-orange-500 px-5 py-2 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          disabled={sending}
          type="submit"
        >
          {sending ? "Enviando…" : "Assinar"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
};

export default NewsletterSignup;
