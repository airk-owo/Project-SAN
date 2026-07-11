import type { Card, Player } from "../app/lib/gameTypes";
import { ROLE_LABEL, charName, hearts } from "../app/lib/gameConstants";
import { EquipmentDisplay } from "./EquipmentDisplay";
import { DecisionArea } from "./DecisionArea";

/** One opponent's seat panel (portrait, hp, equipment, decision area) — ย้าย verbatim จาก app/page.tsx */
export function OpponentPanel({
  player,
  targetable,
  isActiveTurn,
  distance,
  onClick,
  onSkills,
  onInspect,
}: {
  player: Player;
  targetable?: boolean;
  isActiveTurn?: boolean;
  distance?: number | null;
  onClick?: () => void;
  onSkills?: () => void;
  onInspect?: (card: Card) => void;
}) {
  return (
    <article
      onClick={onClick}
      className={`mock-player local-opponent ${targetable ? "local-targetable" : ""} ${!player.alive ? "local-dead" : ""} ${isActiveTurn ? "mock-active-turn" : ""}`}
    >
      <div className="mock-portrait-col">
        <div
          className={`mock-portrait${player.skippedPlayThisTurn ? " local-silenced" : ""}`}
        >
          {player.character?.image ? (
            <img src={player.character.image} alt={charName(player)} />
          ) : (
            charName(player).slice(0, 1)
          )}
        </div>
        {player.character?.kingdomTh && (
          <span
            className={`mock-kingdom kingdom-${player.character.kingdom ?? "QUN"}`}
          >
            {player.character.kingdomTh}
          </span>
        )}
        <DecisionArea cards={player.decisionArea} onInspect={onInspect} />
      </div>
      <div className="mock-player-content">
        <div className="local-name-row">
          <b>{charName(player)}</b>
          {player.character && (
            <button
              className="local-skills-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSkills?.();
              }}
              title="ดูทักษะ"
            >
              !
            </button>
          )}
        </div>
        <small className="mock-username">@{player.username}</small>
        <div className="local-hp-hand">
          {hearts(player.hp, player.maxHp)}
          <span className="mock-hand-count">
            🂠 × {player.handCount ?? player.hand.length}
          </span>
        </div>
        <small className="mock-seat-info">
          ที่นั่ง {player.seatIndex}
          {distance != null ? ` · ระยะ ${distance}` : ""}
        </small>
        <small
          className={`mock-role${player.role ? " local-role-" + player.role : ""}`}
        >
          บทบาท:{" "}
          {player.role ? (ROLE_LABEL[player.role] ?? player.role) : "???"}
        </small>
        <EquipmentDisplay eq={player.equipment} onInspect={onInspect} />
      </div>
    </article>
  );
}
