import type { Card, Character } from "../app/lib/gameTypes";
import {
  cardInfo,
  suitColor,
  suitTx,
  cardTypeLabel,
} from "../app/lib/gameConstants";

type EncCategory = "generals" | "basic" | "trick" | "equip";

type Props = {
  isPlaying: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  classicNames: boolean;
  encCharDetail: Character | null;
  setEncCharDetail: (value: Character | null) => void;
  encDetail: Card | null;
  setEncDetail: (value: Card | null) => void;
  encSearch: string;
  setEncSearch: (value: string) => void;
  encCategory: EncCategory;
  setEncCategory: (value: EncCategory) => void;
  catalog: Card[] | null;
  charCatalog: Character[] | null;
};

// Card / general encyclopedia — a side drawer that lazy-loads the full catalogues.
// Opened from the navbar, an edge tab (desktop), or an edge-swipe (mobile).
export function EncyclopediaDrawer({
  isPlaying,
  open,
  onOpen,
  onClose,
  classicNames,
  encCharDetail,
  setEncCharDetail,
  encDetail,
  setEncDetail,
  encSearch,
  setEncSearch,
  encCategory,
  setEncCategory,
  catalog,
  charCatalog,
}: Props) {
  // Card name version for the encyclopedia (in-game cards are already resolved server-side).
  const encName = (c: { name: string; oldName?: string | null }) =>
    classicNames && c.oldName ? c.oldName : c.name;
  const encCategoryOf = (c: Card): "basic" | "trick" | "equip" =>
    c.cardType === "basic"
      ? "basic"
      : c.cardType === "instant_trick" || c.cardType === "delayed_trick"
        ? "trick"
        : "equip";
  return (
    <>
      {/* Edge triggers only on the game board (kept off the seating/lobby screens) */}
      {isPlaying && (
        <>
          {/* Desktop: slim gold sliding tab on the left edge */}
          <button
            className={`ency-tab${open ? " away" : ""}`}
            onClick={onOpen}
            title="คลังการ์ด / สารานุกรม"
            aria-label="เปิดคลังการ์ด"
          >
            <span className="ency-tab-icon">📜</span>
            <span className="ency-tab-text">คลังการ์ด</span>
          </button>
          {/* Mobile: minimal handle (swipe from the left edge also works) */}
          <button
            className={`ency-handle${open ? " away" : ""}`}
            onClick={onOpen}
            aria-label="เปิดคลังการ์ด (ปัดจากขอบซ้าย)"
          />
        </>
      )}
      {/* Desktop backdrop — dims the board behind the 40–50% panel */}
      <div
        className={`ency-backdrop${open ? " open" : ""}`}
        onClick={onClose}
      />
      <aside className={`ency-panel${open ? " open" : ""}`} aria-hidden={!open}>
        <header className="ency-header">
          <h2>📜 คลังการ์ด</h2>
          <button className="ency-close" onClick={onClose} aria-label="ปิด">
            ×
          </button>
        </header>
        {encCharDetail ? (
          <div className="ency-detail">
            <button
              className="ency-back"
              onClick={() => setEncCharDetail(null)}
            >
              ← กลับไปที่รายการ
            </button>
            {encCharDetail.image && (
              <img
                className="ency-detail-art"
                src={encCharDetail.image}
                alt={encCharDetail.name}
                loading="lazy"
              />
            )}
            <h3>{encCharDetail.name}</h3>
            <p className="ency-detail-type">
              {encCharDetail.kingdomTh || "—"} · ♥ {encCharDetail.hp}
              {encCharDetail.gender ? ` · ${encCharDetail.gender}` : ""}
            </p>
            {encCharDetail.skills.length ? (
              <ul className="ency-skills">
                {encCharDetail.skills.map((s) => (
                  <li key={s.name}>
                    <b>{s.name}</b>
                    <p>{s.description}</p>
                    {s.condition && <small>{s.condition}</small>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>ไม่มีทักษะพิเศษ</p>
            )}
          </div>
        ) : encDetail ? (
          (() => {
            const info = cardInfo(encDetail);
            return (
              <div className="ency-detail">
                <button
                  className="ency-back"
                  onClick={() => setEncDetail(null)}
                >
                  ← กลับไปที่รายการ
                </button>
                <span
                  className={`card-rank mock-card-suit-${suitColor(encDetail.suit)}`}
                >
                  {encDetail.number} {suitTx(encDetail.suit)}
                </span>
                <h3>{encName(encDetail)}</h3>
                {encDetail.oldName && encDetail.oldName !== encDetail.name && (
                  <p className="ency-detail-altname">
                    {classicNames ? "ชื่อใหม่" : "ชื่อเดิม"}:{" "}
                    {classicNames ? encDetail.name : encDetail.oldName}
                  </p>
                )}
                {encDetail.image && (
                  <img
                    className="ency-detail-art"
                    src={encDetail.image}
                    alt={encName(encDetail)}
                    loading="lazy"
                  />
                )}
                <p className="ency-detail-type">
                  <b>ประเภท:</b> {cardTypeLabel(encDetail)}
                </p>
                {(encDetail.cardType === "weapon" ||
                  encDetail.equipmentSlot === "weapon") &&
                encDetail.effectParams?.range ? (
                  <p className="card-detail-range">
                    🎯 ระยะโจมตี {encDetail.effectParams.range}
                  </p>
                ) : null}
                <p>
                  {info?.desc || encDetail.description || "ยังไม่มีคำอธิบาย"}
                </p>
                {info?.use && (
                  <p className="card-detail-use">
                    <b>เมื่อไหร่:</b> {info.use}
                  </p>
                )}
              </div>
            );
          })()
        ) : (
          <>
            <input
              className="ency-search"
              value={encSearch}
              onChange={(e) => setEncSearch(e.target.value)}
              placeholder={
                encCategory === "generals"
                  ? "🔍 ค้นหาขุนพล…"
                  : "🔍 ค้นหาชื่อการ์ด…"
              }
            />
            <div className="ency-layout">
              <nav className="ency-sidebar" aria-label="ตัวกรอง">
                {(
                  [
                    ["generals", "👑", "ขุนพล"],
                    ["basic", "🀄", "พื้นฐาน"],
                    ["trick", "🎴", "อุบาย"],
                    ["equip", "⚔️", "อุปกรณ์"],
                  ] as const
                ).map(([key, icon, label]) => (
                  <button
                    key={key}
                    className={`ency-filter${encCategory === key ? " active" : ""}`}
                    onClick={() => setEncCategory(key)}
                  >
                    <span className="ency-filter-icon">{icon}</span>
                    <span className="ency-filter-label">{label}</span>
                  </button>
                ))}
              </nav>
              <div className="ency-body">
                {encCategory === "generals"
                  ? (() => {
                      if (!charCatalog)
                        return <p className="ency-empty">กำลังโหลดขุนพล…</p>;
                      const q = encSearch.trim().toLowerCase();
                      const items = charCatalog.filter(
                        (c) =>
                          !q ||
                          c.name.toLowerCase().includes(q) ||
                          (c.kingdomTh || "").toLowerCase().includes(q),
                      );
                      if (!items.length)
                        return <p className="ency-empty">ไม่พบขุนพล</p>;
                      return (
                        <div className="ency-grid">
                          {items.map((char) => (
                            <button
                              key={char.id}
                              className="ency-card"
                              onClick={() => setEncCharDetail(char)}
                              title={char.name}
                            >
                              {char.image ? (
                                <img
                                  className="ency-card-img"
                                  src={char.image}
                                  alt={char.name}
                                  loading="lazy"
                                />
                              ) : (
                                <span className="ency-card-noimg">🎴</span>
                              )}
                              <b className="ency-card-name">{char.name}</b>
                              <span className="ency-card-type">
                                {char.kingdomTh || ""} · ♥{char.hp}
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })()
                  : (() => {
                      if (!catalog)
                        return <p className="ency-empty">กำลังโหลดการ์ด…</p>;
                      const byName = new Map<
                        string,
                        { card: Card; count: number }
                      >();
                      for (const c of catalog) {
                        const e = byName.get(c.name);
                        if (e) e.count++;
                        else byName.set(c.name, { card: c, count: 1 });
                      }
                      const q = encSearch.trim().toLowerCase();
                      const items = [...byName.values()].filter(
                        ({ card }) =>
                          encCategoryOf(card) === encCategory &&
                          (!q ||
                            encName(card).toLowerCase().includes(q) ||
                            card.name.toLowerCase().includes(q) ||
                            (card.description || "").toLowerCase().includes(q)),
                      );
                      if (!items.length)
                        return <p className="ency-empty">ไม่พบการ์ด</p>;
                      return (
                        <div className="ency-grid">
                          {items.map(({ card, count }) => (
                            <button
                              key={card.name}
                              className="ency-card"
                              onClick={() => setEncDetail(card)}
                              title={encName(card)}
                            >
                              <span className="ency-card-count">×{count}</span>
                              {card.image ? (
                                <img
                                  className="ency-card-img"
                                  src={card.image}
                                  alt={encName(card)}
                                  loading="lazy"
                                />
                              ) : (
                                <span className="ency-card-noimg">🎴</span>
                              )}
                              <b className="ency-card-name">{encName(card)}</b>
                              <span className="ency-card-type">
                                {cardTypeLabel(card)}
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
