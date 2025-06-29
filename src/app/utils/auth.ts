import { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { Tables } from "./supabase/types";

type UserProfile = Tables<'users'>;

interface CurrentUser extends User {
  profile: UserProfile;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user;

  if (authError || !user) {
    return null;
  }

  // Get additional user info from our users table
  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !userProfile) {
    return null;
  }

  return {
    ...user,
    profile: userProfile
  } as CurrentUser;
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

export async function requireAdminAuth(): Promise<CurrentUser> {
  const user = await requireAuth();
  
  return user;
}
