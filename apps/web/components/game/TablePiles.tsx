import type { Dispatch, SetStateAction } from "react";
import type { Card, Game, Player } from "../../app/lib/gameTypes";
import { CardFace } from "../CardFace";
import { Icon } from "../Icon";

/** กองจั่ว/กองทิ้งกลางโต๊ะ + บรรทัดบอกสถานะ — ย้าย verbatim จาก app/page.tsx
 *  ปุ่มกองจั่วควบหน้าที่ จั่วเทิร์น/รับไพ่ค้าง/เปิดไพ่ตัดสิน ตาม state */
export function TablePiles({
  game,
  emit,
  isDrawPhase,
  myOwedDraws,
  myJudgmentDraw,
  topDiscard,
  setShowDropZone,
  rw,
  responder,
}: {
  game: Game;
  emit: (event: string, data?: Record<string, unknown>) => void;
  isDrawPhase: boolean;
  myOwedDraws: number;
  myJudgmentDraw: boolean;
  topDiscard: Card | undefined;
  setShowDropZone: Dispatch<SetStateAction<boolean>>;
  rw: Game["responseWindow"];
  responder: Player | undefined;
}) {
  return (
    <>
      <section className="mock-piles">
        <button
          className={`mock-pile${isDrawPhase || myOwedDraws > 0 || myJudgmentDraw ? " local-draw-pile-active" : ""}`}
          onClick={
            isDrawPhase
              ? () => emit("turn:draw-one")
              : myOwedDraws > 0
                ? () => emit("pending:draw")
                : myJudgmentDraw
                  ? () => emit("judgment:draw")
                  : undefined
          }
          title={
            isDrawPhase
              ? "คลิกเพื่อจั่วไพ่ทีละใบ"
              : myOwedDraws > 0
                ? "คลิกเพื่อจั่วไพ่ที่ได้รับ"
                : myJudgmentDraw
                  ? "คลิกเพื่อเปิดไพ่ตัดสิน"
                  : undefined
          }
        >
          <div className="mock-deck">
            {isDrawPhase
              ? `จั่ว ${game.turn?.drawnThisTurn ?? 0}/2`
              : myOwedDraws > 0
                ? `รับ +${myOwedDraws}`
                : myJudgmentDraw
                  ? "⚖"
                  : "🂠"}
          </div>
          <b>กองจั่ว</b>
          <small>{game.deck.length} ใบ</small>
        </button>
        <button
          type="button"
          className="mock-pile mock-pile-btn"
          onClick={() => game.discard.length && setShowDropZone(true)}
          disabled={!game.discard.length}
          title="ดูไพ่ทั้งหมดในกองทิ้ง"
        >
          {topDiscard ? (
            <CardFace
              key={topDiscard.id}
              card={topDiscard}
              className="mock-card-pile local-card-played"
              compact
            />
          ) : (
            <div className="mock-discard mock-card-pile-empty">—</div>
          )}
          <b>กองทิ้ง</b>
          <small>
            {game.discard.length} ใบ
            {game.discard.length > 0 ? (
              <>
                {" "}
                <Icon name="search" />
              </>
            ) : null}
          </small>
        </button>
      </section>
      <p className="local-action-empty">
        {isDrawPhase
          ? "⬆ กดกองจั่วเพื่อจั่วไพ่"
          : myOwedDraws > 0
            ? `⬆ กดกองจั่วเพื่อรับไพ่ที่ได้รับ (${myOwedDraws} ใบ)`
            : rw
              ? `กำลังรอ ${responder?.username ?? "ผู้เล่น"} ตอบสนอง`
              : "—"}
      </p>
    </>
  );
}
