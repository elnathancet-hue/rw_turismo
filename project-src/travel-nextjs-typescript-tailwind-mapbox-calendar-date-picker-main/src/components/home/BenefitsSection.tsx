import type { HomeSection } from "../../lib/content/types";
const BenefitsSection = ({ section }: { section: HomeSection }) => {
  const items = Array.isArray(section.content?.items) ? section.content.items : [];
  return (
    <section className="py-12">
      <h2 className="text-3xl font-semibold">{section.title}</h2>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {items.map((item: any, index: number) => (
          <article className="rounded-xl bg-orange-50 p-6" key={`${item.title}-${index}`}>
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-gray-600">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
};
export default BenefitsSection;
