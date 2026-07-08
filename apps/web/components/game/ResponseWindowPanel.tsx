import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Card, Game, Player } from "../../app/lib/gameTypes";
import { charName, suitTx } from "../../app/lib/gameConstants";

/** แผง response window กลาง (negate / dying-heal / attack-dodge / mass / duel)
 *  รวมสกิลแทรกระหว่างหลบ (ระเหเร่ร่อน, ปกป้องราชันย์) — ย้าย verbatim จาก app/page.tsx */
export function ResponseWindowPanel({
  game,
  rw,
  myPlayer,
  emit,
  countdown,
  canRespond,
  responder,
  dyingPlayer,
  myConv,
  myKeys,
  redirectMode,
  setRedirectMode,
  redirectCard,
  setRedirectCard,
  guardianMode,
  setGuardianMode,
}: {
  game: Game;
  rw: NonNullable<Game["responseWindow"]>;
  myPlayer: Player | undefined;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
  canRespond: boolean;
  responder: Player | undefined;
  dyingPlayer: Player | undefined;
  myConv: (effect: string, card: Card) => boolean;
  myKeys: string[];
  redirectMode: boolean;
  setRedirectMode: Dispatch<SetStateAction<boolean>>;
  redirectCard: string | undefined;
  setRedirectCard: Dispatch<SetStateAction<string | undefined>>;
  guardianMode: boolean;
  setGuardianMode: Dispatch<SetStateAction<boolean>>;
}) {
  if (rw.type === "coerce_attack" || rw.type === "harvest_pick") return null;
  return (
    <section className="mock-response" role="dialog">
      <span className="mock-response-icon">
        {rw.type === "negate" ? "🛡" : rw.type === "dying_heal" ? "✚" : "⚔"}
      </span>
      {countdown}
      {rw.type === "negate" ? (
        <>
          {canRespond ? (
            <>
              <div>
                <h2>ใช้คงกระพันชาตรีหรือไม่?</h2>
              </div>
              <div className="mock-response-actions">
                <button
                  disabled={
                    !myPlayer?.hand.some(
                      (c) => c.effect === "negate_trick_effect",
                    )
                  }
                  onClick={() => {
                    const c = myPlayer?.hand.find(
                      (c) => c.effect === "negate_trick_effect",
                    );
                    if (c) emit("negate:play", { cardId: c.id });
                  }}
                >
                  🛡 ใช้คงกระพันชาตรี
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => emit("negate:decline")}
                >
                  ไม่ใช้
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2>กำลังรอ {responder?.username ?? "ผู้เล่น"}</h2>
                <p>ว่าจะยกเลิกไพ่อุบายหรือไม่</p>
              </div>
            </>
          )}
        </>
      ) : rw.type === "dying_heal" ? (
        <>
          {canRespond ? (
            <>
              <div>
                <small>{charName(dyingPlayer)} อยู่ในสถานะใกล้ตาย</small>
                <h2>ใช้ เสบียง ช่วยหรือไม่?</h2>
              </div>
              <div className="mock-response-actions">
                <button
                  disabled={!myPlayer?.hand.some((c) => myConv("heal", c))}
                  onClick={() => {
                    const c = myPlayer?.hand.find((c) => myConv("heal", c));
                    if (c) emit("response:heal", { cardId: c.id });
                  }}
                >
                  ✚ ใช้ เสบียง
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => emit("response:decline")}
                >
                  ไม่ทำอะไร
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2>กำลังรอ {responder?.username ?? "ผู้เล่น"}</h2>
                <p>ว่าจะช่วย {charName(dyingPlayer)} หรือไม่</p>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {canRespond ? (
            <>
              <div>
                <h2>
                  {rw.type === "mass_dodge" || rw.type === "multi_attack"
                    ? "ต้องใช้ หลบ"
                    : rw.type === "mass_attack"
                      ? "ต้องใช้ โจมตี"
                      : rw.type === "duel_attack"
                        ? "ท้าสู้ — ตอบโต้ด้วย โจมตี"
                        : (game.pendingAction?.dodgesRequired ?? 1) > 1
                          ? `ถูกโจมตี — ต้องใช้ หลบ อีก ${Math.max(1, (game.pendingAction?.dodgesRequired ?? 1) - (rw.responses?.filter((r) => r.playerId === game.viewerId && r.response === "card").length ?? 0))} ใบ`
                          : "ถูกโจมตี — ตอบสนอง"}
                </h2>
              </div>
              <div className="mock-response-actions">
                {rw.type === "attack_dodge" ? (
                  <>
                    {!game.pendingAction?.noDodge && (
                      <button
                        disabled={
                          !myPlayer?.hand.some((c) => myConv("dodge", c))
                        }
                        onClick={() => {
                          const c =
                            myPlayer?.hand.find((c) => c.effect === "dodge") ||
                            myPlayer?.hand.find((c) => myConv("dodge", c));
                          if (c) emit("attack:respond", { cardId: c.id });
                        }}
                      >
                        🛡 ใช้ หลบ
                      </button>
                    )}
                    <button
                      className="mock-muted-button"
                      onClick={() => emit("attack:respond")}
                    >
                      {game.pendingAction?.noDodge
                        ? "รับความเสียหาย (หลบไม่ได้ — ม้าคะนองศึก)"
                        : "รับความเสียหาย"}
                    </button>
                    {myKeys.includes("redirect_attack") &&
                      (myPlayer?.hand.length ?? 0) > 0 &&
                      !redirectMode && (
                        <button
                          className="local-skill-btn"
                          onClick={() => {
                            setRedirectMode(true);
                            setRedirectCard(undefined);
                          }}
                        >
                          ↪ ระเหเร่ร่อน (เปลี่ยนเป้า)
                        </button>
                      )}
                    {myKeys.includes("ask_wei_dodge") &&
                      myPlayer?.role === "emperor" &&
                      !game.pendingAction?.noDodge &&
                      !guardianMode && (
                        <button
                          className="local-skill-btn"
                          onClick={() => setGuardianMode(true)}
                        >
                          🛡 ปกป้องราชันย์ (ให้วุยก๊กหลบแทน)
                        </button>
                      )}
                    {guardianMode && (
                      <span className="local-force-cards">
                        เลือกพันธมิตรวุยก๊กบนโต๊ะ{" "}
                        <button
                          className="mock-muted-button"
                          onClick={() => setGuardianMode(false)}
                        >
                          ยกเลิก
                        </button>
                      </span>
                    )}
                    {redirectMode && (
                      <div className="local-force-cards">
                        {!redirectCard ? (
                          <>
                            {myPlayer?.hand.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => setRedirectCard(c.id)}
                              >
                                ทิ้ง {c.name} ({c.number}
                                {suitTx(c.suit)})
                              </button>
                            ))}
                          </>
                        ) : (
                          <span>
                            เลือกเป้าหมายใหม่บนโต๊ะ (ในระยะของคุณ
                            ไม่ใช่ผู้โจมตี)
                          </span>
                        )}
                        <button
                          className="mock-muted-button"
                          onClick={() => {
                            setRedirectMode(false);
                            setRedirectCard(undefined);
                          }}
                        >
                          ยกเลิก
                        </button>
                      </div>
                    )}
                  </>
                ) : rw.type === "mass_dodge" || rw.type === "multi_attack" ? (
                  <>
                    <button
                      disabled={!myPlayer?.hand.some((c) => myConv("dodge", c))}
                      onClick={() => {
                        const c =
                          myPlayer?.hand.find((c) => c.effect === "dodge") ||
                          myPlayer?.hand.find((c) => myConv("dodge", c));
                        if (c) emit("mass:respond", { cardId: c.id });
                      }}
                    >
                      🛡 ใช้ หลบ
                    </button>
                    <button
                      className="mock-muted-button"
                      onClick={() => emit("mass:decline")}
                    >
                      รับความเสียหาย
                    </button>
                  </>
                ) : rw.type === "duel_attack" ? (
                  <>
                    <button
                      disabled={
                        !myPlayer?.hand.some((c) => myConv("attack", c))
                      }
                      onClick={() => {
                        const c =
                          myPlayer?.hand.find((c) => c.effect === "attack") ||
                          myPlayer?.hand.find((c) => myConv("attack", c));
                        if (c) emit("duel:respond", { cardId: c.id });
                      }}
                    >
                      ⚔ ตอบโต้ด้วย โจมตี
                    </button>
                    <button
                      className="mock-muted-button"
                      onClick={() => emit("response:decline")}
                    >
                      ยอมแพ้ (เสีย 1 HP)
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={
                        !myPlayer?.hand.some((c) => myConv("attack", c))
                      }
                      onClick={() => {
                        const c =
                          myPlayer?.hand.find((c) => c.effect === "attack") ||
                          myPlayer?.hand.find((c) => myConv("attack", c));
                        if (c) emit("mass:respond", { cardId: c.id });
                      }}
                    >
                      ⚔ ใช้ โจมตี
                    </button>
                    <button
                      className="mock-muted-button"
                      onClick={() => emit("mass:decline")}
                    >
                      ไม่ใช้ (เสีย 1 HP)
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <h2>กำลังรอ {responder?.username ?? "ผู้เล่น"} ตอบสนอง</h2>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
