// Background music manager — one looping <audio> element, swapped by track.
// Separate concern from lib/audio.ts (short sound-effect cues on an
// AudioContext); this is the ambient loop for the lobby vs. the table.
//
// Gated by a `musicOn` preference. Browsers block autoplay until the first user
// gesture, so play() may reject on load; we retry once on the next pointerdown.
type Track = "lobby" | "game";

const SRC: Record<Track, string> = {
  lobby: "/audio/lobby_1.mp3",
  game: "/audio/game_1.mp3",
};

let el: HTMLAudioElement | null = null;
let current: Track | null = null;
let enabled = true;
let volume = 0.35;
let unlockArmed = false;

function ensure(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.loop = true;
    el.volume = volume;
    el.preload = "auto";
  }
  return el;
}

// Autoplay was blocked — resume on the first user gesture, once.
function armUnlock() {
  if (unlockArmed || typeof document === "undefined") return;
  unlockArmed = true;
  const resume = () => {
    unlockArmed = false;
    document.removeEventListener("pointerdown", resume);
    if (enabled && current) el?.play().catch(() => {});
  };
  document.addEventListener("pointerdown", resume, { once: true });
}

function tryPlay() {
  if (!enabled || !current) return;
  ensure()
    .play()
    .catch(() => armUnlock());
}

// Switch to (or start) a track and play it if music is enabled. Safe to call
// repeatedly with the same track — a no-op once it's already playing.
export function playTrack(track: Track) {
  const a = ensure();
  if (current !== track) {
    current = track;
    a.src = SRC[track];
  }
  tryPlay();
}

// Apply the on/off preference. Pauses immediately when turned off; resumes the
// current track when turned on.
export function setMusicEnabled(on: boolean) {
  enabled = on;
  if (!on) el?.pause();
  else tryPlay();
}

// Set the playback level (0–1). Persists on the shared element so it survives
// track swaps.
export function setMusicVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
  if (el) el.volume = volume;
}
