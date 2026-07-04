import Link from "next/link";
import type { HomeSection } from "../../lib/content/types";

const DestinationsSection = ({ section }: { section: HomeSection }) => {
  const items = Array.isArray(section.content?.items) ? section.content.items : [];
  return (
    <section className="py-12">
      <h2 className="text-3xl font-semibold">{section.title}</h2>
      {section.subtitle && <p className="mt-2 text-gray-600">{section.subtitle}</p>}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item: any, index: number) => (
          <Link className="relative min-h-[240px] overflow-hidden rounded-xl bg-slate-800" href={item.url || "#"} key={`${item.title}-${index}`}>
            {item.image && <img alt={item.title || "Destino"} className="absolute inset-0 h-full w-full object-cover opacity-70" loading="lazy" src={item.image} />}
            <div className="relative flex min-h-[240px] flex-col justify-end p-6 text-white">
              <h3 className="text-2xl font-semibold">{item.title}</h3>
              {item.subtitle && <p>{item.subtitle}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
export default DestinationsSection;
