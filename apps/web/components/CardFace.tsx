import type { Card } from "../app/lib/gameTypes";
import { suitColor, suitTx, cardTypeLabel } from "../app/lib/gameConstants";

/** A card rendered in the exact face style as the player's hand cards
 *  (rank / art / name / type). Reused for the drop-zone previews. */
export function CardFace({
  card,
  className = "",
  compact = false,
}: {
  card: Card;
  className?: string;
  compact?: boolean;
}) {
  return (
    <article
      className={`mock-card mock-card-suit-${suitColor(card.suit)} ${className}`}
    >
      <header>
        <span className="mock-card-rank">
          {card.number}
          {suitTx(card.suit)}
        </span>
      </header>
      {card.image ? (
        <img className="mock-card-art" src={card.image} alt={card.name} />
      ) : (
        <div className="mock-card-art">WTK</div>
      )}
      <b className="mock-card-name">{card.name}</b>
      {!compact && <small>{cardTypeLabel(card)}</small>}
    </article>
  );
}
