/**
 * ⚠ DESIGN SANDBOX (route "/game/mock"), NOT the real game. Renders the SAME components
 *   and CSS classes as the real online game page (app/page.tsx) — OpponentPanel,
 *   EquipmentDisplay, DecisionArea, LogChatPanel, .mock-card hand, .local-turn-frame —
 *   fed with static mock data, so table/seat/hand visuals can be tuned (e.g. checking
 *   6–10 player density) without needing N real browser tabs connected via Socket.io.
 *   For real-game UI/UX edit app/page.tsx. (Hot-seat demo = app/game/local/page.tsx.)
 */
"use client";
import { useRef, useState, type CSSProperties } from "react";
import type { Card, Character, Player } from "../../lib/gameTypes";
import {
  ROLE_LABEL,
  charName,
  hearts,
  suitColor,
  suitTx,
  cardTypeLabel,
  kingdomLabel,
  edgePosition,
} from "../../lib/gameConstants";
import { OpponentPanel } from "../../../components/OpponentPanel";
import { EquipmentDisplay } from "../../../components/EquipmentDisplay";
import { DecisionArea } from "../../../components/DecisionArea";
import { LogChatPanel } from "../../../components/LogChatPanel";
import { Icon } from "../../../components/Icon";

let cardSeq = 0;
function mkCard(
  name: string,
  suit: string,
  number: string,
  type: string,
  cardType: string,
  equipmentSlot: string | null = null,
): Card {
  cardSeq += 1;
  return {
    id: `mock-card-${cardSeq}`,
    name,
    type,
    cardType,
    suit,
    number,
    description: null,
    effect: null,
    equipmentSlot,
    image: null,
  };
}

// Delayed-trick cards that sit in a player's decision area (DecisionArea keys its icon
// off `effect`: ⚡ ฟ้าลงโทษ / 🕒 มีสุขลืมเมือง).
function mkLightning(): Card {
  return {
    ...mkCard("ฟ้าลงโทษ", "♠", "2", "ไพ่กล", "trick"),
    oldName: "เรือระเบิดเพลิง",
    effect: "delayed_lightning_judgment",
  };
}
function mkIndulgence(): Card {
  return { ...mkCard("มีสุขลืมเมือง", "♥", "Q", "ไพ่กล", "trick"), effect: "delayed_skip_play_phase" };
}

function mkCharacter(
  id: string,
  name: string,
  hp: number,
  kingdom: string,
  kingdomTh: string,
  gender: string,
): Character {
  return { id, name, hp, kingdom, kingdomTh, gender, image: null, skills: [] };
}

function mkPlayer(p: {
  id: string;
  username: string;
  seatIndex: number;
  character: Character;
  hp: number;
  maxHp: number;
  hand?: Card[];
  weapon?: Card;
  armor?: Card;
  offensiveMount?: Card;
  defensiveMount?: Card;
  decisionArea?: Card[];
  role?: Player["role"];
  skippedPlayThisTurn?: boolean;
}): Player {
  return {
    id: p.id,
    username: p.username,
    seatIndex: p.seatIndex,
    connectionStatus: "online",
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    role: p.role,
    roleRevealed: p.role === "emperor",
    character: p.character,
    characterOptions: [],
    hand: p.hand ?? [],
    handCount: (p.hand ?? []).length,
    equipment: {
      weapon: p.weapon ?? null,
      armor: p.armor ?? null,
      offensiveMount: p.offensiveMount ?? null,
      defensiveMount: p.defensiveMount ?? null,
    },
    decisionArea: p.decisionArea ?? [],
    alive: true,
    hp: p.hp,
    maxHp: p.maxHp,
    skippedPlayThisTurn: p.skippedPlayThisTurn,
    ready: true,
    confirmedCharacter: true,
  };
}

const viewerId = "liu-bei";

// Full pool of 9 opponents (→ up to 10 players). The player-count control slices the
// first (count − 1) of these, so the demo cases (delayed tricks, "โดนใบ้") are ordered
// first to stay visible even at low counts. seatIndex is renumbered after slicing.
const OPPONENT_POOL: Player[] = [
  mkPlayer({
    id: "cao-cao",
    username: "caocao_player",
    seatIndex: 2,
    character: mkCharacter("CAOCAO", "โจโฉ", 4, "WEI", "วุยก๊ก", "ชาย"),
    hp: 3,
    maxHp: 4,
    weapon: mkCard("กระบี่ชิงกัง", "♠", "3", "อุปกรณ์ / อาวุธ", "equipment", "weapon"),
    offensiveMount: mkCard("ม้าศึก", "♥", "A", "อุปกรณ์ / ม้า", "equipment", "offensive_mount"),
    // DEMO: โดนฟ้าลงโทษอย่างเดียว
    decisionArea: [mkLightning()],
  }),
  mkPlayer({
    id: "sun-quan",
    username: "sunquan",
    seatIndex: 3,
    character: mkCharacter("SUNQUAN", "ซุนกวน", 4, "WU", "ง่อก๊ก", "ชาย"),
    hp: 4,
    maxHp: 4,
    armor: mkCard("ค่ายกลแปดทิศ", "♣", "2", "อุปกรณ์ / เกราะ", "equipment", "armor"),
    // DEMO: โดนมีสุขลืมเมืองอย่างเดียว
    decisionArea: [mkIndulgence()],
  }),
  mkPlayer({
    id: "zhao-yun",
    username: "zhaoyun_main",
    seatIndex: 4,
    character: mkCharacter("ZHAOYUN", "จูล่ง", 4, "SHU", "จ๊กก๊ก", "ชาย"),
    hp: 3,
    maxHp: 4,
    weapon: mkCard("หอกมังกรเงิน", "♠", "5", "อุปกรณ์ / อาวุธ", "equipment", "weapon"),
    // DEMO: โดนทั้งสองอย่าง (ฟ้าลงโทษ + มีสุขลืมเมือง)
    decisionArea: [mkLightning(), mkIndulgence()],
  }),
  mkPlayer({
    id: "xiahou-dun",
    username: "xiahoudun",
    seatIndex: 5,
    character: mkCharacter("XIAHOUDUN", "แฮหัวตุ้น", 4, "WEI", "วุยก๊ก", "ชาย"),
    hp: 2,
    maxHp: 4,
    weapon: mkCard("ดาบคู่หงส์", "♦", "4", "อุปกรณ์ / อาวุธ", "equipment", "weapon"),
    // DEMO: โดนใบ้ (มีสุขลืมเมืองข้ามช่วงเล่นไพ่)
    skippedPlayThisTurn: true,
  }),
  mkPlayer({
    id: "lu-bu",
    username: "lubu_ftw",
    seatIndex: 6,
    character: mkCharacter("LUBU", "ลิโป้", 4, "QUN", "อิสระ", "ชาย"),
    hp: 1,
    maxHp: 4,
    weapon: mkCard("ทวนฟ้าละคร", "♠", "K", "อุปกรณ์ / อาวุธ", "equipment", "weapon"),
    offensiveMount: mkCard("ม้าเซ็กเทา", "♥", "5", "อุปกรณ์ / ม้า", "equipment", "offensive_mount"),
  }),
  mkPlayer({
    id: "zhang-fei",
    username: "zhangfei88",
    seatIndex: 7,
    character: mkCharacter("ZHANGFEI", "เตียวหุย", 4, "SHU", "จ๊กก๊ก", "ชาย"),
    hp: 4,
    maxHp: 4,
    armor: mkCard("เกราะเหล็กกล้า", "♦", "6", "อุปกรณ์ / เกราะ", "equipment", "armor"),
  }),
  mkPlayer({
    id: "sun-ce",
    username: "sunce_",
    seatIndex: 8,
    character: mkCharacter("SUNCE", "ซุนเซ็ก", 4, "WU", "ง่อก๊ก", "ชาย"),
    hp: 3,
    maxHp: 4,
    hand: Array.from({ length: 7 }, () => mkCard("การ์ด", "♠", "?", "", "basic")),
  }),
  mkPlayer({
    id: "huang-gai",
    username: "huanggai",
    seatIndex: 9,
    character: mkCharacter("HUANGGAI", "ฮองกาย", 4, "WU", "ง่อก๊ก", "ชาย"),
    hp: 4,
    maxHp: 4,
    hand: [mkCard("การ์ด", "♠", "?", "", "basic")],
  }),
  mkPlayer({
    id: "diao-chan",
    username: "diaochan_",
    seatIndex: 10,
    character: mkCharacter("DIAOCHAN", "เตียวเสี้ยน", 3, "QUN", "อิสระ", "หญิง"),
    hp: 2,
    maxHp: 3,
    defensiveMount: mkCard("ม้าเซ็กเทา", "♥", "5", "อุปกรณ์ / ม้า", "equipment", "defensive_mount"),
  }),
];

const me = mkPlayer({
  id: viewerId,
  username: "pakitta",
  seatIndex: 1,
  character: mkCharacter("LIUBEI", "เล่าปี่", 4, "SHU", "จ๊กก๊ก", "ชาย"),
  hp: 4,
  maxHp: 4,
  weapon: mkCard("ง้าวมังกรเขียว", "♠", "5", "อุปกรณ์ / อาวุธ", "equipment", "weapon"),
  armor: mkCard("ค่ายกลแปดทิศ", "♣", "2", "อุปกรณ์ / เกราะ", "equipment", "armor"),
  role: "emperor",
  // DEMO: การ์ดตัวเองโดนทั้งสองอย่าง ให้เห็นตราบนโปรไฟล์ฝั่งตัวเองด้วย
  decisionArea: [mkLightning(), mkIndulgence()],
  hand: [
    mkCard("โจมตี", "♥", "7", "ไพ่พื้นฐาน", "basic"),
    mkCard("หลบ", "♠", "2", "ไพ่พื้นฐาน", "basic"),
    mkCard("เสบียง", "♦", "9", "ไพ่พื้นฐาน", "basic"),
    mkCard("โจมตี", "♣", "K", "ไพ่พื้นฐาน", "basic"),
    mkCard("ง้าวมังกรเขียว", "♠", "5", "อุปกรณ์ / อาวุธ", "equipment", "weapon"),
  ],
});

const mockLog = [
  { id: "l1", message: "เริ่มเกมแล้ว", at: "2026-01-01T20:10:00", type: "mock" },
  {
    id: "l2",
    message: "แจกบทบาทให้ผู้เล่นแล้ว",
    at: "2026-01-01T20:11:00",
    type: "mock",
  },
  {
    id: "l3",
    message: "เล่าปี่ เลือกขุนพล",
    at: "2026-01-01T20:12:00",
    type: "mock",
  },
  {
    id: "l4",
    message: "โจโฉ ติดตั้ง กระบี่ชิงกัง",
    at: "2026-01-01T20:13:00",
    type: "mock",
  },
  {
    id: "l5",
    message: "โจโฉ ใช้ โจมตี ใส่ เล่าปี่",
    at: "2026-01-01T20:14:00",
    type: "mock",
  },
  { id: "l6", message: "เล่าปี่ ใช้ หลบ", at: "2026-01-01T20:15:00", type: "mock" },
];

const mockChat = [
  { id: "c1", username: "pakitta", text: "ขอคิดก่อนนะ", at: "2026-01-01T20:16:00" },
  { id: "c2", username: "sunquan", text: "พร้อมแล้ว", at: "2026-01-01T20:17:00" },
  { id: "c3", username: "caocao_player", text: "ใช้หลบไหม?", at: "2026-01-01T20:18:00" },
];

const stepBtn = (disabled: boolean): CSSProperties => ({
  width: 26,
  height: 26,
  borderRadius: "50%",
  border: "1px solid #c8b58a66",
  background: disabled ? "#c8b58a22" : "#e0ba67",
  color: disabled ? "#c8b58a66" : "#170f0a",
  fontSize: "1.1rem",
  fontWeight: 700,
  lineHeight: 1,
  cursor: disabled ? "default" : "pointer",
});

function seatDensityFor(count: number) {
  if (count <= 4) return "large";
  if (count <= 6) return "medium";
  if (count <= 8) return "small";
  return "compact";
}

export default function MockGamePage() {
  const [openPanel, setOpenPanel] = useState<"log" | null>("log");
  const [logChatTab, setLogChatTab] = useState<"log" | "chat">("log");
  const [chatText, setChatText] = useState("");
  const [playerCount, setPlayerCount] = useState(8);
  const logEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Take the first (playerCount − 1) opponents and renumber their seats around the viewer.
  const opponents = OPPONENT_POOL.slice(0, playerCount - 1).map((p, i) => ({
    ...p,
    seatIndex: i + 2,
  }));
  const density = seatDensityFor(playerCount);
  // DEMO: ใช้ชื่อการ์ดเก่า → ฟ้าลงโทษแสดงเป็นไอคอนเรือ (เรือระเบิดเพลิง)
  const classicNames = true;

  return (
    <main className={`mock-game-page local-game-page mock-count-${playerCount}`}>
      <nav className="local-navbar">
        <div className="local-navbar-left">
          <span className="local-nav-title">ยุทธพิชัยสามก๊ก</span>
          <span className="local-nav-turn">
            <b>ตา: {me.username}</b> <em>เล่น</em>
          </span>
        </div>
        <div className="local-role-counts">
          {(["emperor", "rebel", "loyalist", "traitor"] as const).map((role) => (
            <span key={role} className={`local-role-count local-role-${role}`}>
              {ROLE_LABEL[role]} {role === "emperor" ? 1 : 3}
            </span>
          ))}
        </div>
        <div className="local-navbar-right">
          <button
            className={`local-nav-btn${openPanel === "log" ? " active" : ""}`}
            onClick={() => setOpenPanel((p) => (p === "log" ? null : "log"))}
            title="บันทึก/แชท"
            aria-label="บันทึก/แชท"
          >
            <Icon name="comment" size={20} />
          </button>
        </div>
      </nav>

      {/* Dev control (sandbox only): step how many players sit at the table (2–10). */}
      <div
        style={{
          position: "fixed",
          top: "calc(var(--wtk-nav-h, 56px) + 8px)",
          left: 10,
          zIndex: 120,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 6px",
          background: "#170f0aef",
          border: "1px solid #c8b58a80",
          borderRadius: 999,
          boxShadow: "0 4px 14px #0006",
        }}
      >
        <button
          onClick={() => setPlayerCount((n) => Math.max(2, n - 1))}
          disabled={playerCount <= 2}
          title="ลดผู้เล่น"
          style={stepBtn(playerCount <= 2)}
        >
          −
        </button>
        <span
          style={{
            color: "#faf8ef",
            fontSize: "0.8rem",
            fontWeight: 700,
            minWidth: 46,
            textAlign: "center",
          }}
        >
          {playerCount} คน
        </span>
        <button
          onClick={() => setPlayerCount((n) => Math.min(10, n + 1))}
          disabled={playerCount >= 10}
          title="เพิ่มผู้เล่น"
          style={stepBtn(playerCount >= 10)}
        >
          +
        </button>
      </div>

      {openPanel === "log" && (
        <LogChatPanel
          tab={logChatTab}
          onTabChange={setLogChatTab}
          onClose={() => setOpenPanel(null)}
          log={mockLog}
          renderLog={(msg) => msg}
          logEndRef={logEndRef}
          chat={mockChat}
          chatEndRef={chatEndRef}
          chatText={chatText}
          onChatTextChange={setChatText}
          onSendChat={() => {}}
        />
      )}

      <section className="mock-match-layout">
        <section className="mock-table-stage" data-density={density}>
          <div className="mock-table-surface">
            <div className="mock-table-pattern">三國</div>
            <section className="mock-piles" aria-label="กองไพ่">
              <article className="mock-pile">
                <div className="mock-deck">🂠</div>
                <b>กองจั่ว</b>
                <small>42 ใบ</small>
              </article>
              <article className="mock-pile">
                <div className="mock-discard">
                  เสบียง
                  <br />
                  <span>♦ 9</span>
                </div>
                <b>กองทิ้ง</b>
                <small>18 ใบ</small>
              </article>
            </section>
            <section className="mock-action" aria-label="การกระทำปัจจุบัน">
              <small>การกระทำปัจจุบัน</small>
              <p>
                <b>โจโฉ</b> ใช้ <b>โจมตี</b> ใส่ <b>เล่าปี่</b>
              </p>
              <article className="mock-action-card">
                <span>7 ♥</span>
                <strong>โจมตี</strong>
                <em>Attack</em>
              </article>
            </section>
          </div>
          {opponents.map((player, index) => {
            const pos = edgePosition(index, opponents.length);
            const style = {
              "--seat-x": pos.left,
              "--seat-y": pos.top,
            } as CSSProperties;
            return (
              <div key={player.id} className="mock-opponent" style={style}>
                <OpponentPanel
                  player={player}
                  distance={Math.min(index + 1, opponents.length - index)}
                  classicNames={classicNames}
                />
              </div>
            );
          })}
        </section>
      </section>

      <section className="mock-current-player local-seat-active">
        <article className="mock-player mock-self mock-active-turn">
          <div className="mock-portrait-col">
            <div className="mock-portrait">
              {me.character?.image ? (
                <img src={me.character.image} alt={charName(me)} />
              ) : (
                charName(me).slice(0, 1)
              )}
            </div>
            {me.character?.kingdomTh && (
              <span className={`mock-kingdom kingdom-${me.character.kingdom ?? "QUN"}`}>
                <span className="kingdom-full">
                  {kingdomLabel(me.character.kingdomTh).full}
                </span>
                <span className="kingdom-short">
                  {kingdomLabel(me.character.kingdomTh).short}
                </span>
              </span>
            )}
            <DecisionArea cards={me.decisionArea} classicNames={classicNames} />
          </div>
          <div className="mock-player-content">
            <div className="local-name-row">
              <b>{charName(me)}</b>
              <button className="local-skills-btn" title="ดูทักษะ">
                !
              </button>
            </div>
            <small className="mock-username">@{me.username}</small>
            <div className="local-hp-hand">
              {hearts(me.hp, me.maxHp)}
              <span className="mock-hand-count">🂠 × {me.hand.length}</span>
            </div>
            <small className="mock-seat-info">ที่นั่ง {me.seatIndex}</small>
            {me.role && (
              <small className="mock-role local-role-emperor">
                บทบาท: {ROLE_LABEL[me.role] ?? me.role}
              </small>
            )}
            <EquipmentDisplay eq={me.equipment} />
          </div>
        </article>

        <div className="local-action-col">
          <div className="mock-your-turn">
            <strong>⬆ กดกองจั่วบนโต๊ะเพื่อจั่วไพ่</strong>
          </div>
          <div className="local-turn-frame">
            <div className="local-skill-slot">
              <button className="local-skill-btn">
                ทักษะ: ผูกมิตร (โปรยเสน่ห์)
              </button>
            </div>
            <div className="local-skill-slot local-skill-slot-empty" />
            <div className="local-turn-controls">
              <button className="mock-muted-button" disabled>
                ทิ้งไพ่เกินมือ
              </button>
              <button>จบเทิร์น</button>
            </div>
          </div>
        </div>

        <div className="mock-hand" aria-label="ไพ่ในมือ">
          {me.hand.map((card) => (
            <article
              key={card.id}
              tabIndex={0}
              className={`mock-card mock-card-suit-${suitColor(card.suit)} local-hand-card`}
            >
              <header>
                <span className="mock-card-rank">
                  {card.number}
                  {suitTx(card.suit)}
                </span>
              </header>
              <div className="mock-card-art">WTK</div>
              <b className="mock-card-name">{card.name}</b>
              <small>{cardTypeLabel(card)}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="mock-response" role="dialog" aria-label="การตอบโต้">
        <span className="mock-response-icon">⚔</span>
        <div>
          <small>โจโฉ ใช้ไพ่</small>
          <h2>โจมตี ใส่คุณ</h2>
          <p>คุณต้องการตอบโต้อย่างไร?</p>
        </div>
        <div className="mock-response-actions">
          <button>🛡 ใช้ หลบ</button>
          <button className="mock-muted-button">ไม่ทำอะไร</button>
        </div>
      </section>
    </main>
  );
}
