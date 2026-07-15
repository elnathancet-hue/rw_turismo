export type HomeSectionKey =
  | "hero_banner"
  | "featured_products"
  | "destinations"
  | "categories"
  | "promotional_banner"
  | "benefits"
  | "testimonials"
  | "latest_blog_posts"
  | "newsletter"
  | "custom_content";

export type HomeSection = {
  id: string;
  section_key: HomeSectionKey | string;
  title: string | null;
  subtitle: string | null;
  content: Record<string, any>;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type HomeBanner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string | null;
  mobile_image_url: string | null;
  button_text: string | null;
  button_url: string | null;
  overlay_strength: number;
  active: boolean;
  display_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SiteSetting = {
  id: string;
  setting_key: string;
  value: Record<string, any>;
  updated_at: string;
};

export type PageBlock =
  | { id: string; type: "text"; markdown: string }
  | { id: string; type: "image"; url: string; alt: string; caption: string }
  | { id: string; type: "gallery"; images: { url: string; alt: string }[] }
  | {
      id: string;
      type: "banner";
      image: string;
      title: string;
      subtitle: string;
      button_label: string;
      button_url: string;
    }
  | {
      id: string;
      type: "cta";
      title: string;
      text: string;
      button_label: string;
      button_url: string;
    }
  | { id: string; type: "video"; url: string; caption: string }
  | { id: string; type: "quote"; text: string; author: string }
  | {
      id: string;
      type: "faq";
      items: { question: string; answer: string }[];
    }
  | { id: string; type: "spacer"; size: "small" | "medium" | "large" }
  | {
      id: string;
      type: "form";
      title: string;
      subtitle: string;
      button_label: string;
      // Rótulo que vira o "interesse" do lead no CRM (ex.: nome da landing).
      interest: string;
      success_message: string;
    };

export type Page = {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: "draft" | "published";
  seo_title: string | null;
  seo_description: string | null;
  blocks?: PageBlock[];
  // Modo HTML: quando preenchido, a página publicada é este HTML (os blocos
  // são ignorados). custom_html_chrome decide se o menu/rodapé do site
  // envolvem a página ou se ela é servida sozinha, exatamente como colada.
  custom_html?: string | null;
  custom_html_chrome?: boolean;
  // Aparência: topo da página (menu do site / barra simples / nenhum) e rodapé.
  header_style?: "site" | "simple" | "none";
  show_footer?: boolean;
  created_at: string;
  updated_at: string;
};

export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type BlogTag = {
  id: string;
  name: string;
  slug: string;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  author_id: string | null;
  category_id: string | null;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  og_image: string | null;
  created_at: string;
  updated_at: string;
  blog_categories?: Pick<BlogCategory, "name" | "slug"> | null;
  tags?: BlogTag[];
};

