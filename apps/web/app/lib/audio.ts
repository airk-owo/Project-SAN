// Audio cues on a shared AudioContext — ย้ายจาก app/page.tsx (Home)
// ทุก call site เป็นคน gate ด้วย `soundOn` เหมือนเดิม; ctx เป็น singleton
// ระดับ module แทน useRef (Home mount ครั้งเดียวต่อหน้า — พฤติกรรมเท่าเดิม)
let audioCtx: AudioContext | null = null;
export const tone = (
  freq: number,
  start: number,
  end: number,
  vol = 0.14,
  type: OscillatorType = "sine",
) => {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(
      vol,
      ctx.currentTime + start + 0.015,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + end);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + end + 0.03);
  } catch {}
};
export const playDecisionAlert = () => {
  tone(988, 0, 0.16, 0.17);
  tone(1319, 0.15, 0.42, 0.15);
};
export const playCountdownTick = (urgent: boolean) =>
  tone(urgent ? 1650 : 1350, 0, urgent ? 0.13 : 0.07, 0.13, "square");
// Gentle descending two-note when the turn auto-ends.
export const playAutoEndChime = () => {
  tone(587, 0, 0.16, 0.13);
  tone(392, 0.15, 0.42, 0.12);
};
// ฟ้าลงโทษ: a sharp crack over a rolling low rumble — a proper thunderclap.
export const playThunder = () => {
  tone(2300, 0, 0.05, 0.18, "square"); // เสียงเปรี้ยงแหลม
  tone(150, 0.02, 0.85, 0.22, "sawtooth"); // เสียงคำรามต่ำ
  tone(92, 0.05, 1.15, 0.2, "sawtooth");
  tone(55, 0.12, 1.4, 0.17, "sine"); // หางเสียงกึกก้อง
};

// Two-tone rising "ding-ding" for "it's your turn" — moved here from an inline
// oscillator block in page.tsx that built a fresh AudioContext every turn (leak).
// tone() reuses the shared singleton context instead.
export const playYourTurnChime = () => {
  tone(660, 0, 0.22, 0.16);
  tone(988, 0.16, 0.5, 0.16);
};

// A card gets declared/played on the table — short, dry click so it doesn't
// compete with the (louder, sample-based) hit/dying cues that may follow it
// in the same log batch.
export const playCardDeclare = () => tone(720, 0, 0.09, 0.1, "triangle");

// Dodge (閃) — a quick descending whoosh.
export const playDodge = () => {
  tone(900, 0, 0.08, 0.12, "sawtooth");
  tone(500, 0.05, 0.16, 0.1, "sawtooth");
};

// Heal (桃/酒) — gentle ascending two-note, mirror of playAutoEndChime's
// descending shape so the two read as opposites.
export const playHeal = () => {
  tone(392, 0, 0.16, 0.12);
  tone(587, 0.12, 0.4, 0.14);
};

// Draw phase — two short neutral ticks (card-on-card).
export const playDrawCards = () => {
  tone(1100, 0, 0.05, 0.1, "square");
  tone(1100, 0.08, 0.13, 0.1, "square");
};
