import { useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Card, Game } from "../../app/lib/gameTypes";
import { suitTx } from "../../app/lib/gameConstants";

/** จูกัดเหลียง หยั่งรู้ฟ้าดิน: จัดลำดับไพ่บนกองจั่วด้วยการ "ลาก" ขึ้น-ลง (บนสุด = จั่วก่อน)
 *  ไพ่ทั้งหมดจะถูกวางกลับไว้ "บน" ตามลำดับที่จัด — ไม่มีกองล่างแล้ว
 *  state ลำดับที่จัดอยู่ที่ Home (ผ่าน props) เพื่อคง reset semantics เดิม */
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
  const cards: Card[] = game.pendingPeek?.cards ?? [];
  const originalIds = cards.map((c) => c.id);
  const originalKey = originalIds.join(",");

  // เมื่อไพ่ที่แอบดูมาถึง (หรือเปลี่ยนชุด) ให้ตั้งลำดับเริ่มต้น = ลำดับเดิมบนกองจั่ว
  useEffect(() => {
    if (!originalKey) return;
    setPeekOrder((prev) => {
      const sameSet =
        prev.length === originalIds.length &&
        prev.every((id) => originalIds.includes(id));
      return sameSet ? prev : originalIds;
    });
    // originalKey เป็นตัวแทนของชุดไพ่; setPeekOrder เสถียร
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalKey]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  if (!game.pendingPeek || game.pendingPeek.playerId !== game.viewerId)
    return null;

  // ลำดับที่กำลังแสดง: ใช้ peekOrder ถ้าครบชุดแล้ว ไม่งั้น fallback ลำดับเดิม (ก่อน seed)
  const currentIds =
    peekOrder.length === cards.length &&
    peekOrder.every((id) => originalIds.includes(id))
      ? peekOrder
      : originalIds;
  const ordered = currentIds
    .map((id) => cards.find((c) => c.id === id))
    .filter((c): c is Card => !!c);
  const moved = currentIds.some((id, i) => id !== originalIds[i]);

  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= currentIds.length) return;
    const base = [...currentIds];
    const [x] = base.splice(from, 1);
    base.splice(to, 0, x);
    setPeekOrder(base);
  };

  return (
    <section className="local-repeat-attack" role="dialog">
      <b>🔮 หยั่งรู้ฟ้าดิน — จัดลำดับกองจั่ว (ลากขึ้น-ลง · ใบบนสุดจั่วก่อน)</b>
      <small className="local-peek-hint">
        ลากไพ่เพื่อสลับลำดับ หรือใช้ปุ่ม ▲▼ · ลำดับบน→ล่าง = ลำดับที่จะจั่ว
      </small>
      {countdown}
      <div className="local-force-cards local-peek-list">
        {ordered.map((c, i) => (
          <div
            key={c.id}
            className={`local-peek-row${overIndex === i ? " local-peek-over" : ""}${
              dragIndex === i ? " local-peek-dragging" : ""
            }`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIndex(i);
            }}
            onDragLeave={() => setOverIndex((v) => (v === i ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
          >
            <span className="local-peek-grip" aria-hidden>
              ⠿
            </span>
            <b>{i + 1}.</b> {c.name} ({c.number}
            {suitTx(c.suit)}){" "}
            <em>{i === 0 ? "จั่วก่อน" : ""}</em>
            <span className="local-peek-moves">
              <button
                type="button"
                className="mock-muted-button"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                aria-label="เลื่อนขึ้น"
              >
                ▲
              </button>
              <button
                type="button"
                className="mock-muted-button"
                disabled={i === ordered.length - 1}
                onClick={() => move(i, i + 1)}
                aria-label="เลื่อนลง"
              >
                ▼
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="mock-response-actions">
        <button
          disabled={!moved}
          onClick={() => {
            emit("skill:peek-resolve", { topIds: currentIds, bottomIds: [] });
            setPeekOrder([]);
          }}
        >
          ยืนยันจัดเรียง
        </button>
        <button
          className="mock-muted-button"
          onClick={() => {
            emit("skill:peek-resolve", { topIds: originalIds, bottomIds: [] });
            setPeekOrder([]);
          }}
        >
          เรียงแบบเดิม
        </button>
      </div>
    </section>
  );
}
