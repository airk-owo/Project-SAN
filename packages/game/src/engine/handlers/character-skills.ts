// Character-skill handlers: skill registry, event subscribers, and player-triggered skills. Extracted verbatim from index.ts.
import type {
  Card,
  EventSubscriber,
  GameEvent,
  GameEventName,
  GameState,
  Player,
  TargetCardSelection,
} from "../types.js";
import {
  characterName,
  findHandCard,
  flashTable,
  getAlivePlayers,
  getPlayerById,
  grantDraws,
  logAction,
  moveToDiscard,
  recordJudgment,
  toCardInstance,
  type RuntimeEquipmentSlot,
} from "../state.js";
import {
  reshuffleDiscardIntoDrawPile,
  synchronizeGameState,
} from "../sync.js";
import { canPlayerAct } from "../actions.js";
import { CHARACTER_SKILLS, hasCharacterSkill } from "../skills.js";
import { canTargetWithAttack } from "../targeting.js";
import {
  applyDamage,
  healPlayer,
  openDyingRescueWindow,
  playAttack,
  playDodge,
} from "./combat.js";
import { hasUnlimitedAttack } from "./equipment-passives.js";
/** กุยแก คำสั่งเสีย (遗计): the owner hands one revealed card to any living player; the window closes once all are distributed. */
export function assignLegacyCard(
  state: GameState,
  ownerId: string,
  cardId: string,
  targetId: string,
) {
  const pending = state.pendingLegacy;
  if (!pending || pending.ownerId !== ownerId)
    throw new Error("ไม่มีคำสั่งเสียที่ค้างอยู่");
  const idx = pending.cards.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new Error("ไพ่ไม่อยู่ในคำสั่งเสีย");
  const target = getPlayerById(state, targetId);
  if (!target || !target.alive) throw new Error("ต้องมอบให้ผู้เล่นที่มีชีวิต");
  const [card] = pending.cards.splice(idx, 1);
  target.hand.push(card);
  const owner = getPlayerById(state, ownerId);
  logAction(
    state,
    "legacy-give",
    `${characterName(owner!)} มอบ ${card.name} ให้ ${target.username} (คำสั่งเสีย)`,
    ownerId,
    targetId,
    card.id,
  );
  flashTable(
    state,
    "📜",
    "คำสั่งเสีย",
    `${owner?.username ?? "ผู้เล่น"} มอบการ์ดให้ ${target.username}`,
  ); // ไม่โชว์หน้าไพ่ (เป็นความลับ)
  if (!pending.cards.length) state.pendingLegacy = undefined;
  synchronizeGameState(state);
}
/** สุมาอี้ กำหนดชะตา: any holder replaces the revealed judgment card with one of their hand cards (the old one is discarded). */
export function replaceJudgmentCard(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
) {
  const pending = state.pendingJudgment;
  if (!pending || pending.stage !== "revealed")
    throw new Error("ยังไม่มีไพ่ตัดสินให้เปลี่ยน");
  if (!hasCharacterSkill(state, playerId, "replace_judgment"))
    throw new Error("ไม่มีทักษะกำหนดชะตา");
  const player = getPlayerById(state, playerId);
  if (!player || !player.alive) throw new Error("Unknown player");
  const card = findHandCard(player, cardInstanceId);
  if (!card) throw new Error("ไพ่ที่เลือกไม่อยู่ในมือ");
  player.hand = player.hand.filter((item) => item !== card);
  if (pending.revealed) moveToDiscard(state, pending.revealed, true); // old judgment card to discard
  pending.revealed = card;
  logAction(
    state,
    "skill-replace-judgment",
    `${characterName(player)} ใช้ กำหนดชะตา เปลี่ยนไพ่ตัดสินเป็น ${card.name} (${card.number}${card.suit})`,
    player.id,
    pending.playerId,
    card.id,
  );
  synchronizeGameState(state);
}
// ── Active character skills (player-triggered during their play phase) ─────
const markSkillUsed = (state: GameState, key: string) => {
  state.skillsUsedThisTurn = [...(state.skillsUsedThisTurn ?? []), key];
};
/** อุยกาย พลีชีพ: lose 1 HP to gain 2 draws. May put you into a dying state. */
export function useSelfDamageDraw(state: GameState, playerId: string) {
  if (!canPlayerAct(state, playerId))
    throw new Error("ใช้ทักษะได้เฉพาะช่วงเล่นไพ่ของคุณ");
  if (!hasCharacterSkill(state, playerId, "self_damage_draw"))
    throw new Error("ไม่มีทักษะพลีชีพ");
  const player = getPlayerById(state, playerId);
  if (!player || player.hp === undefined) throw new Error("Unknown player");
  player.hp = Math.max(0, player.hp - 1);
  logAction(
    state,
    "skill-self-damage-draw",
    `${characterName(player)} ใช้ พลีชีพ เสีย 1 พลังชีวิต ได้สิทธิ์จั่ว 2 ใบ`,
    playerId,
  );
  grantDraws(state, playerId, 2);
  if (player.hp === 0) openDyingRescueWindow(state, playerId, playerId);
  synchronizeGameState(state);
}
/** ซุนกวน ถ่วงดุล: once per turn, discard any number of hand cards then gain that many draws. */
export function useDiscardThenDraw(
  state: GameState,
  playerId: string,
  cardInstanceIds: string[],
) {
  if (!canPlayerAct(state, playerId))
    throw new Error("ใช้ทักษะได้เฉพาะช่วงเล่นไพ่ของคุณ");
  if (!hasCharacterSkill(state, playerId, "discard_then_draw_equal"))
    throw new Error("ไม่มีทักษะถ่วงดุล");
  if (state.skillsUsedThisTurn?.includes("discard_then_draw_equal"))
    throw new Error("ใช้ถ่วงดุลได้ 1 ครั้งต่อรอบ");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  const ids = [...new Set(cardInstanceIds)];
  if (ids.length !== cardInstanceIds.length)
    throw new Error("ไพ่ต้องไม่ซ้ำกัน");
  if (!ids.length) throw new Error("เลือกไพ่อย่างน้อย 1 ใบ");
  const cards = ids.map((id) => findHandCard(player, id));
  if (cards.some((c) => !c)) throw new Error("ไพ่ที่เลือกไม่อยู่ในมือ");
  for (const card of cards as Card[]) {
    player.hand = player.hand.filter((c) => c !== card);
    moveToDiscard(state, card, false);
  }
  markSkillUsed(state, "discard_then_draw_equal");
  logAction(
    state,
    "skill-balance",
    `${characterName(player)} ใช้ ถ่วงดุล ทิ้งไพ่ ${cards.length} ใบ ได้สิทธิ์จั่ว ${cards.length} ใบ`,
    playerId,
  );
  grantDraws(state, playerId, cards.length);
  synchronizeGameState(state);
}
/** สุมาอี้ กลยุทธ์โต้กลับ: take the chosen card from the damager (hidden hand position or visible equipment). */
export function takeCardFromDamager(
  state: GameState,
  playerId: string,
  selection: TargetCardSelection,
) {
  const pending = state.pendingFankui;
  if (!pending || pending.playerId !== playerId)
    throw new Error("ไม่มีกลยุทธ์โต้กลับที่ค้างอยู่");
  const sima = getPlayerById(state, playerId),
    damager = getPlayerById(state, pending.damagerId);
  if (!sima || !damager) throw new Error("ผู้เล่นหาย");
  let chosen: Card | undefined, slot: RuntimeEquipmentSlot | undefined;
  if (selection.zone === "hand") {
    chosen = damager.hand[selection.handIndex];
  } else if (selection.zone === "equipment") {
    for (const key of Object.keys(
      damager.equipment,
    ) as RuntimeEquipmentSlot[]) {
      const e = damager.equipment[key];
      if (
        e &&
        (e.id === selection.cardInstanceId ||
          toCardInstance(e).instanceId === selection.cardInstanceId)
      ) {
        chosen = e;
        slot = key;
        break;
      }
    }
  } else throw new Error("Decision-area selection is not supported");
  if (!chosen) throw new Error("ไพ่ที่เลือกไม่มีอยู่");
  if (slot) damager.equipment[slot] = null;
  else damager.hand = damager.hand.filter((c) => c !== chosen);
  sima.hand.push(chosen);
  state.pendingFankui = undefined;
  logAction(
    state,
    "skill-fankui",
    `${characterName(sima)} ใช้ กลยุทธ์โต้กลับ หยิบไพ่ 1 ใบจาก ${characterName(damager)}`,
    sima.id,
    damager.id,
  );
  synchronizeGameState(state);
}
export function declineFankui(state: GameState, playerId: string) {
  const pending = state.pendingFankui;
  if (!pending || pending.playerId !== playerId)
    throw new Error("ไม่มีกลยุทธ์โต้กลับที่ค้างอยู่");
  state.pendingFankui = undefined;
  logAction(
    state,
    "skill-fankui-declined",
    `${characterName(getPlayerById(state, playerId)!)} ไม่ใช้ กลยุทธ์โต้กลับ`,
    playerId,
  );
  synchronizeGameState(state);
}
/** แฮหัวตุ้น ย้อนรอยศัตรู: the owner manually reveals the judgment card; a non-♥ result makes the damager pay (discard 2 / take 1 damage). */
export function revealRetaliateJudgment(state: GameState, ownerId: string) {
  const pending = state.pendingRetaliateJudgment;
  if (!pending || pending.ownerId !== ownerId)
    throw new Error("ไม่มีย้อนรอยศัตรูที่รอเปิดไพ่");
  const owner = getPlayerById(state, ownerId),
    damager = getPlayerById(state, pending.damagerId);
  state.pendingRetaliateJudgment = undefined;
  if (!owner || !owner.alive || owner.hp === undefined || owner.hp <= 0) {
    synchronizeGameState(state);
    return;
  } // owner no longer eligible
  if (!state.deck.length) reshuffleDiscardIntoDrawPile(state);
  const judge = state.deck.pop();
  if (!judge) {
    synchronizeGameState(state);
    return;
  }
  moveToDiscard(state, judge, false);
  const isHeart = judge.suit === "♥";
  logAction(
    state,
    "skill-retaliate",
    `${characterName(owner)} ใช้ ย้อนรอยศัตรู เปิดตัดสิน ${judge.name} (${judge.number}${judge.suit}) — ${isHeart ? "♥ ไม่มีผล" : "ผู้ทำดาเมจต้องเลือก ทิ้ง 2 ใบ หรือ รับ 1 ดาเมจ"}`,
    ownerId,
    damager?.id,
    judge.id,
  );
  recordJudgment(
    state,
    ownerId,
    "ย้อนรอยศัตรู",
    judge,
    isHeart
      ? "♥ ไม่มีผล — ปลอดภัย"
      : `ไม่ใช่ ♥ → ${damager?.username ?? "ผู้ทำดาเมจ"} ต้องทิ้ง 2 ใบ หรือรับ 1 ดาเมจ`,
  ); // ประกาศผลไพ่ให้ทุกคนเห็น (แบนเนอร์) ก่อนคนโดนตัดสินใจ
  if (!isHeart && damager && damager.alive)
    state.pendingRetaliate = { damagerId: damager.id, victimId: ownerId };
  synchronizeGameState(state);
}
/** แฮหัวตุ้น ย้อนรอยศัตรู: the damager pays by discarding two of their own hand cards. */
export function retaliateDiscard(
  state: GameState,
  damagerId: string,
  cardInstanceIds: string[],
) {
  const pending = state.pendingRetaliate;
  if (!pending || pending.damagerId !== damagerId)
    throw new Error("ไม่มีย้อนรอยศัตรูที่ค้างอยู่");
  const damager = getPlayerById(state, damagerId);
  if (!damager) throw new Error("Unknown player");
  const ids = [...new Set(cardInstanceIds)];
  if (ids.length !== 2) throw new Error("ต้องทิ้งไพ่บนมือ 2 ใบ");
  const cards = ids.map((id) => findHandCard(damager, id));
  if (cards.some((c) => !c)) throw new Error("ไพ่ที่เลือกไม่อยู่ในมือ");
  for (const card of cards as Card[]) {
    damager.hand = damager.hand.filter((c) => c !== card);
    moveToDiscard(state, card, false);
  }
  state.pendingRetaliate = undefined;
  logAction(
    state,
    "retaliate-discard",
    `${characterName(damager)} เลือกทิ้งไพ่ 2 ใบ (ย้อนรอยศัตรู)`,
    damagerId,
  );
  synchronizeGameState(state);
}
/** แฮหัวตุ้น ย้อนรอยศัตรู: the damager instead takes 1 damage. */
export function retaliateTakeDamage(state: GameState, damagerId: string) {
  const pending = state.pendingRetaliate;
  if (!pending || pending.damagerId !== damagerId)
    throw new Error("ไม่มีย้อนรอยศัตรูที่ค้างอยู่");
  const victimId = pending.victimId;
  state.pendingRetaliate = undefined;
  logAction(
    state,
    "retaliate-damage",
    `${characterName(getPlayerById(state, damagerId)!)} เลือกรับความเสียหาย 1 หน่วย (ย้อนรอยศัตรู)`,
    damagerId,
    victimId,
  );
  applyDamage(state, damagerId, 1, victimId);
  synchronizeGameState(state);
}
/** ไต้เกี้ยว ระเหเร่ร่อน: while you are the Attack target, discard a card to redirect it to another general within YOUR attack range (not the attacker). */
export function redirectAttack(
  state: GameState,
  redirectorId: string,
  cardInstanceId: string,
  newTargetId: string,
) {
  const window = state.responseWindow,
    action = state.currentAction,
    pending = state.pendingAction;
  if (
    !window ||
    !action ||
    !pending ||
    window.type !== "attack_dodge" ||
    window.currentResponderId !== redirectorId
  )
    throw new Error("ใช้ระเหเร่ร่อนได้เฉพาะตอนตกเป็นเป้าหมายโจมตี");
  if (!hasCharacterSkill(state, redirectorId, "redirect_attack"))
    throw new Error("ไม่มีทักษะระเหเร่ร่อน");
  const redirector = getPlayerById(state, redirectorId);
  if (!redirector) throw new Error("Unknown player");
  const card = findHandCard(redirector, cardInstanceId);
  if (!card) throw new Error("ไพ่ที่เลือกไม่อยู่ในมือ");
  if (newTargetId === action.actorId)
    throw new Error("เลือกผู้โจมตีเป็นเป้าหมายใหม่ไม่ได้");
  if (newTargetId === redirectorId) throw new Error("เลือกตัวเองไม่ได้");
  const newTarget = getPlayerById(state, newTargetId);
  if (!newTarget || !newTarget.alive) throw new Error("เป้าหมายไม่ถูกต้อง");
  if (!canTargetWithAttack(state, redirectorId, newTargetId))
    throw new Error("เป้าหมายต้องอยู่ในระยะโจมตีของคุณ");
  redirector.hand = redirector.hand.filter((c) => c !== card);
  moveToDiscard(state, card, false);
  action.targetIds = [newTargetId];
  pending.targetId = newTargetId;
  pending.noDodge = false;
  window.requiredPlayerIds = [newTargetId];
  window.currentResponderId = newTargetId;
  window.responses = [];
  window.allowedResponseEffectKeys = ["dodge"];
  logAction(
    state,
    "skill-redirect",
    `${characterName(redirector)} ใช้ ระเหเร่ร่อน เปลี่ยนเป้าหมายโจมตีไปยัง ${characterName(newTarget)}`,
    redirectorId,
    newTargetId,
    card.id,
  );
  synchronizeGameState(state);
}
/** ฮัวโต๋ ยาสวรรค์: once per turn, discard 1 card to restore 1 HP to any wounded (non-dying) general, self included. */
export function useMiracleMedicine(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
  targetId: string,
) {
  if (!canPlayerAct(state, playerId))
    throw new Error("ใช้ทักษะได้เฉพาะช่วงเล่นไพ่ของคุณ");
  if (!hasCharacterSkill(state, playerId, "miracle_medicine"))
    throw new Error("ไม่มีทักษะยาสวรรค์");
  if (state.skillsUsedThisTurn?.includes("miracle_medicine"))
    throw new Error("ใช้ยาสวรรค์ได้ 1 ครั้งต่อรอบ");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  const card = findHandCard(player, cardInstanceId);
  if (!card) throw new Error("ไพ่ที่เลือกไม่อยู่ในมือ");
  const target = getPlayerById(state, targetId);
  if (
    !target ||
    !target.alive ||
    target.hp === undefined ||
    target.maxHp === undefined
  )
    throw new Error("เลือกขุนพลที่ยังมีชีวิต");
  if (target.hp >= target.maxHp) throw new Error("เป้าหมายพลังชีวิตเต็มแล้ว");
  player.hand = player.hand.filter((c) => c !== card);
  moveToDiscard(state, card, false);
  markSkillUsed(state, "miracle_medicine");
  healPlayer(state, targetId, 1);
  logAction(
    state,
    "skill-miracle",
    `${characterName(player)} ใช้ ยาสวรรค์ ทิ้งไพ่ 1 ใบ ฟื้นฟู 1 HP ให้ ${characterName(target)}`,
    playerId,
    targetId,
    card.id,
  );
  synchronizeGameState(state);
}
/** ซุนซ่างเซียง แผนแต่งงาน: once per turn, discard 2 cards to heal a wounded male general and herself 1 HP each. */
export function useMarriage(
  state: GameState,
  playerId: string,
  cardInstanceIds: string[],
  targetId: string,
) {
  if (!canPlayerAct(state, playerId))
    throw new Error("ใช้ทักษะได้เฉพาะช่วงเล่นไพ่ของคุณ");
  if (!hasCharacterSkill(state, playerId, "marriage_heal"))
    throw new Error("ไม่มีทักษะแผนแต่งงาน");
  if (state.skillsUsedThisTurn?.includes("marriage_heal"))
    throw new Error("ใช้แผนแต่งงานได้ 1 ครั้งต่อรอบ");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  const ids = [...new Set(cardInstanceIds)];
  if (ids.length !== 2) throw new Error("ต้องทิ้งไพ่ 2 ใบที่ไม่ซ้ำกัน");
  const cards = ids.map((id) => findHandCard(player, id));
  if (cards.some((c) => !c)) throw new Error("ไพ่ที่เลือกไม่อยู่ในมือ");
  const target = getPlayerById(state, targetId);
  if (
    !target ||
    !target.alive ||
    target.hp === undefined ||
    target.maxHp === undefined
  )
    throw new Error("เลือกขุนพลที่ยังมีชีวิต");
  if (target.character?.gender !== "ชาย")
    throw new Error("เลือกได้เฉพาะขุนพลชาย");
  if (target.hp >= target.maxHp) throw new Error("เป้าหมายพลังชีวิตเต็มแล้ว");
  for (const card of cards as Card[]) {
    player.hand = player.hand.filter((c) => c !== card);
    moveToDiscard(state, card, false);
  }
  markSkillUsed(state, "marriage_heal");
  healPlayer(state, targetId, 1);
  healPlayer(state, playerId, 1);
  logAction(
    state,
    "skill-marriage",
    `${characterName(player)} ใช้ แผนแต่งงาน ทิ้งไพ่ 2 ใบ ฟื้นฟู 1 HP ให้ ${characterName(target)} และตนเอง`,
    playerId,
    targetId,
  );
  synchronizeGameState(state);
}
/** เตียวเลี้ยว จู่โจมฉับพลัน: in your draw phase, instead of drawing, take one hand card from each of up to 2 other players. */
export function useRaid(
  state: GameState,
  playerId: string,
  targetIds: string[],
) {
  if (state.responseWindow) throw new Error("ต้องแก้ไขสถานะที่ค้างอยู่ก่อน");
  if (state.turn.activePlayerId !== playerId || state.turn.phase !== "draw")
    throw new Error("ใช้ได้เฉพาะช่วงจั่วไพ่ของคุณ");
  if (!hasCharacterSkill(state, playerId, "raid_draw_phase"))
    throw new Error("ไม่มีทักษะจู่โจมฉับพลัน");
  if ((state.turn.drawnThisTurn || 0) > 0)
    throw new Error("ต้องใช้ก่อนเริ่มจั่วไพ่");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  const ids = [...new Set(targetIds)];
  if (ids.length !== targetIds.length) throw new Error("เป้าหมายต้องไม่ซ้ำกัน");
  if (ids.length < 1 || ids.length > 2) throw new Error("เลือกเป้าหมาย 1–2 คน");
  if (ids.includes(playerId)) throw new Error("เลือกตัวเองไม่ได้");
  const targets = ids.map((id) => getPlayerById(state, id));
  if (targets.some((t) => !t || !t.alive))
    throw new Error("เป้าหมายต้องยังมีชีวิต");
  if (targets.some((t) => t!.hand.length === 0))
    throw new Error("เป้าหมายต้องมีไพ่บนมือ");
  for (const t of targets as Player[]) {
    const idx = Math.floor(Math.random() * t.hand.length);
    const [card] = t.hand.splice(idx, 1);
    player.hand.push(card!);
    logAction(
      state,
      "skill-raid",
      `${characterName(player)} ใช้ จู่โจมฉับพลัน หยิบไพ่ 1 ใบจาก ${characterName(t)}`,
      player.id,
      t.id,
    );
  }
  state.hasDrawnThisTurn = true;
  state.turn.drawnThisTurn =
    2 + (hasCharacterSkill(state, playerId, "draw_phase_plus_one") ? 1 : 0);
  if (state.skipPlayPhase) {
    state.turn.phase = "discard";
    state.skipPlayPhase = false;
    logAction(
      state,
      "play-phase-skipped",
      `${characterName(player)} ถูกข้ามช่วงเล่นไพ่`,
      player.id,
    );
  } else state.turn.phase = "play";
  synchronizeGameState(state);
}
/** เคาทู ฆ่าเสือมือเปล่า: in your draw phase, draw only 1 card to gain +1 Attack/Duel damage for the rest of the turn. */
export function useUnarmedHunt(state: GameState, playerId: string) {
  if (state.responseWindow) throw new Error("ต้องแก้ไขสถานะที่ค้างอยู่ก่อน");
  if (state.turn.activePlayerId !== playerId || state.turn.phase !== "draw")
    throw new Error("ใช้ได้เฉพาะช่วงจั่วไพ่ของคุณ");
  if (!hasCharacterSkill(state, playerId, "unarmed_tiger"))
    throw new Error("ไม่มีทักษะฆ่าเสือมือเปล่า");
  if ((state.turn.drawnThisTurn || 0) > 0)
    throw new Error("ต้องใช้ก่อนเริ่มจั่วไพ่");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  if (!state.deck.length) reshuffleDiscardIntoDrawPile(state);
  const card = state.deck.pop();
  if (card) {
    player.hand.push(card);
    logAction(
      state,
      "skill-unarmed-hunt",
      `${characterName(player)} ใช้ ฆ่าเสือมือเปล่า จั่วไพ่ 1 ใบ (พลังโจมตี +1 ในรอบนี้)`,
      player.id,
    );
  }
  state.unarmedPowerActive = true;
  state.hasDrawnThisTurn = true;
  state.turn.drawnThisTurn =
    2 + (hasCharacterSkill(state, playerId, "draw_phase_plus_one") ? 1 : 0);
  if (state.skipPlayPhase) {
    state.turn.phase = "discard";
    state.skipPlayPhase = false;
    logAction(
      state,
      "play-phase-skipped",
      `${characterName(player)} ถูกข้ามช่วงเล่นไพ่`,
      player.id,
    );
  } else state.turn.phase = "play";
  synchronizeGameState(state);
}
/** อ้วนสุด จองหอง: ระหว่างขั้นเตรียมของจักรพรรดิ ผู้ถือทักษะเลือกจั่วเพิ่ม 1 ใบ
 *  แลกกับขีดจำกัดไพ่บนมือของจักรพรรดิ −1 ในรอบนั้น (ตัดสินใจแยกจากเจ้าของเทิร์น) */
export function resolveArrogance(
  state: GameState,
  playerId: string,
  use: boolean,
) {
  const pending = state.pendingArrogance;
  if (!pending || pending.playerId !== playerId)
    throw new Error("ไม่มีจังหวะจองหองที่ค้างอยู่");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  state.pendingArrogance = undefined;
  if (!use) {
    logAction(
      state,
      "skill-arrogance-declined",
      `${characterName(player)} ไม่ใช้ จองหอง`,
      playerId,
    );
    synchronizeGameState(state);
    return;
  }
  if (!state.deck.length) reshuffleDiscardIntoDrawPile(state);
  const card = state.deck.pop();
  if (card) {
    player.hand.push(card);
    logAction(
      state,
      "skill-arrogance",
      `${characterName(player)} ใช้ จองหอง จั่วเพิ่ม 1 ใบ (ขีดจำกัดไพ่บนมือของจักรพรรดิ -1 ในรอบนี้)`,
      playerId,
      undefined,
      card.id,
    );
  }
  state.arrogancePenalty = true;
  synchronizeGameState(state);
}
/** จิวยี่ บาดหมาง: once per turn, choose a general who must guess a suit; a random card is drawn from จิวยี่'s hand to them, and on a suit mismatch they lose 1 HP. */
export function useDischord(
  state: GameState,
  playerId: string,
  targetId: string,
) {
  if (!canPlayerAct(state, playerId))
    throw new Error("ใช้ทักษะได้เฉพาะช่วงเล่นไพ่ของคุณ");
  if (!hasCharacterSkill(state, playerId, "dischord"))
    throw new Error("ไม่มีทักษะบาดหมาง");
  if (state.skillsUsedThisTurn?.includes("dischord"))
    throw new Error("ใช้บาดหมางได้ 1 ครั้งต่อรอบ");
  const player = getPlayerById(state, playerId),
    target = getPlayerById(state, targetId);
  if (!player || !target || !target.alive)
    throw new Error("เลือกขุนพลที่ยังมีชีวิต");
  if (targetId === playerId) throw new Error("เลือกตัวเองไม่ได้");
  if (player.hand.length === 0) throw new Error("ต้องมีไพ่บนมืออย่างน้อย 1 ใบ");
  markSkillUsed(state, "dischord");
  state.pendingDischord = { jiuyiId: playerId, targetId };
  logAction(
    state,
    "skill-dischord",
    `${characterName(player)} ใช้ บาดหมาง กับ ${characterName(target)} — ให้เลือก 1 ดอกไพ่`,
    playerId,
    targetId,
  );
  synchronizeGameState(state);
}
/** The chosen general guesses a suit; resolve the random hand-card transfer and any HP loss. */
export function pickDischordSuit(
  state: GameState,
  targetId: string,
  suit: string,
) {
  const pending = state.pendingDischord;
  if (!pending || pending.targetId !== targetId)
    throw new Error("ไม่มีบาดหมางที่ค้างอยู่");
  if (!["♠", "♥", "♦", "♣"].includes(suit))
    throw new Error("เลือกดอกไพ่ไม่ถูกต้อง");
  const jiuyi = getPlayerById(state, pending.jiuyiId),
    target = getPlayerById(state, targetId);
  if (!jiuyi || !target) {
    state.pendingDischord = undefined;
    return synchronizeGameState(state);
  }
  state.pendingDischord = undefined;
  if (jiuyi.hand.length === 0) {
    logAction(
      state,
      "skill-dischord-empty",
      `${characterName(jiuyi)} ไม่มีไพ่ให้หยิบ`,
      jiuyi.id,
      targetId,
    );
    return synchronizeGameState(state);
  }
  const idx = Math.floor(Math.random() * jiuyi.hand.length),
    [card] = jiuyi.hand.splice(idx, 1);
  target.hand.push(card!);
  const matched = card!.suit === suit;
  logAction(
    state,
    "skill-dischord-reveal",
    `${characterName(target)} เลือก ${suit} — หยิบได้ ${card!.name} (${card!.suit}) ${matched ? "ตรงดอก" : "ไม่ตรงดอก"}`,
    jiuyi.id,
    targetId,
    card!.id,
  );
  if (!matched) applyDamage(state, targetId, 1, jiuyi.id);
  synchronizeGameState(state);
}
// ── Emperor "ask an ally to respond for you" skills (เล่าปี่ คุณธรรมนำประชา / โจโฉ ปกป้องราชันย์) ──
/** เล่าปี่ คุณธรรมนำประชา: emperor asks a SHU ally to play an Attack (counted as เล่าปี่'s) against a target in เล่าปี่'s range. */
export function requestUnityAttack(
  state: GameState,
  emperorId: string,
  targetId: string,
  allyId: string,
) {
  if (!canPlayerAct(state, emperorId))
    throw new Error("ใช้ทักษะได้เฉพาะช่วงเล่นไพ่ของคุณ");
  const emperor = getPlayerById(state, emperorId);
  if (!emperor || emperor.role !== "emperor")
    throw new Error("ใช้ได้เฉพาะจักรพรรดิ");
  if (!hasCharacterSkill(state, emperorId, "ask_shu_attack"))
    throw new Error("ไม่มีทักษะคุณธรรมนำประชา");
  if (
    state.turn.attackUsedThisTurn >= 1 &&
    !hasUnlimitedAttack(state, emperorId)
  )
    throw new Error("ใช้โจมตีได้ครั้งเดียวต่อรอบ");
  if (!canTargetWithAttack(state, emperorId, targetId))
    throw new Error("เป้าหมายไม่อยู่ในระยะโจมตีของคุณ");
  const ally = getPlayerById(state, allyId);
  if (!ally || !ally.alive || allyId === emperorId)
    throw new Error("เลือกพันธมิตรที่ยังมีชีวิต");
  if (ally.character?.kingdom !== "SHU")
    throw new Error("เลือกได้เฉพาะขุนพลจ๊กก๊ก");
  if (!ally.hand.some((c) => c.effect === "attack"))
    throw new Error("พันธมิตรไม่มีการ์ดโจมตี");
  state.pendingAllyAssist = { emperorId, allyId, kind: "attack", targetId };
  logAction(
    state,
    "skill-unity",
    `${characterName(emperor)} ใช้ คุณธรรมนำประชา ขอให้ ${characterName(ally)} โจมตี ${characterName(getPlayerById(state, targetId)!)} แทน`,
    emperorId,
    allyId,
  );
  synchronizeGameState(state);
}
/** โจโฉ ปกป้องราชันย์: emperor asks a WEI ally to play a Dodge (counted as โจโฉ's) while โจโฉ is the attack target. */
export function requestGuardianDodge(
  state: GameState,
  emperorId: string,
  allyId: string,
) {
  const window = state.responseWindow;
  if (
    !window ||
    window.type !== "attack_dodge" ||
    window.currentResponderId !== emperorId
  )
    throw new Error("ใช้ได้เฉพาะตอนที่คุณตกเป็นเป้าหมายโจมตี");
  const emperor = getPlayerById(state, emperorId);
  if (!emperor || emperor.role !== "emperor")
    throw new Error("ใช้ได้เฉพาะจักรพรรดิ");
  if (!hasCharacterSkill(state, emperorId, "ask_wei_dodge"))
    throw new Error("ไม่มีทักษะปกป้องราชันย์");
  const ally = getPlayerById(state, allyId);
  if (!ally || !ally.alive || allyId === emperorId)
    throw new Error("เลือกพันธมิตรที่ยังมีชีวิต");
  if (ally.character?.kingdom !== "WEI")
    throw new Error("เลือกได้เฉพาะขุนพลวุยก๊ก");
  if (!ally.hand.some((c) => c.effect === "dodge"))
    throw new Error("พันธมิตรไม่มีการ์ดหลบ");
  state.pendingAllyAssist = { emperorId, allyId, kind: "dodge" };
  logAction(
    state,
    "skill-guardian",
    `${characterName(emperor)} ใช้ ปกป้องราชันย์ ขอให้ ${characterName(ally)} หลบแทน`,
    emperorId,
    allyId,
  );
  synchronizeGameState(state);
}
/** The asked ally plays the card on the emperor's behalf: it is moved to the emperor and played as the emperor's own Attack/Dodge. */
export function allyAssist(
  state: GameState,
  allyId: string,
  cardInstanceId: string,
) {
  const pending = state.pendingAllyAssist;
  if (!pending || pending.allyId !== allyId)
    throw new Error("ไม่มีคำขอช่วยเหลือที่ค้างอยู่");
  const ally = getPlayerById(state, allyId),
    emperor = getPlayerById(state, pending.emperorId);
  if (!ally || !emperor) throw new Error("ผู้เล่นหาย");
  const card = findHandCard(ally, cardInstanceId);
  if (!card) throw new Error("ไพ่ที่เลือกไม่อยู่ในมือ");
  const need = pending.kind;
  if (card.effect !== need)
    throw new Error(need === "attack" ? "ต้องใช้ไพ่โจมตี" : "ต้องใช้ไพ่หลบ");
  ally.hand = ally.hand.filter((c) => c !== card);
  emperor.hand.push(card);
  state.pendingAllyAssist = undefined;
  logAction(
    state,
    "skill-ally-assist",
    `${characterName(ally)} ช่วย ${characterName(emperor)} ด้วย ${card.name}`,
    allyId,
    emperor.id,
    card.id,
  );
  if (need === "attack")
    playAttack(state, pending.emperorId, pending.targetId!, card.id);
  else playDodge(state, pending.emperorId, card.id);
}
export function declineAllyAssist(state: GameState, allyId: string) {
  const pending = state.pendingAllyAssist;
  if (!pending || pending.allyId !== allyId)
    throw new Error("ไม่มีคำขอช่วยเหลือที่ค้างอยู่");
  state.pendingAllyAssist = undefined;
  logAction(
    state,
    "skill-ally-declined",
    `${characterName(getPlayerById(state, allyId)!)} ปฏิเสธคำขอช่วยเหลือ`,
    allyId,
  );
  synchronizeGameState(state);
}
/** เตียวเสี้ยน สาวงามยุยง: once per turn, discard a card to force two male generals to duel each other (you pick who attacks first). */
export function useIncite(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
  firstAttackerId: string,
  secondPlayerId: string,
) {
  if (!canPlayerAct(state, playerId))
    throw new Error("ใช้ทักษะได้เฉพาะช่วงเล่นไพ่ของคุณ");
  if (!hasCharacterSkill(state, playerId, "incite_duel"))
    throw new Error("ไม่มีทักษะสาวงามยุยง");
  if (state.skillsUsedThisTurn?.includes("incite"))
    throw new Error("ใช้สาวงามยุยงได้ 1 ครั้งต่อรอบ");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  const card = findHandCard(player, cardInstanceId);
  if (!card) throw new Error("ไพ่ที่เลือกไม่อยู่ในมือ");
  const first = getPlayerById(state, firstAttackerId),
    second = getPlayerById(state, secondPlayerId);
  if (!first || !second || !first.alive || !second.alive)
    throw new Error("เลือกขุนพลที่ยังมีชีวิต");
  if (firstAttackerId === secondPlayerId)
    throw new Error("ต้องเลือกขุนพล 2 คนที่ต่างกัน");
  if (firstAttackerId === playerId || secondPlayerId === playerId)
    throw new Error("เลือกตัวเองไม่ได้");
  if (first.character?.gender !== "ชาย" || second.character?.gender !== "ชาย")
    throw new Error("เลือกได้เฉพาะขุนพลชาย");
  player.hand = player.hand.filter((c) => c !== card);
  moveToDiscard(state, card, true);
  markSkillUsed(state, "incite"); // ตั้งเป็น lastPlayedCard เพื่อโชว์กลางโต๊ะ และเป็น "ไพ่ต้นเหตุ" ของการท้าสู้ (โจโฉ ไม่ยอมให้โลกทรยศ)
  const actionId = crypto.randomUUID();
  state.currentAction = {
    actionId,
    actorId: secondPlayerId,
    card: toCardInstance(card),
    effectKey: "duel_attack_response",
    targetIds: [firstAttackerId],
    status: "declared",
    createdAt: new Date().toISOString(),
  };
  state.responseWindow = {
    windowId: crypto.randomUUID(),
    type: "duel_attack",
    sourceActionId: actionId,
    requiredPlayerIds: [firstAttackerId, secondPlayerId],
    currentResponderId: firstAttackerId,
    allowedResponseEffectKeys: ["attack"],
    responses: [],
    status: "open",
    createdAt: new Date().toISOString(),
  };
  logAction(
    state,
    "skill-incite",
    `${characterName(player)} ใช้ สาวงามยุยง ให้ ${characterName(first)} และ ${characterName(second)} ท้าสู้กัน (${characterName(first)} โจมตีก่อน)`,
    playerId,
  );
  synchronizeGameState(state);
}
/** จูกัดเหลียง หยั่งรู้ฟ้าดิน: peek the top X cards (X = alive count, max 5) to reorder onto the top and/or bottom of the draw pile. */
export function usePeek(state: GameState, playerId: string) {
  if (state.responseWindow || state.pendingPeek)
    throw new Error("ต้องแก้ไขสถานะที่ค้างอยู่ก่อน");
  if (state.turn.activePlayerId !== playerId || state.turn.phase !== "draw")
    throw new Error("ใช้ได้เฉพาะช่วงเตรียมการของคุณ (ก่อนจั่วไพ่)");
  if ((state.turn.drawnThisTurn || 0) > 0)
    throw new Error("ต้องใช้ก่อนเริ่มจั่วไพ่");
  if (!hasCharacterSkill(state, playerId, "peek_reorder_deck"))
    throw new Error("ไม่มีทักษะหยั่งรู้ฟ้าดิน");
  if (state.skillsUsedThisTurn?.includes("peek"))
    throw new Error("ใช้หยั่งรู้ฟ้าดินได้ 1 ครั้งต่อรอบ");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  const x = Math.min(getAlivePlayers(state).length, 5);
  if (state.deck.length < x) reshuffleDiscardIntoDrawPile(state);
  const take = Math.min(x, state.deck.length);
  if (take === 0) throw new Error("กองจั่วไม่มีไพ่");
  const peeked = state.deck.splice(state.deck.length - take, take).reverse(); // peeked[0] = current topmost
  state.pendingPeek = { playerId, cards: peeked };
  markSkillUsed(state, "peek");
  logAction(
    state,
    "skill-peek",
    `${characterName(player)} ใช้ หยั่งรู้ฟ้าดิน เปิดดูไพ่บนสุด ${take} ใบ`,
    playerId,
  );
  synchronizeGameState(state);
}
/** Places the peeked cards back: topIds on top (topIds[0] drawn first), bottomIds at the bottom. */
export function resolvePeek(
  state: GameState,
  playerId: string,
  topIds: string[],
  bottomIds: string[],
) {
  const pending = state.pendingPeek;
  if (!pending || pending.playerId !== playerId)
    throw new Error("ไม่มีหยั่งรู้ฟ้าดินที่ค้างอยู่");
  const all = pending.cards,
    allIds = all.map((c) => c.id),
    chosen = [...topIds, ...bottomIds];
  if (
    chosen.length !== all.length ||
    new Set(chosen).size !== all.length ||
    chosen.some((id) => !allIds.includes(id))
  )
    throw new Error("ต้องจัดเรียงไพ่ให้ครบทุกใบ");
  const byId = (id: string) => all.find((c) => c.id === id)!;
  for (let i = bottomIds.length - 1; i >= 0; i--)
    state.deck.unshift(byId(bottomIds[i])); // bottom of pile
  for (let i = topIds.length - 1; i >= 0; i--) state.deck.push(byId(topIds[i])); // topIds[0] ends up on top (pop)
  state.pendingPeek = undefined;
  logAction(
    state,
    "skill-peek-resolve",
    `${characterName(getPlayerById(state, playerId)!)} จัดเรียงกองจั่วใหม่ (บน ${topIds.length} / ล่าง ${bottomIds.length})`,
    playerId,
  );
  synchronizeGameState(state);
}
/** เอียนสี พึ่งวาสนา: in your prep/draw phase, reveal the top card; keep it if black, and you may repeat until you reveal a red one. */
export function useFortune(state: GameState, playerId: string) {
  if (state.responseWindow) throw new Error("ต้องแก้ไขสถานะที่ค้างอยู่ก่อน");
  // ช่วงเตรียมการ = ก่อนตัดสิน (judgment) และก่อนจั่ว (draw) — พึ่งวาสนาใช้ได้ก่อนเปิดไพ่ตัดสิน (เช่น ฟ้าลงโทษ)
  if (
    state.turn.activePlayerId !== playerId ||
    (state.turn.phase !== "draw" && state.turn.phase !== "judgment")
  )
    throw new Error("ใช้ได้เฉพาะช่วงเตรียมการของคุณ (ก่อนตัดสิน/ก่อนจั่วไพ่)");
  if ((state.turn.drawnThisTurn || 0) > 0)
    throw new Error("ต้องใช้ก่อนเริ่มจั่วไพ่");
  if (!hasCharacterSkill(state, playerId, "fortune_judgment"))
    throw new Error("ไม่มีทักษะพึ่งวาสนา");
  if (state.skillsUsedThisTurn?.includes("fortune_done"))
    throw new Error("พึ่งวาสนาจบลงแล้วในรอบนี้ (เปิดได้ดอกสีแดง)");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  if (!state.deck.length) reshuffleDiscardIntoDrawPile(state);
  const card = state.deck.pop();
  if (!card) throw new Error("กองจั่วไม่มีไพ่");
  if (["♠", "♣"].includes(card.suit)) {
    player.hand.push(card);
    logAction(
      state,
      "skill-fortune",
      `${characterName(player)} ใช้ พึ่งวาสนา เปิด ${card.name} (${card.number}${card.suit}) ดอกดำ — เก็บเข้ามือ`,
      playerId,
      undefined,
      card.id,
    );
  } else {
    moveToDiscard(state, card, false);
    markSkillUsed(state, "fortune_done");
    logAction(
      state,
      "skill-fortune-end",
      `${characterName(player)} ใช้ พึ่งวาสนา เปิด ${card.name} (${card.number}${card.suit}) ดอกแดง — จบการใช้ทักษะ`,
      playerId,
      undefined,
      card.id,
    );
  }
  flashTable(
    state,
    "🔮",
    "พึ่งวาสนา",
    `${player.username} เปิดได้ ${["♠", "♣"].includes(card.suit) ? "ดอกดำ — เก็บเข้ามือ" : "ดอกแดง — จบ"}`,
    card,
  );
  synchronizeGameState(state);
}
/** เล่าปี่ เมตตาธรรม: give hand cards to another general; once you have given 2+ cards this turn, heal yourself 1 HP (max once/turn). */
export function useBenevolence(
  state: GameState,
  playerId: string,
  cardInstanceIds: string[],
  recipientId: string,
) {
  if (!canPlayerAct(state, playerId))
    throw new Error("ใช้ทักษะได้เฉพาะช่วงเล่นไพ่ของคุณ");
  if (!hasCharacterSkill(state, playerId, "benevolence_give"))
    throw new Error("ไม่มีทักษะเมตตาธรรม");
  const player = getPlayerById(state, playerId),
    recipient = getPlayerById(state, recipientId);
  if (!player || !recipient || !recipient.alive)
    throw new Error("เลือกขุนพลอื่นที่ยังมีชีวิต");
  if (recipientId === playerId) throw new Error("มอบให้ตัวเองไม่ได้");
  const ids = [...new Set(cardInstanceIds)];
  if (ids.length !== cardInstanceIds.length)
    throw new Error("ไพ่ต้องไม่ซ้ำกัน");
  if (!ids.length) throw new Error("เลือกไพ่อย่างน้อย 1 ใบ");
  const cards = ids.map((id) => findHandCard(player, id));
  if (cards.some((c) => !c)) throw new Error("ไพ่ที่เลือกไม่อยู่ในมือ");
  for (const card of cards as Card[]) {
    player.hand = player.hand.filter((c) => c !== card);
    recipient.hand.push(card);
  }
  state.benevolenceGivenThisTurn =
    (state.benevolenceGivenThisTurn || 0) + cards.length;
  logAction(
    state,
    "skill-benevolence",
    `${characterName(player)} ใช้ เมตตาธรรม มอบไพ่ ${cards.length} ใบให้ ${characterName(recipient)}`,
    playerId,
    recipientId,
  );
  if (
    state.benevolenceGivenThisTurn >= 2 &&
    !state.skillsUsedThisTurn?.includes("benevolence_healed") &&
    player.hp !== undefined &&
    player.maxHp !== undefined &&
    player.hp < player.maxHp
  ) {
    markSkillUsed(state, "benevolence_healed");
    healPlayer(state, playerId, 1);
    logAction(
      state,
      "skill-benevolence-heal",
      `${characterName(player)} มอบไพ่ 2 ใบขึ้นไป จึงฟื้นฟู 1 HP`,
      playerId,
    );
  }
  synchronizeGameState(state);
}
