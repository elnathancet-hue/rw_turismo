import { FormEvent, useState } from "react";
import { subscribeNewsletter } from "../../lib/content/client";
import type { HomeSection } from "../../lib/content/types";
const NewsletterSection = ({ section }: { section: HomeSection }) => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMessage("Informe um e-mail válido.");
    try {
      await subscribeNewsletter(email);
      setEmail("");
      setMessage("Cadastro realizado. Obrigado!");
    } catch {
      setMessage("Não foi possível cadastrar este e-mail agora.");
    }
  };
  return (
    <section className="my-12 rounded-2xl bg-slate-900 px-6 py-10 text-white sm:px-10">
      <h2 className="text-3xl font-semibold">{section.title}</h2>
      {section.subtitle && <p className="mt-2 text-slate-300">{section.subtitle}</p>}
      <form className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row" onSubmit={submit}>
        <input aria-label="E-mail" className="flex-1 rounded-lg px-4 py-3 text-slate-900" onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" type="email" value={email} />
        <button className="rounded-lg bg-orange-500 px-5 py-3 font-semibold" type="submit">Quero receber</button>
      </form>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </section>
  );
};
export default NewsletterSection;
