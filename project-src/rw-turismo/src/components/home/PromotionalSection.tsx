import Link from "next/link";
import type { HomeSection } from "../../lib/content/types";
import { hrefSeguro } from "../../lib/security/url";

const PromotionalSection = ({ section }: { section: HomeSection }) => {
  // button_url é gravado pelo papel `conteudo` e ia direto para o href.
  // Ver lib/security/url.ts.
  const botaoHref = hrefSeguro(section.content?.button_url);

  return (
    <section className="my-12 rounded-2xl bg-orange-50 px-6 py-10 sm:px-10">
      <h2 className="text-3xl font-semibold">{section.title}</h2>
      {section.subtitle && (
        <p className="mt-2 text-gray-600">{section.subtitle}</p>
      )}
      {section.content?.text && (
        <p className="mt-5 max-w-3xl whitespace-pre-wrap text-gray-700">
          {section.content.text}
        </p>
      )}
      {section.content?.button_text && botaoHref && (
        <Link
          className="mt-6 inline-flex rounded-lg bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600"
          href={botaoHref}
        >
          {section.content.button_text}
        </Link>
      )}
    </section>
  );
};

export default PromotionalSection;
