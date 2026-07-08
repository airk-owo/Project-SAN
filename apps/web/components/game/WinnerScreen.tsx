import type { Game } from "../../app/lib/gameTypes";
import { ROLE_LABEL } from "../../app/lib/gameConstants";

/** จอสรุปผลจบเกม (ฝ่ายชนะ + บทบาททุกคน) — ย้าย verbatim จาก app/page.tsx */
export function WinnerScreen({
  game,
  onLeave,
}: {
  game: Game;
  onLeave: () => void;
}) {
  if (!game.winner) return null;
  const label =
    game.winner === "traitor"
      ? "คนทรยศชนะ"
      : game.winner === "rebels"
        ? "กบฏชนะ"
        : "จักรพรรดิและผู้ภักดีชนะ";
  const me = game.players.find((p) => p.id === game.viewerId);
  const iWin =
    !!me &&
    ((game.winner === "traitor" && me.role === "traitor") ||
      (game.winner === "rebels" && me.role === "rebel") ||
      (game.winner === "emperor_loyalists" &&
        (me.role === "emperor" || me.role === "loyalist")));
  return (
    <div className="modal-backdrop local-endgame">
      <section className="local-endgame-card">
        <h1 className="local-endgame-title">🏆 {label}</h1>
        {me && (
          <p className={`local-endgame-you ${iWin ? "win" : "lose"}`}>
            {iWin ? "🎉 คุณชนะ!" : "😔 คุณพ่ายแพ้"}
          </p>
        )}
        <div className="local-endgame-roles">
          {[...game.players]
            .sort((a, b) => a.seatIndex - b.seatIndex)
            .map((p) => (
              <div
                key={p.id}
                className={`local-endgame-row local-role-${p.role || "unknown"}`}
              >
                <b>{p.username}</b>
                <span>
                  {p.character?.name ? `${p.character.name} · ` : ""}
                  {ROLE_LABEL[p.role || ""] || p.role || "—"}
                </span>
                <small>{p.alive ? "✅ รอด" : "💀 ตาย"}</small>
              </div>
            ))}
        </div>
        <div className="mock-response-actions">
          <button onClick={onLeave}>ออกจากห้อง</button>
        </div>
      </section>
    </div>
  );
}
