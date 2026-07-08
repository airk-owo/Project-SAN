import type { ReactNode } from "react";
import type { Game, Player } from "../../app/lib/gameTypes";

/** หน้าไม้กล: เป้าหมายหลบแล้ว ผู้โจมตีเลือกโจมตีซ้ำ — ย้าย verbatim จาก app/page.tsx */
export function RepeatAttackPrompt({
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
    !game.pendingRepeatAttack ||
    game.pendingRepeatAttack.attackerId !== game.viewerId
  )
    return null;
  const attack = myPlayer?.hand.find((c) => c.effect === "attack");
  return (
    <section className="local-repeat-attack" role="dialog">
      <b>
        เป้าหมายหลบสำเร็จ ต้องการโจมตีซ้ำด้วย{" "}
        {game.pendingRepeatAttack!.weaponName} หรือไม่?
      </b>
      {countdown}
      <div>
        <button
          disabled={!attack}
          onClick={() => attack && emit("attack:repeat", { cardId: attack.id })}
        >
          {attack ? "โจมตีซ้ำ" : "ไม่มีไพ่โจมตี"}
        </button>
        <button
          className="mock-muted-button"
          onClick={() => emit("attack:repeat-decline")}
        >
          ไม่โจมตีซ้ำ
        </button>
      </div>
    </section>
  );
}
