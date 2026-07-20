import Link from "next/link";
import CardActions from "./CardActions";
import type { Product } from "../../lib/products/types";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

// Imagem e texto são links pro pacote; a barra de ação (Ver pacote + WhatsApp)
// aparece embaixo quando ligada na Aparência. Por isso o card é um <article>
// (âncora dentro de âncora não é válida).
const ProductCard = ({ product }: { product: Product }) => {
  const promotionalPrice = product.promotional_price;
  const href = `/products/${product.slug}`;

  return (
    <article className="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-lg">
      <Link className="block" href={href}>
        <div className="relative h-52 bg-gray-100">
          {product.cover_image && (
            <img alt={product.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" src={product.cover_image} />
          )}
          {promotionalPrice != null && (
            <span className="absolute top-3 left-3 bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 text-xs font-semibold">
              Promoção
            </span>
          )}
          {product.has_future_date === false && (
            <span className="absolute top-3 right-3 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Novas datas em breve
            </span>
          )}
        </div>
      </Link>
      <div className="p-5">
        <Link className="block" href={href}>
          <p className="text-sm text-gray-500">{product.destination}</p>
          <h3 className="mt-1 text-xl font-semibold">{product.title}</h3>
          {product.description && (
            <p className="mt-2 line-clamp-2 text-sm text-gray-500">
              {product.description}
            </p>
          )}
          {promotionalPrice != null ? (
            <span className="mt-4 flex items-baseline gap-2">
              <span className="line-through text-gray-400 text-sm">{money(product.price)}</span>
              <span className="font-semibold text-orange-600">{money(promotionalPrice)}</span>
            </span>
          ) : (
            <span className="mt-4 block font-semibold text-orange-600">{money(product.price)}</span>
          )}
        </Link>
        <CardActions href={href} title={product.title} />
      </div>
    </article>
  );
};

export default ProductCard;
