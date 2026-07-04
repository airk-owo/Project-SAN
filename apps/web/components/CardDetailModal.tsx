import type { Card } from "../app/lib/gameTypes";
import { cardInfo, suitColor, suitTx, cardTypeLabel } from "../app/lib/gameConstants";

type Props = {
  card: Card | undefined;
  onClose: () => void;
};

// Full card detail overlay — opened by tapping a card face (hand, drop zone, etc.).
// Renders nothing when no card is selected.
export function CardDetailModal({ card, onClose }: Props) {
  if (!card) return null;
  const info = cardInfo(card);
  return (
    <div className="modal-backdrop modal-top" onClick={onClose}>
      <section className="card-detail" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <span className={`card-rank mock-card-suit-${suitColor(card.suit)}`}>
          {card.number} {suitTx(card.suit)}
        </span>
        <h2>{card.name}</h2>
        {card.image && (
          <img className="card-detail-art" src={card.image} alt={card.name} />
        )}
        <p>
          <b>ประเภท:</b> {cardTypeLabel(card)}
        </p>
        {(card.cardType === "weapon" || card.equipmentSlot === "weapon") &&
        card.effectParams?.range ? (
          <p className="card-detail-range">
            🎯 ระยะโจมตี {card.effectParams.range}
          </p>
        ) : null}
        <p>{info?.desc || card.description || "ยังไม่มีคำอธิบาย"}</p>
        {info?.use && (
          <p className="card-detail-use">
            <b>เมื่อไหร่:</b> {info.use}
          </p>
        )}
      </section>
    </div>
  );
}
