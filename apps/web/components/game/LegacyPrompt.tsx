import type { ReactNode } from "react";
import type { Game } from "../../app/lib/gameTypes";
import { suitColor, suitTx } from "../../app/lib/gameConstants";

/** กุยแก คำสั่งเสีย: เจ้าของแจกไพ่ที่เปิดให้ผู้เล่น — ย้าย verbatim จาก app/page.tsx */
export function LegacyPrompt({
  game,
  emit,
  countdown,
}: {
  game: Game;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
}) {
  if (!game.pendingLegacy) return null;
  const isOwner = game.pendingLegacy!.ownerId === game.viewerId;
  const owner = game.players.find((p) => p.id === game.pendingLegacy!.ownerId);
  if (!isOwner)
    return (
      <section className="mock-response" role="dialog">
        <span className="mock-response-icon">📜</span>
        {countdown}
        <div>
          <h2>คำสั่งเสีย</h2>
          <p>กำลังรอ {owner?.username ?? "ผู้เล่น"} มอบไพ่ให้ผู้เล่น…</p>
        </div>
      </section>
    );
  const cards = game.pendingLegacy!.cards;
  return (
    <section className="mock-response local-legacy" role="dialog">
      <span className="mock-response-icon">📜</span>
      {countdown}
      <div className="local-legacy-body">
        <h2>คำสั่งเสีย — มอบไพ่ให้ผู้เล่น</h2>
        <p>เลือกผู้รับของแต่ละใบ (ใบบนสุดจั่วก่อน)</p>
        <div className="local-legacy-list">
          {cards.map((c) => (
            <div key={c.id} className="local-legacy-row">
              <b className={`local-legacy-card local-suit-${suitColor(c.suit)}`}>
                {c.name} · {c.number}
                {suitTx(c.suit)}
              </b>
              <div className="local-legacy-targets">
                {game.players
                  .filter((p) => p.alive)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        emit("legacy:assign", {
                          cardId: c.id,
                          targetId: p.id,
                        })
                      }
                    >
                      {p.username}
                      {p.id === game.viewerId ? " (ตัวเอง)" : ""}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
