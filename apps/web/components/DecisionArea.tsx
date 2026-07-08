import type { Card } from "../app/lib/gameTypes";

/** Delayed-trick cards sitting in a player's decision area — ย้าย verbatim จาก app/page.tsx */
export function DecisionArea({
  cards,
  onInspect,
}: {
  cards: Card[];
  onInspect?: (card: Card) => void;
}) {
  if (!cards?.length) return null;
  return (
    <div className="local-decision-area">
      {cards.map((c) => (
        <span
          key={c.id}
          className={`local-decision-card${onInspect ? " local-inspectable" : ""}`}
          title={c.description || c.name}
          onClick={
            onInspect
              ? (e) => {
                  e.stopPropagation();
                  onInspect(c);
                }
              : undefined
          }
        >
          {c.effect === "delayed_lightning_judgment"
            ? "⚡"
            : c.effect === "delayed_skip_play_phase"
              ? "🕒"
              : "🎴"}{" "}
          {c.name}
        </span>
      ))}
    </div>
  );
}
