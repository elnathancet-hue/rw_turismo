import EditableHome from "../components/home/EditableHome";
import { getPublicHomeContent } from "../lib/content/server";
import type { HomeBanner, HomeSection, SiteSetting } from "../lib/content/types";
import { fallbackProducts } from "../lib/products/fallback";
import {
  getActiveProductsServer,
  getFutureDateProductIdsServer,
} from "../lib/products/server";

export default EditableHome;

export const getStaticProps = async () => {
  let products = fallbackProducts;
  let sections: HomeSection[] = [
    {
      id: "fallback-featured",
      section_key: "featured_products",
      title: "Pacotes em destaque",
      subtitle: null,
      content: { limit: 6 },
      active: true,
      display_order: 10,
      created_at: "",
      updated_at: "",
    },
    {
      id: "fallback-benefits",
      section_key: "benefits",
      title: "Viaje com tranquilidade",
      subtitle: null,
      content: {
        items: [
          { title: "Atendimento próximo", text: "Conte com nossa equipe." },
          {
            title: "Experiências selecionadas",
            text: "Roteiros escolhidos com cuidado.",
          },
          { title: "Reserva segura", text: "Seus dados protegidos." },
        ],
      },
      active: true,
      display_order: 20,
      created_at: "",
      updated_at: "",
    },
  ];
  let banners: HomeBanner[] = [
    {
      id: "fallback-banner",
      title: "Sua próxima viagem começa aqui",
      subtitle: "Pacotes e experiências escolhidos para você.",
      image_url: "/banner1200x600.jpg",
      mobile_image_url: null,
      button_text: "Ver pacotes",
      button_url: "#pacotes",
      overlay_strength: 0.35,
      active: true,
      display_order: 0,
      starts_at: null,
      ends_at: null,
      created_at: "",
      updated_at: "",
    },
  ];
  let settings: SiteSetting[] = [
    {
      id: "fallback-seo",
      setting_key: "home_seo",
      value: {
        title: "RW Turismo",
        description: "Pacotes, experiências e destinos para sua próxima viagem.",
        og_image: "/banner1200x600.jpg",
      },
      updated_at: "",
    },
  ];

  try {
    products = await getActiveProductsServer();
    // Rotula e despriorizada quem está sem saída futura (vitrine honesta:
    // continua visível — vira captação de lista de espera — mas vai pro fim).
    try {
      const withFutureDate = await getFutureDateProductIdsServer();
      products = products
        .map((product) => ({
          ...product,
          has_future_date: withFutureDate.has(product.id),
        }))
        .sort(
          (a, b) =>
            Number(b.has_future_date ?? true) - Number(a.has_future_date ?? true)
        );
    } catch (annotateError) {
      console.error("Failed to annotate future dates", annotateError);
    }
  } catch (error) {
    console.error("Failed to load products for homepage; using fallback", error);
  }

  try {
    const homeContent = await getPublicHomeContent();
    // Empty arrays are intentional: fallback is used only when Supabase fails.
    sections = homeContent.sections;
    banners = homeContent.banners;
    settings = homeContent.settings;
  } catch (error) {
    console.error("Failed to load editable homepage; using fallback", error);
  }

  return {
    props: { products, sections, banners, settings },
    revalidate: 60,
  };
};
