"use client";
// Session + profile hook for the optional Google login. Inert when the feature flag
// is off (or supabase env is absent): returns nulls and never touches supabase.
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { AUTH_ENABLED } from "./flags";

export type Profile = {
  id: string;
  username: string;
  avatar: string | null;
  total_games: number;
  total_wins: number;
  emperor_games: number;
  emperor_wins: number;
  rebel_games: number;
  rebel_wins: number;
  loyalist_games: number;
  loyalist_wins: number;
  traitor_games: number;
  traitor_wins: number;
  most_played_role: string | null;
  best_role: string | null;
  favorite_character: string | null;
  current_win_streak: number;
  current_loss_streak: number;
  best_win_streak: number;
  survived_games: number;
  created_at: string;
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!AUTH_ENABLED || !supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    // detectSessionInUrl (supabase-js default) consumes the OAuth redirect on "/",
    // then this listener picks the session up — no callback route needed.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const authUserId = session?.user?.id;
  useEffect(() => {
    if (!AUTH_ENABLED || !supabase || !authUserId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", authUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile((data as Profile | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [authUserId]);

  const signIn = useCallback(() => {
    if (!AUTH_ENABLED || !supabase) return;
    void supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/` },
    });
  }, []);
  const signOut = useCallback(() => {
    if (!AUTH_ENABLED || !supabase) return;
    void supabase.auth.signOut();
  }, []);

  return { session, profile, signIn, signOut };
}

/** Fresh access token for room:join — getSession refreshes an expired token first. */
export async function getAccessToken(): Promise<string | null> {
  if (!AUTH_ENABLED || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
