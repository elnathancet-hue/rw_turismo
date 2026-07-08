import Link from "next/link";
import type { Product } from "../../lib/products/types";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const ProductCard = ({ product }: { product: Product }) => {
  const promotionalPrice = product.promotional_price;
  return (
    <Link className="group overflow-hidden rounded-xl border bg-white shadow-sm hover:shadow-lg" href={`/products/${product.slug}`}>
      <div className="relative h-52 bg-gray-100">
        {product.cover_image && <img alt={product.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" src={product.cover_image} />}
        {promotionalPrice != null && (
          <span className="absolute top-3 left-3 bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 text-xs font-semibold">
            Promoção
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="text-sm text-gray-500">{product.destination}</p>
        <h3 className="mt-1 text-xl font-semibold">{product.title}</h3>
        {promotionalPrice != null ? (
          <p className="mt-4 flex items-baseline gap-2">
            <span className="line-through text-gray-400 text-sm">{money(product.price)}</span>
            <span className="font-semibold text-orange-600">{money(promotionalPrice)}</span>
          </p>
        ) : (
          <p className="mt-4 font-semibold text-orange-600">{money(product.price)}</p>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
