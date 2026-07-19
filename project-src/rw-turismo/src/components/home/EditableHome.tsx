import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import type { HomeBanner, HomeSection, SiteSetting } from "../../lib/content/types";
import type { Product } from "../../lib/products/types";
import type { ISuggestionFormatted } from "../../types/typings";
import Drawer from "../Drawer";
import Footer from "../Footer";
import Header from "../Header";
import PackageSearchBar from "../PackageSearchBar";
import HomeSectionRenderer from "./HomeSectionRenderer";
import HeroBanner from "./HeroBanner";

export type EditableHomeProps = {
  banners: HomeBanner[];
  sections: HomeSection[];
  settings: SiteSetting[];
  products: Product[];
};

const EditableHome = ({ banners, sections, settings, products }: EditableHomeProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(null);
  const seo = settings.find((item) => item.setting_key === "home_seo")?.value ?? {};
  const identity = settings.find((item) => item.setting_key === "site_identity")?.value ?? {};
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
  const banner = banners[0];

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
      <div
        className={`relative z-10 mx-auto max-w-5xl px-4 sm:px-8 ${
          banner ? "-mt-12" : "mt-8"
        }`}
      >
        <PackageSearchBar />
      </div>
      <main className="mx-auto max-w-7xl px-8 sm:px-16">
        {[...sections]
          .filter((section) => section.active)
          .sort((a, b) => a.display_order - b.display_order)
          .map((section) => (
            <HomeSectionRenderer
              key={section.id}
              products={products}
              section={section}
            />
          ))}
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
