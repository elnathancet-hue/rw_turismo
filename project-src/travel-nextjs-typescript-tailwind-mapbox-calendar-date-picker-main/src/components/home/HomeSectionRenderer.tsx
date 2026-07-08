import { sectionTypeOf } from "../../lib/content/home-registry";
import type { HomeSection } from "../../lib/content/types";
import type { Product } from "../../lib/products/types";
import BenefitsSection from "./BenefitsSection";
import DestinationsSection from "./DestinationsSection";
import FeaturedProducts from "./FeaturedProducts";
import ProductCollectionSection from "./ProductCollectionSection";
import PromotionalSection from "./PromotionalSection";
import TestimonialsSection from "./TestimonialsSection";

type Props = {
  products: Product[];
  section: HomeSection;
};

const HomeSectionRenderer = ({ products, section }: Props) => {
  if (!section.active) return null;

  // Legacy singleton keys have no "__", so sectionTypeOf returns them as-is.
  switch (sectionTypeOf(section.section_key)) {
    case "featured_products":
      return <FeaturedProducts products={products} section={section} />;
    case "product_collection":
      return <ProductCollectionSection products={products} section={section} />;
    case "destinations":
      return <DestinationsSection section={section} />;
    case "benefits":
      return <BenefitsSection section={section} />;
    case "testimonials":
      return <TestimonialsSection section={section} />;
    case "promotional_banner":
      return <PromotionalSection section={section} />;
    // Blog and newsletter are intentionally disabled in this stage.
    case "latest_blog_posts":
    case "newsletter":
    default:
      return null;
  }
};

export default HomeSectionRenderer;
