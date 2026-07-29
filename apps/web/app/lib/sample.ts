// Sample-based SFX — short one-shot clips that want real texture (impact,
// a dying gong, victory/defeat) rather than a synthesized tone. Sibling to
// lib/audio.ts (oscillator cues) and lib/bgm.ts (looping background music);
// separate from bgm.ts because these overlap/one-shot instead of looping on
// a single shared <audio> element — a hit landing right before a "dying" cue
// must not cut either one off.
//
// Gated by a `sfxOn` preference (mirrors bgm.ts's `enabled`/`setMusicEnabled`
// pattern). Autoplay can block the very first cue before any user gesture —
// same as bgm.ts — so a rejected play() is queued and retried once on the
// next pointerdown.
export type SampleKey = "hit" | "dying" | "player-died" | "victory" | "defeat";

const SRC: Record<SampleKey, string> = {
  hit: "/audio/sfx/hit.mp3",
  dying: "/audio/sfx/dying.mp3",
  "player-died": "/audio/sfx/death.mp3",
  victory: "/audio/sfx/victory.mp3",
  defeat: "/audio/sfx/defeat.mp3",
};

let enabled = true;
let volume = 0.5;
let unlockArmed = false;
const pendingKeys = new Set<SampleKey>();

export function setSampleEnabled(on: boolean) {
  enabled = on;
}

export function setSampleVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
}

// Autoplay was blocked — resume queued cues on the first user gesture, once.
function armUnlock() {
  if (unlockArmed || typeof document === "undefined") return;
  unlockArmed = true;
  const resume = () => {
    unlockArmed = false;
    document.removeEventListener("pointerdown", resume);
    const keys = [...pendingKeys];
    pendingKeys.clear();
    if (enabled) keys.forEach((k) => playSample(k));
  };
  document.addEventListener("pointerdown", resume, { once: true });
}

// Fresh <audio> element per call (clips are short) so overlapping cues don't
// cut each other off. Missing/404 asset files fail silently via the same
// .catch() path as a blocked autoplay — safe to call before assets exist.
export function playSample(key: SampleKey) {
  if (!enabled) return;
  const src = SRC[key];
  if (!src) return;
  const el = new Audio(src);
  el.volume = volume;
  el.play().catch(() => {
    pendingKeys.add(key);
    armUnlock();
  });
}
