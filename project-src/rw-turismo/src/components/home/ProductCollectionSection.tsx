import Link from "next/link";
import {
  collectionUrl,
  filterCollectionProducts,
  normalizeCollectionContent,
} from "../../lib/content/home-registry";
import type { HomeSection } from "../../lib/content/types";
import type { Product } from "../../lib/products/types";
import ProductCard from "./ProductCard";

const ProductCollectionSection = ({ section, products }: { section: HomeSection; products: Product[] }) => {
  const items = filterCollectionProducts(products, section.content);
  if (!items.length) return null;
  const { cta_label } = normalizeCollectionContent(section.content);
  return (
    <section className="py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold">{section.title}</h2>
          {section.subtitle && <p className="mt-2 text-gray-600">{section.subtitle}</p>}
        </div>
        <Link className="text-orange-600 font-semibold hover:text-orange-700" href={collectionUrl(section.content)}>
          {cta_label} →
        </Link>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
};

export default ProductCollectionSection;
