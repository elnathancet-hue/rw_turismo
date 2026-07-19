import type { HomeSection } from "./types";
import type { Product } from "../products/types";

// ---------------------------------------------------------------------------
// Registry of home section types — the single place that defines what kinds
// of section the home supports.
//
// To add a NEW section type in the future:
//   1. Add an entry to `sectionRegistry` below (label, defaults, singleton).
//   2. Render it in src/components/home/HomeSectionRenderer.tsx.
//   3. Add its fields to the inspector in the home builder (SectionFields).
//
// Multi-instance types (singleton: false) get section_keys like
// "product_collection__ab12x" — the part before "__" is the type, so the
// unique constraint on home_sections.section_key still holds per instance.
// ---------------------------------------------------------------------------

export const sectionTypeOf = (sectionKey: string): string =>
  sectionKey.split("__")[0];

export const newSectionKey = (type: string, singleton: boolean): string =>
  singleton
    ? type
    : `${type}__${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 5)}`;

export type SectionTypeMeta = {
  type: string;
  label: string;
  description: string;
  // Only one instance allowed on the page (matches legacy fixed sections).
  singleton: boolean;
  defaults: {
    title: string;
    subtitle: string;
    content: Record<string, any>;
    active: boolean;
  };
};

export const PRODUCT_TYPE_LABELS: Record<Product["type"], string> = {
  package: "Pacotes",
  flight: "Passagens e voos",
  hotel: "Hotéis",
  stay: "Hospedagens",
  experience: "Experiências",
};

export const sectionRegistry: SectionTypeMeta[] = [
  {
    type: "product_collection",
    label: "Coleção de viagens",
    description:
      "Fileira de viagens que se preenche sozinha: promoções, por tipo ou todas.",
    singleton: false,
    defaults: {
      title: "Ofertas e promoções",
      subtitle: "Aproveite antes que as vagas acabem.",
      content: {
        mode: "promo",
        product_type: "package",
        limit: 6,
        cta_label: "Ver todas as promoções",
      },
      active: true,
    },
  },
  {
    type: "featured_products",
    label: "Produtos em destaque",
    description: "Vitrine com produtos escolhidos a dedo.",
    singleton: true,
    defaults: {
      title: "Pacotes em destaque",
      subtitle: "Experiências selecionadas para sua próxima viagem.",
      content: { product_ids: [], limit: 6 },
      active: true,
    },
  },
  {
    type: "destinations",
    label: "Destinos",
    description: "Cards de destinos com foto e link.",
    singleton: true,
    defaults: {
      title: "Destinos mais procurados",
      subtitle: "Inspire-se para sua próxima viagem.",
      content: { items: [] },
      active: true,
    },
  },
  {
    type: "benefits",
    label: "Benefícios",
    description: "Motivos para viajar com a agência.",
    singleton: true,
    defaults: {
      title: "Viaje com tranquilidade",
      subtitle: "",
      content: { items: [] },
      active: true,
    },
  },
  {
    type: "testimonials",
    label: "Depoimentos",
    description: "Avaliações reais de clientes.",
    singleton: true,
    defaults: {
      title: "Quem viaja com a RW Turismo recomenda",
      subtitle: "",
      content: { items: [] },
      active: false,
    },
  },
  {
    type: "promotional_banner",
    label: "Chamada promocional",
    description: "Faixa de destaque com texto e botão.",
    singleton: true,
    defaults: {
      title: "Pronto para sua próxima viagem?",
      subtitle: "",
      content: { text: "", button_text: "", button_url: "" },
      active: false,
    },
  },
];

export const sectionMetaOf = (sectionKey: string): SectionTypeMeta | null =>
  sectionRegistry.find((meta) => meta.type === sectionTypeOf(sectionKey)) ??
  null;

// ---------------------------------------------------------------------------
// product_collection helpers — shared by the public renderer, the search page
// URL contract and the home builder preview.
// ---------------------------------------------------------------------------

export type CollectionMode =
  | "promo"
  | "type"
  | "destination"
  | "origin"
  | "category"
  | "all";

export const COLLECTION_MODES: CollectionMode[] = [
  "promo",
  "type",
  "destination",
  "origin",
  "category",
  "all",
];

export type CollectionContent = {
  mode: CollectionMode;
  product_type?: Product["type"];
  // Free-text values that must match the product's own field exactly.
  destination?: string;
  origin?: string;
  // Id da categoria escolhida (a ligação produto↔categoria vem em category_ids).
  category_id?: string;
  limit?: number;
  cta_label?: string;
};

export const normalizeCollectionContent = (
  content: Record<string, any> | null | undefined
): Required<CollectionContent> => {
  const rawMode = content?.mode;
  const mode: CollectionMode = COLLECTION_MODES.includes(rawMode)
    ? rawMode
    : "promo";
  const product_type: Product["type"] =
    content?.product_type && content.product_type in PRODUCT_TYPE_LABELS
      ? content.product_type
      : "package";
  const destination =
    typeof content?.destination === "string" ? content.destination : "";
  const origin = typeof content?.origin === "string" ? content.origin : "";
  const category_id =
    typeof content?.category_id === "string" ? content.category_id : "";
  const limit = Math.min(Math.max(Number(content?.limit ?? 6), 1), 12);
  const cta_label =
    typeof content?.cta_label === "string" && content.cta_label.trim()
      ? content.cta_label
      : "Ver mais";
  return {
    mode,
    product_type,
    destination,
    origin,
    category_id,
    limit,
    cta_label,
  };
};

// Where the section's "ver mais" button points — the search page understands
// these query params (promo=1, tipo=, destino=, origem=).
export const collectionUrl = (
  content: Record<string, any> | null | undefined
): string => {
  const { mode, product_type, destination, origin } =
    normalizeCollectionContent(content);
  if (mode === "promo") return "/search?promo=1";
  if (mode === "type") return `/search?tipo=${product_type}`;
  if (mode === "destination")
    return destination
      ? `/search?destino=${encodeURIComponent(destination)}`
      : "/search";
  if (mode === "origin")
    return origin ? `/search?origem=${encodeURIComponent(origin)}` : "/search";
  // A busca ainda não filtra por categoria, então o "ver mais" abre a busca geral.
  return "/search";
};

// In-memory filter over the products the home already loads server-side.
export const filterCollectionProducts = (
  products: Product[],
  content: Record<string, any> | null | undefined
): Product[] => {
  const { mode, product_type, destination, origin, category_id, limit } =
    normalizeCollectionContent(content);
  const matches = products.filter((product) => {
    if (mode === "promo") return product.promotional_price != null;
    if (mode === "type") return product.type === product_type;
    if (mode === "destination")
      return !!destination && product.destination === destination;
    if (mode === "origin") return !!origin && product.origin === origin;
    if (mode === "category")
      return !!category_id && (product.category_ids ?? []).includes(category_id);
    return true;
  });
  return matches.slice(0, limit);
};

export const isCollectionSection = (section: HomeSection): boolean =>
  sectionTypeOf(section.section_key) === "product_collection";
