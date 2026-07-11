import type { Card } from "../app/lib/gameTypes";

/** Delayed-trick markers for a player (ฟ้าลงโทษ / มีสุขลืมเมือง). Rendered as icon
 *  badges below the ก๊ก chip in the portrait column (see .local-decision-badges) rather
 *  than full-width pill labels below the card content — the pills used to add a row (or
 *  two, when a player had both tricks) and stretch the seat card taller. */

// Custom PNG per trick, with an emoji fallback if the image is missing (onError). Keyed
// by the card's `effect`.
const TRICK_ICON: Record<string, { src: string; emoji: string }> = {
  delayed_lightning_judgment: { src: "/icons/thunder.png", emoji: "⚡" },
  delayed_skip_play_phase: { src: "/icons/mute.png", emoji: "🕒" },
};

export function DecisionArea({
  cards,
  onInspect,
}: {
  cards: Card[];
  onInspect?: (card: Card) => void;
}) {
  if (!cards?.length) return null;
  return (
    <div className="local-decision-badges">
      {cards.map((c) => {
        const isLightning = c.effect === "delayed_lightning_judgment";
        const icon = TRICK_ICON[c.effect ?? ""];
        return (
          <span
            key={c.id}
            className={`local-decision-badge-icon${isLightning ? " local-decision-badge-lightning" : ""}${onInspect ? " local-inspectable" : ""}`}
            title={c.name}
            onClick={
              onInspect
                ? (e) => {
                    e.stopPropagation();
                    onInspect(c);
                  }
                : undefined
            }
          >
            {icon ? (
              <>
                <img
                  className="local-decision-badge-img"
                  src={icon.src}
                  alt={c.name}
                  onError={(e) => {
                    // image missing (e.g. thunder.png not added yet) → show the emoji
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget
                      .nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "";
                  }}
                />
                <span
                  className="local-decision-badge-emoji"
                  style={{ display: "none" }}
                >
                  {icon.emoji}
                </span>
              </>
            ) : (
              "🎴"
            )}
          </span>
        );
      })}
    </div>
  );
}
