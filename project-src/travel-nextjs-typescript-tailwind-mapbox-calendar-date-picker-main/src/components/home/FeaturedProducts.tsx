import Link from "next/link";
import type { Product } from "../../lib/products/types";
import type { HomeSection } from "../../lib/content/types";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const FeaturedProducts = ({ section, products }: { section: HomeSection; products: Product[] }) => {
  const ids = Array.isArray(section.content?.product_ids)
    ? (section.content.product_ids as string[])
    : null;
  const selected = ids
    ? ids
        .map((id) => products.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product))
    : products;
  const limit = Math.min(Math.max(Number(section.content?.limit ?? 6), 1), 12);
  const items = selected.slice(0, limit);
  if (!items.length) return null;
  return (
    <section className="py-12" id="pacotes">
      <h2 className="text-3xl font-semibold">{section.title}</h2>
      {section.subtitle && <p className="mt-2 text-gray-600">{section.subtitle}</p>}
      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((product) => (
          <Link className="group overflow-hidden rounded-xl border bg-white shadow-sm hover:shadow-lg" href={`/products/${product.slug}`} key={product.id}>
            <div className="h-52 bg-gray-100">
              {product.cover_image && <img alt={product.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" src={product.cover_image} />}
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-500">{product.destination}</p>
              <h3 className="mt-1 text-xl font-semibold">{product.title}</h3>
              <p className="mt-4 font-semibold text-orange-600">{money(product.promotional_price ?? product.price)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
export default FeaturedProducts;
