import Link from "next/link";
import type { PageBlock } from "../lib/content/types";
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

const PageBlockView = ({ block }: { block: PageBlock }) => {
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
    default:
      return null;
  }
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
