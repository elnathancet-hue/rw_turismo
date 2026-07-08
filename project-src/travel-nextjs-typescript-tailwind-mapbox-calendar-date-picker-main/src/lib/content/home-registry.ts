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
      "Vitrine filtrada (promoções, por tipo…) com botão ver mais.",
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

export type CollectionMode = "promo" | "type" | "all";

export type CollectionContent = {
  mode: CollectionMode;
  product_type?: Product["type"];
  limit?: number;
  cta_label?: string;
};

export const normalizeCollectionContent = (
  content: Record<string, any> | null | undefined
): Required<CollectionContent> => {
  const mode: CollectionMode =
    content?.mode === "type" || content?.mode === "all"
      ? content.mode
      : "promo";
  const product_type: Product["type"] =
    content?.product_type && content.product_type in PRODUCT_TYPE_LABELS
      ? content.product_type
      : "package";
  const limit = Math.min(Math.max(Number(content?.limit ?? 6), 1), 12);
  const cta_label =
    typeof content?.cta_label === "string" && content.cta_label.trim()
      ? content.cta_label
      : "Ver mais";
  return { mode, product_type, limit, cta_label };
};

// Where the section's "ver mais" button points — the search page understands
// these query params (promo=1, tipo=<product type>).
export const collectionUrl = (
  content: Record<string, any> | null | undefined
): string => {
  const { mode, product_type } = normalizeCollectionContent(content);
  if (mode === "promo") return "/search?promo=1";
  if (mode === "type") return `/search?tipo=${product_type}`;
  return "/search";
};

// In-memory filter over the products the home already loads server-side.
export const filterCollectionProducts = (
  products: Product[],
  content: Record<string, any> | null | undefined
): Product[] => {
  const { mode, product_type, limit } = normalizeCollectionContent(content);
  const matches = products.filter((product) => {
    if (mode === "promo") return product.promotional_price != null;
    if (mode === "type") return product.type === product_type;
    return true;
  });
  return matches.slice(0, limit);
};

export const isCollectionSection = (section: HomeSection): boolean =>
  sectionTypeOf(section.section_key) === "product_collection";
