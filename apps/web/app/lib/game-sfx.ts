// Dispatches SFX for new game.log entries — the single place that decides
// which of the many log types that can land in one game:state broadcast get
// a sound, mixing lib/audio.ts's synthesized cues and lib/sample.ts's sample
// cues. Takes full GameLog entries (not just a `type` string) so a future
// per-card (entry.cardId) or per-skill (entry.type.startsWith("skill-"))
// split can be added without changing this function's signature.
//
// At most one cue plays per call (see HANDLERS below) — a single turn can
// log several entries at once (e.g. a declared attack + dodge + dying), and
// playing all of them stacked reads as noise rather than feedback.
import {
  playCardDeclare,
  playDodge,
  playHeal,
  playDrawCards,
} from "./audio";
import { playSample } from "./sample";

export type GameLogEntry = {
  id: string;
  message: string;
  at: string;
  type: string;
  actorId?: string;
  targetId?: string;
  cardId?: string;
};

let enabled = true;
export function setSfxEnabled(on: boolean) {
  enabled = on;
}

// "card-played" alone only fires for the no-resolver fallback path
// (packages/game/src/index.ts) — real plays (attacks, tricks, heals,
// equipment) log under these other types instead. Group them as one
// "a card was played" bucket for now.
const CARD_PLAY_TYPES = new Set([
  "targeted-card-declared",
  "trick-declared",
  "heal-played",
  "equipment-equipped",
  "card-played",
]);

// Ordered highest-priority first; the first matching handler wins the batch.
const HANDLERS: [test: (type: string) => boolean, play: () => void][] = [
  [(t) => t === "player-died", () => playSample("player-died")],
  [(t) => t === "dying", () => playSample("dying")],
  [(t) => t === "damage", () => playSample("hit")],
  [(t) => t === "attack-dodged", () => playDodge()],
  [
    (t) => t === "healed" || t === "dying-heal-played" || t === "dying-rescued",
    () => playHeal(),
  ],
  [(t) => CARD_PLAY_TYPES.has(t), () => playCardDeclare()],
  [(t) => t === "turn-draw", () => playDrawCards()],
];

function roleWon(role: string | undefined, winner: string | undefined) {
  if (!role || !winner) return false;
  if (winner === "rebels") return role === "rebel";
  if (winner === "traitor") return role === "traitor";
  if (winner === "emperor_loyalists")
    return role === "emperor" || role === "loyalist";
  return false;
}

/**
 * Play (at most) one cue for a batch of log entries new since the last
 * render. `viewerRole`/`winner` are only needed to frame "game-finished" as
 * victory vs. defeat from this viewer's side.
 */
export function dispatchGameLogSfx(
  entries: GameLogEntry[],
  ctx: { viewerRole?: string; winner?: string },
) {
  if (!enabled || entries.length === 0) return;
  // Game end always wins the batch — nothing else matters once the match is over.
  if (entries.some((e) => e.type === "game-finished")) {
    playSample(roleWon(ctx.viewerRole, ctx.winner) ? "victory" : "defeat");
    return;
  }
  for (const [test, play] of HANDLERS) {
    if (entries.some((e) => test(e.type))) {
      play();
      return;
    }
  }
}
