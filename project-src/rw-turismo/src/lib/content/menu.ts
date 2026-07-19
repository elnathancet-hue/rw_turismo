import { createSupabaseBrowserClient } from "../supabase/browser";

// Site navigation menu ("abas" do site), stored in site_settings under the
// key "menu". Readable by anon (RLS public read), writable by admins only.
export type MenuItem = {
  id: string;
  label: string;
  url: string;
  // Set when the item points to a CMS page — lets the builder keep the
  // menu entry in sync when the page is renamed or removed.
  page_id?: string | null;
};

export type SiteMenu = { items: MenuItem[] };

export const MENU_SETTING_KEY = "menu";

export const menuItemId = () =>
  `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// site_settings.value is free-form jsonb; never trust its shape.
export const normalizeMenu = (value: unknown): SiteMenu => {
  const items = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return { items: [] };
  return {
    items: items
      .filter(
        (item): item is Record<string, unknown> =>
          !!item &&
          typeof (item as Record<string, unknown>).label === "string" &&
          typeof (item as Record<string, unknown>).url === "string"
      )
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : menuItemId(),
        label: item.label as string,
        url: item.url as string,
        page_id: typeof item.page_id === "string" ? item.page_id : null,
      })),
  };
};

const db = () => createSupabaseBrowserClient() as any;

export const getSiteMenu = async (): Promise<SiteMenu> => {
  const { data, error } = await db()
    .from("site_settings")
    .select("value")
    .eq("setting_key", MENU_SETTING_KEY)
    .maybeSingle();
  if (error) throw error;
  return normalizeMenu(data?.value);
};

export const saveSiteMenu = async (menu: SiteMenu): Promise<SiteMenu> => {
  const { data, error } = await db()
    .from("site_settings")
    .upsert(
      { setting_key: MENU_SETTING_KEY, value: menu },
      { onConflict: "setting_key" }
    )
    .select("value")
    .single();
  if (error) throw error;
  return normalizeMenu(data?.value);
};

// Keeps a page's menu entry in sync (used by the page builder's
// "mostrar no menu" toggle). Updates in place to preserve the item order.
export const upsertPageMenuItem = async (
  page: { id: string; slug: string },
  label: string
): Promise<SiteMenu> => {
  const menu = await getSiteMenu();
  const url = `/paginas/${page.slug}`;
  const exists = menu.items.some((item) => item.page_id === page.id);
  const items = exists
    ? menu.items.map((item) =>
        item.page_id === page.id ? { ...item, label, url } : item
      )
    : [...menu.items, { id: menuItemId(), label, url, page_id: page.id }];
  return saveSiteMenu({ items });
};

export const removePageMenuItem = async (pageId: string): Promise<SiteMenu> => {
  const menu = await getSiteMenu();
  if (!menu.items.some((item) => item.page_id === pageId)) return menu;
  return saveSiteMenu({
    items: menu.items.filter((item) => item.page_id !== pageId),
  });
};
