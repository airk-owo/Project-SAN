import type { ReactNode } from "react";
import type { Game } from "../../app/lib/gameTypes";

/** แฮหัวตุ้น ย้อนรอยศัตรู: รอเจ้าของสกิลเปิดไพ่ตัดสิน — ย้าย verbatim จาก app/page.tsx */
export function RetaliateJudgmentPrompt({
  game,
  emit,
  countdown,
}: {
  game: Game;
  emit: (event: string, data?: Record<string, unknown>) => void;
  countdown: ReactNode;
}) {
  if (!game.pendingRetaliateJudgment) return null;
  const owner = game.players.find(
    (p) => p.id === game.pendingRetaliateJudgment!.ownerId,
  );
  const damager = game.players.find(
    (p) => p.id === game.pendingRetaliateJudgment!.damagerId,
  );
  const isOwner = game.pendingRetaliateJudgment!.ownerId === game.viewerId;
  return (
    <section className="local-repeat-attack" role="dialog">
      <b>
        🩸 ย้อนรอยศัตรู
        {isOwner ? "" : ` — ${owner?.username ?? "ผู้เล่น"}`}
      </b>
      {countdown}
      {isOwner ? (
        <>
          <p>
            เปิดไพ่ตัดสินเอง — ถ้าไม่ใช่ ♥ ผู้ทำดาเมจ (
            {damager?.username ?? "ผู้เล่น"}) ต้องทิ้งไพ่ 2 ใบ
            หรือรับความเสียหาย 1 หน่วย
          </p>
          <div className="mock-response-actions">
            <button onClick={() => emit("retaliate:reveal")}>
              🎴 เปิดไพ่ตัดสิน
            </button>
          </div>
        </>
      ) : (
        <p>
          กำลังรอ {owner?.username ?? "ผู้เล่น"} เปิดไพ่ตัดสิน ย้อนรอยศัตรู…
        </p>
      )}
    </section>
  );
}
