import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import { isStaffRole, type StaffRole, type UserRole } from "./roles";

export type UserProfile = {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  // Desativar tira o acesso sem apagar o perfil. Perfis criados antes da
  // migration de usuários do sistema podem vir sem a coluna — nesse caso
  // tratamos como ativo (era o comportamento anterior).
  active?: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileClient = SupabaseClient<Database>;

const profilesTable = (client: ProfileClient) =>
  (client as SupabaseClient<any>).from("users_profiles");

export const getUserProfile = async (
  client: ProfileClient,
  userId: string
): Promise<UserProfile | null> => {
  const { data, error } = await profilesTable(client)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as UserProfile | null;
};

export const isProfileActive = (profile: UserProfile | null): boolean =>
  profile !== null && profile.active !== false;

export const isAdminProfile = (profile: UserProfile | null): boolean =>
  profile?.role === "admin" && isProfileActive(profile);

// Papel de equipe do perfil, ou null se for cliente/conta desativada. É o que
// decide quais telas do /admin aparecem — ver lib/auth/roles.ts.
export const staffRoleOfProfile = (
  profile: UserProfile | null
): StaffRole | null =>
  isProfileActive(profile) && isStaffRole(profile?.role) ? profile.role : null;

export const ensureUserProfile = async (
  client: ProfileClient,
  user: User
): Promise<UserProfile> => {
  const existingProfile = await getUserProfile(client, user.id);

  if (existingProfile) {
    return existingProfile;
  }

  const email = user.email?.toLowerCase() ?? null;
  const name =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : typeof user.user_metadata?.picture === "string"
      ? user.user_metadata.picture
      : null;

  const { data, error } = await profilesTable(client)
    .insert({
      user_id: user.id,
      name,
      email,
      role: "customer",
      avatar_url: avatarUrl,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as UserProfile;
};
