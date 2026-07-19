import type { HomeSection } from "../../lib/content/types";
import type { Product } from "../../lib/products/types";
import ProductCard from "./ProductCard";

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
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
};
export default FeaturedProducts;
