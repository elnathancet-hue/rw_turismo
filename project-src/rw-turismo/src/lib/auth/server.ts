import type { Session, User } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseServerClient } from "../supabase/server";
import { ensureUserProfile, getUserProfile, type UserProfile } from "./profile";

type ServerAuthContext = {
  req?: Pick<NextApiRequest, "cookies">;
  res?: NextApiResponse;
};

export const getSupabaseServerSession = async (
  context: ServerAuthContext = {}
): Promise<Session | null> => {
  const supabase = createSupabaseServerClient(context);
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
};

export const getSupabaseServerUser = async (
  context: ServerAuthContext = {}
): Promise<User | null> => {
  const supabase = createSupabaseServerClient(context);
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user;
};

export const isSupabaseServerAuthenticated = async (
  context: ServerAuthContext = {}
): Promise<boolean> => {
  const user = await getSupabaseServerUser(context);

  return Boolean(user);
};

export const getSupabaseServerProfile = async (
  context: ServerAuthContext = {}
): Promise<UserProfile | null> => {
  const supabase = createSupabaseServerClient(context);
  const user = await getSupabaseServerUser(context);

  if (!user) {
    return null;
  }

  return getUserProfile(supabase, user.id);
};

export const ensureSupabaseServerProfile = async (
  context: ServerAuthContext = {}
): Promise<UserProfile | null> => {
  const supabase = createSupabaseServerClient(context);
  const user = await getSupabaseServerUser(context);

  if (!user) {
    return null;
  }

  return ensureUserProfile(supabase, user);
};
