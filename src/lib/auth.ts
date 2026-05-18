import { createClient } from "./supabase/server";

export type SessionUser = {
  id: string;
  name: string;
  xUsername: string;
  onboarded: boolean;
};

export type UserProfile = {
  id: string;
  x_username: string | null;
  name: string;
  avatar_url: string | null;
  match_count: number;
  tournament_count: number;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string;
  x_username: string | null;
  avatar_url: string | null;
  match_count: number;
  tournament_count: number;
  onboarded: boolean;
  created_at: string;
};

function toSessionUser(profile: ProfileRow): SessionUser {
  return {
    id: profile.id,
    name: profile.display_name,
    xUsername: profile.x_username ?? "",
    onboarded: profile.onboarded,
  };
}

function toUserProfile(profile: ProfileRow): UserProfile {
  return {
    id: profile.id,
    x_username: profile.x_username,
    name: profile.display_name,
    avatar_url: profile.avatar_url,
    match_count: profile.match_count,
    tournament_count: profile.tournament_count,
    created_at: profile.created_at,
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return {
      id: user.id,
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email?.split("@")[0] ??
        "Player",
      xUsername: "",
      onboarded: false,
    };
  }

  return toSessionUser(profile as ProfileRow);
}

export async function getUserProfile(id: string): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  return data ? toUserProfile(data as ProfileRow) : null;
}

export async function updateUserProfile(
  id: string,
  updates: { name?: string; xUsername?: string; onboarded?: boolean },
): Promise<{ profile: UserProfile | null; error: string | null }> {
  const supabase = await createClient();
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.display_name = updates.name;
  if (updates.xUsername !== undefined)
    dbUpdates.x_username = updates.xUsername || null;
  if (updates.onboarded !== undefined) dbUpdates.onboarded = updates.onboarded;

  const { data, error } = await supabase
    .from("profiles")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("updateUserProfile error:", error);
    return { profile: null, error: error.message };
  }
  return {
    profile: data ? toUserProfile(data as ProfileRow) : null,
    error: null,
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
