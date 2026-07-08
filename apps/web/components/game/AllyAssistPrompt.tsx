import type { ReactNode } from "react";
import type { Game, Player } from "../../app/lib/gameTypes";
import { charName } from "../../app/lib/gameConstants";

/** สกิลจักรพรรดิ (คุณธรรมสามัคคี/ปกป้องราชันย์): พันธมิตรใช้โจมตี/หลบแทน — ย้าย verbatim จาก app/page.tsx */
export function AllyAssistPrompt({
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
  if (!game.pendingAllyAssist || game.pendingAllyAssist.allyId !== game.viewerId)
    return null;
  const pa = game.pendingAllyAssist!;
  const emperor = game.players.find((p) => p.id === pa.emperorId);
  const need = pa.kind;
  const card = myPlayer?.hand.find((c) => c.effect === need);
  return (
    <section className="local-repeat-attack" role="dialog">
      <b>
        👑 {charName(emperor)} ขอให้คุณใช้{" "}
        {need === "attack" ? "โจมตี" : "หลบ"} แทน
        {pa.targetId
          ? ` (เป้าหมาย ${charName(game.players.find((p) => p.id === pa.targetId))})`
          : ""}
      </b>
      {countdown}
      <div className="mock-response-actions">
        <button
          disabled={!card}
          onClick={() => card && emit("ally:assist", { cardId: card.id })}
        >
          {card
            ? `${need === "attack" ? "⚔ ใช้ โจมตี" : "🛡 ใช้ หลบ"} แทน`
            : `ไม่มีไพ่${need === "attack" ? "โจมตี" : "หลบ"}`}
        </button>
        <button className="mock-muted-button" onClick={() => emit("ally:decline")}>
          ปฏิเสธ
        </button>
      </div>
    </section>
  );
}
