import type { ReactNode } from "react";
import type { Game } from "../../app/lib/gameTypes";
import {
  cardInfo,
  cardTypeLabel,
  suitColor,
  suitTx,
} from "../../app/lib/gameConstants";

/** เก็บเกี่ยวยุ้งฉาง: ผู้เล่นผลัดกันหยิบไพ่จากกองที่เปิด — ย้าย verbatim จาก app/page.tsx */
export function HarvestPrompt({
  game,
  rw,
  emit,
  countdown,
}: {
  game: Game;
  rw: NonNullable<Game["responseWindow"]>;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
}) {
  if (!game.pendingHarvest || rw.type !== "harvest_pick") return null;
  const picker = game.players.find((p) => p.id === rw.currentResponderId);
  const isPicker = rw.currentResponderId === game.viewerId;
  return (
    <section className="mock-response local-harvest" role="dialog">
      <span className="mock-response-icon">🌾</span>
      {countdown}
      <div>
        <h2>
          {isPicker
            ? "เลือกไพ่ 1 ใบจากยุ้งฉาง"
            : `กำลังรอ ${picker?.username ?? "ผู้เล่น"} เลือกไพ่`}
        </h2>
      </div>
      <div className="local-harvest-pool">
        {game.pendingHarvest!.revealed.map((c, i) => {
          const hidden = c.effect === "hidden_harvest";
          const hinfo = hidden ? null : cardInfo(c);
          return (
            <button
              key={c.id || i}
              disabled={!isPicker || hidden}
              className={`mock-card ${hidden ? "local-harvest-hidden" : `mock-card-suit-${suitColor(c.suit)}`}`}
              onClick={() =>
                isPicker && !hidden && emit("harvest:pick", { cardId: c.id })
              }
            >
              {hidden ? null : (
                <>
                  <header>
                    <span className="mock-card-rank">
                      {c.number}
                      {suitTx(c.suit)}
                    </span>
                  </header>
                  {c.image ? (
                    <img className="mock-card-art" src={c.image} alt={c.name} />
                  ) : (
                    <div className="mock-card-art">WTK</div>
                  )}
                  <b className="mock-card-name">{c.name}</b>
                  <small>{cardTypeLabel(c)}</small>
                </>
              )}
              {hinfo && (
                <div className="card-tip" role="tooltip">
                  <b className="card-tip-name">{c.name}</b>
                  <span className="card-tip-type">
                    {cardTypeLabel(c)} · {c.number}
                    {suitTx(c.suit)}
                  </span>
                  <p className="card-tip-desc">{hinfo.desc}</p>
                  {hinfo.use && (
                    <p className="card-tip-use">
                      <i>เมื่อไหร่:</i> {hinfo.use}
                    </p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
