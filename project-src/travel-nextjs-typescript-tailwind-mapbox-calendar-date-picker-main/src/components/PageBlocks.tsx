import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { PageBlock } from "../lib/content/types";
import { submitSiteLead } from "../lib/leads/client";
import { gaEvent } from "../lib/analytics/gtag";
import MarkdownContent from "./MarkdownContent";

const buttonClass =
  "inline-flex rounded-lg bg-orange-500 px-6 py-2.5 font-semibold text-white transition hover:bg-orange-600";

const BlockButton = ({ label, url }: { label: string; url: string }) => {
  if (!label || !url) return null;
  if (url.startsWith("/") || url.startsWith("#")) {
    return (
      <Link className={buttonClass} href={url}>
        {label}
      </Link>
    );
  }
  return (
    <a className={buttonClass} href={url} rel="noopener noreferrer" target="_blank">
      {label}
    </a>
  );
};

const toEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  const youtube = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/
  );
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
};

const spacerHeight: Record<string, string> = {
  small: "h-6",
  medium: "h-12",
  large: "h-24",
};

// Named export: the admin page builder renders each block through this same
// component, so the editing canvas matches the published page exactly.
export const PageBlockView = ({ block }: { block: PageBlock }) => {
  switch (block.type) {
    case "text":
      return (
        <MarkdownContent
          className="prose prose-lg max-w-none prose-headings:font-semibold prose-a:font-medium prose-a:text-orange-600"
          content={block.markdown}
        />
      );
    case "image":
      return (
        <figure>
          {block.url && (
            <img
              alt={block.alt}
              className="w-full rounded-xl object-cover"
              src={block.url}
            />
          )}
          {block.caption && (
            <figcaption className="mt-2 text-center text-sm text-gray-500">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    case "gallery":
      return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {block.images
            .filter((image) => image.url)
            .map((image, index) => (
              <img
                alt={image.alt}
                className="h-48 w-full rounded-lg object-cover"
                key={index}
                loading="lazy"
                src={image.url}
              />
            ))}
        </div>
      );
    case "banner":
      return (
        <section className="relative overflow-hidden rounded-2xl bg-slate-900 text-white">
          {block.image && (
            <img
              alt={block.title}
              className="absolute inset-0 h-full w-full object-cover opacity-60"
              src={block.image}
            />
          )}
          <div className="relative px-8 py-16 sm:px-12">
            {block.title && (
              <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">
                {block.title}
              </h2>
            )}
            {block.subtitle && (
              <p className="mt-3 max-w-xl text-white/90">{block.subtitle}</p>
            )}
            {block.button_label && (
              <div className="mt-6">
                <BlockButton label={block.button_label} url={block.button_url} />
              </div>
            )}
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="rounded-2xl bg-orange-50 p-8 text-center">
          {block.title && (
            <h2 className="text-2xl font-semibold">{block.title}</h2>
          )}
          {block.text && (
            <p className="mx-auto mt-2 max-w-xl text-gray-600">{block.text}</p>
          )}
          {block.button_label && (
            <div className="mt-5">
              <BlockButton label={block.button_label} url={block.button_url} />
            </div>
          )}
        </section>
      );
    case "video": {
      const embed = toEmbedUrl(block.url);
      return (
        <figure>
          {embed && (
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
                src={embed}
                title={block.caption || "Vídeo"}
              />
            </div>
          )}
          {block.caption && (
            <figcaption className="mt-2 text-center text-sm text-gray-500">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "quote":
      return (
        <blockquote className="border-l-4 border-orange-500 bg-orange-50 px-6 py-5">
          <p className="text-lg italic text-gray-800">{block.text}</p>
          {block.author && (
            <footer className="mt-2 text-sm font-semibold text-gray-600">
              — {block.author}
            </footer>
          )}
        </blockquote>
      );
    case "faq":
      return (
        <div className="divide-y rounded-xl border">
          {block.items
            .filter((item) => item.question)
            .map((item, index) => (
              <details className="group px-5 py-4" key={index}>
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold marker:content-none">
                  {item.question}
                  <span className="ml-2 text-xl text-orange-500 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-gray-600">
                  {item.answer}
                </p>
              </details>
            ))}
        </div>
      );
    case "spacer":
      return (
        <div aria-hidden="true" className={spacerHeight[block.size] ?? "h-12"} />
      );
    case "form":
      return <LeadFormBlock block={block} />;
    default:
      return null;
  }
};

const leadInputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-orange-500";

// Bloco de captação: os envios viram leads no CRM (origem "Formulário do
// site"), carregando a UTM da campanha guardada no navegador.
const LeadFormBlock = ({
  block,
}: {
  block: Extract<PageBlock, { type: "form" }>;
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim() || (!phone.trim() && !email.trim())) {
      setError("Preencha seu nome e um contato (WhatsApp ou e-mail).");
      return;
    }
    setIsSending(true);
    try {
      await submitSiteLead({
        name,
        phone,
        email,
        message,
        interest: block.interest,
      });
      gaEvent("generate_lead", { interest: block.interest ?? undefined });
      setDone(true);
    } catch {
      setError("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
      {block.title && <h2 className="text-2xl font-semibold">{block.title}</h2>}
      {block.subtitle && <p className="mt-1 text-gray-600">{block.subtitle}</p>}

      {done ? (
        <p
          className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"
          role="status"
        >
          {block.success_message || "Recebemos seus dados! Obrigado."}
        </p>
      ) : (
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <label className="block text-sm font-medium text-gray-700">
            Nome
            <input
              className={leadInputClass}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            WhatsApp
            <input
              className={leadInputClass}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(86) 9…"
              type="tel"
              value={phone}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
            E-mail
            <input
              className={leadInputClass}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
            Mensagem (opcional)
            <textarea
              className={`${leadInputClass} min-h-[90px]`}
              onChange={(event) => setMessage(event.target.value)}
              value={message}
            />
          </label>
          {error && (
            <p
              className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:col-span-2"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <button
              className="rounded-lg bg-orange-500 px-6 py-2.5 font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
              disabled={isSending}
              type="submit"
            >
              {isSending
                ? "Enviando…"
                : block.button_label || "Quero saber mais"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

const PageBlocks = ({ blocks }: { blocks: PageBlock[] }) => (
  <div className="space-y-10">
    {blocks.map((block) => (
      <div key={block.id}>
        <PageBlockView block={block} />
      </div>
    ))}
  </div>
);

export default PageBlocks;
