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

