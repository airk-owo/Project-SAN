import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Card, Game } from "../../app/lib/gameTypes";
import { suitTx } from "../../app/lib/gameConstants";

/** จูกัดเหลียง หยั่งรู้ฟ้าดิน: จัดลำดับไพ่บนกองจั่ว — ย้าย verbatim จาก app/page.tsx
 *  state ลำดับที่เลือกยังอยู่ที่ Home (ผ่าน props) เพื่อคง reset semantics เดิม */
export function PeekPrompt({
  game,
  emit,
  countdown,
  peekOrder,
  setPeekOrder,
}: {
  game: Game;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
  peekOrder: string[];
  setPeekOrder: Dispatch<SetStateAction<string[]>>;
}) {
  if (!game.pendingPeek || game.pendingPeek.playerId !== game.viewerId)
    return null;
  const cards = game.pendingPeek.cards;
  const toggle = (id: string) =>
    setPeekOrder((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const unselected = cards.filter((c) => !peekOrder.includes(c.id));
  const bottomIds = unselected.map((c) => c.id);
  const ordered = [
    ...peekOrder
      .map((id) => cards.find((c) => c.id === id))
      .filter((c): c is Card => !!c),
    ...unselected,
  ];
  return (
    <section className="local-repeat-attack" role="dialog">
      <b>🔮 หยั่งรู้ฟ้าดิน — จัดลำดับกองจั่ว (บนลงล่าง · ใบบนสุดจั่วก่อน)</b>
      <small className="local-peek-hint">
        กดไพ่เพื่อเลื่อนขึ้นกลุ่ม “บน” ตามลำดับที่กด · ใบที่ไม่ได้กดจะไหลลงล่าง
      </small>
      {countdown}
      <div className="local-force-cards local-peek-list">
        {ordered.map((c, i) => {
          const sel = peekOrder.includes(c.id);
          return (
            <button
              key={c.id}
              className={sel ? "selected-card" : ""}
              onClick={() => toggle(c.id)}
            >
              <b>{i + 1}.</b> {c.name} ({c.number}
              {suitTx(c.suit)}){" "}
              <em>
                {sel ? "บน" : "ล่าง"}
                {i === 0 ? " · จั่วก่อน" : ""}
              </em>
            </button>
          );
        })}
      </div>
      <div className="mock-response-actions">
        <button
          onClick={() => {
            emit("skill:peek-resolve", {
              topIds: peekOrder,
              bottomIds,
            });
            setPeekOrder([]);
          }}
        >
          ยืนยันการจัดเรียง (บน {peekOrder.length}/ล่าง {bottomIds.length})
        </button>
        <button
          className="mock-muted-button"
          onClick={() => {
            emit("skill:peek-resolve", {
              topIds: cards.map((c) => c.id),
              bottomIds: [],
            });
            setPeekOrder([]);
          }}
        >
          วางทั้งหมดไว้บน (ตามเดิม)
        </button>
      </div>
    </section>
  );
}
