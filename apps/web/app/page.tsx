"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { io } from "socket.io-client";
const socket = io(
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001",
  { autoConnect: false },
);
// Proactive "play a card" socket events gated by the optional Card Play Confirmation
// setting. Response-window plays (dodge/negate/heal) are intentionally excluded — they
// run under the server's response countdown, so a confirm step there could cause timeouts.
const PLAY_CONFIRM_EVENTS = new Set([
  "card:play",
  "card:discard-target",
  "card:steal-target",
  "coerce:play",
  "attack:multi",
  "weapon:snake-attack",
  "skill:seduce",
]);

type Role = "emperor" | "loyalist" | "rebel" | "traitor";
type RoleDefinition = {
  role_key: Role;
  role_th: string;
  visibility: string;
  win_condition_th: string;
  team: string;
};
type Character = {
  id: string;
  name: string;
  hp: number;
  kingdom?: string;
  kingdomTh?: string;
  gender?: string;
  image?: string | null;
  skills: { name: string; description: string; condition?: string | null }[];
};
type Card = {
  id: string;
  name: string;
  type: string;
  cardType: string;
  suit: string;
  number: string;
  description: string | null;
  effect: string | null;
  equipmentSlot: string | null;
  image?: string | null;
  effectParams?: { range?: number } | null;
};
type EquipmentSlots = {
  weapon: Card | null;
  armor: Card | null;
  offensiveMount: Card | null;
  defensiveMount: Card | null;
};
type Player = {
  id: string;
  username: string;
  seatIndex: number;
  connectionStatus: "online" | "disconnected";
  joinedAt: string;
  lastSeenAt: string;
  role?: Role;
  roleRevealed: boolean;
  character?: Character;
  characterOptions: Character[];
  hand: Card[];
  handCount: number;
  equipment: EquipmentSlots;
  decisionArea: Card[];
  alive: boolean;
  hp?: number;
  maxHp?: number;
  ready: boolean;
  confirmedCharacter: boolean;
};
type Member = {
  id: string;
  username: string;
  connectionStatus: "online" | "disconnected";
  joinedAt: string;
  lastSeenAt: string;
};
type ResponseWindow = {
  type: string;
  currentResponderId: string | null;
  status: "open" | "resolved";
  responses: {
    playerId: string;
    response: "card" | "decline" | "timeout";
    card?: Card;
  }[];
  requiredPlayerIds?: string[];
  dyingPlayerId?: string;
};
type Turn = {
  activePlayerId: string | null;
  phase: string;
  attackUsedThisTurn: number;
  drawnThisTurn?: number;
};
type RoleAliveCounts = {
  emperor: number;
  loyalist: number;
  rebel: number;
  traitor: number;
};
type RoleSet = {
  emperor: number;
  loyalist: number;
  rebel: number;
  traitor: number;
};
type Room = {
  id: string;
  playerCount: number;
  spectatorCount: number;
  host: string;
  status: string;
  hasPassword: boolean;
};
type Game = {
  viewerId: string;
  hostId: string;
  isSpectator: boolean;
  phase: string;
  currentPlayerId?: string;
  hasDrawnThisTurn: boolean;
  lastPlayedCard?: Card;
  pendingAction?: {
    kind: "attack";
    actorId: string;
    targetId: string;
    dodgesRequired?: number;
    noDodge?: boolean;
  } | null;
  players: Player[];
  spectators: Member[];
  roleDefinitions?: RoleDefinition[];
  deck: { length: number };
  discard: Card[];
  log: { id: string; message: string; at: string }[];
  turn: Turn | null;
  responseWindow: ResponseWindow | null;
  winner?: string;
  pendingRepeatAttack?: { attackerId: string; weaponName: string } | null;
  pendingDestroyMount?: { attackerId: string; targetId: string } | null;
  pendingForceAttackDamage?: { attackerId: string } | null;
  pendingReplaceDamage?: {
    attackerId: string;
    targetId: string;
    damage: number;
    weaponName: string;
  } | null;
  pendingTwinSwords?: {
    attackerId: string;
    targetId: string;
    weaponName: string;
  } | null;
  pendingCoerce?: {
    actorId: string;
    weaponHolderId: string;
    victimId: string;
    trickName: string;
  } | null;
  pendingHarvest?: { revealed: Card[] } | null;
  pendingJudgment?: {
    playerId: string;
    trickEffect: string;
    trickName: string;
    stage: "awaiting_draw" | "revealed";
    revealed?: Card;
  } | null;
  pendingFankui?: { playerId: string; damagerId: string } | null;
  pendingRetaliate?: { damagerId: string; victimId: string } | null;
  pendingRetaliateJudgment?: { ownerId: string; damagerId: string } | null;
  pendingLegacy?: { ownerId: string; cards: Card[] } | null;
  pendingPeek?: { playerId: string; cards: Card[] } | null;
  pendingDischord?: { jiuyiId: string; targetId: string } | null;
  pendingAllyAssist?: {
    emperorId: string;
    allyId: string;
    kind: "attack" | "dodge";
    targetId?: string;
  } | null;
  pendingDraws?: Record<string, number>;
  lastJudgment?: {
    playerId: string;
    trickName: string;
    cardName: string;
    cardNumber: string;
    cardSuit: string;
    result: string;
    at: string;
  };
  tableFlash?: {
    icon: string;
    title: string;
    detail?: string;
    card?: { name: string; number: string; suit: string };
    at: string;
  } | null;
  roleAliveCounts?: RoleAliveCounts;
  distances?: Record<string, number | null>;
  responseDeadline?: number | null;
  startDeadline?: number | null;
  characterSkillKeys?: Record<string, string[]>;
  skillsUsedThisTurn?: string[];
};
type IceSelection =
  | { zone: "hand"; handIndex: number }
  | { zone: "equipment"; cardInstanceId: string };

const ROLE_LABEL: Record<string, string> = {
  emperor: "จักรพรรดิ",
  rebel: "กบฏ",
  loyalist: "ผู้ภักดี",
  traitor: "ทรยศ",
};
const PHASE_LABEL: Record<string, string> = {
  judgment: "ตัดสิน",
  draw: "จั่ว",
  play: "เล่น",
  discard: "ทิ้งไพ่",
  end: "จบเทิร์น",
};
const roleText = (role: RoleSet) =>
  `จักรพรรดิ ${role.emperor} · ผู้ภักดี ${role.loyalist} · กบฏ ${role.rebel} · ทรยศ ${role.traitor}`;
// '︎' (variation selector-15) forces text presentation so iOS/Safari doesn't turn ♥ into a color emoji (which ignores CSS color & breaks the HP bar layout).
const HEART = "♥︎";
const hearts = (hp?: number, maxHp?: number) =>
  hp === undefined || maxHp === undefined ? null : (
    <span className="mock-hearts">
      {HEART.repeat(Math.max(0, hp))}
      <i>{HEART.repeat(Math.max(0, maxHp - hp))}</i>
    </span>
  );
const charName = (
  p: { character?: { name: string }; username: string } | undefined,
) => p?.character?.name ?? p?.username ?? "ผู้เล่น";
const CARD_INFO: Record<string, { desc: string; use: string }> = {
  attack: {
    desc: 'ทำให้เป้าหมายต้องใช้ "หลบ" ไม่เช่นนั้นเสียพลังชีวิต 1',
    use: "ใช้โจมตีศัตรูในระยะ (1 ครั้ง/เทิร์น)",
  },
  dodge: {
    desc: 'ยกเลิกผลจากการ์ด "โจมตี"',
    use: "การ์ดตอบโต้ — เล่นได้เมื่อถูกโจมตี",
  },
  heal: {
    desc: "ฟื้นฟูพลังชีวิต 1 หน่วย",
    use: "ใช้ตอนเลือดไม่เต็ม หรือช่วยคนใกล้ตาย",
  },
  all_others_attack_or_damage: {
    desc: 'ขุนพลอื่นทุกคนต้องใช้ "โจมตี" ตามลำดับ ไม่เช่นนั้นเสียพลังชีวิต 1',
    use: "กดดันทั้งโต๊ะ",
  },
  all_others_dodge_or_damage: {
    desc: 'ขุนพลอื่นทุกคนต้องใช้ "หลบ" ตามลำดับ ไม่เช่นนั้นเสียพลังชีวิต 1',
    use: "รัวใส่ทั้งโต๊ะ",
  },
  duel_attack_response: {
    desc: 'เลือกขุนพล 1 คน ผลัดกันใช้ "โจมตี" ฝ่ายที่หยุดก่อนเสียพลังชีวิต 1',
    use: "ท้าดวล",
  },
  draw_cards: { desc: "จั่วการ์ด 2 ใบจากกองจั่ว", use: "เติมการ์ดบนมือ" },
  heal_all_living: {
    desc: "ฟื้นฟูพลังชีวิตให้ขุนพลที่ยังมีชีวิตทุกคน คนละ 1 หน่วย",
    use: "ฟื้นทั้งทีม",
  },
  discard_target_card: {
    desc: "ทิ้งการ์ดบนมือ/อุปกรณ์ 1 ใบ ของขุนพลอื่น 1 คน",
    use: "ทำลายอุปกรณ์หรือไพ่สำคัญของศัตรู",
  },
  steal_target_card_in_range: {
    desc: "หยิบการ์ด 1 ใบ จากขุนพลอื่นที่อยู่ในระยะ 1 หน่วย",
    use: "ขโมยไพ่ศัตรูที่อยู่ติดกัน",
  },
  negate_trick_effect: {
    desc: "ยกเลิกผลของไพ่อุบายที่ประกาศใช้",
    use: "ใช้ในช่วง Negate Window",
  },
  delayed_skip_play_phase: {
    desc: "วางบนขุนพลอื่น เมื่อถึงเทิร์นเขา ตัดสิน: ถ้าไม่ใช่ ♥ จะถูกข้ามช่วงเล่นไพ่",
    use: "กันไม่ให้ศัตรูออกการ์ดในเทิร์นถัดไป",
  },
  delayed_lightning_judgment: {
    desc: "วางบนตัวเอง เมื่อถึงเทิร์น ตัดสิน: ♠ 2–9 เสีย 3 พลังชีวิต ไม่งั้นเลื่อนไปคนถัดไป",
    use: "ระเบิดเวลาที่วนรอบโต๊ะ",
  },
  coerce_attack_or_take_weapon: {
    desc: "บังคับขุนพลที่มีอาวุธให้โจมตีเป้าหมายที่เลือก ถ้าไม่โจมตี คุณยึดอาวุธของเขา",
    use: "ยืมมือศัตรูฆ่ากันเอง หรือปล้นอาวุธ",
  },
  reveal_and_draft_cards: {
    desc: "เปิดไพ่ 1 ใบต่อผู้เล่นมีชีวิต แล้วเริ่มจากคุณ ผลัดกันหยิบคนละใบ",
    use: "เติมไพ่ให้ทั้งโต๊ะ แต่คุณเลือกก่อน",
  },
};
const cardInfo = (c: Card) =>
  CARD_INFO[c.effect || ""] ||
  (c.description ? { desc: c.description, use: "" } : null);
const suitColor = (suit: string) =>
  suit === "♥" || suit === "♦" ? "red" : "black";
// เติม VS-15 (U+FE0E) ท้ายดอกไพ่ตอนแสดงผล → บังคับให้ iOS ทุกเวอร์ชัน render เป็นตัวอักษร ไม่ใช่อิโมจิ (ห้ามใช้กับ logic เทียบดอก)
const SUIT_TEXT: Record<string, string> = {
  "♠": "♠︎",
  "♥": "♥︎",
  "♦": "♦︎",
  "♣": "♣︎",
};
const suitTx = (s: string) => SUIT_TEXT[s] ?? s;
/** Short type label: drops the "อุปกรณ์ /" prefix and appends the mount distance modifier. */
const cardTypeLabel = (c: Card) => {
  const base = (c.type || "").replace(/^อุปกรณ์\s*\/\s*/, "");
  if (c.equipmentSlot === "offensive_mount") return `${base} −1`;
  if (c.equipmentSlot === "defensive_mount") return `${base} +1`;
  return base;
};
const KINGDOM_FACTION: Record<string, string> = {
  WEI: "wei",
  SHU: "shu",
  WU: "wu",
  QUN: "qun",
};

function EquipmentDisplay({
  eq,
  onInspect,
}: {
  eq: EquipmentSlots;
  onInspect?: (card: Card) => void;
}) {
  const r = (key: keyof EquipmentSlots, icon: string, label: string) => {
    const s = eq[key];
    return (
      <span
        className={`mock-equipment-slot ${s ? "equipped" : ""}${s && onInspect ? " local-inspectable" : ""}`}
        title={s?.name ?? `${label}: ว่าง`}
        onClick={
          s && onInspect
            ? (e) => {
                e.stopPropagation();
                onInspect(s);
              }
            : undefined
        }
      >
        <i>{icon}</i>
        <em>{label}</em>
        <b>{s?.name ?? "—"}</b>
      </span>
    );
  };
  return (
    <div className="mock-equipment">
      {r("weapon", "🗡", "อาวุธ")}
      {r("armor", "🛡", "เกราะ")}
      {r("offensiveMount", "🐎", "ม้ารุก −1")}
      {r("defensiveMount", "🐎", "ม้ารับ +1")}
    </div>
  );
}
function DecisionArea({
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

// Arc across the top of the table. index 0 = viewer's immediate left neighbor,
// last index = viewer's immediate right neighbor (viewer sits at the bottom).
function edgePosition(index: number, total: number) {
  if (total <= 0) return { left: "50%", top: "1%" };
  if (total === 1) return { left: "50%", top: "4%" };
  const t = index / (total - 1); // 0 → left, 1 → right
  const angle = Math.PI * (1 - t); // π (left) → 0 (right)
  const left = 50 + 46 * Math.cos(angle); // 4% … 96%
  const top = 48 - 46 * Math.sin(angle); // ends low (48), middle high (2)
  return { left: `${left.toFixed(1)}%`, top: `${top.toFixed(1)}%` };
}

// Circular position for all 10 lobby seats (seat 1 at top, clockwise)
function lobbyPosition(seatIndex: number): { left: string; top: string } {
  const angle = ((seatIndex - 1) / 10) * 2 * Math.PI - Math.PI / 2;
  return {
    left: `${(50 + 42 * Math.cos(angle)).toFixed(1)}%`,
    top: `${(50 + 38 * Math.sin(angle)).toFixed(1)}%`,
  };
}

function OpponentPanel({
  player,
  targetable,
  distance,
  onClick,
  onSkills,
  onInspect,
}: {
  player: Player;
  targetable?: boolean;
  distance?: number | null;
  onClick?: () => void;
  onSkills?: () => void;
  onInspect?: (card: Card) => void;
}) {
  return (
    <article
      onClick={onClick}
      className={`mock-player local-opponent ${targetable ? "local-targetable" : ""} ${!player.alive ? "local-dead" : ""}`}
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
        <DecisionArea cards={player.decisionArea} onInspect={onInspect} />
      </div>
    </article>
  );
}

/** True when the server's decision countdown is waiting on the viewer specifically
 *  (dodge/heal/negate/duel/etc. or any pending decision the viewer must resolve). */
function isViewerDecisionActive(game: Game | undefined): boolean {
  if (!game || game.phase !== "playing" || !game.responseDeadline) return false;
  const me = game.viewerId;
  const rw = game.responseWindow;
  return Boolean(
    (rw?.status === "open" && rw.currentResponderId === me) ||
      game.pendingJudgment?.playerId === me ||
      game.pendingRepeatAttack?.attackerId === me ||
      game.pendingDestroyMount?.attackerId === me ||
      game.pendingForceAttackDamage?.attackerId === me ||
      game.pendingReplaceDamage?.attackerId === me ||
      game.pendingTwinSwords?.targetId === me ||
      game.pendingFankui?.playerId === me ||
      game.pendingLegacy?.ownerId === me ||
      game.pendingRetaliateJudgment?.ownerId === me ||
      game.pendingRetaliate?.damagerId === me ||
      game.pendingPeek?.playerId === me ||
      game.pendingDischord?.targetId === me ||
      game.pendingAllyAssist?.allyId === me,
  );
}

export default function Home() {
  const [game, setGame] = useState<Game | undefined>();
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const prevPhaseRef = useRef<string | undefined>(undefined);
  const [room, setRoom] = useState("demo");
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [chatText, setChatText] = useState("");
  const [chat, setChat] = useState<
    { id: string; username: string; text: string; at: string }[]
  >([]);
  const [roleOptions, setRoleOptions] = useState<RoleSet[]>([]);
  const [error, setError] = useState<string>();
  const [showRole, setShowRole] = useState(false);
  const [detailCard, setDetailCard] = useState<Card>();
  const [showDropZone, setShowDropZone] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [catalog, setCatalog] = useState<Card[] | null>(null);
  const [encSearch, setEncSearch] = useState("");
  const [encCategory, setEncCategory] = useState<
    "all" | "basic" | "trick" | "equip"
  >("all");
  const [encDetail, setEncDetail] = useState<Card | null>(null);
  const [confirmBeforePlay, setConfirmBeforePlay] = useState(true); // default ON — opt out via settings
  const [pendingPlay, setPendingPlay] = useState<{
    event: string;
    data?: Record<string, unknown>;
  } | null>(null);
  const [skillsCharacter, setSkillsCharacter] = useState<Character>();
  const [logChatTab, setLogChatTab] = useState<"log" | "chat">("log");
  const [soundOn, setSoundOn] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedAttackId, setSelectedAttackId] = useState<string>();
  const [selectedDiscardId, setSelectedDiscardId] = useState<string>();
  const [selectedDiscardTargetId, setSelectedDiscardTargetId] =
    useState<string>();
  const [selectedDiscardZone, setSelectedDiscardZone] = useState<
    "hand" | "equipment"
  >();
  const [selectedStealId, setSelectedStealId] = useState<string>();
  const [selectedStealTargetId, setSelectedStealTargetId] = useState<string>();
  const [selectedStealZone, setSelectedStealZone] = useState<
    "hand" | "equipment"
  >();
  const [discardLimitMode, setDiscardLimitMode] = useState(false);
  const [discardLimitSelected, setDiscardLimitSelected] = useState<string[]>(
    [],
  );
  const [discardLimitConfirming, setDiscardLimitConfirming] = useState(false);
  const [forceDiscardRefs, setForceDiscardRefs] = useState<string[]>([]);
  const [iceSelections, setIceSelections] = useState<IceSelection[]>([]);
  const [snakeMode, setSnakeMode] = useState(false);
  const [snakeCards, setSnakeCards] = useState<string[]>([]);
  const [multiAttackId, setMultiAttackId] = useState<string>();
  const [multiTargets, setMultiTargets] = useState<string[]>([]);
  const [coerceCardId, setCoerceCardId] = useState<string>();
  const [coerceHolderId, setCoerceHolderId] = useState<string>();
  const [balanceMode, setBalanceMode] = useState(false);
  const [balanceCards, setBalanceCards] = useState<string[]>([]);
  const [miracleMode, setMiracleMode] = useState(false);
  const [miracleCard, setMiracleCard] = useState<string>();
  const [marriageMode, setMarriageMode] = useState(false);
  const [marriageCards, setMarriageCards] = useState<string[]>([]);
  const [raidMode, setRaidMode] = useState(false);
  const [raidTargets, setRaidTargets] = useState<string[]>([]);
  const [benevolenceMode, setBenevolenceMode] = useState(false);
  const [benevolenceCards, setBenevolenceCards] = useState<string[]>([]);
  const [retaliateCards, setRetaliateCards] = useState<string[]>([]);
  const [redirectMode, setRedirectMode] = useState(false);
  const [redirectCard, setRedirectCard] = useState<string>();
  const [bandinMode, setBandinMode] = useState(false);
  const [seduceMode, setSeduceMode] = useState(false);
  const [seduceCard, setSeduceCard] = useState<string>();
  const [peekOrder, setPeekOrder] = useState<string[]>([]);
  const [dischordMode, setDischordMode] = useState(false);
  const [confirmSelfDamage, setConfirmSelfDamage] = useState(false);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [confirmCharacter, setConfirmCharacter] = useState<
    Character | undefined
  >();
  const [inciteMode, setInciteMode] = useState(false);
  const [inciteCard, setInciteCard] = useState<string>();
  const [inciteFirst, setInciteFirst] = useState<string>();
  const [unityMode, setUnityMode] = useState(false);
  const [unityTarget, setUnityTarget] = useState<string>();
  const [guardianMode, setGuardianMode] = useState(false);
  const [guicaiPicking, setGuicaiPicking] = useState(false);
  const [openPanel, setOpenPanel] = useState<"room" | "logchat" | null>(null);
  const [roleVisible, setRoleVisible] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [confirmStart, setConfirmStart] = useState(false);
  const [drawPreview, setDrawPreview] = useState<Card[] | null>(null);
  const [equipConfirmCard, setEquipConfirmCard] = useState<Card>();
  const [judgmentBanner, setJudgmentBanner] = useState<Game["lastJudgment"]>();
  const prevJudgmentAt = useRef<string | undefined>(undefined);
  const judgmentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [tableBanner, setTableBanner] = useState<Game["tableFlash"]>();
  const prevFlashAt = useRef<string | undefined>(undefined);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const prevHandIds = useRef<string | undefined>(undefined);
  const countingRef = useRef(false); // true ระหว่างนับ 1-2-3 เปิดเกม — กัน draw-preview เด้งซ้อน
  const drawNoticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lastTurn = useRef<string | undefined>(undefined);
  const [turnBanner, setTurnBanner] = useState(false);
  const turnBannerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const revealedRole = useRef<Role | undefined>(undefined);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);

  // --- Audio cues on a shared AudioContext; every call site is gated by `soundOn`. ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tone = (
    freq: number,
    start: number,
    end: number,
    vol = 0.14,
    type: OscillatorType = "sine",
  ) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(
        vol,
        ctx.currentTime + start + 0.015,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + end + 0.03);
    } catch {}
  };
  const playDecisionAlert = () => {
    tone(988, 0, 0.16, 0.17);
    tone(1319, 0.15, 0.42, 0.15);
  };
  const playCountdownTick = (urgent: boolean) =>
    tone(urgent ? 1650 : 1350, 0, urgent ? 0.13 : 0.07, 0.13, "square");

  const myDecision = isViewerDecisionActive(game);
  const prevDecisionRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);
  // Initial alert: sound the moment a decision falls to the viewer.
  useEffect(() => {
    if (myDecision && !prevDecisionRef.current && soundOn) playDecisionAlert();
    prevDecisionRef.current = myDecision;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myDecision, soundOn]);
  // Urgent per-second ticking during the final 7 seconds of the viewer's decision.
  useEffect(() => {
    if (!myDecision || !game?.responseDeadline) {
      lastTickRef.current = null;
      return;
    }
    const secs = Math.max(0, Math.ceil((game.responseDeadline - nowTs) / 1000));
    if (secs >= 1 && secs <= 7 && lastTickRef.current !== secs) {
      lastTickRef.current = secs;
      if (soundOn) playCountdownTick(secs <= 3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTs, myDecision, soundOn, game?.responseDeadline]);

  useEffect(() => {
    let id = localStorage.getItem("wtk-member-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("wtk-member-id", id);
    }
    setUserId(id);
  }, []);
  // Per-player Card Play Confirmation preference — defaults ON; players opt out in settings.
  // Persists across reloads/matches on this device (only an explicit "0" turns it off).
  useEffect(() => {
    const stored = localStorage.getItem("wtk-confirm-play");
    setConfirmBeforePlay(stored === null ? true : stored === "1");
  }, []);
  // Encyclopedia: lazy-load the full card catalogue the first time the drawer opens.
  useEffect(() => {
    if (!showEncyclopedia || catalog) return;
    fetch(
      `${process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"}/cards`,
    )
      .then((r) => r.json())
      .then((c: Card[]) => setCatalog(Array.isArray(c) ? c : []))
      .catch(() => setCatalog([]));
  }, [showEncyclopedia, catalog]);
  // Encyclopedia: "swipe from the left edge" opens the drawer on touch devices
  // (mobile has no visible edge tab so it doesn't cover the left-side seats).
  useEffect(() => {
    if (showEncyclopedia) return;
    let startX = 0,
      startY = 0,
      tracking = false;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t && t.clientX <= 26) {
        tracking = true;
        startX = t.clientX;
        startY = t.clientY;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      if (t.clientX - startX > 55 && Math.abs(t.clientY - startY) < 45) {
        tracking = false;
        setShowEncyclopedia(true);
      }
    };
    const onEnd = () => {
      tracking = false;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [showEncyclopedia]);
  useEffect(() => {
    const onState = (v: Game) => {
      setGame(v);
      setError(undefined);
    };
    const onMsg = (v: {
      id: string;
      username: string;
      text: string;
      at: string;
    }) => setChat((c) => [...c, v]);
    const onOptions = (v: RoleSet[]) => setRoleOptions(v);
    const onError = (v: string) => setError(v);
    socket.on("game:state", onState);
    socket.on("chat:message", onMsg);
    socket.on("game:role-options", onOptions);
    socket.on("game:error", onError);
    return () => {
      socket.off("game:state", onState);
      socket.off("chat:message", onMsg);
      socket.off("game:role-options", onOptions);
      socket.off("game:error", onError);
    };
  }, []);
  useEffect(() => {
    const reconnect = () => {
      if (joinedRoom && userId)
        socket.emit("room:join", {
          gameId: joinedRoom,
          username: name,
          userId,
        });
    };
    socket.on("connect", reconnect);
    return () => {
      socket.off("connect", reconnect);
    };
  }, [joinedRoom, userId, name]);
  // When it becomes the viewer's turn: flash a visual banner (always) and play a chime (if sound is on).
  useEffect(() => {
    const turn = game?.currentPlayerId;
    const newlyMyTurn =
      !!turn && turn === game?.viewerId && lastTurn.current !== turn;
    if (newlyMyTurn) {
      setTurnBanner(true);
      if (turnBannerTimer.current) clearTimeout(turnBannerTimer.current);
      turnBannerTimer.current = setTimeout(() => setTurnBanner(false), 2800);
      if (soundOn) {
        try {
          const ctx = new AudioContext();
          // Two-tone rising "ding-ding" so the turn cue is unmistakable.
          const chime = (freq: number, start: number, end: number) => {
            const osc = ctx.createOscillator(),
              gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(
              0.16,
              ctx.currentTime + start + 0.02,
            );
            gain.gain.exponentialRampToValueAtTime(
              0.0001,
              ctx.currentTime + end,
            );
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + end + 0.02);
          };
          chime(660, 0, 0.22);
          chime(988, 0.16, 0.5);
        } catch {}
      }
    }
    lastTurn.current = turn;
  }, [game?.currentPlayerId, game?.viewerId, soundOn]);
  useEffect(() => {
    const role = game?.players.find((p) => p.id === game.viewerId)?.role;
    if (role && revealedRole.current !== role) {
      revealedRole.current = role;
      setShowRole(true);
    }
  }, [game?.players, game?.viewerId]);
  useEffect(() => {
    const ph = game?.phase;
    if (
      ph === "playing" &&
      prevPhaseRef.current &&
      prevPhaseRef.current !== "playing"
    ) {
      setStartCountdown(3);
      countingRef.current = true;
    }
    if (ph && ph !== prevPhaseRef.current)
      setOpenPanel(ph === "waiting" ? "room" : null);
    if (game) prevPhaseRef.current = ph;
  }, [game?.phase]);
  useEffect(() => {
    if (startCountdown === null) {
      countingRef.current = false;
      return;
    }
    if (startCountdown <= 0) {
      const t = setTimeout(() => {
        setStartCountdown(null);
        const hand = game?.players.find((p) => p.id === game.viewerId)?.hand;
        if (hand?.length) {
          setDrawPreview(hand);
          if (drawNoticeTimer.current) clearTimeout(drawNoticeTimer.current);
          drawNoticeTimer.current = setTimeout(
            () => setDrawPreview(null),
            3000,
          );
        }
      }, 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStartCountdown((c) => (c ?? 1) - 1), 850);
    return () => clearTimeout(t);
  }, [startCountdown]);
  useEffect(() => {
    if (logChatTab === "chat")
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, logChatTab]);
  useEffect(() => {
    if (logChatTab === "log")
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [game?.log?.length, logChatTab]);
  // Re-runs when phase changes to 'playing' so handRef.current is populated by then
  useEffect(() => {
    const el = handRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [game?.phase]);
  // Tick once per second while a response/decision countdown is active (display only; server enforces the skip)
  useEffect(() => {
    if (!game?.responseDeadline && !game?.startDeadline) return;
    setNowTs(Date.now());
    const id = setInterval(() => setNowTs(Date.now()), 300);
    return () => clearInterval(id);
  }, [game?.responseDeadline, game?.startDeadline]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(undefined), 10000);
    return () => clearTimeout(t);
  }, [error]);
  // Close the hand-limit discard menu once the debt is cleared or it's not the viewer's turn; close play-phase selection modes outside the play phase
  useEffect(() => {
    if (!game) return;
    const me = game.players.find((p) => p.id === game.viewerId);
    const myTurn = game.currentPlayerId === game.viewerId;
    const myPlay = myTurn && game.turn?.phase === "play";
    const req = Math.max(0, (me?.hand.length || 0) - (me?.hp || 0));
    if (!myTurn || req === 0) {
      setDiscardLimitMode(false);
      setDiscardLimitSelected([]);
      setDiscardLimitConfirming(false);
    }
    if (!myPlay) {
      setSnakeMode(false);
      setSnakeCards([]);
      setMultiAttackId(undefined);
      setMultiTargets([]);
      setCoerceCardId(undefined);
      setCoerceHolderId(undefined);
      setSelectedAttackId(undefined);
      setSelectedDiscardId(undefined);
      setSelectedStealId(undefined);
      setBalanceMode(false);
      setBalanceCards([]);
    }
  }, [game]);
  // Show the judgment reveal to everyone for a few seconds whenever a new one occurs
  useEffect(() => {
    const j = game?.lastJudgment;
    if (!j) return;
    if (prevJudgmentAt.current === undefined) {
      prevJudgmentAt.current = j.at;
      return;
    } // skip the one already present on first load
    if (prevJudgmentAt.current === j.at) return;
    prevJudgmentAt.current = j.at;
    setJudgmentBanner(j);
    if (judgmentTimer.current) clearTimeout(judgmentTimer.current);
    judgmentTimer.current = setTimeout(
      () => setJudgmentBanner(undefined),
      5000,
    );
  }, [game?.lastJudgment?.at]);
  useEffect(() => {
    const f = game?.tableFlash;
    if (!f) return;
    if (prevFlashAt.current === undefined) {
      prevFlashAt.current = f.at;
      return;
    }
    if (prevFlashAt.current === f.at) return;
    prevFlashAt.current = f.at;
    setTableBanner(f);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setTableBanner(undefined), 4000);
  }, [game?.tableFlash?.at]);
  // Notify the viewer which card(s) just entered their hand (draw, or any gain). Skips the initial deal.
  useEffect(() => {
    const hand = game?.players.find((p) => p.id === game.viewerId)?.hand;
    if (!hand) {
      prevHandIds.current = undefined;
      return;
    }
    const prev = prevHandIds.current;
    prevHandIds.current = hand.map((c) => c.id).join(",");
    if (countingRef.current) return; // ระหว่างนับ 1-2-3 ไพ่เปิดเกมถูกโชว์โดย countdown effect — ไม่ต้อง preview ซ้ำ
    const prevSet = new Set(prev ? prev.split(",") : []);
    // The opening hand is revealed after the 3-2-1 countdown (see the countdown effect); here we only preview later draws.
    const added =
      prev === undefined ? [] : hand.filter((c) => !prevSet.has(c.id));
    if (!added.length) return;
    setDrawPreview(added);
    if (drawNoticeTimer.current) clearTimeout(drawNoticeTimer.current);
    drawNoticeTimer.current = setTimeout(() => setDrawPreview(null), 3000);
  }, [game]);

  const loadRooms = () =>
    fetch(
      `${process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"}/rooms`,
    )
      .then((r) => r.json())
      .then(setRooms)
      .catch(() => setRooms([]));
  useEffect(() => {
    if (game) return;
    loadRooms();
    const id = setInterval(loadRooms, 5000);
    return () => clearInterval(id);
  }, [game]);
  const join = (roomId = room) => {
    if (!userId) return;
    socket.connect();
    setJoinedRoom(roomId);
    socket.emit("room:join", { gameId: roomId, username: name, userId });
  };
  const emitNow = (event: string, data?: Record<string, unknown>) =>
    socket.emit(event, { gameId: joinedRoom, ...data });
  // Card Play Confirmation: when the per-player setting is ON, defer proactive card
  // plays behind a confirm/cancel overlay instead of sending them to the server.
  const emit = (event: string, data?: Record<string, unknown>) => {
    if (confirmBeforePlay && PLAY_CONFIRM_EVENTS.has(event)) {
      setPendingPlay({ event, data });
      return;
    }
    emitNow(event, data);
  };
  const toggleConfirmBeforePlay = () =>
    setConfirmBeforePlay((v) => {
      const next = !v;
      try {
        localStorage.setItem("wtk-confirm-play", next ? "1" : "0");
      } catch {}
      return next;
    });

  if (!game)
    return (
      <main className="lobby">
        <h1 className="game-title">ยุทธพิชัยสามก๊ก</h1>
        <p>เข้าสู่สมรภูมิและรวมพลสหายของคุณ</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Username"
        />
        <section className="room-browser">
          <div>
            <h2>ห้องที่เปิดอยู่</h2>
            <button onClick={loadRooms}>รีเฟรช</button>
          </div>
          <div className="room-list">
            {rooms.length ? (
              rooms.map((r) => (
                <article key={r.id}>
                  <b>{r.id}</b>
                  <span>
                    {r.status === "waiting"
                      ? "กำลังรอผู้เล่น"
                      : "กำลังเล่น — Spectator"}
                  </span>
                  <small>
                    หัวหน้า: {r.host} · ผู้เล่น {r.playerCount} · ผู้ชม{" "}
                    {r.spectatorCount}
                  </small>
                  <button
                    disabled={!name || !userId}
                    onClick={() => join(r.id)}
                  >
                    {r.status === "waiting" ? "เข้าห้อง" : "เข้าชม"}
                  </button>
                </article>
              ))
            ) : (
              <p>ยังไม่มีห้องที่เปิดอยู่</p>
            )}
          </div>
        </section>
        <section className="create-room">
          <h2>สร้างห้องใหม่</h2>
          <div className="create-row">
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="ชื่อห้อง"
            />
            <button disabled={!name || !userId} onClick={() => join()}>
              สร้าง/เข้าห้อง
            </button>
          </div>
        </section>
      </main>
    );

  const myPlayer = game.players.find((p) => p.id === game.viewerId);
  const myRoleInfo = game.roleDefinitions?.find(
    (r) => r.role_key === myPlayer?.role,
  );
  const isMyTurn = game.currentPlayerId === game.viewerId;
  const isPlaying = game.phase === "playing";
  const rw = game.responseWindow;
  const canRespond =
    rw?.currentResponderId === game.viewerId && rw.status === "open";
  const responder = rw?.currentResponderId
    ? game.players.find((p) => p.id === rw.currentResponderId)
    : undefined;
  const dyingPlayer =
    rw?.type === "dying_heal" && rw.dyingPlayerId
      ? game.players.find((p) => p.id === rw.dyingPlayerId)
      : undefined;
  const canAct =
    isMyTurn && game.hasDrawnThisTurn && !rw && game.turn?.phase === "play";
  const isDrawPhase = isMyTurn && game.turn?.phase === "draw";
  const myOwedDraws = game.pendingDraws?.[game.viewerId] ?? 0;
  const myKeys =
    (myPlayer?.character && game.characterSkillKeys?.[myPlayer.character.id]) ||
    [];
  const mySwap = myKeys.includes("attack_dodge_swap"); // จูล่ง กล้าหาญ
  const hasMySkill = (key: string) => myKeys.includes(key);
  const myGuicai = myKeys.includes("replace_judgment"); // สุมาอี้ กำหนดชะตา
  // Does one of my cards count as `asEffect`? (own effect, จูล่ง swap, or a suit conversion: กวนอู/เอียนสี/ฮัวโต๋)
  const myConv = (asEffect: string, card: Card): boolean =>
    card.effect === asEffect ||
    (mySwap &&
      ((asEffect === "dodge" && card.effect === "attack") ||
        (asEffect === "attack" && card.effect === "dodge"))) ||
    (myKeys.includes("red_as_attack") &&
      asEffect === "attack" &&
      ["♥", "♦"].includes(card.suit)) ||
    (myKeys.includes("black_as_dodge") &&
      asEffect === "dodge" &&
      ["♠", "♣"].includes(card.suit)) ||
    (myKeys.includes("red_as_heal") &&
      asEffect === "heal" &&
      ["♥", "♦"].includes(card.suit));
  const skillUsed = (key: string) =>
    Boolean(game.skillsUsedThisTurn?.includes(key));
  const toggleBalance = (id: string) =>
    setBalanceCards((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const pj = game.pendingJudgment;
  const myJudgmentDraw = Boolean(
    pj && pj.playerId === game.viewerId && pj.stage === "awaiting_draw",
  );
  const myJudgmentAct = Boolean(
    pj && pj.playerId === game.viewerId && pj.stage === "revealed",
  );
  const requiredDiscard =
    (game.characterSkillKeys?.[game.viewerId] || []).includes(
      "skip_discard_if_no_attack",
    ) && (game.turn?.attackUsedThisTurn ?? 0) === 0
      ? 0
      : Math.max(0, (myPlayer?.hand.length || 0) - (myPlayer?.hp || 0)); // ลิบอง ยับยั้งชั่งใจ: ถ้าไม่ได้โจมตีในรอบนี้ ไม่ต้องทิ้งไพ่
  const toggleDiscardLimit = (id: string) =>
    setDiscardLimitSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const cancelDiscardLimit = () => {
    setDiscardLimitMode(false);
    setDiscardLimitSelected([]);
    setDiscardLimitConfirming(false);
  };
  const hasSnakeSpear =
    myPlayer?.equipment.weapon?.effect === "discard_two_as_attack";
  const hasUnlimitedAttack =
    myPlayer?.equipment.weapon?.effect === "unlimited_attack_per_turn" ||
    (game.characterSkillKeys?.[game.viewerId] || []).includes(
      "unlimited_attack",
    ); // หน้าไม้กล หรือ เตียวหุย คำราม → โจมตีได้ไม่จำกัด
  const canSnakeAttack =
    canAct &&
    hasSnakeSpear &&
    (hasUnlimitedAttack || (game.turn?.attackUsedThisTurn ?? 0) < 1);
  const toggleSnake = (id: string) =>
    setSnakeCards((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 2
          ? [...prev, id]
          : prev,
    );
  const cancelSnake = () => {
    setSnakeMode(false);
    setSnakeCards([]);
  };
  const canPlayCard = (card: Card) => {
    if (canRespond) {
      if (rw?.type === "attack_dodge")
        return myConv("dodge", card) || card.effect === "negate_trick_effect";
      if (rw?.type === "dying_heal") return myConv("heal", card);
      if (rw?.type === "negate") return card.effect === "negate_trick_effect";
      if (rw?.type === "mass_dodge")
        return myConv("dodge", card) || card.effect === "negate_trick_effect";
      if (rw?.type === "multi_attack") return myConv("dodge", card);
      if (rw?.type === "mass_attack")
        return myConv("attack", card) || card.effect === "negate_trick_effect";
      if (rw?.type === "duel_attack") return myConv("attack", card);
      return false;
    }
    if (!canAct) return false;
    if (card.effect === "attack")
      return hasUnlimitedAttack || (game.turn?.attackUsedThisTurn ?? 0) < 1;
    if (card.effect === "dodge")
      return (
        myConv("attack", card) &&
        (hasUnlimitedAttack || (game.turn?.attackUsedThisTurn ?? 0) < 1)
      ); // จูล่ง/กวนอู: ใช้ "หลบ"/ไพ่แดง เป็น "โจมตี"
    return true;
  };
  const selectCard = (card: Card) => {
    if (!canPlayCard(card)) return;
    if (canRespond) {
      if (rw?.type === "negate" && card.effect === "negate_trick_effect")
        return emit("negate:play", { cardId: card.id });
      if (
        (rw?.type === "mass_dodge" || rw?.type === "mass_attack") &&
        card.effect === "negate_trick_effect"
      )
        return emit("mass:respond", { cardId: card.id });
      if (
        rw?.type === "mass_dodge" ||
        rw?.type === "mass_attack" ||
        rw?.type === "multi_attack"
      )
        return emit("mass:respond", { cardId: card.id });
      if (rw?.type === "attack_dodge" && myConv("dodge", card))
        return emit("attack:respond", { cardId: card.id });
      if (rw?.type === "duel_attack" && myConv("attack", card))
        return emit("duel:respond", { cardId: card.id });
      if (rw?.type === "dying_heal" && myConv("heal", card))
        return emit("response:heal", { cardId: card.id });
      return;
    }
    if (card.effect === "attack") {
      if (
        myPlayer?.equipment.weapon?.effect ===
          "last_hand_multi_target_attack" &&
        myPlayer.hand.length === 1
      ) {
        setMultiAttackId(card.id);
        setMultiTargets([]);
        setSelectedAttackId(undefined);
        setSelectedDiscardId(undefined);
        setSelectedStealId(undefined);
      } else {
        setSelectedAttackId(card.id);
        setSelectedDiscardId(undefined);
        setSelectedStealId(undefined);
      }
    } else if (card.effect === "dodge" && myConv("attack", card)) {
      setSelectedAttackId(card.id);
      setSelectedDiscardId(undefined);
      setSelectedStealId(undefined);
    } // จูล่ง/กวนอู: เล่น "หลบ"/ไพ่แดง เป็น "โจมตี" — เลือกเป้าหมาย
    else if (card.effect === "duel_attack_response") {
      setSelectedAttackId(card.id);
      setSelectedDiscardId(undefined);
      setSelectedStealId(undefined);
    } else if (card.effect === "discard_target_card") {
      setSelectedDiscardId(card.id);
      setSelectedAttackId(undefined);
      setSelectedStealId(undefined);
    } else if (card.effect === "steal_target_card_in_range") {
      setSelectedStealId(card.id);
      setSelectedAttackId(undefined);
      setSelectedDiscardId(undefined);
    } else if (card.effect === "coerce_attack_or_take_weapon") {
      setCoerceCardId(card.id);
      setCoerceHolderId(undefined);
      setSelectedAttackId(undefined);
      setSelectedDiscardId(undefined);
      setSelectedStealId(undefined);
    } else if (card.effect === "delayed_skip_play_phase") {
      setSelectedAttackId(card.id);
      setSelectedDiscardId(undefined);
      setSelectedStealId(undefined);
    } else if (card.effect === "delayed_lightning_judgment")
      emit("card:play", { cardId: card.id });
    else if (
      card.effect === "all_others_dodge_or_damage" ||
      card.effect === "all_others_attack_or_damage" ||
      card.effect === "draw_cards" ||
      card.effect === "heal_all_living" ||
      card.effect === "heal" ||
      card.effect === "reveal_and_draft_cards"
    )
      emit("card:play", { cardId: card.id });
    else if (card.equipmentSlot) setEquipConfirmCard(card);
  };
  const cancelSelection = () => {
    setSelectedAttackId(undefined);
    setSelectedDiscardId(undefined);
    setSelectedDiscardTargetId(undefined);
    setSelectedStealId(undefined);
    setSelectedStealTargetId(undefined);
    setSelectedStealZone(undefined);
    setSelectedDiscardZone(undefined);
    setMultiAttackId(undefined);
    setMultiTargets([]);
    setCoerceCardId(undefined);
    setCoerceHolderId(undefined);
  };
  // Card Play Confirmation overlay actions.
  const confirmPendingPlay = () => {
    if (pendingPlay) emitNow(pendingPlay.event, pendingPlay.data);
    setPendingPlay(null);
  };
  const cancelPendingPlay = () => {
    setPendingPlay(null);
    cancelSelection(); // return the card safely to hand / clear any target selection
  };
  // Opponents in circular seat order starting just after the viewer, wrapping around,
  // so the table mirrors real seat geometry (immediate neighbors sit beside the viewer).
  const seatOrdered = [...game.players].sort(
    (a, b) => a.seatIndex - b.seatIndex,
  );
  const viewerSeatIdx = seatOrdered.findIndex((p) => p.id === game.viewerId);
  const opponents =
    viewerSeatIdx < 0
      ? seatOrdered.filter((p) => p.id !== game.viewerId)
      : [
          ...seatOrdered.slice(viewerSeatIdx + 1),
          ...seatOrdered.slice(0, viewerSeatIdx),
        ];
  const discardTarget = selectedDiscardTargetId
    ? game.players.find((p) => p.id === selectedDiscardTargetId)
    : undefined;
  const stealTarget = selectedStealTargetId
    ? game.players.find((p) => p.id === selectedStealTargetId)
    : undefined;
  const topDiscard = game.lastPlayedCard;
  const renderLog = (msg: string) => {
    const names = game.players
      .map((p) => p.username)
      .sort((a, b) => b.length - a.length);
    if (!names.length) return msg;
    return msg
      .split(
        new RegExp(
          `(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
          "g",
        ),
      )
      .map((part, i) => (names.includes(part) ? <b key={i}>{part}</b> : part));
  };
  const isHost = game.hostId === game.viewerId,
    waiting = game.phase === "waiting";
  const chooser = game.players.find(
    (p) => !p.confirmedCharacter && p.characterOptions.length > 0,
  );
  const anchorSeat = myPlayer?.seatIndex || 1;
  const waitingForCharacter = game.players.filter((p) => !p.confirmedCharacter);
  const emperor = game.players.find((p) => p.role === "emperor");
  const roleCounts = game.roleAliveCounts;
  const readyCount = game.players.filter((p) => p.ready).length;
  const startSecondsLeft = game.startDeadline
    ? Math.max(0, Math.ceil((game.startDeadline - nowTs) / 1000))
    : null;

  // Plain JSX element (not a component) so it is not remounted on every keystroke —
  // a nested component definition would lose input focus after each character.
  // Log/chat panel content — opened from the navbar (top-right overlay so it never covers the hand).
  const logChatContent = (
    <section className="mock-log local-navpanel">
      <h2 className="local-tab-bar">
        <button
          className={`local-tab${logChatTab === "log" ? " local-tab-active" : ""}`}
          onClick={() => setLogChatTab("log")}
        >
          บันทึก
        </button>
        <button
          className={`local-tab${logChatTab === "chat" ? " local-tab-active" : ""}`}
          onClick={() => setLogChatTab("chat")}
        >
          แชท
        </button>
        <button
          className="local-chat-collapse"
          onClick={() => setOpenPanel(null)}
          title="ปิด"
        >
          ✕
        </button>
      </h2>
      {logChatTab === "log" ? (
        <div className="local-log-scroll">
          {game.log.map((l) => (
            <p key={l.id}>
              <time>{l.at.slice(11, 16) || l.at}</time>
              {renderLog(l.message)}
            </p>
          ))}
          <div ref={logEndRef} />
        </div>
      ) : (
        <div className="local-chat-scroll">
          {chat.map((m) => (
            <p key={m.id}>
              <time>{m.at?.slice(11, 16) || ""}</time>
              <b>{m.username}:</b> {m.text}
            </p>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}
      {logChatTab === "chat" && (
        <form
          className="local-chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (chatText.trim()) {
              emit("chat:send", { text: chatText });
              setChatText("");
            }
          }}
        >
          <input
            className="local-chat-input"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="พิมพ์ข้อความ…"
            maxLength={200}
          />
          <button type="submit" disabled={!chatText.trim()}>
            ส่ง
          </button>
        </form>
      )}
    </section>
  );
  // Room panel content — opened from the navbar.
  const roomContent = (
    <section className="mock-log local-navpanel">
      <h2 className="local-tab-bar">
        <span className="local-navpanel-title">ห้อง: {joinedRoom}</span>
        <button
          className="local-chat-collapse"
          onClick={() => setOpenPanel(null)}
          title="ปิด"
        >
          ✕
        </button>
      </h2>
      <div className="local-lobby-players">
        ผู้เล่น {game.players.length} คน
        {game.spectators.length > 0
          ? ` · ผู้ชม ${game.spectators.length} คน`
          : ""}
      </div>
      {game.spectators.length > 0 && (
        <div className="local-spectator-names">
          👁 ผู้ชม: {game.spectators.map((s) => s.username).join(", ")}
        </div>
      )}
      <div className="local-lobby-controls">
        {waiting && !myPlayer && !game.isSpectator && (
          <button onClick={() => emit("seat:random")}>นั่งที่นั่งสุ่ม</button>
        )}
        {waiting && myPlayer && (
          <div className="local-ready-row">
            <button
              className={myPlayer.ready ? "secondary" : ""}
              onClick={() => emit("player:ready", { ready: !myPlayer.ready })}
            >
              {myPlayer.ready ? "✓ ยกเลิกพร้อม" : "พร้อมแล้ว"}
            </button>
            <button
              className="secondary local-spectate-btn"
              onClick={() => emit("seat:spectate")}
            >
              ดูเฉย ๆ
            </button>
          </div>
        )}
        {isHost &&
          waiting &&
          (game.startDeadline ? (
            <button
              className="danger"
              onClick={() => emit("game:cancel-start")}
            >
              ✕ ยกเลิกการเริ่ม ({startSecondsLeft})
            </button>
          ) : (
            <button
              onClick={() => setConfirmStart(true)}
              disabled={readyCount < game.players.length}
            >
              เริ่มเกม ({readyCount}/{game.players.length})
            </button>
          ))}
        {isPlaying && myPlayer?.alive && (
          <button
            className="danger"
            onClick={() => {
              setOpenPanel(null);
              setConfirmSurrender(true);
            }}
          >
            🏳️ ยอมแพ้
          </button>
        )}
        <button
          className="danger"
          onClick={() => {
            emit("room:leave");
            setGame(undefined);
            setJoinedRoom("");
            loadRooms();
          }}
        >
          ออกจากห้อง
        </button>
      </div>
    </section>
  );
  const activePlayer = game.players.find(
    (p) => p.id === game.turn?.activePlayerId,
  );
  const navbar = (
    <nav className="local-navbar">
      <div className="local-navbar-left">
        <span className="local-nav-title">ยุทธพิชัยสามก๊ก</span>
        {isPlaying && (
          <span className="local-nav-turn">
            <b>ตา: {activePlayer?.username || "—"}</b>{" "}
            <em>
              {PHASE_LABEL[game.turn?.phase || ""] || game.turn?.phase}
              {isDrawPhase && (game.turn?.drawnThisTurn ?? 0) > 0
                ? ` ${game.turn?.drawnThisTurn}/2`
                : ""}
            </em>
          </span>
        )}
        {game.isSpectator && <span className="local-nav-turn">· ผู้ชม</span>}
      </div>
      {isPlaying && (
        <div className="local-role-counts">
          {(["emperor", "rebel", "loyalist", "traitor"] as const).map(
            (role) => {
              const alive = roleCounts
                ? roleCounts[role]
                : game.players.filter((p) => p.role === role && p.alive).length;
              return (
                <span
                  key={role}
                  className={`local-role-count local-role-${role}${alive === 0 ? " local-role-dead" : ""}`}
                >
                  {ROLE_LABEL[role]} {alive}
                </span>
              );
            },
          )}
        </div>
      )}
      <div className="local-navbar-right">
        <button
          className={`local-nav-btn${openPanel === "room" ? " active" : ""}`}
          onClick={() => setOpenPanel((p) => (p === "room" ? null : "room"))}
          title="ห้อง"
        >
          🏠
        </button>
        <button
          className={`local-nav-btn${openPanel === "logchat" ? " active" : ""}`}
          onClick={() =>
            setOpenPanel((p) => (p === "logchat" ? null : "logchat"))
          }
          title="บันทึก/แชท"
        >
          💬
        </button>
        {myPlayer?.role && (
          <button
            className="local-nav-btn"
            onClick={() => setShowRole(true)}
            title="บทบาทของฉัน"
          >
            🎭
          </button>
        )}
        <button
          className={`local-nav-btn${confirmBeforePlay ? " active" : ""}`}
          onClick={() => setShowSettings(true)}
          title="ตั้งค่าในเกม"
        >
          ⚙️
        </button>
      </div>
    </nav>
  );
  const navPanels = (
    <>
      {openPanel === "room" && roomContent}
      {openPanel === "logchat" && logChatContent}
    </>
  );
  const secondsLeft = game.responseDeadline
    ? Math.max(0, Math.ceil((game.responseDeadline - nowTs) / 1000))
    : null;
  const countdownBadge =
    secondsLeft != null ? (
      <span
        className={`local-countdown${secondsLeft <= 5 ? " local-countdown-urgent" : ""}`}
      >
        ⏳ {secondsLeft} วิ
      </span>
    ) : null;
  // Feature 2: critical final-7-seconds state for the viewer's own decision.
  const criticalCountdown =
    myDecision && secondsLeft != null && secondsLeft <= 7 && secondsLeft >= 1;

  const encCategoryOf = (c: Card): "basic" | "trick" | "equip" =>
    c.cardType === "basic"
      ? "basic"
      : c.cardType === "instant_trick" || c.cardType === "delayed_trick"
        ? "trick"
        : "equip";
  const encyclopediaDrawer = isPlaying ? (
    <>
      {/* Desktop: slim gold sliding tab on the left edge */}
      <button
        className={`ency-tab${showEncyclopedia ? " away" : ""}`}
        onClick={() => setShowEncyclopedia(true)}
        title="คลังการ์ด / สารานุกรม"
        aria-label="เปิดคลังการ์ด"
      >
        <span className="ency-tab-icon">📖</span>
        <span className="ency-tab-text">คลังการ์ด</span>
      </button>
      {/* Mobile: minimal handle (swipe from the left edge also works) */}
      <button
        className={`ency-handle${showEncyclopedia ? " away" : ""}`}
        onClick={() => setShowEncyclopedia(true)}
        aria-label="เปิดคลังการ์ด (ปัดจากขอบซ้าย)"
      />
      {/* Desktop backdrop — dims the board behind the 40–50% panel */}
      <div
        className={`ency-backdrop${showEncyclopedia ? " open" : ""}`}
        onClick={() => setShowEncyclopedia(false)}
      />
      <aside
        className={`ency-panel${showEncyclopedia ? " open" : ""}`}
        aria-hidden={!showEncyclopedia}
      >
        <header className="ency-header">
          <h2>📖 คลังการ์ด</h2>
          <button
            className="ency-close"
            onClick={() => setShowEncyclopedia(false)}
            aria-label="ปิด"
          >
            ×
          </button>
        </header>
        {encDetail ? (
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
                <h3>{encDetail.name}</h3>
                {encDetail.image && (
                  <img
                    className="ency-detail-art"
                    src={encDetail.image}
                    alt={encDetail.name}
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
                <p>{info?.desc || encDetail.description || "ยังไม่มีคำอธิบาย"}</p>
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
              placeholder="🔍 ค้นหาชื่อการ์ด…"
            />
            <div className="ency-filters">
              {(
                [
                  ["all", "ทั้งหมด"],
                  ["basic", "พื้นฐาน"],
                  ["trick", "อุบาย"],
                  ["equip", "อุปกรณ์"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={`ency-chip${encCategory === key ? " active" : ""}`}
                  onClick={() => setEncCategory(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="ency-body">
              {!catalog ? (
                <p className="ency-empty">กำลังโหลดคลังการ์ด…</p>
              ) : (
                (() => {
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
                      (encCategory === "all" ||
                        encCategoryOf(card) === encCategory) &&
                      (!q ||
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
                        >
                          {card.image ? (
                            <img
                              className="ency-card-img"
                              src={card.image}
                              alt={card.name}
                              loading="lazy"
                            />
                          ) : (
                            <span className="ency-card-noimg">🎴</span>
                          )}
                          <span className="ency-card-body">
                            <b className="ency-card-name">{card.name}</b>
                            <span className="ency-card-type">
                              {cardTypeLabel(card)}
                            </span>
                            <span className="ency-card-desc">
                              {cardInfo(card)?.desc || card.description}
                            </span>
                          </span>
                          <span className="ency-card-count">×{count}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </>
        )}
      </aside>
    </>
  ) : null;

  return (
    <>
      {navbar}
      {encyclopediaDrawer}
      <main
        className={
          isPlaying
            ? `mock-game-page local-game-page mock-count-${game.players.length}`
            : "game-page"
        }
      >
        {navPanels}
        {game.winner &&
          (() => {
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
                    <button
                      onClick={() => {
                        emit("room:leave");
                        setGame(undefined);
                        setJoinedRoom("");
                        loadRooms();
                      }}
                    >
                      ออกจากห้อง
                    </button>
                  </div>
                </section>
              </div>
            );
          })()}
        {error && (
          <div
            className="local-warn-overlay"
            onClick={() => setError(undefined)}
          >
            <div className="local-warn-box" role="alert">
              <span>⚠️ {error}</span>
              <small>แตะเพื่อปิด</small>
            </div>
          </div>
        )}
        {drawPreview && drawPreview.length > 0 && (
          <div
            className="local-draw-preview"
            role="status"
            onClick={() => setDrawPreview(null)}
          >
            <div
              className="local-draw-preview-fan"
              style={{ "--n": drawPreview.length } as CSSProperties}
            >
              {drawPreview.map((c, i) => (
                <article
                  key={c.id}
                  className={`mock-card mock-card-suit-${suitColor(c.suit)} local-preview-card`}
                  style={{ "--i": i } as CSSProperties}
                >
                  <header>
                    <span className="mock-card-rank">
                      {c.number}
                      {suitTx(c.suit)}
                    </span>
                  </header>
                  {c.image ? (
                    <img className="mock-card-art" src={c.image} alt={c.name} />
                  ) : (
                    <div className="mock-card-art">WTK</div>
                  )}
                  <b className="mock-card-name">{c.name}</b>
                  <small>{cardTypeLabel(c)}</small>
                </article>
              ))}
            </div>
            <p className="local-draw-preview-label">
              🎴 ได้รับการ์ด {drawPreview.length} ใบ · แตะเพื่อปิด
            </p>
          </div>
        )}
        {game.isSpectator && (
          <p className="spectator-banner">
            คุณกำลังรับชมเกมนี้ในฐานะ Spectator
          </p>
        )}

        {/* Pre-game: same table layout as playing but no piles */}
        {!isPlaying && (
          <section
            className={`mock-match-layout mock-count-${game.players.length}`}
          >
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
                const player = game.players.find(
                  (p) => p.seatIndex === seatNum,
                );
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
                        onClick={() =>
                          emit("seat:select", { seatIndex: seatNum })
                        }
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
                          <img
                            src={player.character.image}
                            alt={charName(player)}
                          />
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
                          <small
                            style={{ color: "var(--danger)", fontWeight: 700 }}
                          >
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
        )}

        {roleOptions.length > 0 && isHost && (
          <section className="choice">
            <h2>เลือกชุดบทบาท</h2>
            {roleOptions.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  emit("game:start", { composition: r });
                  setRoleOptions([]);
                }}
              >
                {roleText(r)}
              </button>
            ))}
          </section>
        )}
        {game.phase === "character-select" && chooser && (
          <section className="choice">
            <h2>เลือกขุนพลของคุณ (คลิกที่การ์ด)</h2>
            <div className="character-grid">
              {chooser.characterOptions.map((c) => (
                <article
                  key={c.id}
                  tabIndex={0}
                  onClick={() => setConfirmCharacter(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setConfirmCharacter(c);
                    }
                  }}
                  className={`local-general-card local-faction-${KINGDOM_FACTION[c.kingdom || ""] || "qun"}`}
                >
                  {c.image ? (
                    <img className="local-general-bg" src={c.image} alt="" />
                  ) : (
                    <div className="local-general-bg local-general-bg-ph">
                      WTK
                    </div>
                  )}
                  <div className="local-general-info">
                    <div className="local-general-head">
                      <h3 className="general-name">{c.name}</h3>
                      <span className="local-general-meta">
                        {c.kingdomTh || "อิสระ"} · HP {c.hp}
                      </span>
                    </div>
                    <div className="local-general-skills">
                      {c.skills.map((s) => (
                        <p key={s.name}>
                          <b>{s.name}</b> — {s.description}
                        </p>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {isPlaying && (
          <section className="mock-match-layout">
            <section className="mock-table-stage" data-density="large">
              <div className="mock-table-surface">
                <div className="mock-table-pattern">三國</div>
                <section className="mock-piles">
                  <button
                    className={`mock-pile${isDrawPhase || myOwedDraws > 0 || myJudgmentDraw ? " local-draw-pile-active" : ""}`}
                    onClick={
                      isDrawPhase
                        ? () => emit("turn:draw-one")
                        : myOwedDraws > 0
                          ? () => emit("pending:draw")
                          : myJudgmentDraw
                            ? () => emit("judgment:draw")
                            : undefined
                    }
                    title={
                      isDrawPhase
                        ? "คลิกเพื่อจั่วไพ่ทีละใบ"
                        : myOwedDraws > 0
                          ? "คลิกเพื่อจั่วไพ่ที่ได้รับ"
                          : myJudgmentDraw
                            ? "คลิกเพื่อเปิดไพ่ตัดสิน"
                            : undefined
                    }
                  >
                    <div className="mock-deck">
                      {isDrawPhase
                        ? `จั่ว ${game.turn?.drawnThisTurn ?? 0}/2`
                        : myOwedDraws > 0
                          ? `รับ +${myOwedDraws}`
                          : myJudgmentDraw
                            ? "⚖"
                            : "🂠"}
                    </div>
                    <b>กองจั่ว</b>
                    <small>{game.deck.length} ใบ</small>
                  </button>
                  <button
                    type="button"
                    className="mock-pile mock-pile-btn"
                    onClick={() =>
                      game.discard.length && setShowDropZone(true)
                    }
                    disabled={!game.discard.length}
                    title="ดูไพ่ทั้งหมดในกองทิ้ง"
                  >
                    <div
                      key={topDiscard?.id || "empty"}
                      className={`mock-discard${topDiscard ? " local-suit-" + suitColor(topDiscard.suit) + " local-card-played" : ""}`}
                    >
                      {topDiscard ? (
                        <>
                          {topDiscard.name}
                          <br />
                          <span>
                            {topDiscard.number} {suitTx(topDiscard.suit)}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                    <b>กองทิ้ง</b>
                    <small>
                      {game.discard.length} ใบ
                      {game.discard.length > 0 ? " 🔍" : ""}
                    </small>
                  </button>
                </section>
                <p className="local-action-empty">
                  {isDrawPhase
                    ? "⬆ กดกองจั่วเพื่อจั่วไพ่"
                    : myOwedDraws > 0
                      ? `⬆ กดกองจั่วเพื่อรับไพ่ที่ได้รับ (${myOwedDraws} ใบ)`
                      : rw
                        ? `กำลังรอ ${responder?.username ?? "ผู้เล่น"} ตอบสนอง`
                        : "—"}
                </p>
              </div>
              {opponents.map((player, index) => {
                const pos = edgePosition(index, opponents.length);
                const style = {
                  "--seat-x": pos.left,
                  "--seat-y": pos.top,
                } as CSSProperties;
                const attackTarget = Boolean(selectedAttackId && player.alive);
                const discardTargetable = Boolean(
                  selectedDiscardId &&
                  player.alive &&
                  player.id !== game.viewerId,
                );
                const stealTargetable = Boolean(
                  selectedStealId &&
                  player.alive &&
                  player.id !== game.viewerId,
                );
                const snakeTargetable = Boolean(
                  snakeMode &&
                  snakeCards.length === 2 &&
                  player.alive &&
                  player.id !== game.viewerId,
                );
                const multiTargetable = Boolean(
                  multiAttackId && player.alive && player.id !== game.viewerId,
                );
                const coerceHolderPick = Boolean(
                  coerceCardId &&
                  !coerceHolderId &&
                  player.alive &&
                  player.id !== game.viewerId &&
                  player.equipment.weapon,
                );
                const coerceVictimPick = Boolean(
                  coerceCardId &&
                  coerceHolderId &&
                  player.alive &&
                  player.id !== coerceHolderId,
                );
                const miracleTargetable = Boolean(
                  miracleMode &&
                  miracleCard &&
                  player.alive &&
                  player.hp !== undefined &&
                  player.maxHp !== undefined &&
                  player.hp < player.maxHp,
                );
                const marriageTargetable = Boolean(
                  marriageMode &&
                  marriageCards.length === 2 &&
                  player.alive &&
                  player.character?.gender === "ชาย" &&
                  player.hp !== undefined &&
                  player.maxHp !== undefined &&
                  player.hp < player.maxHp,
                );
                const raidTargetable = Boolean(
                  raidMode &&
                  player.alive &&
                  player.id !== game.viewerId &&
                  (player.handCount ?? player.hand.length) > 0,
                );
                const benevolenceTargetable = Boolean(
                  benevolenceMode &&
                  benevolenceCards.length > 0 &&
                  player.alive &&
                  player.id !== game.viewerId,
                );
                const redirectTargetable = Boolean(
                  redirectMode &&
                  redirectCard &&
                  player.alive &&
                  player.id !== game.viewerId &&
                  player.id !== game.pendingAction?.actorId,
                );
                const seduceTargetable = Boolean(
                  seduceMode &&
                  seduceCard &&
                  player.alive &&
                  player.id !== game.viewerId,
                );
                const dischordTargetable = Boolean(
                  dischordMode && player.alive && player.id !== game.viewerId,
                );
                const inciteTargetable = Boolean(
                  inciteMode &&
                  inciteCard &&
                  player.alive &&
                  player.id !== game.viewerId &&
                  player.character?.gender === "ชาย" &&
                  player.id !== inciteFirst,
                );
                const unityTgtable = Boolean(
                  unityMode &&
                  !unityTarget &&
                  player.alive &&
                  player.id !== game.viewerId,
                );
                const unityAllyable = Boolean(
                  unityMode &&
                  unityTarget &&
                  player.alive &&
                  player.id !== game.viewerId &&
                  player.id !== unityTarget &&
                  player.character?.kingdom === "SHU",
                );
                const guardianTargetable = Boolean(
                  guardianMode &&
                  player.alive &&
                  player.id !== game.viewerId &&
                  player.character?.kingdom === "WEI",
                );
                const targetable =
                  attackTarget ||
                  discardTargetable ||
                  stealTargetable ||
                  snakeTargetable ||
                  multiTargetable ||
                  coerceHolderPick ||
                  coerceVictimPick ||
                  miracleTargetable ||
                  marriageTargetable ||
                  raidTargetable ||
                  benevolenceTargetable ||
                  redirectTargetable ||
                  seduceTargetable ||
                  dischordTargetable ||
                  inciteTargetable ||
                  unityTgtable ||
                  unityAllyable ||
                  guardianTargetable;
                const onTarget = attackTarget
                  ? () => {
                      emit("card:play", {
                        cardId: selectedAttackId,
                        targetId: player.id,
                      });
                      cancelSelection();
                    }
                  : guardianTargetable
                    ? () => {
                        emit("skill:guardian", { allyId: player.id });
                        setGuardianMode(false);
                      }
                    : unityTgtable
                      ? () => setUnityTarget(player.id)
                      : unityAllyable
                        ? () => {
                            emit("skill:unity", {
                              targetId: unityTarget,
                              allyId: player.id,
                            });
                            setUnityMode(false);
                            setUnityTarget(undefined);
                          }
                        : inciteTargetable
                          ? () => {
                              if (!inciteFirst) setInciteFirst(player.id);
                              else {
                                emit("skill:incite", {
                                  cardId: inciteCard,
                                  firstAttackerId: inciteFirst,
                                  secondPlayerId: player.id,
                                });
                                setInciteMode(false);
                                setInciteCard(undefined);
                                setInciteFirst(undefined);
                              }
                            }
                          : dischordTargetable
                            ? () => {
                                emit("skill:dischord", { targetId: player.id });
                                setDischordMode(false);
                              }
                            : seduceTargetable
                              ? () => {
                                  emit("skill:seduce", {
                                    cardId: seduceCard,
                                    targetId: player.id,
                                  });
                                  setSeduceMode(false);
                                  setSeduceCard(undefined);
                                }
                              : redirectTargetable
                                ? () => {
                                    emit("redirect:attack", {
                                      cardId: redirectCard,
                                      targetId: player.id,
                                    });
                                    setRedirectMode(false);
                                    setRedirectCard(undefined);
                                  }
                                : benevolenceTargetable
                                  ? () => {
                                      emit("skill:benevolence", {
                                        cardIds: benevolenceCards,
                                        targetId: player.id,
                                      });
                                      setBenevolenceCards([]);
                                    }
                                  : raidTargetable
                                    ? () => {
                                        setRaidTargets((prev) =>
                                          prev.includes(player.id)
                                            ? prev.filter(
                                                (x) => x !== player.id,
                                              )
                                            : prev.length < 2
                                              ? [...prev, player.id]
                                              : prev,
                                        );
                                      }
                                    : miracleTargetable
                                      ? () => {
                                          emit("skill:miracle", {
                                            cardId: miracleCard,
                                            targetId: player.id,
                                          });
                                          setMiracleMode(false);
                                          setMiracleCard(undefined);
                                        }
                                      : marriageTargetable
                                        ? () => {
                                            emit("skill:marriage", {
                                              cardIds: marriageCards,
                                              targetId: player.id,
                                            });
                                            setMarriageMode(false);
                                            setMarriageCards([]);
                                          }
                                        : coerceHolderPick
                                          ? () => {
                                              setCoerceHolderId(player.id);
                                            }
                                          : coerceVictimPick
                                            ? () => {
                                                emit("coerce:play", {
                                                  cardId: coerceCardId,
                                                  weaponHolderId:
                                                    coerceHolderId,
                                                  victimId: player.id,
                                                });
                                                cancelSelection();
                                              }
                                            : multiTargetable
                                              ? () => {
                                                  setMultiTargets((prev) =>
                                                    prev.includes(player.id)
                                                      ? prev.filter(
                                                          (x) =>
                                                            x !== player.id,
                                                        )
                                                      : prev.length < 3
                                                        ? [...prev, player.id]
                                                        : prev,
                                                  );
                                                }
                                              : snakeTargetable
                                                ? () => {
                                                    emit(
                                                      "weapon:snake-attack",
                                                      {
                                                        cardIds: snakeCards,
                                                        targetId: player.id,
                                                      },
                                                    );
                                                    cancelSnake();
                                                  }
                                                : discardTargetable
                                                  ? () => {
                                                      setSelectedDiscardTargetId(
                                                        player.id,
                                                      );
                                                      setSelectedDiscardZone(
                                                        undefined,
                                                      );
                                                    }
                                                  : stealTargetable
                                                    ? () => {
                                                        const dist =
                                                          game.distances?.[
                                                            player.id
                                                          ];
                                                        const ignore = (
                                                          game
                                                            .characterSkillKeys?.[
                                                            game.viewerId
                                                          ] || []
                                                        ).includes(
                                                          "trick_ignore_distance",
                                                        );
                                                        if (
                                                          !ignore &&
                                                          (dist == null ||
                                                            dist > 1)
                                                        ) {
                                                          setError(
                                                            `${charName(player)} อยู่นอกระยะลอบขโมย (ต้องระยะ 1) — เลือกเป้าหมายใหม่`,
                                                          );
                                                          return;
                                                        }
                                                        setSelectedStealTargetId(
                                                          player.id,
                                                        );
                                                        setSelectedStealZone(
                                                          undefined,
                                                        );
                                                      }
                                                    : undefined;
                const dist = game.distances?.[player.id];
                const respCard = rw?.responses?.find(
                  (r) => r.playerId === player.id && r.response === "card",
                )?.card;
                return (
                  <div
                    key={player.id}
                    className={`mock-opponent${multiTargets.includes(player.id) || raidTargets.includes(player.id) || inciteFirst === player.id || unityTarget === player.id ? " local-multi-selected" : ""}`}
                    style={style}
                  >
                    <OpponentPanel
                      player={player}
                      targetable={targetable}
                      distance={dist}
                      onClick={onTarget}
                      onSkills={
                        player.character
                          ? () => setSkillsCharacter(player.character)
                          : undefined
                      }
                      onInspect={setDetailCard}
                    />
                    {respCard && (
                      <div
                        className={`local-seat-play mock-card-suit-${suitColor(respCard.suit)}`}
                      >
                        <span className="mock-card-rank">
                          {respCard.number}
                          {suitTx(respCard.suit)}
                        </span>
                        <b>{respCard.name}</b>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </section>
        )}

        {isPlaying && (
          <section className="mock-current-player">
            <article className="mock-player mock-self">
              <div className="mock-portrait">
                {myPlayer?.character?.image ? (
                  <img
                    src={myPlayer.character.image}
                    alt={charName(myPlayer)}
                  />
                ) : (
                  charName(myPlayer).slice(0, 1)
                )}
              </div>
              <div className="mock-player-content">
                <div className="local-name-row">
                  <b>{charName(myPlayer)}</b>
                  {myPlayer?.character && (
                    <button
                      className="local-skills-btn"
                      onClick={() =>
                        myPlayer.character &&
                        setSkillsCharacter(myPlayer.character)
                      }
                      title="ดูทักษะ"
                    >
                      !
                    </button>
                  )}
                </div>
                <small className="mock-username">@{myPlayer?.username}</small>
                <div className="local-hp-hand">
                  {hearts(myPlayer?.hp, myPlayer?.maxHp)}
                  <span className="mock-hand-count">
                    🂠 × {myPlayer?.hand.length}
                  </span>
                </div>
                <small className="mock-seat-info">
                  ที่นั่ง {myPlayer?.seatIndex}
                </small>
                {myPlayer?.role && (
                  <small
                    className={`mock-role${myPlayer.role === "emperor" || roleVisible ? " local-role-" + myPlayer.role : ""}`}
                  >
                    {myPlayer.role !== "emperor" && (
                      <button
                        className="local-role-toggle"
                        onClick={() => setRoleVisible((v) => !v)}
                        title={roleVisible ? "ซ่อนบทบาท" : "แสดงบทบาท"}
                      >
                        {roleVisible ? "👁" : "🙈"}
                      </button>
                    )}
                    บทบาท:{" "}
                    {myPlayer.role === "emperor" || roleVisible
                      ? (ROLE_LABEL[myPlayer.role] ?? myPlayer.role)
                      : "???"}
                  </small>
                )}
                <EquipmentDisplay
                  eq={
                    myPlayer?.equipment ?? {
                      weapon: null,
                      armor: null,
                      offensiveMount: null,
                      defensiveMount: null,
                    }
                  }
                  onInspect={setDetailCard}
                />
                <DecisionArea
                  cards={myPlayer?.decisionArea ?? []}
                  onInspect={setDetailCard}
                />
              </div>
            </article>
            <div className="mock-your-turn">
              {myOwedDraws > 0 ? (
                <strong>
                  ⬆ คุณได้รับไพ่ {myOwedDraws} ใบ — กดกองจั่วเพื่อรับ
                </strong>
              ) : selectedAttackId || selectedDiscardId || selectedStealId ? (
                <strong>เลือกผู้เล่นเป้าหมายบนโต๊ะ</strong>
              ) : isDrawPhase ? (
                <strong>⬆ กดกองจั่วบนโต๊ะเพื่อจั่วไพ่</strong>
              ) : null}
            </div>
            <div className="local-turn-controls">
              <button
                disabled={
                  !isMyTurn ||
                  Boolean(rw) ||
                  Boolean(pj) ||
                  game.turn?.phase === "draw" ||
                  requiredDiscard > 0 ||
                  myOwedDraws > 0
                }
                onClick={() => emit("turn:end")}
              >
                จบเทิร์น
              </button>
              {requiredDiscard > 0 && isMyTurn && !discardLimitMode && (
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setDiscardLimitMode(true);
                    setDiscardLimitSelected([]);
                  }}
                >
                  ทิ้งไพ่เกินมือ ({requiredDiscard})
                </button>
              )}
              {canSnakeAttack && !snakeMode && !discardLimitMode && (
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    cancelSelection();
                    setSnakeMode(true);
                    setSnakeCards([]);
                  }}
                >
                  ⚔ {myPlayer?.equipment.weapon?.name || "ทวนอสรพิษ"} (ทิ้ง 2
                  ใบ)
                </button>
              )}
              {canAct &&
                hasMySkill("self_damage_draw") &&
                (myPlayer?.hp ?? 0) > 0 && (
                  <button
                    className="local-skill-btn"
                    onClick={() => setConfirmSelfDamage(true)}
                  >
                    ✦ พลีชีพ (จ่าย 1 HP จั่ว 2)
                  </button>
                )}
              {canAct &&
                hasMySkill("discard_then_draw_equal") &&
                !skillUsed("discard_then_draw_equal") &&
                !balanceMode &&
                !discardLimitMode &&
                !snakeMode &&
                !miracleMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setBalanceMode(true);
                      setBalanceCards([]);
                    }}
                  >
                    ✦ ถ่วงดุล (ทิ้ง→จั่ว)
                  </button>
                )}
              {canAct &&
                hasMySkill("miracle_medicine") &&
                !skillUsed("miracle_medicine") &&
                !balanceMode &&
                !discardLimitMode &&
                !snakeMode &&
                !miracleMode &&
                !marriageMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setMiracleMode(true);
                      setMiracleCard(undefined);
                    }}
                  >
                    ✦ ยาสวรรค์ (ทิ้ง 1 → ฟื้น 1 HP)
                  </button>
                )}
              {canAct &&
                hasMySkill("marriage_heal") &&
                !skillUsed("marriage_heal") &&
                !balanceMode &&
                !discardLimitMode &&
                !snakeMode &&
                !miracleMode &&
                !marriageMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setMarriageMode(true);
                      setMarriageCards([]);
                    }}
                  >
                    ✦ แผนแต่งงาน (ทิ้ง 2 → ฟื้น 2)
                  </button>
                )}
              {canAct &&
                hasMySkill("benevolence_give") &&
                !balanceMode &&
                !discardLimitMode &&
                !snakeMode &&
                !miracleMode &&
                !marriageMode &&
                !benevolenceMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setBenevolenceMode(true);
                      setBenevolenceCards([]);
                    }}
                  >
                    ✦ เมตตาธรรม (มอบไพ่ให้พันธมิตร)
                  </button>
                )}
              {canAct &&
                hasMySkill("black_as_dismantle") &&
                !bandinMode &&
                !balanceMode &&
                !discardLimitMode &&
                !snakeMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setBandinMode(true);
                    }}
                  >
                    ✦ บ้าบิ่น (♠/♣ เป็น ถอนสะพาน)
                  </button>
                )}
              {canAct &&
                hasMySkill("diamond_as_indulgence") &&
                !seduceMode &&
                !balanceMode &&
                !discardLimitMode &&
                !snakeMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setSeduceMode(true);
                      setSeduceCard(undefined);
                    }}
                  >
                    ✦ โปรยเสน่ห์ (♦ เป็น มีสุขลืมเมือง)
                  </button>
                )}
              {canAct &&
                hasMySkill("dischord") &&
                !skillUsed("dischord") &&
                (myPlayer?.hand.length ?? 0) > 0 &&
                !dischordMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setDischordMode(true);
                    }}
                  >
                    ✦ บาดหมาง (เลือกเป้าให้ทายดอก)
                  </button>
                )}
              {canAct &&
                hasMySkill("incite_duel") &&
                !skillUsed("incite") &&
                (myPlayer?.hand.length ?? 0) > 0 &&
                !inciteMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setInciteMode(true);
                      setInciteCard(undefined);
                      setInciteFirst(undefined);
                    }}
                  >
                    ✦ สาวงามยุยง (ให้ 2 ชายท้าสู้กัน)
                  </button>
                )}
              {canAct &&
                hasMySkill("ask_shu_attack") &&
                myPlayer?.role === "emperor" &&
                !unityMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setUnityMode(true);
                      setUnityTarget(undefined);
                    }}
                  >
                    ✦ คุณธรรมสามัคคี (ให้จ๊กก๊กโจมตีแทน)
                  </button>
                )}
              {isDrawPhase &&
                hasMySkill("raid_draw_phase") &&
                (game.turn?.drawnThisTurn ?? 0) === 0 &&
                !raidMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setRaidMode(true);
                      setRaidTargets([]);
                    }}
                  >
                    ✦ จู่โจมฉับพลัน (แทนการจั่ว)
                  </button>
                )}
              {isDrawPhase &&
                hasMySkill("unarmed_tiger") &&
                (game.turn?.drawnThisTurn ?? 0) === 0 && (
                  <button
                    className="local-skill-btn"
                    onClick={() => emit("skill:hunt")}
                  >
                    ✦ ฆ่าเสือมือเปล่า (จั่ว 1 → +1 ดาเมจ)
                  </button>
                )}
              {isDrawPhase &&
                hasMySkill("fortune_judgment") &&
                (game.turn?.drawnThisTurn ?? 0) === 0 &&
                !skillUsed("fortune_done") && (
                  <button
                    className="local-skill-btn"
                    onClick={() => emit("skill:fortune")}
                  >
                    ✦ พึ่งวาสนา (เปิดดวง เก็บดอกดำ)
                  </button>
                )}
              {isDrawPhase &&
                hasMySkill("emperor_arrogance") &&
                myPlayer?.role === "emperor" &&
                (game.turn?.drawnThisTurn ?? 0) === 0 &&
                !skillUsed("arrogance") && (
                  <button
                    className="local-skill-btn"
                    onClick={() => emit("skill:arrogance")}
                  >
                    ✦ จองหอง (จั่ว +1, มือ -1)
                  </button>
                )}
              {isDrawPhase &&
                hasMySkill("peek_reorder_deck") &&
                (game.turn?.drawnThisTurn ?? 0) === 0 &&
                !skillUsed("peek") &&
                !game.pendingPeek && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      setPeekOrder([]);
                      emit("skill:peek");
                    }}
                  >
                    ✦ หยั่งรู้ฟ้าดิน (ดู/จัดกองจั่ว)
                  </button>
                )}
            </div>
            {(selectedAttackId || selectedDiscardId || selectedStealId) && (
              <button className="local-cancel" onClick={cancelSelection}>
                ยกเลิกเลือกเป้าหมาย
              </button>
            )}
            {discardLimitMode && (
              <div className="local-discard-limit-bar">
                <span>
                  เลือก <b>{discardLimitSelected.length}</b> ใบ (ต้องทิ้งอีก{" "}
                  {requiredDiscard} ใบ)
                </span>
                <button
                  disabled={discardLimitSelected.length === 0}
                  onClick={() => setDiscardLimitConfirming(true)}
                >
                  ทิ้งที่เลือก
                </button>
                <button
                  className="mock-muted-button"
                  onClick={cancelDiscardLimit}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {snakeMode && (
              <div className="local-discard-limit-bar">
                <span>
                  เลือกไพ่ <b>{snakeCards.length}</b>/2 ใบ{" "}
                  {snakeCards.length === 2
                    ? "→ เลือกเป้าหมายบนโต๊ะ"
                    : "เพื่อใช้เป็นการโจมตี"}
                </span>
                <button className="mock-muted-button" onClick={cancelSnake}>
                  ยกเลิก
                </button>
              </div>
            )}
            {multiAttackId && (
              <div className="local-discard-limit-bar">
                <span>
                  โจมตีหลายเป้า: เลือก <b>{multiTargets.length}</b>/3 คนบนโต๊ะ
                </span>
                <button
                  disabled={multiTargets.length < 1}
                  onClick={() => {
                    emit("attack:multi", {
                      cardId: multiAttackId,
                      targetIds: multiTargets,
                    });
                    cancelSelection();
                  }}
                >
                  โจมตี ({multiTargets.length})
                </button>
                <button className="mock-muted-button" onClick={cancelSelection}>
                  ยกเลิก
                </button>
              </div>
            )}
            {coerceCardId && (
              <div className="local-discard-limit-bar">
                <span>
                  ยืมมือสังหาร:{" "}
                  {!coerceHolderId
                    ? "เลือกขุนพลที่มีอาวุธ"
                    : `เลือกเหยื่อให้ ${charName(game.players.find((p) => p.id === coerceHolderId))}`}
                </span>
                <button className="mock-muted-button" onClick={cancelSelection}>
                  ยกเลิก
                </button>
              </div>
            )}
            {balanceMode && (
              <div className="local-discard-limit-bar">
                <span>
                  ถ่วงดุล: เลือกไพ่ทิ้ง <b>{balanceCards.length}</b> ใบ
                  (จะได้จั่ว {balanceCards.length} ใบ)
                </span>
                <button
                  disabled={balanceCards.length === 0}
                  onClick={() => {
                    emit("skill:balance", { cardIds: balanceCards });
                    setBalanceMode(false);
                    setBalanceCards([]);
                  }}
                >
                  ทิ้งแล้วจั่ว
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setBalanceMode(false);
                    setBalanceCards([]);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {miracleMode && (
              <div className="local-discard-limit-bar">
                <span>
                  ยาสวรรค์:{" "}
                  {!miracleCard
                    ? "เลือกไพ่บนมือ 1 ใบเพื่อทิ้ง"
                    : "เลือกเป้าหมายที่บาดเจ็บบนโต๊ะ"}
                </span>
                {miracleCard &&
                  (myPlayer?.hp ?? 0) < (myPlayer?.maxHp ?? 0) && (
                    <button
                      onClick={() => {
                        emit("skill:miracle", {
                          cardId: miracleCard,
                          targetId: game.viewerId,
                        });
                        setMiracleMode(false);
                        setMiracleCard(undefined);
                      }}
                    >
                      ฟื้นฟูตัวเอง
                    </button>
                  )}
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setMiracleMode(false);
                    setMiracleCard(undefined);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {marriageMode && (
              <div className="local-discard-limit-bar">
                <span>
                  แผนแต่งงาน: เลือกไพ่ทิ้ง <b>{marriageCards.length}</b>/2 ใบ
                  {marriageCards.length === 2
                    ? " → เลือกขุนพลชายที่บาดเจ็บบนโต๊ะ"
                    : ""}
                </span>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setMarriageMode(false);
                    setMarriageCards([]);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {raidMode && (
              <div className="local-discard-limit-bar">
                <span>
                  จู่โจมฉับพลัน: เลือกขุนพลอื่น <b>{raidTargets.length}</b>/2
                  คนบนโต๊ะ (แทนการจั่ว)
                </span>
                <button
                  disabled={raidTargets.length < 1}
                  onClick={() => {
                    emit("skill:raid", { targetIds: raidTargets });
                    setRaidMode(false);
                    setRaidTargets([]);
                  }}
                >
                  หยิบไพ่ ({raidTargets.length})
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setRaidMode(false);
                    setRaidTargets([]);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {benevolenceMode && (
              <div className="local-discard-limit-bar">
                <span>
                  เมตตาธรรม: เลือกไพ่ <b>{benevolenceCards.length}</b> ใบ
                  {benevolenceCards.length > 0
                    ? " → เลือกผู้รับบนโต๊ะ"
                    : " (มอบ 2+ ใบในรอบ = ฟื้น 1 HP)"}
                </span>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setBenevolenceMode(false);
                    setBenevolenceCards([]);
                  }}
                >
                  เสร็จสิ้น
                </button>
              </div>
            )}
            {bandinMode && (
              <div className="local-discard-limit-bar">
                <span>บ้าบิ่น: เลือกไพ่ ♠/♣ 1 ใบ เพื่อใช้เป็น "ถอนสะพาน"</span>
                <button
                  className="mock-muted-button"
                  onClick={() => setBandinMode(false)}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {seduceMode && (
              <div className="local-discard-limit-bar">
                <span>
                  โปรยเสน่ห์:{" "}
                  {!seduceCard
                    ? "เลือกไพ่ ♦ 1 ใบ"
                    : "เลือกเป้าหมายบนโต๊ะ (ใช้เป็น มีสุขลืมเมือง)"}
                </span>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setSeduceMode(false);
                    setSeduceCard(undefined);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {dischordMode && (
              <div className="local-discard-limit-bar">
                <span>บาดหมาง: เลือกขุนพลบนโต๊ะ 1 คน</span>
                <button
                  className="mock-muted-button"
                  onClick={() => setDischordMode(false)}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {inciteMode && (
              <div className="local-discard-limit-bar">
                <span>
                  สาวงามยุยง:{" "}
                  {!inciteCard
                    ? "เลือกไพ่ทิ้ง 1 ใบ"
                    : !inciteFirst
                      ? "เลือกขุนพลชายที่โจมตีก่อน"
                      : "เลือกขุนพลชายคู่ต่อสู้"}
                </span>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setInciteMode(false);
                    setInciteCard(undefined);
                    setInciteFirst(undefined);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {unityMode && (
              <div className="local-discard-limit-bar">
                <span>
                  คุณธรรมสามัคคี:{" "}
                  {!unityTarget
                    ? "เลือกเป้าหมายโจมตี (ในระยะของคุณ)"
                    : "เลือกพันธมิตรจ๊กก๊กให้โจมตีแทน"}
                </span>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setUnityMode(false);
                    setUnityTarget(undefined);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            <div className="mock-hand" ref={handRef}>
              {myPlayer?.hand.map((card) => {
                const info = cardInfo(card);
                const isDiscardSelected = discardLimitSelected.includes(
                  card.id,
                );
                const isSnakeSelected = snakeCards.includes(card.id);
                const isBalanceSelected = balanceCards.includes(card.id);
                const isMiracleSelected =
                  miracleMode && miracleCard === card.id;
                const isMarriageSelected = marriageCards.includes(card.id);
                const isBenevolenceSelected = benevolenceCards.includes(
                  card.id,
                );
                const isSeduceSelected = seduceCard === card.id;
                const isInciteSelected = inciteCard === card.id;
                const pickMode =
                  discardLimitMode ||
                  snakeMode ||
                  balanceMode ||
                  miracleMode ||
                  marriageMode ||
                  benevolenceMode ||
                  bandinMode ||
                  seduceMode ||
                  inciteMode;
                const handleClick = discardLimitMode
                  ? () => toggleDiscardLimit(card.id)
                  : snakeMode
                    ? () => toggleSnake(card.id)
                    : balanceMode
                      ? () => toggleBalance(card.id)
                      : miracleMode
                        ? () => setMiracleCard(card.id)
                        : marriageMode
                          ? () =>
                              setMarriageCards((prev) =>
                                prev.includes(card.id)
                                  ? prev.filter((x) => x !== card.id)
                                  : prev.length < 2
                                    ? [...prev, card.id]
                                    : prev,
                              )
                          : benevolenceMode
                            ? () =>
                                setBenevolenceCards((prev) =>
                                  prev.includes(card.id)
                                    ? prev.filter((x) => x !== card.id)
                                    : [...prev, card.id],
                                )
                            : bandinMode
                              ? () => {
                                  if (card.suit === "♠" || card.suit === "♣") {
                                    setSelectedDiscardId(card.id);
                                    setBandinMode(false);
                                  }
                                }
                              : seduceMode
                                ? () => {
                                    if (card.suit === "♦")
                                      setSeduceCard(card.id);
                                  }
                                : inciteMode
                                  ? () => setInciteCard(card.id)
                                  : () => selectCard(card);
                const playable = canPlayCard(card);
                return (
                  <article
                    key={card.id}
                    tabIndex={0}
                    onClick={handleClick}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClick();
                      }
                    }}
                    className={`mock-card mock-card-suit-${suitColor(card.suit)} ${pickMode ? "local-hand-card" : playable ? "local-hand-card" : "local-card-disabled"} ${!pickMode && (selectedAttackId === card.id || selectedDiscardId === card.id || selectedStealId === card.id) ? "selected-card" : ""} ${(discardLimitMode && !isDiscardSelected) || (snakeMode && !isSnakeSelected) || (balanceMode && !isBalanceSelected) || (miracleMode && !isMiracleSelected) || (marriageMode && !isMarriageSelected) || (benevolenceMode && !isBenevolenceSelected) || (seduceMode && !isSeduceSelected) || (inciteMode && !isInciteSelected) ? "local-discard-unselected" : ""} ${isDiscardSelected || isSnakeSelected || isBalanceSelected || isMiracleSelected || isMarriageSelected || isBenevolenceSelected || isSeduceSelected || isInciteSelected ? "local-discard-selected" : ""}`}
                  >
                    <header>
                      <span className="mock-card-rank">
                        {card.number}
                        {suitTx(card.suit)}
                      </span>
                    </header>
                    <button
                      className="local-card-info"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailCard(card);
                      }}
                      title="ดูรายละเอียดการ์ด"
                    >
                      ℹ
                    </button>
                    {card.image ? (
                      <img
                        className="mock-card-art"
                        src={card.image}
                        alt={card.name}
                      />
                    ) : (
                      <div className="mock-card-art">WTK</div>
                    )}
                    <b className="mock-card-name">{card.name}</b>
                    <small>{cardTypeLabel(card)}</small>
                    {(isDiscardSelected ||
                      isSnakeSelected ||
                      isBalanceSelected ||
                      isMiracleSelected ||
                      isMarriageSelected) && (
                      <span className="local-discard-badge">ทิ้ง</span>
                    )}
                    {isBenevolenceSelected && (
                      <span className="local-discard-badge">มอบ</span>
                    )}
                    {isSeduceSelected && (
                      <span className="local-discard-badge">เสน่ห์</span>
                    )}
                    {!pickMode && info && (
                      <div className="card-tip" role="tooltip">
                        <b className="card-tip-name">{card.name}</b>
                        <span className="card-tip-type">
                          {cardTypeLabel(card)} · {card.number}
                          {suitTx(card.suit)}
                        </span>
                        <p className="card-tip-desc">{info.desc}</p>
                        {info.use && (
                          <p className="card-tip-use">
                            <i>เมื่อไหร่:</i> {info.use}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {isPlaying &&
          rw &&
          rw.type !== "coerce_attack" &&
          rw.type !== "harvest_pick" && (
            <section className="mock-response" role="dialog">
              <span className="mock-response-icon">
                {rw.type === "negate"
                  ? "🛡"
                  : rw.type === "dying_heal"
                    ? "✚"
                    : "⚔"}
              </span>
              {countdownBadge}
              {rw.type === "negate" ? (
                <>
                  {canRespond ? (
                    <>
                      <div>
                        <h2>ใช้คงกระพันชาตรีหรือไม่?</h2>
                      </div>
                      <div className="mock-response-actions">
                        <button
                          disabled={
                            !myPlayer?.hand.some(
                              (c) => c.effect === "negate_trick_effect",
                            )
                          }
                          onClick={() => {
                            const c = myPlayer?.hand.find(
                              (c) => c.effect === "negate_trick_effect",
                            );
                            if (c) emit("negate:play", { cardId: c.id });
                          }}
                        >
                          🛡 ใช้คงกระพันชาตรี
                        </button>
                        <button
                          className="mock-muted-button"
                          onClick={() => emit("negate:decline")}
                        >
                          ไม่ใช้
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <h2>กำลังรอ {responder?.username ?? "ผู้เล่น"}</h2>
                        <p>ว่าจะยกเลิกไพ่อุบายหรือไม่</p>
                      </div>
                    </>
                  )}
                </>
              ) : rw.type === "dying_heal" ? (
                <>
                  {canRespond ? (
                    <>
                      <div>
                        <small>
                          {charName(dyingPlayer)} อยู่ในสถานะใกล้ตาย
                        </small>
                        <h2>ใช้ เสบียง ช่วยหรือไม่?</h2>
                      </div>
                      <div className="mock-response-actions">
                        <button
                          disabled={
                            !myPlayer?.hand.some((c) => myConv("heal", c))
                          }
                          onClick={() => {
                            const c = myPlayer?.hand.find((c) =>
                              myConv("heal", c),
                            );
                            if (c) emit("response:heal", { cardId: c.id });
                          }}
                        >
                          ✚ ใช้ เสบียง
                        </button>
                        <button
                          className="mock-muted-button"
                          onClick={() => emit("response:decline")}
                        >
                          ไม่ทำอะไร
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <h2>กำลังรอ {responder?.username ?? "ผู้เล่น"}</h2>
                        <p>ว่าจะช่วย {charName(dyingPlayer)} หรือไม่</p>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  {canRespond ? (
                    <>
                      <div>
                        <h2>
                          {rw.type === "mass_dodge" ||
                          rw.type === "multi_attack"
                            ? "ต้องใช้ หลบ"
                            : rw.type === "mass_attack"
                              ? "ต้องใช้ โจมตี"
                              : rw.type === "duel_attack"
                                ? "ท้าสู้ — ตอบโต้ด้วย โจมตี"
                                : (game.pendingAction?.dodgesRequired ?? 1) > 1
                                  ? `ถูกโจมตี — ต้องใช้ หลบ อีก ${Math.max(1, (game.pendingAction?.dodgesRequired ?? 1) - (rw.responses?.filter((r) => r.playerId === game.viewerId && r.response === "card").length ?? 0))} ใบ`
                                  : "ถูกโจมตี — ตอบสนอง"}
                        </h2>
                      </div>
                      <div className="mock-response-actions">
                        {rw.type === "attack_dodge" ? (
                          <>
                            {!game.pendingAction?.noDodge && (
                              <button
                                disabled={
                                  !myPlayer?.hand.some((c) =>
                                    myConv("dodge", c),
                                  )
                                }
                                onClick={() => {
                                  const c =
                                    myPlayer?.hand.find(
                                      (c) => c.effect === "dodge",
                                    ) ||
                                    myPlayer?.hand.find((c) =>
                                      myConv("dodge", c),
                                    );
                                  if (c)
                                    emit("attack:respond", { cardId: c.id });
                                }}
                              >
                                🛡 ใช้ หลบ
                              </button>
                            )}
                            <button
                              className="mock-muted-button"
                              onClick={() => emit("attack:respond")}
                            >
                              {game.pendingAction?.noDodge
                                ? "รับความเสียหาย (หลบไม่ได้ — ม้าคะนองศึก)"
                                : "รับความเสียหาย"}
                            </button>
                            {myKeys.includes("redirect_attack") &&
                              (myPlayer?.hand.length ?? 0) > 0 &&
                              !redirectMode && (
                                <button
                                  className="local-skill-btn"
                                  onClick={() => {
                                    setRedirectMode(true);
                                    setRedirectCard(undefined);
                                  }}
                                >
                                  ↪ ระเหเร่ร่อน (เปลี่ยนเป้า)
                                </button>
                              )}
                            {myKeys.includes("ask_wei_dodge") &&
                              myPlayer?.role === "emperor" &&
                              !game.pendingAction?.noDodge &&
                              !guardianMode && (
                                <button
                                  className="local-skill-btn"
                                  onClick={() => setGuardianMode(true)}
                                >
                                  🛡 ปกป้องราชันย์ (ให้วุยก๊กหลบแทน)
                                </button>
                              )}
                            {guardianMode && (
                              <span className="local-force-cards">
                                เลือกพันธมิตรวุยก๊กบนโต๊ะ{" "}
                                <button
                                  className="mock-muted-button"
                                  onClick={() => setGuardianMode(false)}
                                >
                                  ยกเลิก
                                </button>
                              </span>
                            )}
                            {redirectMode && (
                              <div className="local-force-cards">
                                {!redirectCard ? (
                                  <>
                                    {myPlayer?.hand.map((c) => (
                                      <button
                                        key={c.id}
                                        onClick={() => setRedirectCard(c.id)}
                                      >
                                        ทิ้ง {c.name} ({c.number}
                                        {suitTx(c.suit)})
                                      </button>
                                    ))}
                                  </>
                                ) : (
                                  <span>
                                    เลือกเป้าหมายใหม่บนโต๊ะ (ในระยะของคุณ
                                    ไม่ใช่ผู้โจมตี)
                                  </span>
                                )}
                                <button
                                  className="mock-muted-button"
                                  onClick={() => {
                                    setRedirectMode(false);
                                    setRedirectCard(undefined);
                                  }}
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            )}
                          </>
                        ) : rw.type === "mass_dodge" ||
                          rw.type === "multi_attack" ? (
                          <>
                            <button
                              disabled={
                                !myPlayer?.hand.some((c) => myConv("dodge", c))
                              }
                              onClick={() => {
                                const c =
                                  myPlayer?.hand.find(
                                    (c) => c.effect === "dodge",
                                  ) ||
                                  myPlayer?.hand.find((c) =>
                                    myConv("dodge", c),
                                  );
                                if (c) emit("mass:respond", { cardId: c.id });
                              }}
                            >
                              🛡 ใช้ หลบ
                            </button>
                            <button
                              className="mock-muted-button"
                              onClick={() => emit("mass:decline")}
                            >
                              รับความเสียหาย
                            </button>
                          </>
                        ) : rw.type === "duel_attack" ? (
                          <>
                            <button
                              disabled={
                                !myPlayer?.hand.some((c) => myConv("attack", c))
                              }
                              onClick={() => {
                                const c =
                                  myPlayer?.hand.find(
                                    (c) => c.effect === "attack",
                                  ) ||
                                  myPlayer?.hand.find((c) =>
                                    myConv("attack", c),
                                  );
                                if (c) emit("duel:respond", { cardId: c.id });
                              }}
                            >
                              ⚔ ตอบโต้ด้วย โจมตี
                            </button>
                            <button
                              className="mock-muted-button"
                              onClick={() => emit("response:decline")}
                            >
                              ยอมแพ้ (เสีย 1 HP)
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              disabled={
                                !myPlayer?.hand.some((c) => myConv("attack", c))
                              }
                              onClick={() => {
                                const c =
                                  myPlayer?.hand.find(
                                    (c) => c.effect === "attack",
                                  ) ||
                                  myPlayer?.hand.find((c) =>
                                    myConv("attack", c),
                                  );
                                if (c) emit("mass:respond", { cardId: c.id });
                              }}
                            >
                              ⚔ ใช้ โจมตี
                            </button>
                            <button
                              className="mock-muted-button"
                              onClick={() => emit("mass:decline")}
                            >
                              ไม่ใช้ (เสีย 1 HP)
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <h2>
                          กำลังรอ {responder?.username ?? "ผู้เล่น"} ตอบสนอง
                        </h2>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          )}

        {isPlaying &&
          game.pendingCoerce &&
          (() => {
            const pc = game.pendingCoerce!;
            const holder = game.players.find((p) => p.id === pc.weaponHolderId);
            const victim = game.players.find((p) => p.id === pc.victimId);
            const actor = game.players.find((p) => p.id === pc.actorId);
            const isHolder = pc.weaponHolderId === game.viewerId;
            const atk = myPlayer?.hand.find((c) => c.effect === "attack");
            return (
              <section className="mock-response" role="dialog">
                <span className="mock-response-icon">🗡</span>
                {countdownBadge}
                {isHolder ? (
                  <>
                    <div>
                      <small>
                        {charName(actor)} ใช้ {pc.trickName}
                      </small>
                      <h2>ถูกบังคับให้โจมตี {charName(victim)}</h2>
                    </div>
                    <div className="mock-response-actions">
                      <button
                        disabled={!atk}
                        onClick={() =>
                          atk && emit("coerce:attack", { cardId: atk.id })
                        }
                      >
                        {atk ? `⚔ โจมตี ${charName(victim)}` : "ไม่มีไพ่โจมตี"}
                      </button>
                      <button
                        className="mock-muted-button"
                        onClick={() => emit("coerce:decline")}
                      >
                        ไม่โจมตี (ให้ {charName(actor)} ยึดอาวุธ)
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h2>กำลังรอ {holder?.username ?? "ผู้เล่น"} ตัดสินใจ</h2>
                      <p>
                        ยืมมือสังหาร: โจมตี {charName(victim)} หรือเสียอาวุธ
                      </p>
                    </div>
                  </>
                )}
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingHarvest &&
          rw?.type === "harvest_pick" &&
          (() => {
            const picker = game.players.find(
              (p) => p.id === rw.currentResponderId,
            );
            const isPicker = rw.currentResponderId === game.viewerId;
            return (
              <section className="mock-response local-harvest" role="dialog">
                <span className="mock-response-icon">🌾</span>
                {countdownBadge}
                <div>
                  <h2>
                    {isPicker
                      ? "เลือกไพ่ 1 ใบจากยุ้งฉาง"
                      : `กำลังรอ ${picker?.username ?? "ผู้เล่น"} เลือกไพ่`}
                  </h2>
                </div>
                <div className="local-harvest-pool">
                  {game.pendingHarvest!.revealed.map((c, i) => {
                    const hidden = c.effect === "hidden_harvest";
                    const hinfo = hidden ? null : cardInfo(c);
                    return (
                      <button
                        key={c.id || i}
                        disabled={!isPicker || hidden}
                        className={`mock-card ${hidden ? "local-harvest-hidden" : `mock-card-suit-${suitColor(c.suit)}`}`}
                        onClick={() =>
                          isPicker &&
                          !hidden &&
                          emit("harvest:pick", { cardId: c.id })
                        }
                      >
                        {hidden ? null : (
                          <>
                            <header>
                              <span className="mock-card-rank">
                                {c.number}
                                {suitTx(c.suit)}
                              </span>
                            </header>
                            {c.image ? (
                              <img
                                className="mock-card-art"
                                src={c.image}
                                alt={c.name}
                              />
                            ) : (
                              <div className="mock-card-art">WTK</div>
                            )}
                            <b className="mock-card-name">{c.name}</b>
                            <small>{cardTypeLabel(c)}</small>
                          </>
                        )}
                        {hinfo && (
                          <div className="card-tip" role="tooltip">
                            <b className="card-tip-name">{c.name}</b>
                            <span className="card-tip-type">
                              {cardTypeLabel(c)} · {c.number}
                              {suitTx(c.suit)}
                            </span>
                            <p className="card-tip-desc">{hinfo.desc}</p>
                            {hinfo.use && (
                              <p className="card-tip-use">
                                <i>เมื่อไหร่:</i> {hinfo.use}
                              </p>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          pj &&
          (() => {
            const jp = game.players.find((p) => p.id === pj.playerId);
            const r = pj.revealed;
            return (
              <section
                className="mock-response local-judgment-panel"
                role="dialog"
              >
                <span className="mock-response-icon">⚖</span>
                {countdownBadge}
                {pj.stage === "awaiting_draw" ? (
                  <div>
                    <h2>การตัดสิน: {pj.trickName}</h2>
                    {myJudgmentDraw ? (
                      <p>⬆ กดกองจั่ว (หรือปุ่มด้านล่าง) เพื่อเปิดไพ่ตัดสิน</p>
                    ) : (
                      <p>กำลังรอ {jp?.username ?? "ผู้เล่น"} เปิดไพ่ตัดสิน…</p>
                    )}
                    {myJudgmentDraw && (
                      <div className="mock-response-actions">
                        <button onClick={() => emit("judgment:draw")}>
                          ⚖ เปิดไพ่ตัดสิน
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="local-judgment-reveal">
                      <small>
                        ไพ่ตัดสินของ {charName(jp)} — {pj.trickName}
                      </small>
                      {r ? (
                        <div
                          className={`local-judgment-card local-suit-${suitColor(r.suit)}`}
                        >
                          <span>
                            {r.number} {suitTx(r.suit)}
                          </span>
                          <b>{r.name}</b>
                        </div>
                      ) : (
                        <p>ไม่มีไพ่ตัดสิน</p>
                      )}
                    </div>
                    {myJudgmentAct ? (
                      <div className="mock-response-actions">
                        {myKeys.includes("keep_judgment") && (
                          <button onClick={() => emit("judgment:keep")}>
                            🔮 เก็บไพ่ตัดสิน (คาดการณ์แม่นยำ)
                          </button>
                        )}
                        <button
                          className="mock-muted-button"
                          onClick={() => emit("judgment:resolve")}
                        >
                          {myKeys.includes("keep_judgment")
                            ? "ดำเนินการต่อ (เก็บไพ่เข้ามือ)"
                            : "ดำเนินการต่อ (ทิ้ง)"}
                        </button>
                      </div>
                    ) : (
                      <p>กำลังรอ {jp?.username ?? "ผู้เล่น"} ตัดสินใจ…</p>
                    )}
                    {myGuicai &&
                      (myPlayer?.hand.length ?? 0) > 0 &&
                      (guicaiPicking ? (
                        <div className="local-force-cards">
                          {myPlayer?.hand.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                emit("judgment:replace", { cardId: c.id });
                                setGuicaiPicking(false);
                              }}
                            >
                              {c.name} ({c.number}
                              {suitTx(c.suit)})
                            </button>
                          ))}
                          <button
                            className="mock-muted-button"
                            onClick={() => setGuicaiPicking(false)}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          className="local-skill-btn"
                          onClick={() => setGuicaiPicking(true)}
                        >
                          🃏 กำหนดชะตา (เปลี่ยนไพ่ตัดสิน)
                        </button>
                      ))}
                  </>
                )}
                {pj.playerId === game.viewerId &&
                  pj.stage === "awaiting_draw" &&
                  hasMySkill("fortune_judgment") &&
                  !skillUsed("fortune_done") && (
                    <button
                      className="local-skill-btn"
                      onClick={() => emit("skill:fortune")}
                    >
                      ✦ พึ่งวาสนา (ใช้ก่อนตัดสิน — เปิดดวง เก็บดอกดำ)
                    </button>
                  )}
                {pj.playerId === game.viewerId &&
                  pj.stage === "awaiting_draw" &&
                  pj.trickEffect === "delayed_lightning_judgment" &&
                  myPlayer?.hand.some(
                    (c) => c.effect === "negate_trick_effect",
                  ) && (
                    <button
                      className="local-skill-btn"
                      onClick={() => {
                        const neg = myPlayer?.hand.find(
                          (c) => c.effect === "negate_trick_effect",
                        );
                        if (neg) emit("lightning:negate", { cardId: neg.id });
                      }}
                    >
                      🛡 คงกระพันชาตรี (ยกเลิกฟ้าลงโทษ)
                    </button>
                  )}
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingRepeatAttack &&
          game.pendingRepeatAttack.attackerId === game.viewerId &&
          (() => {
            const attack = myPlayer?.hand.find((c) => c.effect === "attack");
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  เป้าหมายหลบสำเร็จ ต้องการโจมตีซ้ำด้วย{" "}
                  {game.pendingRepeatAttack!.weaponName} หรือไม่?
                </b>
                {countdownBadge}
                <div>
                  <button
                    disabled={!attack}
                    onClick={() =>
                      attack && emit("attack:repeat", { cardId: attack.id })
                    }
                  >
                    {attack ? "โจมตีซ้ำ" : "ไม่มีไพ่โจมตี"}
                  </button>
                  <button
                    className="mock-muted-button"
                    onClick={() => emit("attack:repeat-decline")}
                  >
                    ไม่โจมตีซ้ำ
                  </button>
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingDestroyMount &&
          game.pendingDestroyMount.attackerId === game.viewerId &&
          (() => {
            const target = game.players.find(
              (p) => p.id === game.pendingDestroyMount!.targetId,
            );
            return (
              target && (
                <section className="local-repeat-attack" role="dialog">
                  <b>โจมตีสำเร็จ ต้องการทำลายพาหนะของเป้าหมายหรือไม่?</b>
                  {countdownBadge}
                  <div>
                    {target.equipment.offensiveMount && (
                      <button
                        onClick={() =>
                          emit("mount:destroy", {
                            targetId: target.id,
                            slot: "offensiveMount",
                          })
                        }
                      >
                        ทำลาย {target.equipment.offensiveMount.name}
                      </button>
                    )}
                    {target.equipment.defensiveMount && (
                      <button
                        onClick={() =>
                          emit("mount:destroy", {
                            targetId: target.id,
                            slot: "defensiveMount",
                          })
                        }
                      >
                        ทำลาย {target.equipment.defensiveMount.name}
                      </button>
                    )}
                  </div>
                  <button
                    className="mock-muted-button"
                    onClick={() => emit("mount:destroy-decline")}
                  >
                    ไม่ทำลาย
                  </button>
                </section>
              )
            );
          })()}
        {isPlaying &&
          game.pendingForceAttackDamage &&
          game.pendingForceAttackDamage.attackerId === game.viewerId &&
          (() => {
            const choices = [
              ...(myPlayer?.hand || []),
              ...Object.values(myPlayer?.equipment || {}).filter(
                (c): c is Card => Boolean(c),
              ),
            ];
            const toggle = (id: string) =>
              setForceDiscardRefs((cur) =>
                cur.includes(id)
                  ? cur.filter((r) => r !== id)
                  : cur.length < 2
                    ? [...cur, id]
                    : cur,
              );
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>ต้องการทิ้งไพ่ 2 ใบเพื่อบังคับให้โจมตีโดนหรือไม่?</b>
                {countdownBadge}
                <div className="local-force-cards">
                  {choices.map((c) => (
                    <button
                      key={c.id}
                      className={
                        forceDiscardRefs.includes(c.id) ? "selected-card" : ""
                      }
                      onClick={() => toggle(c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <div>
                  <button
                    disabled={forceDiscardRefs.length !== 2}
                    onClick={() => {
                      emit("attack:force", { cardIds: forceDiscardRefs });
                      setForceDiscardRefs([]);
                    }}
                  >
                    ยืนยัน ({forceDiscardRefs.length}/2)
                  </button>
                  <button
                    className="mock-muted-button"
                    onClick={() => {
                      emit("attack:force-decline");
                      setForceDiscardRefs([]);
                    }}
                  >
                    ยกเลิก
                  </button>
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingReplaceDamage &&
          game.pendingReplaceDamage.attackerId === game.viewerId &&
          (() => {
            const target = game.players.find(
              (p) => p.id === game.pendingReplaceDamage!.targetId,
            );
            if (!target) return null;
            const has = (s: IceSelection) =>
              iceSelections.some(
                (x) =>
                  x.zone === s.zone &&
                  (x.zone === "hand"
                    ? x.handIndex === (s as { handIndex: number }).handIndex
                    : x.cardInstanceId ===
                      (s as { cardInstanceId: string }).cardInstanceId),
              );
            const toggle = (s: IceSelection) =>
              setIceSelections((cur) =>
                has(s)
                  ? cur.filter(
                      (x) =>
                        !(
                          x.zone === s.zone &&
                          (x.zone === "hand"
                            ? x.handIndex ===
                              (s as { handIndex: number }).handIndex
                            : x.cardInstanceId ===
                              (s as { cardInstanceId: string }).cardInstanceId)
                        ),
                    )
                  : cur.length < 2
                    ? [...cur, s]
                    : cur,
              );
            const equipEntries = (
              [
                { key: "weapon", label: "อาวุธ" },
                { key: "armor", label: "เกราะ" },
                { key: "offensiveMount", label: "ม้ารุก" },
                { key: "defensiveMount", label: "ม้ารับ" },
              ] as const
            )
              .map(({ key, label }) => ({ card: target.equipment[key], label }))
              .filter((e) => e.card);
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  {game.pendingReplaceDamage!.weaponName}: ทิ้งไพ่ของ{" "}
                  {charName(target)} 1–2 ใบ แทนที่จะสร้างความเสียหายหรือไม่?
                </b>
                {countdownBadge}
                <div className="local-force-cards">
                  {Array.from({ length: target.handCount }, (_, i) => {
                    const s: IceSelection = { zone: "hand", handIndex: i };
                    return (
                      <button
                        key={`h${i}`}
                        className={has(s) ? "selected-card" : ""}
                        onClick={() => toggle(s)}
                      >
                        🂠 {i + 1}
                      </button>
                    );
                  })}
                  {equipEntries.map(({ card, label }) => {
                    const s: IceSelection = {
                      zone: "equipment",
                      cardInstanceId: card!.id,
                    };
                    return (
                      <button
                        key={card!.id}
                        className={has(s) ? "selected-card" : ""}
                        onClick={() => toggle(s)}
                      >
                        {label}: {card!.name}
                      </button>
                    );
                  })}
                </div>
                <div>
                  <button
                    disabled={iceSelections.length < 1}
                    onClick={() => {
                      emit("ice:replace", { selections: iceSelections });
                      setIceSelections([]);
                    }}
                  >
                    ทิ้งไพ่ ({iceSelections.length}/2)
                  </button>
                  <button
                    className="mock-muted-button"
                    onClick={() => {
                      emit("ice:decline");
                      setIceSelections([]);
                    }}
                  >
                    ให้เสียเลือดตามปกติ
                  </button>
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingTwinSwords &&
          game.pendingTwinSwords.targetId === game.viewerId &&
          (() => {
            const attacker = game.players.find(
              (p) => p.id === game.pendingTwinSwords!.attackerId,
            );
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  {charName(attacker)} ใช้ {game.pendingTwinSwords!.weaponName}{" "}
                  — เลือกทิ้งไพ่บนมือ 1 ใบ หรือให้ผู้โจมตีจั่ว 1 ใบ
                </b>
                {countdownBadge}
                <div className="local-force-cards">
                  {myPlayer?.hand.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => emit("twin:discard", { cardId: c.id })}
                    >
                      ทิ้ง {c.name} ({c.number}
                      {suitTx(c.suit)})
                    </button>
                  ))}
                </div>
                <button
                  className="mock-muted-button"
                  onClick={() => emit("twin:draw")}
                >
                  ให้ผู้โจมตีจั่ว 1 ใบ
                </button>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingFankui &&
          game.pendingFankui.playerId === game.viewerId &&
          (() => {
            const damager = game.players.find(
              (p) => p.id === game.pendingFankui!.damagerId,
            );
            if (!damager) return null;
            const equipEntries = (
              [
                { key: "weapon", label: "อาวุธ" },
                { key: "armor", label: "เกราะ" },
                { key: "offensiveMount", label: "ม้ารุก" },
                { key: "defensiveMount", label: "ม้ารับ" },
              ] as const
            )
              .map(({ key, label }) => ({
                card: damager.equipment[key],
                label,
              }))
              .filter((e) => e.card);
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>🎯 กลยุทธ์โต้กลับ: หยิบไพ่ 1 ใบจาก {charName(damager)}</b>
                {countdownBadge}
                <div className="local-force-cards">
                  {Array.from({ length: damager.handCount }, (_, i) => (
                    <button
                      key={`h${i}`}
                      onClick={() =>
                        emit("fankui:take", {
                          selection: { zone: "hand", handIndex: i },
                        })
                      }
                    >
                      🂠 {i + 1}
                    </button>
                  ))}
                  {equipEntries.map(({ card, label }) => (
                    <button
                      key={card!.id}
                      onClick={() =>
                        emit("fankui:take", {
                          selection: {
                            zone: "equipment",
                            cardInstanceId: card!.id,
                          },
                        })
                      }
                    >
                      {label}: {card!.name}
                    </button>
                  ))}
                </div>
                <button
                  className="mock-muted-button"
                  onClick={() => emit("fankui:decline")}
                >
                  ไม่ใช้
                </button>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingLegacy &&
          (() => {
            const isOwner = game.pendingLegacy!.ownerId === game.viewerId;
            const owner = game.players.find(
              (p) => p.id === game.pendingLegacy!.ownerId,
            );
            if (!isOwner)
              return (
                <section className="mock-response" role="dialog">
                  <span className="mock-response-icon">📜</span>
                  {countdownBadge}
                  <div>
                    <h2>คำสั่งเสีย</h2>
                    <p>
                      กำลังรอ {owner?.username ?? "ผู้เล่น"} มอบไพ่ให้ผู้เล่น…
                    </p>
                  </div>
                </section>
              );
            const cards = game.pendingLegacy!.cards;
            return (
              <section className="mock-response local-legacy" role="dialog">
                <span className="mock-response-icon">📜</span>
                {countdownBadge}
                <div className="local-legacy-body">
                  <h2>คำสั่งเสีย — มอบไพ่ให้ผู้เล่น</h2>
                  <p>เลือกผู้รับของแต่ละใบ (ใบบนสุดจั่วก่อน)</p>
                  <div className="local-legacy-list">
                    {cards.map((c) => (
                      <div key={c.id} className="local-legacy-row">
                        <b
                          className={`local-legacy-card local-suit-${suitColor(c.suit)}`}
                        >
                          {c.name} · {c.number}
                          {suitTx(c.suit)}
                        </b>
                        <div className="local-legacy-targets">
                          {game.players
                            .filter((p) => p.alive)
                            .map((p) => (
                              <button
                                key={p.id}
                                onClick={() =>
                                  emit("legacy:assign", {
                                    cardId: c.id,
                                    targetId: p.id,
                                  })
                                }
                              >
                                {p.username}
                                {p.id === game.viewerId ? " (ตัวเอง)" : ""}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingRetaliateJudgment &&
          (() => {
            const owner = game.players.find(
              (p) => p.id === game.pendingRetaliateJudgment!.ownerId,
            );
            const damager = game.players.find(
              (p) => p.id === game.pendingRetaliateJudgment!.damagerId,
            );
            const isOwner =
              game.pendingRetaliateJudgment!.ownerId === game.viewerId;
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  🩸 ย้อนรอยศัตรู
                  {isOwner ? "" : ` — ${owner?.username ?? "ผู้เล่น"}`}
                </b>
                {countdownBadge}
                {isOwner ? (
                  <>
                    <p>
                      เปิดไพ่ตัดสินเอง — ถ้าไม่ใช่ ♥ ผู้ทำดาเมจ (
                      {damager?.username ?? "ผู้เล่น"}) ต้องทิ้งไพ่ 2 ใบ
                      หรือรับความเสียหาย 1 หน่วย
                    </p>
                    <div className="mock-response-actions">
                      <button onClick={() => emit("retaliate:reveal")}>
                        🎴 เปิดไพ่ตัดสิน
                      </button>
                    </div>
                  </>
                ) : (
                  <p>
                    กำลังรอ {owner?.username ?? "ผู้เล่น"} เปิดไพ่ตัดสิน
                    ย้อนรอยศัตรู…
                  </p>
                )}
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingRetaliate &&
          game.pendingRetaliate.damagerId === game.viewerId &&
          (() => {
            const victim = game.players.find(
              (p) => p.id === game.pendingRetaliate!.victimId,
            );
            const toggle = (id: string) =>
              setRetaliateCards((prev) =>
                prev.includes(id)
                  ? prev.filter((x) => x !== id)
                  : prev.length < 2
                    ? [...prev, id]
                    : prev,
              );
            const canDiscard = (myPlayer?.hand.length ?? 0) >= 2;
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  🩸 คุณถูกสกิล ย้อนรอยศัตรู ของ {victim?.username ?? "ผู้เล่น"}{" "}
                  — ทิ้งไพ่บนมือ 2 ใบ หรือรับความเสียหาย 1 หน่วย
                </b>
                {countdownBadge}
                {canDiscard && (
                  <div className="local-force-cards">
                    {myPlayer?.hand.map((c) => (
                      <button
                        key={c.id}
                        className={
                          retaliateCards.includes(c.id) ? "selected-card" : ""
                        }
                        onClick={() => toggle(c.id)}
                      >
                        {c.name} ({c.number}
                        {suitTx(c.suit)})
                      </button>
                    ))}
                  </div>
                )}
                <div className="mock-response-actions">
                  {canDiscard && (
                    <button
                      disabled={retaliateCards.length !== 2}
                      onClick={() => {
                        emit("retaliate:discard", { cardIds: retaliateCards });
                        setRetaliateCards([]);
                      }}
                    >
                      ทิ้งไพ่ 2 ใบ ({retaliateCards.length}/2)
                    </button>
                  )}
                  <button
                    className="mock-muted-button"
                    onClick={() => {
                      emit("retaliate:damage");
                      setRetaliateCards([]);
                    }}
                  >
                    รับความเสียหาย 1 หน่วย
                  </button>
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingDischord &&
          game.pendingDischord.targetId === game.viewerId &&
          (() => {
            const jiuyi = game.players.find(
              (p) => p.id === game.pendingDischord!.jiuyiId,
            );
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  🎴 บาดหมาง จาก {charName(jiuyi)}: เลือก 1 ดอกไพ่
                  (ทายผิดดอกที่หยิบได้ = เสีย 1 HP แต่ได้ไพ่ใบนั้น)
                </b>
                {countdownBadge}
                <div className="mock-response-actions">
                  {["♠", "♥", "♦", "♣"].map((s) => (
                    <button
                      key={s}
                      onClick={() => emit("dischord:suit", { suit: s })}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingAllyAssist &&
          game.pendingAllyAssist.allyId === game.viewerId &&
          (() => {
            const pa = game.pendingAllyAssist!;
            const emperor = game.players.find((p) => p.id === pa.emperorId);
            const need = pa.kind;
            const card = myPlayer?.hand.find((c) => c.effect === need);
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  👑 {charName(emperor)} ขอให้คุณใช้{" "}
                  {need === "attack" ? "โจมตี" : "หลบ"} แทน
                  {pa.targetId
                    ? ` (เป้าหมาย ${charName(game.players.find((p) => p.id === pa.targetId))})`
                    : ""}
                </b>
                {countdownBadge}
                <div className="mock-response-actions">
                  <button
                    disabled={!card}
                    onClick={() =>
                      card && emit("ally:assist", { cardId: card.id })
                    }
                  >
                    {card
                      ? `${need === "attack" ? "⚔ ใช้ โจมตี" : "🛡 ใช้ หลบ"} แทน`
                      : `ไม่มีไพ่${need === "attack" ? "โจมตี" : "หลบ"}`}
                  </button>
                  <button
                    className="mock-muted-button"
                    onClick={() => emit("ally:decline")}
                  >
                    ปฏิเสธ
                  </button>
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingPeek &&
          game.pendingPeek.playerId === game.viewerId &&
          (() => {
            const cards = game.pendingPeek.cards;
            const toggle = (id: string) =>
              setPeekOrder((prev) =>
                prev.includes(id)
                  ? prev.filter((x) => x !== id)
                  : [...prev, id],
              );
            const unselected = cards.filter((c) => !peekOrder.includes(c.id));
            const bottomIds = unselected.map((c) => c.id);
            const ordered = [
              ...peekOrder
                .map((id) => cards.find((c) => c.id === id))
                .filter((c): c is Card => !!c),
              ...unselected,
            ];
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  🔮 หยั่งรู้ฟ้าดิน — จัดลำดับกองจั่ว (บนลงล่าง ·
                  ใบบนสุดจั่วก่อน)
                </b>
                <small className="local-peek-hint">
                  กดไพ่เพื่อเลื่อนขึ้นกลุ่ม “บน” ตามลำดับที่กด ·
                  ใบที่ไม่ได้กดจะไหลลงล่าง
                </small>
                {countdownBadge}
                <div className="local-force-cards local-peek-list">
                  {ordered.map((c, i) => {
                    const sel = peekOrder.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        className={sel ? "selected-card" : ""}
                        onClick={() => toggle(c.id)}
                      >
                        <b>{i + 1}.</b> {c.name} ({c.number}
                        {suitTx(c.suit)}){" "}
                        <em>
                          {sel ? "บน" : "ล่าง"}
                          {i === 0 ? " · จั่วก่อน" : ""}
                        </em>
                      </button>
                    );
                  })}
                </div>
                <div className="mock-response-actions">
                  <button
                    onClick={() => {
                      emit("skill:peek-resolve", {
                        topIds: peekOrder,
                        bottomIds,
                      });
                      setPeekOrder([]);
                    }}
                  >
                    ยืนยันการจัดเรียง (บน {peekOrder.length}/ล่าง{" "}
                    {bottomIds.length})
                  </button>
                  <button
                    className="mock-muted-button"
                    onClick={() => {
                      emit("skill:peek-resolve", {
                        topIds: cards.map((c) => c.id),
                        bottomIds: [],
                      });
                      setPeekOrder([]);
                    }}
                  >
                    วางทั้งหมดไว้บน (ตามเดิม)
                  </button>
                </div>
              </section>
            );
          })()}

        {isPlaying && discardTarget && selectedDiscardId && (
          <div className="modal-backdrop">
            <section className="card-detail local-target-picker">
              <h2>เลือกไพ่ของ {charName(discardTarget)}</h2>
              {!selectedDiscardZone ? (
                <>
                  <p>เลือกโซน</p>
                  <div className="local-equipment-picker">
                    <button
                      disabled={!discardTarget.handCount}
                      onClick={() => setSelectedDiscardZone("hand")}
                    >
                      🂠 มือ ({discardTarget.handCount})
                    </button>
                    <button
                      disabled={
                        !Object.values(discardTarget.equipment).some(Boolean)
                      }
                      onClick={() => setSelectedDiscardZone("equipment")}
                    >
                      อุปกรณ์
                    </button>
                  </div>
                </>
              ) : selectedDiscardZone === "hand" ? (
                <>
                  <p>เลือกตำแหน่งไพ่บนมือ</p>
                  <div className="local-equipment-picker">
                    {Array.from({ length: discardTarget.handCount }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          emit("card:discard-target", {
                            cardId: selectedDiscardId,
                            targetId: discardTarget.id,
                            selection: { zone: "hand", handIndex: i },
                          });
                          cancelSelection();
                        }}
                      >
                        🂠 {i + 1}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p>เลือกอุปกรณ์</p>
                  <div className="local-equipment-picker">
                    {(
                      [
                        { key: "weapon", label: "อาวุธ" },
                        { key: "armor", label: "เกราะ" },
                        { key: "offensiveMount", label: "ม้ารุก" },
                        { key: "defensiveMount", label: "ม้ารับ" },
                      ] as const
                    ).map(({ key, label }) => {
                      const eq = discardTarget.equipment[key];
                      return eq ? (
                        <button
                          key={key}
                          onClick={() => {
                            emit("card:discard-target", {
                              cardId: selectedDiscardId,
                              targetId: discardTarget.id,
                              selection: {
                                zone: "equipment",
                                cardInstanceId: eq.id,
                              },
                            });
                            cancelSelection();
                          }}
                        >
                          <small>{label}</small>
                          {eq.name}
                        </button>
                      ) : (
                        <span key={key} className="local-empty-slot">
                          {label}: ว่าง
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
              <button className="mock-muted-button" onClick={cancelSelection}>
                ยกเลิก
              </button>
            </section>
          </div>
        )}
        {isPlaying && stealTarget && selectedStealId && (
          <div className="modal-backdrop">
            <section className="card-detail local-target-picker">
              <h2>เลือกไพ่ของ {charName(stealTarget)}</h2>
              {!selectedStealZone ? (
                <>
                  <p>เลือกโซน</p>
                  <div className="local-equipment-picker">
                    <button
                      disabled={!stealTarget.handCount}
                      onClick={() => setSelectedStealZone("hand")}
                    >
                      🂠 มือ ({stealTarget.handCount})
                    </button>
                    <button
                      disabled={
                        !Object.values(stealTarget.equipment).some(Boolean)
                      }
                      onClick={() => setSelectedStealZone("equipment")}
                    >
                      อุปกรณ์
                    </button>
                  </div>
                </>
              ) : selectedStealZone === "hand" ? (
                <>
                  <p>เลือกตำแหน่งไพ่บนมือ</p>
                  <div className="local-equipment-picker">
                    {Array.from({ length: stealTarget.handCount }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          emit("card:steal-target", {
                            cardId: selectedStealId,
                            targetId: stealTarget.id,
                            selection: { zone: "hand", handIndex: i },
                          });
                          cancelSelection();
                        }}
                      >
                        🂠 {i + 1}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p>เลือกอุปกรณ์</p>
                  <div className="local-equipment-picker">
                    {(
                      [
                        { key: "weapon", label: "อาวุธ" },
                        { key: "armor", label: "เกราะ" },
                        { key: "offensiveMount", label: "ม้ารุก" },
                        { key: "defensiveMount", label: "ม้ารับ" },
                      ] as const
                    ).map(({ key, label }) => {
                      const eq = stealTarget.equipment[key];
                      return eq ? (
                        <button
                          key={key}
                          onClick={() => {
                            emit("card:steal-target", {
                              cardId: selectedStealId,
                              targetId: stealTarget.id,
                              selection: {
                                zone: "equipment",
                                cardInstanceId: eq.id,
                              },
                            });
                            cancelSelection();
                          }}
                        >
                          <small>{label}</small>
                          {eq.name}
                        </button>
                      ) : (
                        <span key={key} className="local-empty-slot">
                          {label}: ว่าง
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
              <button className="mock-muted-button" onClick={cancelSelection}>
                ยกเลิก
              </button>
            </section>
          </div>
        )}
        {confirmSelfDamage && (
          <div
            className="modal-backdrop"
            onClick={() => setConfirmSelfDamage(false)}
          >
            <section
              className="card-detail local-target-picker"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>ใช้ พลีชีพ?</h2>
              <p>
                คุณจะเสีย <b>พลังชีวิต 1 หน่วย</b> เพื่อรับสิทธิ์จั่ว{" "}
                <b>2 ใบ</b>
              </p>
              <div className="mock-response-actions">
                <button
                  onClick={() => {
                    emit("skill:self-damage-draw");
                    setConfirmSelfDamage(false);
                  }}
                >
                  ยืนยัน เสีย 1 HP
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => setConfirmSelfDamage(false)}
                >
                  ยกเลิก
                </button>
              </div>
            </section>
          </div>
        )}
        {confirmSurrender && (
          <div
            className="modal-backdrop"
            onClick={() => setConfirmSurrender(false)}
          >
            <section
              className="card-detail local-target-picker"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>🏳️ ยอมแพ้?</h2>
              <p>
                ตัวละครของคุณจะ <b>ตายทันที</b> และเปิดเผยบทบาท
                เพื่อให้เกมดำเนินต่อได้ (ใช้เมื่อคุณต้องออกจากเกม)
              </p>
              <div className="mock-response-actions">
                <button
                  className="danger"
                  onClick={() => {
                    emit("game:surrender");
                    setConfirmSurrender(false);
                  }}
                >
                  ยืนยัน ยอมแพ้
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => setConfirmSurrender(false)}
                >
                  ยกเลิก
                </button>
              </div>
            </section>
          </div>
        )}
        {confirmCharacter && (
          <div
            className="modal-backdrop"
            onClick={() => setConfirmCharacter(undefined)}
          >
            <section
              className="local-skills-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{confirmCharacter.name}</h2>
              <p className="local-skills-faction">
                {confirmCharacter.kingdomTh || "อิสระ"} · HP{" "}
                {confirmCharacter.hp}
              </p>
              <ul className="local-skills-list">
                {confirmCharacter.skills.map((s) => (
                  <li key={s.name}>
                    <b>{s.name}</b>
                    <p>{s.description}</p>
                    {s.condition && (
                      <small className="local-skill-condition">
                        {s.condition}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mock-response-actions">
                <button
                  onClick={() => {
                    emit("character:select", {
                      characterId: confirmCharacter.id,
                    });
                    setConfirmCharacter(undefined);
                  }}
                >
                  ยืนยัน เลือก {confirmCharacter.name}
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => setConfirmCharacter(undefined)}
                >
                  ยกเลิก
                </button>
              </div>
            </section>
          </div>
        )}
        {discardLimitConfirming && (
          <div className="modal-backdrop">
            <section className="card-detail local-target-picker">
              <h2>ยืนยันการทิ้งไพ่</h2>
              <ul className="local-discard-confirm-list">
                {discardLimitSelected.map((id) => {
                  const c = myPlayer?.hand.find((x) => x.id === id);
                  return c ? (
                    <li key={id}>
                      <b>{c.name}</b>{" "}
                      <small>
                        {c.number}
                        {suitTx(c.suit)}
                      </small>
                    </li>
                  ) : null;
                })}
              </ul>
              <div className="mock-response-actions">
                <button
                  onClick={() => {
                    emit("hand:discard", { cardIds: discardLimitSelected });
                    setDiscardLimitSelected([]);
                    setDiscardLimitConfirming(false);
                  }}
                >
                  ยืนยัน ทิ้งไพ่
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => setDiscardLimitConfirming(false)}
                >
                  กลับไปเลือกใหม่
                </button>
              </div>
            </section>
          </div>
        )}

        {showRole && myPlayer?.role && (
          <div className="modal-backdrop" onClick={() => setShowRole(false)}>
            <section
              className="role-reveal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setShowRole(false)}
              >
                ×
              </button>
              <small>บทบาทของคุณ</small>
              <h2>
                {myRoleInfo?.role_th ||
                  ROLE_LABEL[myPlayer.role] ||
                  myPlayer.role}
              </h2>
              <p>{myRoleInfo?.win_condition_th || ""}</p>
            </section>
          </div>
        )}
        {skillsCharacter && (
          <div
            className="modal-backdrop"
            onClick={() => setSkillsCharacter(undefined)}
          >
            <section
              className="local-skills-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setSkillsCharacter(undefined)}
              >
                ×
              </button>
              <h2>{skillsCharacter.name}</h2>
              <p className="local-skills-faction">
                {skillsCharacter.kingdomTh || "—"} · HP {skillsCharacter.hp}
              </p>
              {game.characterSkillKeys?.[skillsCharacter.id]?.length && (
                <p className="local-skill-live">⚙ ทักษะทำงานในระบบแล้ว</p>
              )}
              {skillsCharacter.skills.length ? (
                <ul className="local-skills-list">
                  {skillsCharacter.skills.map((s) => (
                    <li key={s.name}>
                      <b>{s.name}</b>
                      <p>{s.description}</p>
                      {s.condition && (
                        <small className="local-skill-condition">
                          {s.condition}
                        </small>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="local-skills-empty">ไม่มีทักษะพิเศษ</p>
              )}
            </section>
          </div>
        )}
        {detailCard &&
          (() => {
            const info = cardInfo(detailCard);
            return (
              <div
                className="modal-backdrop modal-top"
                onClick={() => setDetailCard(undefined)}
              >
                <section
                  className="card-detail"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="modal-close"
                    onClick={() => setDetailCard(undefined)}
                  >
                    ×
                  </button>
                  <span
                    className={`card-rank mock-card-suit-${suitColor(detailCard.suit)}`}
                  >
                    {detailCard.number} {suitTx(detailCard.suit)}
                  </span>
                  <h2>{detailCard.name}</h2>
                  {detailCard.image && (
                    <img
                      className="card-detail-art"
                      src={detailCard.image}
                      alt={detailCard.name}
                    />
                  )}
                  <p>
                    <b>ประเภท:</b> {cardTypeLabel(detailCard)}
                  </p>
                  {(detailCard.cardType === "weapon" ||
                    detailCard.equipmentSlot === "weapon") &&
                  detailCard.effectParams?.range ? (
                    <p className="card-detail-range">
                      🎯 ระยะโจมตี {detailCard.effectParams.range}
                    </p>
                  ) : null}
                  <p>
                    {info?.desc || detailCard.description || "ยังไม่มีคำอธิบาย"}
                  </p>
                  {info?.use && (
                    <p className="card-detail-use">
                      <b>เมื่อไหร่:</b> {info.use}
                    </p>
                  )}
                </section>
              </div>
            );
          })()}
        {showDropZone && (
          <div
            className="modal-backdrop"
            onClick={() => setShowDropZone(false)}
          >
            <section
              className="card-detail dropzone-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setShowDropZone(false)}
              >
                ×
              </button>
              <h2>กองทิ้ง</h2>
              <p className="dropzone-count">
                ไพ่ทั้งหมด {game.discard.length} ใบ · แตะไพ่เพื่อดูรายละเอียด
              </p>
              {game.discard.length === 0 ? (
                <p className="dropzone-empty">ยังไม่มีไพ่ในกองทิ้ง</p>
              ) : (
                <div className="dropzone-grid">
                  {game.discard
                    .map((card, i) => ({ card, i }))
                    .reverse()
                    .map(({ card, i }) => (
                      <button
                        type="button"
                        key={`${card.id}-${i}`}
                        className={`dropzone-card local-suit-${suitColor(card.suit)}${i === game.discard.length - 1 ? " dropzone-card-top" : ""}`}
                        onClick={() => setDetailCard(card)}
                        title={card.name}
                      >
                        {i === game.discard.length - 1 && (
                          <span className="dropzone-card-badge">ล่าสุด</span>
                        )}
                        <span className="dropzone-card-rank">
                          {card.number} {suitTx(card.suit)}
                        </span>
                        <span className="dropzone-card-name">{card.name}</span>
                      </button>
                    ))}
                </div>
              )}
            </section>
          </div>
        )}
        {showSettings && (
          <div
            className="modal-backdrop"
            onClick={() => setShowSettings(false)}
          >
            <section
              className="card-detail settings-menu"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setShowSettings(false)}
              >
                ×
              </button>
              <h2>ตั้งค่าในเกม</h2>
              <div className="settings-row">
                <span className="settings-row-label">
                  <b>ยืนยันก่อนเล่นการ์ด</b>
                  <small>ถามยืนยันทุกครั้งก่อนเล่นการ์ด กันเผลอเล่นผิดใบ</small>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={confirmBeforePlay}
                  className={`settings-switch${confirmBeforePlay ? " on" : ""}`}
                  onClick={toggleConfirmBeforePlay}
                >
                  <span className="settings-switch-knob" />
                </button>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">
                  <b>เสียงแจ้งเตือน</b>
                  <small>เล่นเสียงเมื่อถึงตาของคุณ</small>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={soundOn}
                  className={`settings-switch${soundOn ? " on" : ""}`}
                  onClick={() => setSoundOn((v) => !v)}
                >
                  <span className="settings-switch-knob" />
                </button>
              </div>
            </section>
          </div>
        )}
        {pendingPlay &&
          (() => {
            const cid =
              typeof pendingPlay.data?.cardId === "string"
                ? (pendingPlay.data.cardId as string)
                : undefined;
            const card = cid
              ? myPlayer?.hand.find((c) => c.id === cid)
              : undefined;
            const tid =
              typeof pendingPlay.data?.targetId === "string"
                ? (pendingPlay.data.targetId as string)
                : undefined;
            const target = tid
              ? game.players.find((p) => p.id === tid)
              : undefined;
            return (
              <div
                className="modal-backdrop modal-top"
                onClick={cancelPendingPlay}
              >
                <section
                  className="card-detail local-target-picker play-confirm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2>ยืนยันการเล่นการ์ด?</h2>
                  {card ? (
                    <div
                      className={`play-confirm-card local-suit-${suitColor(card.suit)}`}
                    >
                      <span className="card-rank">
                        {card.number} {suitTx(card.suit)}
                      </span>
                      <b>{card.name}</b>
                    </div>
                  ) : (
                    <p>คุณกำลังจะเล่นการ์ด</p>
                  )}
                  {target && (
                    <p className="play-confirm-target">
                      🎯 เป้าหมาย: <b>{charName(target)}</b>
                    </p>
                  )}
                  <div className="mock-response-actions">
                    <button onClick={confirmPendingPlay}>✓ ยืนยัน</button>
                    <button className="danger" onClick={cancelPendingPlay}>
                      ✕ ยกเลิก
                    </button>
                  </div>
                </section>
              </div>
            );
          })()}
        {equipConfirmCard && (
          <div
            className="modal-backdrop"
            onClick={() => setEquipConfirmCard(undefined)}
          >
            <section
              className="card-detail local-target-picker"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>ติดตั้งอุปกรณ์?</h2>
              <p>
                <b>{equipConfirmCard.name}</b>{" "}
                <small>
                  ({equipConfirmCard.number}
                  {suitTx(equipConfirmCard.suit)})
                </small>
              </p>
              <p>
                {cardInfo(equipConfirmCard)?.desc ||
                  equipConfirmCard.description ||
                  equipConfirmCard.type}
              </p>
              {(() => {
                const slot = equipConfirmCard.equipmentSlot;
                const slotKey =
                  slot === "weapon"
                    ? "weapon"
                    : slot === "armor"
                      ? "armor"
                      : slot?.includes("offensive")
                        ? "offensiveMount"
                        : slot?.includes("defensive")
                          ? "defensiveMount"
                          : undefined;
                const current = slotKey
                  ? myPlayer?.equipment[slotKey as keyof EquipmentSlots]
                  : undefined;
                return current ? (
                  <p className="local-equip-replace">
                    จะแทนที่ <b>{current.name}</b> ที่ติดตั้งอยู่
                    (ทิ้งลงกองทิ้ง)
                  </p>
                ) : null;
              })()}
              <div className="mock-response-actions">
                <button
                  onClick={() => {
                    // This modal is itself the confirmation for equipment — bypass the
                    // Card Play Confirmation gate so it isn't asked twice.
                    emitNow("card:play", { cardId: equipConfirmCard.id });
                    setEquipConfirmCard(undefined);
                  }}
                >
                  ยืนยันติดตั้ง
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => setEquipConfirmCard(undefined)}
                >
                  ยกเลิก
                </button>
              </div>
            </section>
          </div>
        )}
        {judgmentBanner &&
          (() => {
            const jp = game.players.find(
              (p) => p.id === judgmentBanner.playerId,
            );
            return (
              <div className="local-judgment-banner" role="status">
                <span className="local-judgment-title">
                  ⚖ การตัดสิน — {judgmentBanner.trickName}
                </span>
                <div className="local-judgment-card">
                  <span>
                    {judgmentBanner.cardNumber}{" "}
                    {suitTx(judgmentBanner.cardSuit)}
                  </span>
                  <b>{judgmentBanner.cardName}</b>
                </div>
                <span className="local-judgment-result">
                  {charName(jp)}: {judgmentBanner.result}
                </span>
              </div>
            );
          })()}
        {criticalCountdown && (
          <>
            <div className="local-critical-vignette" aria-hidden="true" />
            <div className="local-critical-countdown" role="alert">
              <span className="local-critical-label">⚠ ตัดสินใจด่วน!</span>
              <span className="local-critical-num">{secondsLeft}</span>
            </div>
          </>
        )}
        {turnBanner && (
          <div
            className="local-turn-banner"
            role="status"
            aria-live="assertive"
            onClick={() => setTurnBanner(false)}
          >
            <span className="local-turn-banner-icon">⚔</span>
            <b>ถึงตาคุณแล้ว!</b>
            <span className="local-turn-banner-sub">เริ่มเทิร์นของคุณ</span>
          </div>
        )}
        {tableBanner && (
          <div className="local-table-flash" role="status">
            <span className="local-table-flash-icon">{tableBanner.icon}</span>
            <div className="local-table-flash-body">
              <b>{tableBanner.title}</b>
              {tableBanner.detail && <span>{tableBanner.detail}</span>}
            </div>
            {tableBanner.card && (
              <div
                className={`local-judgment-card local-suit-${suitColor(tableBanner.card.suit)}`}
              >
                <span>
                  {tableBanner.card.number} {suitTx(tableBanner.card.suit)}
                </span>
                <b>{tableBanner.card.name}</b>
              </div>
            )}
          </div>
        )}
        {startCountdown !== null && (
          <div
            className="local-countdown-overlay"
            onClick={() => setStartCountdown(null)}
          >
            <span className="local-countdown-num" key={startCountdown}>
              {startCountdown > 0 ? startCountdown : "เริ่ม!"}
            </span>
          </div>
        )}
        {game.startDeadline && startSecondsLeft !== null && (
          <div className="local-countdown-overlay">
            <div className="local-start-count">
              <span className="local-countdown-num" key={startSecondsLeft}>
                {startSecondsLeft > 0 ? startSecondsLeft : "เริ่ม!"}
              </span>
              <p>⚔ เกมกำลังจะเริ่ม…</p>
              {isHost && (
                <button
                  className="danger"
                  onClick={() => emit("game:cancel-start")}
                >
                  ✕ ยกเลิกการเริ่มเกม
                </button>
              )}
            </div>
          </div>
        )}
        {confirmStart && (
          <div
            className="modal-backdrop"
            onClick={() => setConfirmStart(false)}
          >
            <section
              className="card-detail local-target-picker"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>เริ่มเกม?</h2>
              <p>
                ผู้เล่น {game.players.length} คนพร้อมแล้ว — จะเริ่มนับถอยหลัง 5
                วินาทีเข้าสู่เกม
              </p>
              <div className="mock-response-actions">
                <button
                  onClick={() => {
                    emit("game:start");
                    setConfirmStart(false);
                  }}
                >
                  ยืนยัน เริ่มเลย
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => setConfirmStart(false)}
                >
                  ยกเลิก
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    </>
  );
}
