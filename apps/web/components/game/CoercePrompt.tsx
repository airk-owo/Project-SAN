import type { ReactNode } from "react";
import type { Game, Player } from "../../app/lib/gameTypes";
import { charName } from "../../app/lib/gameConstants";

/** ยืมมือสังหาร: ผู้ถืออาวุธเลือกโจมตีหรือเสียอาวุธ — ย้าย verbatim จาก app/page.tsx */
export function CoercePrompt({
  game,
  myPlayer,
  emit,
  countdown,
}: {
  game: Game;
  myPlayer: Player | undefined;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
}) {
  if (!game.pendingCoerce) return null;
  const pc = game.pendingCoerce!;
  const holder = game.players.find((p) => p.id === pc.weaponHolderId);
  const victim = game.players.find((p) => p.id === pc.victimId);
  const actor = game.players.find((p) => p.id === pc.actorId);
  const isHolder = pc.weaponHolderId === game.viewerId;
  const atk = myPlayer?.hand.find((c) => c.effect === "attack");
  return (
    <section className="mock-response" role="dialog">
      <span className="mock-response-icon">🗡</span>
      {countdown}
      {isHolder ? (
        <>
          <div>
            <small>
              {charName(actor)} ใช้ {pc.trickName}
            </small>
            <h2>ถูกบังคับให้โจมตี {charName(victim)}</h2>
          </div>
          <div className="mock-response-actions">
            <button
              disabled={!atk}
              onClick={() => atk && emit("coerce:attack", { cardId: atk.id })}
            >
              {atk ? `⚔ โจมตี ${charName(victim)}` : "ไม่มีไพ่โจมตี"}
            </button>
            <button
              className="mock-muted-button"
              onClick={() => emit("coerce:decline")}
            >
              ไม่โจมตี (ให้ {charName(actor)} ยึดอาวุธ)
            </button>
          </div>
        </>
      ) : (
        <>
          <div>
            <h2>กำลังรอ {holder?.username ?? "ผู้เล่น"} ตัดสินใจ</h2>
            <p>ยืมมือสังหาร: โจมตี {charName(victim)} หรือเสียอาวุธ</p>
          </div>
        </>
      )}
    </section>
  );
}
