// Google auth + persistent stats — inert unless FEATURE_AUTH_STATS=1 AND Supabase
// service credentials exist. index.ts calls these hooks unconditionally; every export
// no-ops when disabled, so the flag-off server behaves exactly as before.
// Stats are written ONLY here (service role) via the record_game_result RPC — the
// browser has no write path, and the auth user id comes from verifying the access
// token, never from a client payload.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { GameState, Role, WinningSide } from '@wtk/game';

const url = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const flagOn = process.env.FEATURE_AUTH_STATS === '1';
export const enabled = flagOn && !!url && !!serviceKey;
if (flagOn && !enabled) console.warn('[stats] FEATURE_AUTH_STATS=1 but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — auth/stats stay disabled');
if (enabled) console.log('[stats] auth + stats recording enabled');
const supabase = enabled ? createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

/** Verified guest-id → auth-user-id bindings. Mirrors the `connections` lifecycle. */
const authByGuest = new Map<string, string>();

/** Resolve a Supabase access token to an auth user id. Trust only the token. */
export async function verifyAccessToken(token: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const result = await Promise.race([
      supabase.auth.getUser(token),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('auth verify timeout')), 5000)),
    ]);
    return result.error || !result.data?.user ? null : result.data.user.id;
  } catch {
    return null;
  }
}

export function bindAuth(guestUserId: string, authUserId: string) {
  if (enabled) authByGuest.set(guestUserId, authUserId);
}
export function unbindAuth(guestUserId: string) {
  authByGuest.delete(guestUserId);
}

type MatchMeta = {
  sessionId: string; // fresh per match — room ids get reused across matches
  startedAt: string;
  authByPlayer: Map<string, string>; // survives disconnects: a player who drops mid-game still gets the loss
  recorded: boolean;
};
const matchMeta = new Map<string, MatchMeta>(); // keyed by game.id (= room id; one live match per room)

const WIN_ROLES: Record<WinningSide, Role[]> = {
  emperor_loyalists: ['emperor', 'loyalist'],
  rebels: ['rebel'],
  traitor: ['traitor'],
};

/**
 * Single stats hook, called from emitGame (the one choke point every finished state
 * flows through). Tracks match start, keeps auth bindings snapshotted, and records
 * the result exactly once: in-memory `recorded` guard here, `on conflict do nothing`
 * on game_sessions.id in the RPC.
 */
export function observeGame(game: GameState) {
  if (!enabled) return;
  if (game.phase === 'waiting') {
    matchMeta.delete(game.id); // room recycled into a new lobby — drop any stale match state
    return;
  }
  const finished = game.status === 'finished' && !!game.winner;
  let meta = matchMeta.get(game.id);
  if (!meta) {
    if (finished) return; // never saw this match start (e.g. server restarted mid-game) — cannot attribute
    meta = { sessionId: randomUUID(), startedAt: new Date().toISOString(), authByPlayer: new Map(), recorded: false };
    matchMeta.set(game.id, meta);
  }
  if (!meta.recorded) {
    for (const p of game.players) {
      const authId = authByGuest.get(p.id);
      if (authId) meta.authByPlayer.set(p.id, authId);
    }
    if (finished) {
      meta.recorded = true;
      void recordResult(game, meta);
    }
  }
}

async function recordResult(game: GameState, meta: MatchMeta) {
  if (!supabase) return;
  const winRoles = WIN_ROLES[game.winner!] ?? [];
  const participants = game.players.flatMap((p) => {
    const authId = meta.authByPlayer.get(p.id);
    if (!authId) return []; // guests leave no rows
    return [{
      user_id: authId,
      role: p.role ?? null,
      character_id: p.character?.id ?? null,
      character_name: p.character?.name ?? null,
      faction: p.character?.faction ?? null,
      won: !!p.role && winRoles.includes(p.role),
      survived: p.alive,
      seat_index: p.seatIndex,
    }];
  });
  if (!participants.length) {
    matchMeta.delete(game.id); // all-guest match — nothing to store
    return;
  }
  const payload = {
    p_session_id: meta.sessionId,
    p_room_id: game.id,
    p_started_at: meta.startedAt,
    p_ended_at: new Date().toISOString(),
    p_turns: game.turn?.turnNumber ?? 0,
    p_player_count: game.players.length,
    p_winner_roles: winRoles,
    p_participants: participants,
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { error } = await supabase.rpc('record_game_result', payload);
      if (error) throw new Error(error.message);
      matchMeta.delete(game.id);
      console.log(`[stats] recorded match ${meta.sessionId} (room ${game.id}, ${participants.length} profile(s))`);
      return;
    } catch (err) {
      console.error(`[stats] record attempt ${attempt}/3 failed for room ${game.id}: ${(err as Error).message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  console.error(`[stats] giving up on match ${meta.sessionId} (room ${game.id}) — stats lost for this match`);
}
