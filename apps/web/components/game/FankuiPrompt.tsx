import type { ReactNode } from "react";
import type { Game } from "../../app/lib/gameTypes";
import { charName } from "../../app/lib/gameConstants";

/** สุมาอี้ กลยุทธ์โต้กลับ: หยิบไพ่ 1 ใบจากคนที่ทำดาเมจ — ย้าย verbatim จาก app/page.tsx */
export function FankuiPrompt({
  game,
  emit,
  countdown,
}: {
  game: Game;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
}) {
  if (!game.pendingFankui || game.pendingFankui.playerId !== game.viewerId)
    return null;
  const damager = game.players.find(
    (p) => p.id === game.pendingFankui!.damagerId,
  );
  if (!damager) return null;
  const equipEntries = (
    [
      { key: "weapon", label: "อาวุธ" },
      { key: "armor", label: "เกราะ" },
      { key: "offensiveMount", label: "ม้ารุก" },
      { key: "defensiveMount", label: "ม้ารับ" },
    ] as const
  )
    .map(({ key, label }) => ({
      card: damager.equipment[key],
      label,
    }))
    .filter((e) => e.card);
  return (
    <section className="local-repeat-attack" role="dialog">
      <b>🎯 กลยุทธ์โต้กลับ: หยิบไพ่ 1 ใบจาก {charName(damager)}</b>
      {countdown}
      <div className="local-force-cards">
        {Array.from({ length: damager.handCount }, (_, i) => (
          <button
            key={`h${i}`}
            onClick={() =>
              emit("fankui:take", {
                selection: { zone: "hand", handIndex: i },
              })
            }
          >
            🂠 {i + 1}
          </button>
        ))}
        {equipEntries.map(({ card, label }) => (
          <button
            key={card!.id}
            onClick={() =>
              emit("fankui:take", {
                selection: {
                  zone: "equipment",
                  cardInstanceId: card!.id,
                },
              })
            }
          >
            {label}: {card!.name}
          </button>
        ))}
      </div>
      <button
        className="mock-muted-button"
        onClick={() => emit("fankui:decline")}
      >
        ไม่ใช้
      </button>
    </section>
  );
}
