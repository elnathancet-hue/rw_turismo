import Link from "next/link";
import useWhatsAppWidget from "../../hooks/useWhatsAppWidget";
import { buildWaLink } from "../../lib/content/whatsapp";
import { WhatsAppIcon } from "../WhatsAppFloat";

// Barra de ação dos cards de produto: "Ver pacote" + WhatsApp, controlada
// globalmente na Aparência (widget.cardButtons). Retorna null quando desligada.
const CardActions = ({ href, title }: { href: string; title: string }) => {
  const widget = useWhatsAppWidget();
  if (!widget.cardButtons) return null;

  const waLink = buildWaLink(
    widget.phone,
    `Olá! Tenho interesse em "${title}". Pode me ajudar?`
  );

  return (
    <div className="mt-4 flex flex-col gap-2">
      <Link
        className="w-full rounded-lg bg-orange-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-orange-600"
        href={href}
      >
        {widget.cardButtonLabel || "Ver pacote"}
      </Link>
      {waLink && (
        <a
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
          href={waLink}
          rel="noopener noreferrer"
          target="_blank"
        >
          <WhatsAppIcon className="h-4 w-4" />
          WhatsApp
        </a>
      )}
    </div>
  );
};

export default CardActions;
