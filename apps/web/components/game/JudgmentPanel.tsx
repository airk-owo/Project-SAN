import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Game, Player } from "../../app/lib/gameTypes";
import { charName, suitColor, suitTx } from "../../app/lib/gameConstants";

/** แผงเปิดไพ่ตัดสิน (มีสุขลืมเมือง/ฟ้าลงโทษ + สกิลกุยแก/เอียนสี/สุมาอี้) — ย้าย verbatim จาก app/page.tsx */
export function JudgmentPanel({
  game,
  pj,
  myPlayer,
  emit,
  countdown,
  myJudgmentDraw,
  myJudgmentAct,
  myKeys,
  myGuicai,
  guicaiPicking,
  setGuicaiPicking,
  hasMySkill,
  skillUsed,
}: {
  game: Game;
  pj: NonNullable<Game["pendingJudgment"]>;
  myPlayer: Player | undefined;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
  myJudgmentDraw: boolean;
  myJudgmentAct: boolean;
  myKeys: string[];
  myGuicai: boolean;
  guicaiPicking: boolean;
  setGuicaiPicking: Dispatch<SetStateAction<boolean>>;
  hasMySkill: (key: string) => boolean;
  skillUsed: (key: string) => boolean;
}) {
  const jp = game.players.find((p) => p.id === pj.playerId);
  const r = pj.revealed;
  return (
    <section className="mock-response local-judgment-panel" role="dialog">
      <span className="mock-response-icon">⚖</span>
      {countdown}
      {pj.stage === "awaiting_draw" ? (
        <div>
          <h2>การตัดสิน: {pj.trickName}</h2>
          {myJudgmentDraw ? (
            <p>⬆ กดกองจั่ว (หรือปุ่มด้านล่าง) เพื่อเปิดไพ่ตัดสิน</p>
          ) : (
            <p>กำลังรอ {jp?.username ?? "ผู้เล่น"} เปิดไพ่ตัดสิน…</p>
          )}
          {myJudgmentDraw && (
            <div className="mock-response-actions">
              <button onClick={() => emit("judgment:draw")}>
                ⚖ เปิดไพ่ตัดสิน
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="local-judgment-reveal">
            <small>
              ไพ่ตัดสินของ {charName(jp)} — {pj.trickName}
            </small>
            {r ? (
              <div
                className={`local-judgment-card local-suit-${suitColor(r.suit)}`}
              >
                <span>
                  {r.number} {suitTx(r.suit)}
                </span>
                <b>{r.name}</b>
              </div>
            ) : (
              <p>ไม่มีไพ่ตัดสิน</p>
            )}
          </div>
          {myJudgmentAct ? (
            <div className="mock-response-actions">
              {myKeys.includes("keep_judgment") && (
                <button onClick={() => emit("judgment:keep")}>
                  🔮 เก็บไพ่ตัดสิน (คาดการณ์แม่นยำ)
                </button>
              )}
              <button
                className="mock-muted-button"
                onClick={() => emit("judgment:resolve")}
              >
                {myKeys.includes("keep_judgment")
                  ? "ดำเนินการต่อ (เก็บไพ่เข้ามือ)"
                  : "ดำเนินการต่อ (ทิ้ง)"}
              </button>
            </div>
          ) : (
            <p>กำลังรอ {jp?.username ?? "ผู้เล่น"} ตัดสินใจ…</p>
          )}
          {myGuicai &&
            (myPlayer?.hand.length ?? 0) > 0 &&
            (guicaiPicking ? (
              <div className="local-force-cards">
                {myPlayer?.hand.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      emit("judgment:replace", { cardId: c.id });
                      setGuicaiPicking(false);
                    }}
                  >
                    {c.name} ({c.number}
                    {suitTx(c.suit)})
                  </button>
                ))}
                <button
                  className="mock-muted-button"
                  onClick={() => setGuicaiPicking(false)}
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                className="local-skill-btn"
                onClick={() => setGuicaiPicking(true)}
              >
                🃏 กำหนดชะตา (เปลี่ยนไพ่ตัดสิน)
              </button>
            ))}
        </>
      )}
      {pj.playerId === game.viewerId &&
        pj.stage === "awaiting_draw" &&
        hasMySkill("fortune_judgment") &&
        !skillUsed("fortune_done") && (
          <button
            className="local-skill-btn"
            onClick={() => emit("skill:fortune")}
          >
            ✦ พึ่งวาสนา (ใช้ก่อนตัดสิน — เปิดดวง เก็บดอกดำ)
          </button>
        )}
      {pj.playerId === game.viewerId &&
        pj.stage === "awaiting_draw" &&
        pj.trickEffect === "delayed_lightning_judgment" &&
        myPlayer?.hand.some((c) => c.effect === "negate_trick_effect") && (
          <button
            className="local-skill-btn"
            onClick={() => {
              const neg = myPlayer?.hand.find(
                (c) => c.effect === "negate_trick_effect",
              );
              if (neg) emit("lightning:negate", { cardId: neg.id });
            }}
          >
            🛡 คงกระพันชาตรี (ยกเลิกฟ้าลงโทษ)
          </button>
        )}
    </section>
  );
}
