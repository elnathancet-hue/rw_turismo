import type { HomeSection } from "../../lib/content/types";
const BenefitsSection = ({ section }: { section: HomeSection }) => {
  const items = (Array.isArray(section.content?.items) ? section.content.items : [])
    .filter((item: any) => item.active !== false && item.title)
    .sort((a: any, b: any) => Number(a.order ?? 0) - Number(b.order ?? 0));
  if (!items.length) return null;
  return (
    <section className="py-12">
      <h2 className="text-3xl font-semibold">{section.title}</h2>
      {section.subtitle && <p className="mt-2 text-gray-600">{section.subtitle}</p>}
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {items.map((item: any, index: number) => (
          <article className="rounded-xl bg-orange-50 p-6" key={`${item.title}-${index}`}>
            {item.icon && <span className="text-2xl" aria-hidden="true">{item.icon}</span>}
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-gray-600">{item.description ?? item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
};
export default BenefitsSection;
