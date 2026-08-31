import Link from "next/link";
import type { HomeBanner } from "../../lib/content/types";
import { hrefSeguro } from "../../lib/security/url";

const HeroBanner = ({ banner }: { banner: HomeBanner }) => {
  // button_url vem do banco (papel `conteudo`) e ia direto para o href — o
  // React 18 renderiza `javascript:` com um aviso. Ver lib/security/url.ts.
  const botaoHref = hrefSeguro(banner.button_url);

  return (
    <section className="relative min-h-[430px] overflow-hidden bg-slate-900">
      {banner.image_url && (
        <picture>
          {banner.mobile_image_url && (
            <source media="(max-width: 640px)" srcSet={banner.mobile_image_url} />
          )}
          <img
            alt={banner.title ?? "RW Turismo"}
            className="absolute inset-0 h-full w-full object-cover"
            src={banner.image_url}
          />
        </picture>
      )}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: Number(banner.overlay_strength ?? 0.35) }}
      />
      <div className="relative mx-auto flex min-h-[430px] max-w-7xl flex-col justify-center px-8 py-16 text-white sm:px-16">
        <h1 className="max-w-3xl text-4xl font-bold sm:text-6xl">{banner.title}</h1>
        {banner.subtitle && (
          <p className="mt-4 max-w-2xl text-lg text-white/90">{banner.subtitle}</p>
        )}
        {banner.button_text && botaoHref && (
          <Link
            className="mt-7 w-fit rounded-full bg-orange-500 px-6 py-3 font-semibold hover:bg-orange-600"
            href={botaoHref}
          >
            {banner.button_text}
          </Link>
        )}
      </div>
    </section>
  );
};

export default HeroBanner;
