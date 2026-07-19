import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseServerClient } from "../supabase/server";
import { getUserProfile, isAdminProfile } from "./profile";

type AdminCheckContext = {
  req?: Pick<NextApiRequest, "cookies">;
  res?: NextApiResponse;
};

export const isSupabaseCurrentUserAdmin = async (
  context: AdminCheckContext = {}
): Promise<boolean> => {
  const supabase = createSupabaseServerClient(context);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return false;
  }

  const profile = await getUserProfile(supabase, data.user.id);

  return isAdminProfile(profile);
};
