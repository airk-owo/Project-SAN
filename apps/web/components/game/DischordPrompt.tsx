import type { ReactNode } from "react";
import type { Game } from "../../app/lib/gameTypes";
import { charName } from "../../app/lib/gameConstants";

/** จิวยี่ บาดหมาง: เป้าหมายทายดอกไพ่ — ย้าย verbatim จาก app/page.tsx */
export function DischordPrompt({
  game,
  emit,
  countdown,
}: {
  game: Game;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
}) {
  if (!game.pendingDischord || game.pendingDischord.targetId !== game.viewerId)
    return null;
  const jiuyi = game.players.find((p) => p.id === game.pendingDischord!.jiuyiId);
  return (
    <section className="local-repeat-attack" role="dialog">
      <b>
        🎴 บาดหมาง จาก {charName(jiuyi)}: เลือก 1 ดอกไพ่ (ทายผิดดอกที่หยิบได้ =
        เสีย 1 HP แต่ได้ไพ่ใบนั้น)
      </b>
      {countdown}
      <div className="mock-response-actions">
        {["♠", "♥", "♦", "♣"].map((s) => (
          <button key={s} onClick={() => emit("dischord:suit", { suit: s })}>
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
