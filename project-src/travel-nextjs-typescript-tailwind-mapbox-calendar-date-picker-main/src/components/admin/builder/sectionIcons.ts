import {
  ChatBubbleLeftRightIcon,
  MapPinIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  StarIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";

// Icons live here (UI layer) instead of in the registry, which is imported by
// public pages and must stay lean.
export const sectionTypeIcons: Record<
  string,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  product_collection: TagIcon,
  featured_products: StarIcon,
  destinations: MapPinIcon,
  benefits: ShieldCheckIcon,
  testimonials: ChatBubbleLeftRightIcon,
  promotional_banner: MegaphoneIcon,
};
