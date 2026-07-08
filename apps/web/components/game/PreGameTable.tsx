import type { CSSProperties } from "react";
import type { Game, Player } from "../../app/lib/gameTypes";
import { charName, hearts, lobbyPosition } from "../../app/lib/gameConstants";

/** โต๊ะก่อนเริ่มเกม: ที่นั่ง 10 ตำแหน่ง + สถานะพร้อม/เลือกขุนพล — ย้าย verbatim จาก app/page.tsx */
export function PreGameTable({
  game,
  waiting,
  readyCount,
  emperor,
  waitingForCharacter,
  emit,
}: {
  game: Game;
  waiting: boolean;
  readyCount: number;
  emperor: Player | undefined;
  waitingForCharacter: Player[];
  emit: (event: string, data?: Record<string, unknown>) => void;
}) {
  return (
    <section className={`mock-match-layout mock-count-${game.players.length}`}>
      <section className="mock-table-stage" data-density="large">
        <div className="mock-table-surface">
          <div className="mock-table-pattern">三國</div>
        </div>
        <div className="local-lobby-status">
          {waiting && (
            <p
              style={{
                margin: "4px 0",
                color: "#c8b58a",
                fontSize: ".82rem",
              }}
            >
              พร้อม {readyCount}/{game.players.length} คน
            </p>
          )}
          {game.phase === "character-select" && (
            <div className="local-select-center">
              {!emperor?.confirmedCharacter ? (
                <>
                  กำลังรอ <b>จักรพรรดิ</b> เลือกขุนพล
                </>
              ) : waitingForCharacter.length ? (
                <>
                  กำลังรอ{" "}
                  {waitingForCharacter.map((p, i) => (
                    <span key={p.id}>
                      <b>{p.username}</b>
                      {i < waitingForCharacter.length - 1 ? ", " : ""}
                    </span>
                  ))}{" "}
                  เลือกขุนพล
                </>
              ) : (
                <>ผู้เล่นทุกคนเลือกขุนพลแล้ว</>
              )}
            </div>
          )}
        </div>
        {/* All 10 seats */}
        {Array.from({ length: 10 }, (_, i) => {
          const seatNum = i + 1;
          const player = game.players.find((p) => p.seatIndex === seatNum);
          const pos = lobbyPosition(seatNum);
          const style = {
            "--seat-x": pos.left,
            "--seat-y": pos.top,
          } as CSSProperties;
          if (!player) {
            return waiting ? (
              <div
                key={seatNum}
                className="mock-opponent local-lobby-seat"
                style={style}
              >
                <button
                  onClick={() => emit("seat:select", { seatIndex: seatNum })}
                >
                  + {seatNum}
                </button>
              </div>
            ) : null;
          }
          const isMe = player.id === game.viewerId;
          return (
            <div key={seatNum} className="mock-opponent" style={style}>
              <article
                className={`mock-player local-opponent ${isMe ? "mock-self" : ""}`}
              >
                <div className="mock-portrait">
                  {player.character?.image ? (
                    <img src={player.character.image} alt={charName(player)} />
                  ) : (
                    charName(player).slice(0, 1)
                  )}
                </div>
                <div className="mock-player-content">
                  <div className="local-name-row">
                    <b>
                      {player.username}
                      {player.id === game.hostId && (
                        <span className="local-host-badge"> ♛</span>
                      )}
                    </b>
                  </div>
                  {player.character && (
                    <small style={{ color: "var(--danger)", fontWeight: 700 }}>
                      {player.character.name}
                    </small>
                  )}
                  {waiting && (
                    <small
                      className={`local-ready-text ${player.ready ? "ready" : "not-ready"}`}
                    >
                      {player.ready ? "✓ พร้อม" : "ยังไม่พร้อม"}
                    </small>
                  )}
                  {!waiting && hearts(player.hp, player.maxHp)}
                  <small>ที่นั่ง {player.seatIndex}</small>
                </div>
              </article>
            </div>
          );
        })}
      </section>
    </section>
  );
}
