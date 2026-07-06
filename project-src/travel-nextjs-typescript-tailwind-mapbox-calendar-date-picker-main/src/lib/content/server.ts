import { createSupabaseServerClient } from "../supabase/server";
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
  return {
    sections: (sectionsResult.data ?? []) as HomeSection[],
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
