import { createSupabaseAdminClient } from "../supabase/admin";
import { createSupabaseServerClient } from "../supabase/server";
import { sectionTypeOf } from "./home-registry";
import type {
  BlogCategory,
  BlogPost,
  BlogTag,
  HomeBanner,
  HomeSection,
  Page,
  SiteSetting,
} from "./types";

const client = () => createSupabaseServerClient() as any;
const throwIfError = (error: any) => {
  if (error) throw error;
};

type PublicTestimonial = {
  name: string;
  city?: string;
  text: string;
  active: boolean;
  order: number;
};

// Depoimentos aprovados (Fase 2.4): puxa avaliações NPS aprovadas (nota >= 9 com
// comentário) para exibir na seção de depoimentos da home. Roda no servidor com
// service role (a página é ISR/anon) e nunca quebra a home se falhar.
const getApprovedTestimonials = async (): Promise<PublicTestimonial[]> => {
  try {
    const admin = createSupabaseAdminClient() as any;
    const { data, error } = await admin
      .from("survey_responses")
      .select(
        "comment, display_name, rating, created_at, bookings(customer_name, products(title))"
      )
      .eq("approved", true)
      .gte("rating", 9)
      .not("comment", "is", null)
      .order("created_at", { ascending: false })
      .limit(12);
    if (error) throw error;
    return ((data ?? []) as any[])
      .map((row) => {
        const text = (row.comment ?? "").trim();
        if (!text) return null;
        const name =
          (row.display_name ?? "").trim() ||
          (row.bookings?.customer_name ?? "").split(" ")[0] ||
          "Viajante";
        return {
          name,
          city: row.bookings?.products?.title ?? undefined,
          text,
          active: true,
          order: 100,
        } as PublicTestimonial;
      })
      .filter(Boolean) as PublicTestimonial[];
  } catch (error) {
    console.error("Failed to load approved testimonials", error);
    return [];
  }
};

export const getPublicHomeContent = async () => {
  const now = new Date().toISOString();
  const [sectionsResult, bannersResult, settingsResult] = await Promise.all([
    client().from("home_sections").select("*").eq("active", true).order("display_order"),
    client()
      .from("home_banners")
      .select("*")
      .eq("active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("display_order"),
    client().from("site_settings").select("*"),
  ]);
  throwIfError(sectionsResult.error);
  throwIfError(bannersResult.error);
  throwIfError(settingsResult.error);

  const sections = (sectionsResult.data ?? []) as HomeSection[];
  const surveyTestimonials = await getApprovedTestimonials();
  const sectionsWithTestimonials = surveyTestimonials.length
    ? sections.map((section) =>
        sectionTypeOf(section.section_key) === "testimonials"
          ? {
              ...section,
              content: {
                ...section.content,
                items: [
                  ...(Array.isArray(section.content?.items)
                    ? section.content.items
                    : []),
                  ...surveyTestimonials,
                ],
              },
            }
          : section
      )
    : sections;

  return {
    sections: sectionsWithTestimonials,
    banners: (bannersResult.data ?? []) as HomeBanner[],
    settings: (settingsResult.data ?? []) as SiteSetting[],
  };
};

const enrichTags = async (posts: BlogPost[]) => {
  if (!posts.length) return posts;
  const ids = posts.map((post) => post.id);
  const { data, error } = await client()
    .from("blog_post_tags")
    .select("post_id, blog_tags(id,name,slug)")
    .in("post_id", ids);
  throwIfError(error);
  return posts.map((post) => ({
    ...post,
    tags: (data ?? [])
      .filter((row: any) => row.post_id === post.id)
      .map((row: any) => row.blog_tags)
      .filter(Boolean) as BlogTag[],
  }));
};

export const getPublishedPosts = async (options: {
  limit?: number;
  page?: number;
  categorySlug?: string;
  tagSlug?: string;
} = {}) => {
  const limit = Math.min(Math.max(options.limit ?? 9, 1), 50);
  const page = Math.max(options.page ?? 1, 1);
  const categoryRelation = options.categorySlug
    ? "blog_categories!inner(name,slug)"
    : "blog_categories(name,slug)";
  let query = client()
    .from("blog_posts")
    .select(`*, ${categoryRelation}`, { count: "exact" })
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (options.categorySlug) {
    query = query.eq("blog_categories.slug", options.categorySlug);
  }
  if (options.tagSlug) {
    const { data: tagRows, error: tagError } = await client()
      .from("blog_post_tags")
      .select("post_id, blog_tags!inner(slug)")
      .eq("blog_tags.slug", options.tagSlug);
    throwIfError(tagError);
    query = query.in("id", (tagRows ?? []).map((row: any) => row.post_id));
  }
  const { data, error, count } = await query;
  throwIfError(error);
  return {
    posts: await enrichTags((data ?? []) as BlogPost[]),
    count: count ?? 0,
    page,
    limit,
  };
};

export const getPublishedPostBySlug = async (slug: string) => {
  const { data, error } = await client()
    .from("blog_posts")
    .select("*, blog_categories(name,slug)")
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  throwIfError(error);
  if (!data) return null;
  return (await enrichTags([data as BlogPost]))[0];
};

export const getPublishedPageBySlug = async (slug: string) => {
  const { data, error } = await client()
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  throwIfError(error);
  return (data ?? null) as Page | null;
};

export const getPublicBlogTaxonomy = async () => {
  const [categoriesResult, tagsResult] = await Promise.all([
    client().from("blog_categories").select("*").eq("active", true).order("name"),
    client().from("blog_tags").select("*").order("name"),
  ]);
  throwIfError(categoriesResult.error);
  throwIfError(tagsResult.error);
  return {
    categories: (categoriesResult.data ?? []) as BlogCategory[],
    tags: (tagsResult.data ?? []) as BlogTag[],
  };
};
