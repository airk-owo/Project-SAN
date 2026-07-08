import type { ReactNode } from "react";
import type { Game, Player } from "../../app/lib/gameTypes";
import { charName, suitTx } from "../../app/lib/gameConstants";

/** ดาบคู่: เป้าหมายเลือกทิ้งไพ่ 1 ใบ หรือให้ผู้โจมตีจั่ว — ย้าย verbatim จาก app/page.tsx */
export function TwinSwordsPrompt({
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
  if (
    !game.pendingTwinSwords ||
    game.pendingTwinSwords.targetId !== game.viewerId
  )
    return null;
  const attacker = game.players.find(
    (p) => p.id === game.pendingTwinSwords!.attackerId,
  );
  return (
    <section className="local-repeat-attack" role="dialog">
      <b>
        {charName(attacker)} ใช้ {game.pendingTwinSwords!.weaponName} —
        เลือกทิ้งไพ่บนมือ 1 ใบ หรือให้ผู้โจมตีจั่ว 1 ใบ
      </b>
      {countdown}
      <div className="local-force-cards">
        {myPlayer?.hand.map((c) => (
          <button key={c.id} onClick={() => emit("twin:discard", { cardId: c.id })}>
            ทิ้ง {c.name} ({c.number}
            {suitTx(c.suit)})
          </button>
        ))}
      </div>
      <button className="mock-muted-button" onClick={() => emit("twin:draw")}>
        ให้ผู้โจมตีจั่ว 1 ใบ
      </button>
    </section>
  );
}
