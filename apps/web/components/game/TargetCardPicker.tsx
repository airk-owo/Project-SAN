import type { Dispatch, SetStateAction } from "react";
import type { Player } from "../../app/lib/gameTypes";
import { charName } from "../../app/lib/gameConstants";

export type TargetCardSelection =
  | { zone: "hand"; handIndex: number }
  | { zone: "equipment"; cardInstanceId: string };

/** Modal เลือกไพ่จากมือ/อุปกรณ์ของเป้าหมาย (ถอนสะพาน/ลอบขโมย ใช้ร่วมกัน)
 *  — JSX ย้าย verbatim จาก app/page.tsx (สองบล็อกเดิมต่างกันแค่ event ที่ยิง) */
export function TargetCardPicker({
  target,
  zone,
  setZone,
  onPick,
  onCancel,
}: {
  target: Player;
  zone: "hand" | "equipment" | undefined;
  setZone: Dispatch<SetStateAction<"hand" | "equipment" | undefined>>;
  onPick: (selection: TargetCardSelection) => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section className="card-detail local-target-picker">
        <h2>เลือกไพ่ของ {charName(target)}</h2>
        {!zone ? (
          <>
            <p>เลือกโซน</p>
            <div className="local-equipment-picker">
              <button
                disabled={!target.handCount}
                onClick={() => setZone("hand")}
              >
                🂠 มือ ({target.handCount})
              </button>
              <button
                disabled={!Object.values(target.equipment).some(Boolean)}
                onClick={() => setZone("equipment")}
              >
                อุปกรณ์
              </button>
            </div>
          </>
        ) : zone === "hand" ? (
          <>
            <p>เลือกตำแหน่งไพ่บนมือ</p>
            <div className="local-equipment-picker">
              {Array.from({ length: target.handCount }, (_, i) => (
                <button
                  key={i}
                  onClick={() => onPick({ zone: "hand", handIndex: i })}
                >
                  🂠 {i + 1}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p>เลือกอุปกรณ์</p>
            <div className="local-equipment-picker">
              {(
                [
                  { key: "weapon", label: "อาวุธ" },
                  { key: "armor", label: "เกราะ" },
                  { key: "offensiveMount", label: "ม้ารุก" },
                  { key: "defensiveMount", label: "ม้ารับ" },
                ] as const
              ).map(({ key, label }) => {
                const eq = target.equipment[key];
                return eq ? (
                  <button
                    key={key}
                    onClick={() =>
                      onPick({ zone: "equipment", cardInstanceId: eq.id })
                    }
                  >
                    <small>{label}</small>
                    {eq.name}
                  </button>
                ) : (
                  <span key={key} className="local-empty-slot">
                    {label}: ว่าง
                  </span>
                );
              })}
            </div>
          </>
        )}
        <button className="mock-muted-button" onClick={onCancel}>
          ยกเลิก
        </button>
      </section>
    </div>
  );
}
