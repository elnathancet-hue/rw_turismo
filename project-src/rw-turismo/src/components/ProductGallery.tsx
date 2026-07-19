import { useEffect, useState, type TouchEvent } from "react";

type Props = {
  cover: string | null;
  gallery: string[];
  title: string;
};

// Galeria da página de produto: imagem principal + miniaturas clicáveis +
// lightbox (teclado ← → Esc e swipe no mobile). Produto só com capa mantém o
// layout de imagem única. Usa <img loading="lazy"> como o resto do app.
const ProductGallery = ({ cover, gallery, title }: Props) => {
  const images = [cover, ...gallery].filter(
    (src, index, arr): src is string =>
      typeof src === "string" && src.length > 0 && arr.indexOf(src) === index
  );

  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
      else if (event.key === "ArrowRight")
        setActive((c) => (c + 1) % images.length);
      else if (event.key === "ArrowLeft")
        setActive((c) => (c - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, images.length]);

  if (images.length === 0) return null;

  const single = images.length === 1;
  const go = (dir: number) =>
    setActive((c) => (c + dir + images.length) % images.length);

  const onTouchStart = (event: TouchEvent) =>
    setTouchStartX(event.touches[0]?.clientX ?? null);
  const onTouchEnd = (event: TouchEvent) => {
    if (touchStartX === null) return;
    const dx = (event.changedTouches[0]?.clientX ?? 0) - touchStartX;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    setTouchStartX(null);
  };

  return (
    <div className="mt-8">
      <div
        className="relative overflow-hidden rounded-lg bg-gray-100"
        onTouchEnd={onTouchEnd}
        onTouchStart={onTouchStart}
      >
        <img
          alt={title}
          className="h-[420px] w-full cursor-zoom-in object-cover"
          loading="lazy"
          onClick={() => setLightbox(true)}
          src={images[active]}
        />
        {!single && (
          <>
            <button
              aria-label="Imagem anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-1 text-xl shadow hover:bg-white"
              onClick={() => go(-1)}
              type="button"
            >
              ‹
            </button>
            <button
              aria-label="Próxima imagem"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-1 text-xl shadow hover:bg-white"
              onClick={() => go(1)}
              type="button"
            >
              ›
            </button>
            <span className="absolute bottom-3 right-3 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              {active + 1}/{images.length}
            </span>
          </>
        )}
      </div>

      {!single && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, index) => (
            <button
              aria-label={`Foto ${index + 1}`}
              className={`h-16 w-24 flex-shrink-0 overflow-hidden rounded border-2 transition ${
                index === active
                  ? "border-orange-500"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
              key={src}
              onClick={() => setActive(index)}
              type="button"
            >
              <img
                alt={`${title} — foto ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
                src={src}
              />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            aria-label="Fechar"
            className="absolute right-4 top-4 text-3xl text-white/80 hover:text-white"
            onClick={() => setLightbox(false)}
            type="button"
          >
            ✕
          </button>
          <img
            alt={title}
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
            onTouchEnd={onTouchEnd}
            onTouchStart={onTouchStart}
            src={images[active]}
          />
          {!single && (
            <>
              <button
                aria-label="Imagem anterior"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-4xl text-white/80 hover:text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  go(-1);
                }}
                type="button"
              >
                ‹
              </button>
              <button
                aria-label="Próxima imagem"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-4xl text-white/80 hover:text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  go(1);
                }}
                type="button"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
