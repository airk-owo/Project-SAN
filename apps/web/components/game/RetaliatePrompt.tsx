import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Game, Player } from "../../app/lib/gameTypes";
import { suitTx } from "../../app/lib/gameConstants";

/** แฮหัวตุ้น ย้อนรอยศัตรู: ผู้ทำดาเมจเลือกทิ้ง 2 ใบหรือรับ 1 ดาเมจ — ย้าย verbatim จาก app/page.tsx
 *  state การเลือกยังอยู่ที่ Home (ผ่าน props) เพื่อคง reset semantics เดิม */
export function RetaliatePrompt({
  game,
  myPlayer,
  emit,
  countdown,
  retaliateCards,
  setRetaliateCards,
}: {
  game: Game;
  myPlayer: Player | undefined;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
  retaliateCards: string[];
  setRetaliateCards: Dispatch<SetStateAction<string[]>>;
}) {
  if (
    !game.pendingRetaliate ||
    game.pendingRetaliate.damagerId !== game.viewerId
  )
    return null;
  const victim = game.players.find(
    (p) => p.id === game.pendingRetaliate!.victimId,
  );
  const toggle = (id: string) =>
    setRetaliateCards((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 2
          ? [...prev, id]
          : prev,
    );
  const canDiscard = (myPlayer?.hand.length ?? 0) >= 2;
  return (
    <section className="local-repeat-attack" role="dialog">
      <b>
        🩸 คุณถูกสกิล ย้อนรอยศัตรู ของ {victim?.username ?? "ผู้เล่น"} —
        ทิ้งไพ่บนมือ 2 ใบ หรือรับความเสียหาย 1 หน่วย
      </b>
      {countdown}
      {canDiscard && (
        <div className="local-force-cards">
          {myPlayer?.hand.map((c) => (
            <button
              key={c.id}
              className={retaliateCards.includes(c.id) ? "selected-card" : ""}
              onClick={() => toggle(c.id)}
            >
              {c.name} ({c.number}
              {suitTx(c.suit)})
            </button>
          ))}
        </div>
      )}
      <div className="mock-response-actions">
        {canDiscard && (
          <button
            disabled={retaliateCards.length !== 2}
            onClick={() => {
              emit("retaliate:discard", { cardIds: retaliateCards });
              setRetaliateCards([]);
            }}
          >
            ทิ้งไพ่ 2 ใบ ({retaliateCards.length}/2)
          </button>
        )}
        <button
          className="mock-muted-button"
          onClick={() => {
            emit("retaliate:damage");
            setRetaliateCards([]);
          }}
        >
          รับความเสียหาย 1 หน่วย
        </button>
      </div>
    </section>
  );
}
