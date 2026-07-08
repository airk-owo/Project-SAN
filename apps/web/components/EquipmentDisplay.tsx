import type { Card, EquipmentSlots } from "../app/lib/gameTypes";
import { Icon, type IconName } from "./Icon";

/** Four equipment slots of a player — ย้าย verbatim จาก app/page.tsx */
export function EquipmentDisplay({
  eq,
  onInspect,
}: {
  eq: EquipmentSlots;
  onInspect?: (card: Card) => void;
}) {
  const r = (key: keyof EquipmentSlots, icon: IconName, label: string) => {
    const s = eq[key];
    return (
      <span
        className={`mock-equipment-slot ${s ? "equipped" : ""}${s && onInspect ? " local-inspectable" : ""}`}
        title={s?.name ?? `${label}: ว่าง`}
        onClick={
          s && onInspect
            ? (e) => {
                e.stopPropagation();
                onInspect(s);
              }
            : undefined
        }
      >
        <i>
          <Icon name={icon} />
        </i>
        <em>{label}</em>
        <b>{s?.name ?? "—"}</b>
      </span>
    );
  };
  return (
    <div className="mock-equipment">
      {r("weapon", "sword", "อาวุธ")}
      {r("armor", "shield", "เกราะ")}
      {r("offensiveMount", "mount", "ม้ารุก −1")}
      {r("defensiveMount", "mount", "ม้ารับ +1")}
    </div>
  );
}
