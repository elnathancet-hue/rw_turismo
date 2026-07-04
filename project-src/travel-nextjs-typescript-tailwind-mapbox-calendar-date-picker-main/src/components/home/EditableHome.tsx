import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import type { BlogPost, HomeBanner, HomeSection, SiteSetting } from "../../lib/content/types";
import type { Product } from "../../lib/products/types";
import type { ISuggestionFormatted } from "../../types/typings";
import Drawer from "../Drawer";
import Footer from "../Footer";
import Header from "../Header";
import BenefitsSection from "./BenefitsSection";
import DestinationsSection from "./DestinationsSection";
import FeaturedProducts from "./FeaturedProducts";
import HeroBanner from "./HeroBanner";
import LatestBlogPosts from "./LatestBlogPosts";
import NewsletterSection from "./NewsletterSection";

export type EditableHomeProps = {
  banners: HomeBanner[];
  sections: HomeSection[];
  settings: SiteSetting[];
  products: Product[];
  blogPosts: BlogPost[];
};

const EditableHome = ({ banners, sections, settings, products, blogPosts }: EditableHomeProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(null);
  const seo = settings.find((item) => item.setting_key === "home_seo")?.value ?? {};
  const identity = settings.find((item) => item.setting_key === "site_identity")?.value ?? {};
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
  const banner = banners[0];

  const renderSection = (section: HomeSection) => {
    switch (section.section_key) {
      case "featured_products":
        return <FeaturedProducts key={section.id} products={products} section={section} />;
      case "destinations":
        return <DestinationsSection key={section.id} section={section} />;
      case "benefits":
      case "testimonials":
        return <BenefitsSection key={section.id} section={section} />;
      case "latest_blog_posts":
        return <LatestBlogPosts key={section.id} posts={blogPosts} section={section} />;
      case "newsletter":
        return <NewsletterSection key={section.id} section={section} />;
      case "custom_content":
      case "promotional_banner":
        return (
          <section className="py-12" key={section.id}>
            <h2 className="text-3xl font-semibold">{section.title}</h2>
            {section.subtitle && <p className="mt-3 text-gray-600">{section.subtitle}</p>}
            {section.content?.text && <p className="mt-5 whitespace-pre-wrap">{section.content.text}</p>}
            {section.content?.button_text && section.content?.button_url && (
              <Link className="mt-5 inline-flex rounded-lg bg-orange-500 px-5 py-3 font-semibold text-white" href={section.content.button_url}>
                {section.content.button_text}
              </Link>
            )}
          </section>
        );
      default:
        return null;
    }
  };

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": ["Organization", "TravelAgency"],
    name: identity.name ?? "RW Turismo",
    url: siteUrl || undefined,
    logo: identity.logo || undefined,
    description: identity.description || seo.description,
  };

  return (
    <div>
      <Head>
        <title>{seo.title ?? "RW Turismo"}</title>
        <meta name="description" content={seo.description ?? "Pacotes, experiências e destinos para sua próxima viagem."} />
        <link rel="canonical" href={siteUrl || "/"} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={seo.title ?? "RW Turismo"} />
        <meta property="og:description" content={seo.description ?? ""} />
        {seo.og_image && <meta property="og:image" content={seo.og_image} />}
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href={identity.favicon ?? "/favicon.ico"} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd).replace(/</g, "\\u003c") }} />
      </Head>
      <Header searchInput={searchInput} setSearchInput={setSearchInput} selectedCity={selectedCity} setSelectedCity={setSelectedCity} isOpen={isOpen} setIsOpen={setIsOpen} />
      {banner && <HeroBanner banner={banner} />}
      <main className="mx-auto max-w-7xl px-8 sm:px-16">
        {sections.sort((a, b) => a.display_order - b.display_order).map(renderSection)}
      </main>
      <Footer />
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-item"><Link href="/favorites">Meus favoritos</Link></p>
        <p className="drawer-item"><Link href="/bookings">Minhas reservas</Link></p>
        <p className="drawer-item"><Link href="/blog">Blog</Link></p>
      </Drawer>
    </div>
  );
};
export default EditableHome;
