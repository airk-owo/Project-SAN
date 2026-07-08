import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Card, Game, Player } from "../../app/lib/gameTypes";

/** ขวานหมื่นชั่ง: ทิ้งไพ่ 2 ใบบังคับให้โจมตีโดน — ย้าย verbatim จาก app/page.tsx
 *  state การเลือกไพ่ยังอยู่ที่ Home (ผ่าน props) เพื่อคง reset semantics เดิม */
export function ForceAttackDamagePrompt({
  game,
  myPlayer,
  emit,
  countdown,
  forceDiscardRefs,
  setForceDiscardRefs,
}: {
  game: Game;
  myPlayer: Player | undefined;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
  forceDiscardRefs: string[];
  setForceDiscardRefs: Dispatch<SetStateAction<string[]>>;
}) {
  if (
    !game.pendingForceAttackDamage ||
    game.pendingForceAttackDamage.attackerId !== game.viewerId
  )
    return null;
  const choices = [
    ...(myPlayer?.hand || []),
    ...Object.values(myPlayer?.equipment || {}).filter((c): c is Card =>
      Boolean(c),
    ),
  ];
  const toggle = (id: string) =>
    setForceDiscardRefs((cur) =>
      cur.includes(id)
        ? cur.filter((r) => r !== id)
        : cur.length < 2
          ? [...cur, id]
          : cur,
    );
  return (
    <section className="local-repeat-attack" role="dialog">
      <b>ต้องการทิ้งไพ่ 2 ใบเพื่อบังคับให้โจมตีโดนหรือไม่?</b>
      {countdown}
      <div className="local-force-cards">
        {choices.map((c) => (
          <button
            key={c.id}
            className={forceDiscardRefs.includes(c.id) ? "selected-card" : ""}
            onClick={() => toggle(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div>
        <button
          disabled={forceDiscardRefs.length !== 2}
          onClick={() => {
            emit("attack:force", { cardIds: forceDiscardRefs });
            setForceDiscardRefs([]);
          }}
        >
          ยืนยัน ({forceDiscardRefs.length}/2)
        </button>
        <button
          className="mock-muted-button"
          onClick={() => {
            emit("attack:force-decline");
            setForceDiscardRefs([]);
          }}
        >
          ยกเลิก
        </button>
      </div>
    </section>
  );
}
