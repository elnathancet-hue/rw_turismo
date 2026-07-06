import { createSupabaseBrowserClient } from "../supabase/browser";
import type { FooterSettings } from "./footer";
import type {
  BlogCategory,
  BlogPost,
  BlogTag,
  HomeBanner,
  HomeSection,
  SiteSetting,
} from "./types";

const db = () => createSupabaseBrowserClient() as any;
const unwrap = <T,>(result: { data: T; error: any }): T => {
  if (result.error) throw result.error;
  return result.data;
};

export const listAdminHomeSections = async () =>
  (unwrap(await db().from("home_sections").select("*").order("display_order")) ?? []) as HomeSection[];
export const saveAdminHomeSection = async (value: Partial<HomeSection> & { section_key: string }) => {
  const payload = {
    section_key: value.section_key,
    title: value.title ?? null,
    subtitle: value.subtitle ?? null,
    content: value.content ?? {},
    active: value.active ?? false,
    display_order: value.display_order ?? 0,
  };
  return unwrap(
    await db()
      .from("home_sections")
      .upsert(payload, { onConflict: "section_key" })
      .select()
      .single()
  ) as HomeSection;
};
export const deleteAdminHomeSection = async (id: string) =>
  unwrap(await db().from("home_sections").delete().eq("id", id));

export const listAdminBanners = async () =>
  (unwrap(await db().from("home_banners").select("*").order("display_order")) ?? []) as HomeBanner[];
export const saveAdminBanner = async (value: Partial<HomeBanner>) => {
  const query = value.id
    ? db().from("home_banners").update(value).eq("id", value.id)
    : db().from("home_banners").insert(value);
  return unwrap(await query.select().single()) as HomeBanner;
};
export const deleteAdminBanner = async (id: string) =>
  unwrap(await db().from("home_banners").delete().eq("id", id));

export const listAdminSettings = async () =>
  (unwrap(await db().from("site_settings").select("*").order("setting_key")) ?? []) as SiteSetting[];
export const saveAdminSetting = async (setting_key: string, value: Record<string, any>) =>
  unwrap(await db().from("site_settings").upsert({ setting_key, value }, { onConflict: "setting_key" }).select().single()) as SiteSetting;

export const getFooterSettings = async () => {
  const data = unwrap(
    await db()
      .from("site_settings")
      .select("value")
      .eq("setting_key", "footer")
      .maybeSingle()
  ) as { value: Record<string, any> } | null;
  return (data?.value ?? null) as FooterSettings | null;
};

export const listAdminBlogPosts = async () =>
  (unwrap(await db().from("blog_posts").select("*, blog_categories(name,slug)").order("created_at", { ascending: false })) ?? []) as BlogPost[];
export const getAdminBlogPost = async (id: string) =>
  unwrap(await db().from("blog_posts").select("*").eq("id", id).maybeSingle()) as BlogPost | null;
export const saveAdminBlogPost = async (value: Partial<BlogPost>) => {
  const payload = { ...value };
  delete payload.blog_categories;
  delete payload.tags;
  if (!payload.id && !payload.author_id) {
    const { data } = await db().auth.getUser();
    payload.author_id = data.user?.id ?? null;
  }
  const query = payload.id
    ? db().from("blog_posts").update(payload).eq("id", payload.id)
    : db().from("blog_posts").insert(payload);
  return unwrap(await query.select().single()) as BlogPost;
};
export const deleteAdminBlogPost = async (id: string) =>
  unwrap(await db().from("blog_posts").delete().eq("id", id));
export const getAdminBlogPostTagIds = async (postId: string) => {
  const data = (unwrap(await db().from("blog_post_tags").select("tag_id").eq("post_id", postId)) ?? []) as any[];
  return data.map((row: any) => row.tag_id) as string[];
};
export const setAdminBlogPostTags = async (postId: string, tagIds: string[]) => {
  unwrap(await db().from("blog_post_tags").delete().eq("post_id", postId));
  if (tagIds.length) {
    unwrap(await db().from("blog_post_tags").insert(tagIds.map((tag_id) => ({ post_id: postId, tag_id }))));
  }
};

export const listAdminBlogCategories = async () =>
  (unwrap(await db().from("blog_categories").select("*").order("name")) ?? []) as BlogCategory[];
export const saveAdminBlogCategory = async (value: Partial<BlogCategory>) =>
  unwrap(await db().from("blog_categories").upsert(value, { onConflict: "slug" }).select().single()) as BlogCategory;
export const deleteAdminBlogCategory = async (id: string) =>
  unwrap(await db().from("blog_categories").delete().eq("id", id));

export const listAdminBlogTags = async () =>
  (unwrap(await db().from("blog_tags").select("*").order("name")) ?? []) as BlogTag[];
export const saveAdminBlogTag = async (value: Partial<BlogTag>) =>
  unwrap(await db().from("blog_tags").upsert(value, { onConflict: "slug" }).select().single()) as BlogTag;
export const deleteAdminBlogTag = async (id: string) =>
  unwrap(await db().from("blog_tags").delete().eq("id", id));

export const subscribeNewsletter = async (email: string, source = "home") =>
  unwrap(await db().from("newsletter_subscribers").insert({
    email: email.trim().toLowerCase(),
    source,
    active: true,
  }));
