import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Drawer from "../components/Drawer";
import Footer from "../components/Footer";
import Header from "../components/Header";
import PackageSearchBar from "../components/PackageSearchBar";
import { signOutFromSupabase } from "../lib/auth/client";
import { PRODUCT_TYPE_LABELS } from "../lib/content/home-registry";
import { searchPackages } from "../lib/products/client";
import type { Product } from "../lib/products/types";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value
  );

// Parse YYYY-MM-DD as local time (avoids the UTC off-by-one day).
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
};

const Search = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  const origem =
    typeof router.query.origem === "string" ? router.query.origem : "";
  const destino =
    typeof router.query.destino === "string" ? router.query.destino : "";
  const ida = typeof router.query.ida === "string" ? router.query.ida : "";
  const volta = typeof router.query.volta === "string" ? router.query.volta : "";
  const promo = router.query.promo === "1";
  const tipo = typeof router.query.tipo === "string" ? router.query.tipo : "";
  const tipoLabel =
    tipo in PRODUCT_TYPE_LABELS
      ? PRODUCT_TYPE_LABELS[tipo as keyof typeof PRODUCT_TYPE_LABELS]
      : "";

  useEffect(() => {
    if (!router.isReady) return;
    let active = true;
    setStatus("loading");
    searchPackages({ origem, destino, ida, promo, tipo })
      .then((data) => {
        if (!active) return;
        setProducts(data);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [router.isReady, origem, destino, ida, promo, tipo]);

  // Drops one filter param (promo/tipo chips) keeping the rest of the search.
  const removeFilter = (param: "promo" | "tipo") => {
    const query = { ...router.query };
    delete query[param];
    router.push({ pathname: router.pathname, query });
  };

  const heading = promo
    ? "Pacotes em promoção"
    : tipoLabel
      ? tipoLabel
      : destino
        ? `Pacotes para ${destino}`
        : "Pacotes disponíveis";
  const summary = [
    origem && `saindo de ${origem}`,
    ida && `a partir de ${formatDate(ida)}`,
    promo && "somente promoções",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <Header
        isOpen={isOpen}
        searchInput={headerSearch}
        setIsOpen={setIsOpen}
        setSearchInput={setHeaderSearch}
      />
      <main className="mx-auto min-h-[70vh] max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <PackageSearchBar
          initialDestino={destino}
          initialIda={ida}
          initialOrigem={origem}
          initialVolta={volta}
          key={`${origem}|${destino}|${ida}|${volta}`}
        />

        <div className="mt-8">
          <h1 className="text-2xl font-semibold sm:text-3xl">{heading}</h1>
          {summary && <p className="mt-1 text-sm text-gray-500">{summary}</p>}
          {(promo || tipoLabel) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {promo && (
                <button
                  className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700 hover:bg-orange-200"
                  onClick={() => removeFilter("promo")}
                  type="button"
                >
                  Promoções ✕
                </button>
              )}
              {tipoLabel && (
                <button
                  className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700 hover:bg-orange-200"
                  onClick={() => removeFilter("tipo")}
                  type="button"
                >
                  {tipoLabel} ✕
                </button>
              )}
            </div>
          )}
        </div>

        {status === "loading" && (
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div
                className="animate-pulse overflow-hidden rounded-xl border bg-white"
                key={index}
              >
                <div className="h-52 bg-gray-100" />
                <div className="space-y-3 p-5">
                  <div className="h-3 w-1/3 rounded bg-gray-100" />
                  <div className="h-5 w-2/3 rounded bg-gray-100" />
                  <div className="h-4 w-1/4 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            <p>Não foi possível carregar os pacotes agora.</p>
            <button
              className="mt-3 rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600"
              onClick={() => router.reload()}
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {status === "ready" && products.length === 0 && (
          <div className="mt-8 rounded-lg border bg-white p-8 text-center">
            <p className="text-lg font-semibold">Nenhum pacote encontrado</p>
            <p className="mt-1 text-gray-500">
              Tente outra cidade de saída, destino ou data.
            </p>
            <Link
              className="mt-4 inline-flex rounded-full bg-orange-500 px-5 py-2 font-semibold text-white hover:bg-orange-600"
              href="/#pacotes"
            >
              Ver todos os pacotes
            </Link>
          </div>
        )}

        {status === "ready" && products.length > 0 && (
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Link
                className="group overflow-hidden rounded-xl border bg-white shadow-sm hover:shadow-lg"
                href={`/products/${product.slug}`}
                key={product.id}
              >
                <div className="relative h-52 bg-gray-100">
                  {product.cover_image && (
                    <img
                      alt={product.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                      src={product.cover_image}
                    />
                  )}
                  {product.has_future_date === false && (
                    <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      Novas datas em breve
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-sm text-gray-500">
                    {product.origin
                      ? `${product.origin} → ${product.destination}`
                      : product.destination}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">{product.title}</h3>
                  <p className="mt-4 font-semibold text-orange-600">
                    {money(product.promotional_price ?? product.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-item">
          <Link href="/favorites">Meus favoritos</Link>
        </p>
        <p className="drawer-item">
          <Link href="/bookings">Minhas reservas</Link>
        </p>
        <p className="drawer-item">
          <Link href="/blog">Blog</Link>
        </p>
        <button
          className="drawer-item text-left"
          onClick={() => signOutFromSupabase()}
          type="button"
        >
          Sair
        </button>
      </Drawer>
    </div>
  );
};

export default Search;
