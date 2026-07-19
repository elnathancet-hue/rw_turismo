import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import {
  getUserProfile,
  isAdminProfile,
  type UserProfile,
} from "../lib/auth/profile";

type SupabaseSessionState = {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
};

const initialState: SupabaseSessionState = {
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
};

export const useSupabaseSession = (): SupabaseSessionState => {
  const [state, setState] = useState<SupabaseSessionState>(initialState);

  useEffect(() => {
    let isMounted = true;
    const markAsGuest = () => {
      if (isMounted) {
        setState({
          ...initialState,
          isLoading: false,
        });
      }
    };

    let supabase: ReturnType<typeof createSupabaseBrowserClient>;

    try {
      supabase = createSupabaseBrowserClient();
    } catch (error) {
      console.error("Failed to initialize Supabase session", error);
      markAsGuest();
      return;
    }

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session?.user) {
          markAsGuest();
          return;
        }

        let profile: UserProfile | null = null;

        try {
          profile = await getUserProfile(supabase, data.session.user.id);
        } catch (profileError) {
          console.error("Failed to load Supabase user profile", profileError);
        }

        if (isMounted) {
          setState({
            user: data.session.user,
            session: data.session,
            profile,
            isLoading: false,
            isAuthenticated: true,
            isAdmin: isAdminProfile(profile),
          });
        }
      } catch (error) {
        console.error("Failed to load Supabase session", error);
        markAsGuest();
      }
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadSession();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
};

export default useSupabaseSession;
