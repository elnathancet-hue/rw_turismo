import type { HomeSection } from "../../lib/content/types";

type Testimonial = {
  name?: string;
  city?: string;
  text?: string;
  photo?: string;
  active?: boolean;
  order?: number;
};

const TestimonialsSection = ({ section }: { section: HomeSection }) => {
  const items = (Array.isArray(section.content?.items)
    ? section.content.items
    : []) as Testimonial[];
  const visible = items
    .filter((item) => item.active !== false && item.name && item.text)
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

  if (!visible.length) return null;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-semibold">{section.title}</h2>
      {section.subtitle && (
        <p className="mt-2 text-gray-600">{section.subtitle}</p>
      )}
      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((item, index) => (
          <article
            className="rounded-xl border bg-white p-6 shadow-sm"
            key={`${item.name}-${index}`}
          >
            <p className="text-gray-700">“{item.text}”</p>
            <div className="mt-5 flex items-center gap-3">
              {item.photo && (
                <img
                  alt={item.name}
                  className="h-12 w-12 rounded-full object-cover"
                  loading="lazy"
                  src={item.photo}
                />
              )}
              <div>
                <p className="font-semibold">{item.name}</p>
                {item.city && (
                  <p className="text-sm text-gray-500">{item.city}</p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default TestimonialsSection;
