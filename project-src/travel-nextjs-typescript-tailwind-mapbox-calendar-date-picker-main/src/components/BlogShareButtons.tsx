import { useState } from "react";

// Botões de compartilhar do post: WhatsApp, Facebook, X e copiar link.
const BlogShareButtons = ({ url, title }: { url: string; title: string }) => {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(title);

  const links = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível — ignora
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-600">Compartilhar:</span>
      {links.map((link) => (
        <a
          className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50"
          href={link.href}
          key={link.label}
          rel="noopener noreferrer"
          target="_blank"
        >
          {link.label}
        </a>
      ))}
      <button
        className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50"
        onClick={copy}
        type="button"
      >
        {copied ? "Copiado!" : "Copiar link"}
      </button>
    </div>
  );
};

export default BlogShareButtons;
