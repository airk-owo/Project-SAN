// Shared presentation constants + pure helpers for the online game page.
//
// Moved out of app/page.tsx so both the page and the extracted modal components
// (components/EncyclopediaDrawer, CardDetailModal, DropZoneModal, …) read the same
// card rule text, Thai labels, and derived-state predicates. No React state here —
// only data tables and pure functions (a couple return JSX, hence the .tsx extension).

import type { Card, Game, RoleSet } from "./gameTypes";

export const ROLE_LABEL: Record<string, string> = {
  emperor: "จักรพรรดิ",
  rebel: "กบฏ",
  loyalist: "ผู้ภักดี",
  traitor: "ทรยศ",
};

export const PHASE_LABEL: Record<string, string> = {
  judgment: "ตัดสิน",
  draw: "จั่ว",
  play: "เล่น",
  discard: "ทิ้งไพ่",
  end: "จบเทิร์น",
};

export const roleText = (role: RoleSet) =>
  `จักรพรรดิ ${role.emperor} · ผู้ภักดี ${role.loyalist} · กบฏ ${role.rebel} · ทรยศ ${role.traitor}`;

// '︎' (variation selector-15) forces text presentation so iOS/Safari doesn't turn ♥ into a color emoji (which ignores CSS color & breaks the HP bar layout).
export const HEART = "♥︎";

export const hearts = (hp?: number, maxHp?: number) =>
  hp === undefined || maxHp === undefined ? null : (
    <span className="mock-hearts">
      {HEART.repeat(Math.max(0, hp))}
      <i>{HEART.repeat(Math.max(0, maxHp - hp))}</i>
    </span>
  );

export const charName = (
  p: { character?: { name: string }; username: string } | undefined,
) => p?.character?.name ?? p?.username ?? "ผู้เล่น";

export const CARD_INFO: Record<string, { desc: string; use: string }> = {
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

export const cardInfo = (c: Card) =>
  CARD_INFO[c.effect || ""] ||
  (c.description ? { desc: c.description, use: "" } : null);

export const suitColor = (suit: string) =>
  suit === "♥" || suit === "♦" ? "red" : "black";

// เติม VS-15 (U+FE0E) ท้ายดอกไพ่ตอนแสดงผล → บังคับให้ iOS ทุกเวอร์ชัน render เป็นตัวอักษร ไม่ใช่อิโมจิ (ห้ามใช้กับ logic เทียบดอก)
export const SUIT_TEXT: Record<string, string> = {
  "♠": "♠︎",
  "♥": "♥︎",
  "♦": "♦︎",
  "♣": "♣︎",
};

export const suitTx = (s: string) => SUIT_TEXT[s] ?? s;

/** Short type label: drops the "อุปกรณ์ /" prefix and appends the mount distance modifier. */
export const cardTypeLabel = (c: Card) => {
  const base = (c.type || "").replace(/^อุปกรณ์\s*\/\s*/, "");
  if (c.equipmentSlot === "offensive_mount") return `${base} −1`;
  if (c.equipmentSlot === "defensive_mount") return `${base} +1`;
  return base;
};

export const KINGDOM_FACTION: Record<string, string> = {
  WEI: "wei",
  SHU: "shu",
  WU: "wu",
  QUN: "qun",
};

// Touch/no-hover device? Used to switch the drop-zone preview to two-step tap.
export const coarsePointer = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(hover: none)").matches;

// Arc across the top of the table. index 0 = viewer's immediate left neighbor,
// last index = viewer's immediate right neighbor (viewer sits at the bottom).
export function edgePosition(index: number, total: number) {
  if (total <= 0) return { left: "50%", top: "1%" };
  if (total === 1) return { left: "50%", top: "4%" };
  const t = index / (total - 1); // 0 → left, 1 → right
  const angle = Math.PI * (1 - t); // π (left) → 0 (right)
  const left = 50 + 46 * Math.cos(angle); // 4% … 96%
  const top = 48 - 46 * Math.sin(angle); // ends low (48), middle high (2)
  return { left: `${left.toFixed(1)}%`, top: `${top.toFixed(1)}%` };
}

// Circular position for all 10 lobby seats (seat 1 at top, clockwise)
export function lobbyPosition(seatIndex: number): { left: string; top: string } {
  const angle = ((seatIndex - 1) / 10) * 2 * Math.PI - Math.PI / 2;
  return {
    left: `${(50 + 42 * Math.cos(angle)).toFixed(1)}%`,
    top: `${(50 + 38 * Math.sin(angle)).toFixed(1)}%`,
  };
}

/** True when the server's decision countdown is waiting on the viewer specifically
 *  (dodge/heal/negate/duel/etc. or any pending decision the viewer must resolve). */
export function isViewerDecisionActive(game: Game | undefined): boolean {
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

/** True when it is the viewer's play phase and there is genuinely nothing to do:
 *  no card is proactively playable AND no character/card ability can be activated
 *  AND no forced discard/draw/decision is pending. Used to auto-end the turn.
 *  Deliberately conservative — any doubt (e.g. holding a peach) keeps the turn open. */
export function canAutoEndTurn(game: Game | undefined): boolean {
  if (!game || game.phase !== "playing") return false;
  if (game.currentPlayerId !== game.viewerId) return false;
  if (game.turn?.phase !== "play" || !game.hasDrawnThisTurn) return false;
  if (game.responseWindow || game.pendingJudgment) return false;
  if ((game.pendingDraws?.[game.viewerId] ?? 0) > 0) return false;
  if (
    game.pendingLegacy || game.pendingPeek || game.pendingDischord ||
    game.pendingAllyAssist || game.pendingRetaliate || game.pendingRetaliateJudgment ||
    game.pendingFankui || game.pendingCoerce || game.pendingTwinSwords ||
    game.pendingForceAttackDamage || game.pendingReplaceDamage ||
    game.pendingRepeatAttack || game.pendingDestroyMount || game.pendingHarvest
  )
    return false;
  const me = game.players.find((p) => p.id === game.viewerId);
  if (!me || me.hp === undefined) return false;
  const keys = (me.character && game.characterSkillKeys?.[me.character.id]) || [];
  const used = (k: string) => Boolean(game.skillsUsedThisTurn?.includes(k));
  const attackedThisTurn = game.turn?.attackUsedThisTurn ?? 0;
  const skipDiscard =
    keys.includes("skip_discard_if_no_attack") && attackedThisTurn === 0;
  if (!skipDiscard && me.hand.length - me.hp > 0) return false; // must discard = an action
  const unlimited =
    me.equipment.weapon?.effect === "unlimited_attack_per_turn" ||
    keys.includes("unlimited_attack");
  const canAttackMore = unlimited || attackedThisTurn < 1;
  const isRed = (s: string) => s === "♥" || s === "♦";
  const swap = keys.includes("attack_dodge_swap");
  const redAsAttack = keys.includes("red_as_attack");
  const playable = (c: Card): boolean => {
    if (c.effect === "attack") return canAttackMore;
    if (c.effect === "dodge")
      return (swap || (redAsAttack && isRed(c.suit))) && canAttackMore;
    return true; // tricks / equipment / heal etc. are always proactively playable
  };
  if (me.hand.some(playable)) return false;
  const handN = me.hand.length;
  const hasSuit = (suits: string[]) => me.hand.some((c) => suits.includes(c.suit));
  const abilityUsable =
    (me.equipment.weapon?.effect === "discard_two_as_attack" && canAttackMore) ||
    (keys.includes("self_damage_draw") && me.hp > 0) ||
    (keys.includes("discard_then_draw_equal") && !used("discard_then_draw_equal")) ||
    (keys.includes("miracle_medicine") && !used("miracle_medicine") && handN > 0) ||
    (keys.includes("marriage_heal") && !used("marriage_heal") && handN >= 2) ||
    (keys.includes("benevolence_give") && handN > 0) ||
    (keys.includes("black_as_dismantle") && hasSuit(["♠", "♣"])) ||
    (keys.includes("diamond_as_indulgence") && hasSuit(["♦"])) ||
    (keys.includes("dischord") && !used("dischord") && handN > 0) ||
    (keys.includes("incite_duel") && !used("incite") && handN > 0) ||
    (keys.includes("ask_shu_attack") && me.role === "emperor");
  return !abilityUsable;
}
