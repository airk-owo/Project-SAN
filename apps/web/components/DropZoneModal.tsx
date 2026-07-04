import type { Dispatch, SetStateAction } from "react";
import type { Card } from "../app/lib/gameTypes";
import { coarsePointer } from "../app/lib/gameConstants";
import { CardFace } from "./CardFace";

type NameTip = { key: string; name: string } | null;

type Props = {
  open: boolean;
  onClose: () => void;
  discard: Card[];
  nameTip: NameTip;
  setNameTip: Dispatch<SetStateAction<NameTip>>;
  onOpenDetail: (card: Card) => void;
};

// Discard pile viewer — a grid of every discarded card, newest first.
// Hover (or first-tap on touch) reveals the card name; a click/second-tap opens
// the full card detail. Renders nothing when closed.
export function DropZoneModal({
  open,
  onClose,
  discard,
  nameTip,
  setNameTip,
  onOpenDetail,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        onClose();
        setNameTip(null);
      }}
    >
      <section
        className="card-detail dropzone-panel"
        onClick={(e) => {
          e.stopPropagation();
          setNameTip(null); // tap outside a card closes the name tooltip
        }}
      >
        <button
          className="modal-close"
          onClick={() => {
            onClose();
            setNameTip(null);
          }}
        >
          ×
        </button>
        <h2>กองทิ้ง</h2>
        <p className="dropzone-count">
          ไพ่ทั้งหมด {discard.length} ใบ ·{" "}
          {coarsePointer()
            ? "แตะ 1 ครั้งดูชื่อ แตะซ้ำเปิดรายละเอียด"
            : "ชี้เพื่อดูชื่อ · คลิกดูรายละเอียด"}
        </p>
        {discard.length === 0 ? (
          <p className="dropzone-empty">ยังไม่มีไพ่ในกองทิ้ง</p>
        ) : (
          <div className="dropzone-grid">
            {discard
              .map((card, i) => ({ card, i }))
              .reverse()
              .map(({ card, i }) => {
                const key = `${card.id}-${i}`;
                const isTop = i === discard.length - 1;
                const openDetail = () => {
                  setNameTip(null);
                  onOpenDetail(card);
                };
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    className={`dropzone-card-wrap${isTop ? " dropzone-card-top" : ""}${nameTip?.key === key ? " tip-active" : ""}`}
                    onMouseEnter={() => {
                      if (!coarsePointer())
                        setNameTip({ key, name: card.name });
                    }}
                    onMouseLeave={() =>
                      setNameTip((t) => (t?.key === key ? null : t))
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      // Mobile: 1st tap shows the name, 2nd tap opens detail.
                      if (coarsePointer() && nameTip?.key !== key) {
                        setNameTip({ key, name: card.name });
                        return;
                      }
                      openDetail();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDetail();
                      }
                    }}
                  >
                    {isTop && (
                      <span className="dropzone-card-badge">ล่าสุด</span>
                    )}
                    <CardFace card={card} />
                  </div>
                );
              })}
          </div>
        )}
      </section>
      {nameTip && (
        <div className="dz-name-tooltip" role="tooltip">
          {nameTip.name}
        </div>
      )}
    </div>
  );
}
