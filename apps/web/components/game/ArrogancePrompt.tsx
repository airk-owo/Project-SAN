import type { ReactNode } from "react";
import type { Game } from "../../app/lib/gameTypes";

/** อ้วนสุด จองหอง: ในขั้นเตรียมของจักรพรรดิ ผู้ถือทักษะเลือกว่าจะจั่วเพิ่ม 1 ใบไหม
 *  (แลกกับขีดจำกัดไพ่บนมือของจักรพรรดิ −1 ในรอบนั้น) — โผล่ให้ผู้ถือทักษะเท่านั้น
 *  ไม่ผูกกับเจ้าของเทิร์น เหมือน pendingFankui ของสุมาอี้ */
export function ArrogancePrompt({
  game,
  emit,
  countdown,
}: {
  game: Game;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
}) {
  if (!game.pendingArrogance || game.pendingArrogance.playerId !== game.viewerId)
    return null;
  return (
    <section className="local-repeat-attack" role="dialog">
      <b>✦ จองหอง — ขั้นเตรียมของจักรพรรดิ</b>
      <small className="local-peek-hint">
        จั่วการ์ดเพิ่ม 1 ใบ (ขีดจำกัดไพ่บนมือของจักรพรรดิ −1 ในรอบนี้)
      </small>
      {countdown}
      <div className="mock-response-actions">
        <button onClick={() => emit("skill:arrogance-resolve", { use: true })}>
          จั่วเพิ่ม 1 ใบ
        </button>
        <button
          className="mock-muted-button"
          onClick={() => emit("skill:arrogance-resolve", { use: false })}
        >
          ไม่ใช้
        </button>
      </div>
    </section>
  );
}
