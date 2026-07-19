import { useEffect, useState } from "react";
import { getSiteMenu, type MenuItem } from "../lib/content/menu";

type SiteMenuState = {
  items: MenuItem[];
  isLoading: boolean;
};

// Module-level cache: the menu changes rarely, so every component/page
// navigation shares a single fetch instead of hitting Supabase again.
let menuPromise: Promise<MenuItem[]> | null = null;

const loadMenuItems = (): Promise<MenuItem[]> => {
  if (!menuPromise) {
    menuPromise = getSiteMenu()
      .then((menu) =>
        // Skip half-filled rows saved from the admin so the public site
        // never renders empty or broken links.
        menu.items.filter((item) => item.label.trim() && item.url.trim())
      )
      .catch(() => {
        // The site must never break because of the menu: resolve to an
        // empty menu and let the next mount retry the fetch.
        menuPromise = null;
        return [];
      });
  }
  return menuPromise;
};

// Clears the shared cache (e.g. after the admin saves the menu) so the next
// mount fetches fresh data.
export const invalidateSiteMenu = () => {
  menuPromise = null;
};

export const useSiteMenu = (): SiteMenuState => {
  const [state, setState] = useState<SiteMenuState>({
    items: [],
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    void loadMenuItems().then((items) => {
      if (isMounted) setState({ items, isLoading: false });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
};

export default useSiteMenu;
