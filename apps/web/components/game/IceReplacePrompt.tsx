import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Game, IceSelection } from "../../app/lib/gameTypes";
import { charName } from "../../app/lib/gameConstants";

/** ดาบน้ำแข็ง: ทิ้งไพ่เป้าหมาย 1–2 ใบแทนดาเมจ — ย้าย verbatim จาก app/page.tsx
 *  state การเลือกยังอยู่ที่ Home (ผ่าน props) เพื่อคง reset semantics เดิม */
export function IceReplacePrompt({
  game,
  emit,
  countdown,
  iceSelections,
  setIceSelections,
}: {
  game: Game;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
  iceSelections: IceSelection[];
  setIceSelections: Dispatch<SetStateAction<IceSelection[]>>;
}) {
  if (
    !game.pendingReplaceDamage ||
    game.pendingReplaceDamage.attackerId !== game.viewerId
  )
    return null;
  const target = game.players.find(
    (p) => p.id === game.pendingReplaceDamage!.targetId,
  );
  if (!target) return null;
  const has = (s: IceSelection) =>
    iceSelections.some(
      (x) =>
        x.zone === s.zone &&
        (x.zone === "hand"
          ? x.handIndex === (s as { handIndex: number }).handIndex
          : x.cardInstanceId ===
            (s as { cardInstanceId: string }).cardInstanceId),
    );
  const toggle = (s: IceSelection) =>
    setIceSelections((cur) =>
      has(s)
        ? cur.filter(
            (x) =>
              !(
                x.zone === s.zone &&
                (x.zone === "hand"
                  ? x.handIndex === (s as { handIndex: number }).handIndex
                  : x.cardInstanceId ===
                    (s as { cardInstanceId: string }).cardInstanceId)
              ),
          )
        : cur.length < 2
          ? [...cur, s]
          : cur,
    );
  const equipEntries = (
    [
      { key: "weapon", label: "อาวุธ" },
      { key: "armor", label: "เกราะ" },
      { key: "offensiveMount", label: "ม้ารุก" },
      { key: "defensiveMount", label: "ม้ารับ" },
    ] as const
  )
    .map(({ key, label }) => ({ card: target.equipment[key], label }))
    .filter((e) => e.card);
  return (
    <section className="local-repeat-attack" role="dialog">
      <b>
        {game.pendingReplaceDamage!.weaponName}: ทิ้งไพ่ของ {charName(target)}{" "}
        1–2 ใบ แทนที่จะสร้างความเสียหายหรือไม่?
      </b>
      {countdown}
      <div className="local-force-cards">
        {Array.from({ length: target.handCount }, (_, i) => {
          const s: IceSelection = { zone: "hand", handIndex: i };
          return (
            <button
              key={`h${i}`}
              className={has(s) ? "selected-card" : ""}
              onClick={() => toggle(s)}
            >
              🂠 {i + 1}
            </button>
          );
        })}
        {equipEntries.map(({ card, label }) => {
          const s: IceSelection = {
            zone: "equipment",
            cardInstanceId: card!.id,
          };
          return (
            <button
              key={card!.id}
              className={has(s) ? "selected-card" : ""}
              onClick={() => toggle(s)}
            >
              {label}: {card!.name}
            </button>
          );
        })}
      </div>
      <div>
        <button
          disabled={iceSelections.length < 1}
          onClick={() => {
            emit("ice:replace", { selections: iceSelections });
            setIceSelections([]);
          }}
        >
          ทิ้งไพ่ ({iceSelections.length}/2)
        </button>
        <button
          className="mock-muted-button"
          onClick={() => {
            emit("ice:decline");
            setIceSelections([]);
          }}
        >
          ให้เสียเลือดตามปกติ
        </button>
      </div>
    </section>
  );
}
