import type { ReactNode } from "react";
import type { Game } from "../../app/lib/gameTypes";

/** กิเลน: โจมตีโดนแล้วเลือกทำลายม้าของเป้าหมาย — ย้าย verbatim จาก app/page.tsx */
export function DestroyMountPrompt({
  game,
  emit,
  countdown,
}: {
  game: Game;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
}) {
  if (
    !game.pendingDestroyMount ||
    game.pendingDestroyMount.attackerId !== game.viewerId
  )
    return null;
  const target = game.players.find(
    (p) => p.id === game.pendingDestroyMount!.targetId,
  );
  if (!target) return null;
  return (
    <section className="local-repeat-attack" role="dialog">
      <b>โจมตีสำเร็จ ต้องการทำลายพาหนะของเป้าหมายหรือไม่?</b>
      {countdown}
      <div>
        {target.equipment.offensiveMount && (
          <button
            onClick={() =>
              emit("mount:destroy", {
                targetId: target.id,
                slot: "offensiveMount",
              })
            }
          >
            ทำลาย {target.equipment.offensiveMount.name}
          </button>
        )}
        {target.equipment.defensiveMount && (
          <button
            onClick={() =>
              emit("mount:destroy", {
                targetId: target.id,
                slot: "defensiveMount",
              })
            }
          >
            ทำลาย {target.equipment.defensiveMount.name}
          </button>
        )}
      </div>
      <button
        className="mock-muted-button"
        onClick={() => emit("mount:destroy-decline")}
      >
        ไม่ทำลาย
      </button>
    </section>
  );
}
