// Trick-card handlers: instant/targeted/delayed/mass tricks, harvest, coerce, and the negate pipeline. Extracted verbatim from index.ts.
import type {
  Card,
  CurrentAction,
  GameState,
  TargetCardSelection,
} from "../types.js";
import {
  characterName,
  findHandCard,
  flashTable,
  getAlivePlayers,
  getAlivePlayersInSeatOrder,
  getPlayerById,
  grantDraws,
  logAction,
  moveToDiscard,
  numberParam,
  resolveHiddenHandCard,
  toCardInstance,
  validateHiddenHandIndex,
  type RuntimeEquipmentSlot,
} from "../state.js";
import {
  reshuffleDiscardIntoDrawPile,
  synchronizeGameState,
} from "../sync.js";
import {
  canPlayerAct,
  createTargetedCardAction,
  resolveTargetedCardAction,
} from "../actions.js";
import {
  attackDodgesRequired,
  cardActsAs,
  hasCharacterSkill,
} from "../skills.js";
import { canTargetWithAttack } from "../targeting.js";
import { applyDamage } from "./combat.js";
import { publicCardView } from "../view.js";
function massQueue(state: GameState, actorId: string) {
  const alive = getAlivePlayersInSeatOrder(state),
    index = alive.findIndex((player) => player.id === actorId);
  return index < 0
    ? []
    : [...alive.slice(index + 1), ...alive.slice(0, index)].map(
        (player) => player.id,
      );
}
function playMassTrick(
  state: GameState,
  actorId: string,
  cardInstanceId: string,
  effect: "all_others_dodge_or_damage" | "all_others_attack_or_damage",
) {
  const prepared = createTargetedCardAction(
    state,
    actorId,
    cardInstanceId,
    [],
    { minTargets: 0, maxTargets: 0, allowSelf: false },
    effect,
  );
  if (prepared.card.effect !== effect)
    throw new Error("Mass trick card is not in your hand");
  const queue = massQueue(state, actorId),
    type =
      effect === "all_others_dodge_or_damage" ? "mass_dodge" : "mass_attack",
    required = type === "mass_dodge" ? "dodge" : "attack";
  state.responseWindow = {
    windowId: crypto.randomUUID(),
    type,
    sourceActionId: prepared.action.actionId,
    requiredPlayerIds: queue,
    currentResponderId: queue[0] || null,
    allowedResponseEffectKeys: [required],
    responses: [],
    status: "open",
    createdAt: new Date().toISOString(),
    responderQueue: queue,
  };
  logAction(
    state,
    "mass-trick-played",
    `${characterName(prepared.actor)} ใช้ ${prepared.card.name}`,
    actorId,
  );
  if (!queue.length) advanceMassResponseQueue(state);
  synchronizeGameState(state);
}
export const playMassDodgeOrDamage = (
  state: GameState,
  actorId: string,
  cardInstanceId: string,
) =>
  playMassTrick(state, actorId, cardInstanceId, "all_others_dodge_or_damage");
export const playMassAttackOrDamage = (
  state: GameState,
  actorId: string,
  cardInstanceId: string,
) =>
  playMassTrick(state, actorId, cardInstanceId, "all_others_attack_or_damage");
/** Borrowed Knife: coerce a weapon-holding player to Attack a legal victim; if they refuse or cannot, the actor takes their weapon. */
export function playCoerceAttack(
  state: GameState,
  actorId: string,
  cardInstanceId: string,
  weaponHolderId: string,
  victimId: string,
) {
  if (!canPlayerAct(state, actorId))
    throw new Error("เล่นการ์ดได้เฉพาะช่วงเล่นไพ่ของคุณ");
  const actor = getPlayerById(state, actorId);
  if (!actor) throw new Error("Unknown player");
  const card = findHandCard(actor, cardInstanceId);
  if (!card || card.effect !== "coerce_attack_or_take_weapon")
    throw new Error("ไม่ใช่การ์ดยืมมือสังหาร");
  const holder = getPlayerById(state, weaponHolderId),
    victim = getPlayerById(state, victimId);
  if (!holder || !holder.alive || holder.id === actorId)
    throw new Error("เลือกขุนพลอื่นที่มีอาวุธ");
  if (!holder.equipment.weapon)
    throw new Error("เป้าหมายต้องมีอาวุธติดตั้งอยู่");
  if (!victim || !victim.alive || victim.id === holder.id)
    throw new Error("เลือกเหยื่อที่ถูกต้อง");
  if (!canTargetWithAttack(state, holder.id, victim.id))
    throw new Error("เหยื่ออยู่นอกระยะโจมตีของเป้าหมาย");
  actor.hand = actor.hand.filter((item) => item !== card);
  state.lastPlayedCard = card;
  state.currentAction = {
    actionId: crypto.randomUUID(),
    actorId,
    card: toCardInstance(card),
    effectKey: "coerce_attack_or_take_weapon",
    targetIds: [weaponHolderId, victimId],
    status: "declared",
    createdAt: new Date().toISOString(),
  };
  state.pendingTrickResolution = {
    effectKey: "coerce",
    weaponHolderId,
    victimId,
  };
  logAction(
    state,
    "trick-declared",
    `${characterName(actor)} ประกาศใช้ ${card.name} บังคับ ${characterName(holder)} ให้โจมตี ${characterName(victim)}`,
    actor.id,
    holder.id,
    card.id,
  );
  openNegateWindowForTrick(state, actorId);
}
export function resolveCoerceWithAttack(
  state: GameState,
  weaponHolderId: string,
  attackCardInstanceId: string,
) {
  const pending = state.pendingCoerce,
    window = state.responseWindow;
  if (
    !pending ||
    !window ||
    window.type !== "coerce_attack" ||
    window.currentResponderId !== weaponHolderId ||
    pending.weaponHolderId !== weaponHolderId
  )
    throw new Error("ไม่มีการบังคับโจมตีที่ค้างอยู่");
  const holder = getPlayerById(state, weaponHolderId),
    victim = getPlayerById(state, pending.victimId);
  if (!holder || !victim || !victim.alive) throw new Error("เป้าหมายไม่พร้อม");
  const card = findHandCard(holder, attackCardInstanceId);
  if (!card || card.effect !== "attack") throw new Error("เลือกไพ่โจมตี");
  holder.hand = holder.hand.filter((item) => item !== card);
  state.lastPlayedCard = card;
  const actionId = crypto.randomUUID();
  state.currentAction = {
    actionId,
    actorId: holder.id,
    card: toCardInstance(card),
    effectKey: "attack",
    targetIds: [victim.id],
    status: "declared",
    createdAt: new Date().toISOString(),
  };
  state.responseWindow = {
    windowId: crypto.randomUUID(),
    type: "attack_dodge",
    sourceActionId: actionId,
    requiredPlayerIds: [victim.id],
    currentResponderId: victim.id,
    allowedResponseEffectKeys: ["dodge"],
    responses: [],
    status: "open",
    createdAt: new Date().toISOString(),
  };
  state.pendingAction = {
    id: actionId,
    kind: "attack",
    actorId: holder.id,
    targetId: victim.id,
    cardId: card.id,
    responseKey: "dodge",
    damage: numberParam(card, "damage", 1),
    dodgesRequired: attackDodgesRequired(state, holder.id),
  };
  state.pendingCoerce = undefined;
  logAction(
    state,
    "coerce-attack",
    `${characterName(holder)} ถูกบังคับใช้โจมตีใส่ ${characterName(victim)}`,
    holder.id,
    victim.id,
    card.id,
  );
  synchronizeGameState(state);
}
export function declineCoerce(state: GameState, weaponHolderId: string) {
  const pending = state.pendingCoerce,
    window = state.responseWindow;
  if (
    !pending ||
    !window ||
    window.type !== "coerce_attack" ||
    window.currentResponderId !== weaponHolderId ||
    pending.weaponHolderId !== weaponHolderId
  )
    throw new Error("ไม่มีการบังคับโจมตีที่ค้างอยู่");
  const holder = getPlayerById(state, weaponHolderId),
    actor = getPlayerById(state, pending.actorId);
  if (!holder || !actor) throw new Error("ผู้เล่นหาย");
  const weapon = holder.equipment.weapon;
  if (weapon) {
    holder.equipment.weapon = null;
    actor.hand.push(weapon);
    logAction(
      state,
      "coerce-take-weapon",
      `${characterName(holder)} ไม่โจมตี ${characterName(actor)} จึงยึด ${weapon.name}`,
      actor.id,
      holder.id,
      weapon.id,
    );
  } else
    logAction(
      state,
      "coerce-no-weapon",
      `${characterName(holder)} ไม่มีอาวุธให้ยึด`,
      actor.id,
      holder.id,
    );
  state.pendingCoerce = undefined;
  state.responseWindow = null;
  synchronizeGameState(state);
}
/** Harvest: reveal one card per living player; the actor then each player in turn order takes one; leftovers are discarded. */
export function playHarvest(
  state: GameState,
  actorId: string,
  cardInstanceId: string,
) {
  if (!canPlayerAct(state, actorId))
    throw new Error("เล่นการ์ดได้เฉพาะช่วงเล่นไพ่ของคุณ");
  const actor = getPlayerById(state, actorId);
  if (!actor) throw new Error("Unknown player");
  const card = findHandCard(actor, cardInstanceId);
  if (!card || card.effect !== "reveal_and_draft_cards")
    throw new Error("ไม่ใช่การ์ดเก็บเกี่ยวยุ้งฉาง");
  actor.hand = actor.hand.filter((item) => item !== card);
  state.lastPlayedCard = card;
  state.currentAction = {
    actionId: crypto.randomUUID(),
    actorId,
    card: toCardInstance(card),
    effectKey: "reveal_and_draft_cards",
    targetIds: [],
    status: "declared",
    createdAt: new Date().toISOString(),
  };
  state.pendingTrickResolution = { effectKey: "harvest" };
  logAction(
    state,
    "trick-declared",
    `${characterName(actor)} ประกาศใช้ ${card.name}`,
    actor.id,
    undefined,
    card.id,
  );
  openNegateWindowForTrick(state, actorId);
}
/** Reveals the harvest pool and opens the drafting window. Called after the negate window passes. */
function executeHarvest(state: GameState, actorId: string, trickCard: Card) {
  const actor = getPlayerById(state, actorId);
  if (!actor) return;
  moveToDiscard(state, trickCard);
  const order = [actor.id, ...massQueue(state, actorId)];
  const revealed: Card[] = [];
  for (let index = 0; index < order.length; index++) {
    if (!state.deck.length) reshuffleDiscardIntoDrawPile(state);
    const drawn = state.deck.pop();
    if (!drawn) break;
    revealed.push(drawn);
  }
  if (!revealed.length) {
    logAction(state, "harvest-empty", "ไม่มีไพ่ให้เปิดเผย", actor.id);
    return;
  }
  state.pendingHarvest = { revealed };
  state.responseWindow = {
    windowId: crypto.randomUUID(),
    type: "harvest_pick",
    sourceActionId: `harvest:${crypto.randomUUID()}`,
    requiredPlayerIds: order,
    currentResponderId: order[0]!,
    allowedResponseEffectKeys: [],
    responses: [],
    status: "open",
    createdAt: new Date().toISOString(),
    responderQueue: order,
  };
  logAction(
    state,
    "harvest-played",
    `${characterName(actor)} ใช้ ${trickCard.name} เปิดไพ่ ${revealed.length} ใบให้เลือก`,
    actor.id,
  );
}
/** Opens the coerce window. Called after the negate window passes. */
function executeCoerce(
  state: GameState,
  actorId: string,
  weaponHolderId: string,
  victimId: string,
  trickCard: Card,
) {
  moveToDiscard(state, trickCard);
  const holder = getPlayerById(state, weaponHolderId),
    victim = getPlayerById(state, victimId),
    actor = getPlayerById(state, actorId);
  if (!holder || !holder.alive || !victim || !victim.alive || !actor) {
    logAction(state, "coerce-fizzle", "ยืมมือสังหารไม่มีผล");
    return;
  }
  state.pendingCoerce = {
    actorId,
    weaponHolderId,
    victimId,
    trickName: trickCard.name,
  };
  state.responseWindow = {
    windowId: crypto.randomUUID(),
    type: "coerce_attack",
    sourceActionId: `coerce:${crypto.randomUUID()}`,
    requiredPlayerIds: [weaponHolderId],
    currentResponderId: weaponHolderId,
    allowedResponseEffectKeys: ["attack"],
    responses: [],
    status: "open",
    createdAt: new Date().toISOString(),
  };
  logAction(
    state,
    "coerce-active",
    `${characterName(holder)} ต้องเลือกโจมตี ${characterName(victim)} หรือเสียอาวุธ`,
    actor.id,
    holder.id,
  );
}
function finishHarvest(state: GameState) {
  const harvest = state.pendingHarvest;
  if (harvest) {
    if (harvest.revealed.length) {
      logAction(
        state,
        "harvest-discard",
        `ไพ่ที่เหลือ ${harvest.revealed.length} ใบถูกทิ้ง`,
      );
      for (const leftover of harvest.revealed)
        moveToDiscard(state, leftover, false);
    }
  }
  state.pendingHarvest = undefined;
  state.responseWindow = null;
  synchronizeGameState(state);
}
function advanceHarvest(state: GameState) {
  const harvest = state.pendingHarvest,
    window = state.responseWindow;
  if (!harvest || !window || window.type !== "harvest_pick") return;
  if (!harvest.revealed.length) return finishHarvest(state);
  const next = (window.responderQueue || []).find(
    (id) =>
      !window.responses.some((response) => response.playerId === id) &&
      getPlayerById(state, id)?.alive,
  );
  if (next) {
    window.currentResponderId = next;
    synchronizeGameState(state);
    return;
  }
  finishHarvest(state);
}
export function pickHarvestCard(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
) {
  const harvest = state.pendingHarvest,
    window = state.responseWindow;
  if (
    !harvest ||
    !window ||
    window.type !== "harvest_pick" ||
    window.currentResponderId !== playerId
  )
    throw new Error("ยังไม่ถึงตาคุณเลือกไพ่");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  const index = harvest.revealed.findIndex(
    (revealed) =>
      revealed.id === cardInstanceId ||
      toCardInstance(revealed).instanceId === cardInstanceId,
  );
  if (index < 0) throw new Error("ไพ่ที่เลือกไม่มีในกองที่เปิดเผย");
  const [chosen] = harvest.revealed.splice(index, 1);
  player.hand.push(chosen!);
  window.responses.push({
    playerId,
    response: "card",
    createdAt: new Date().toISOString(),
  });
  logAction(
    state,
    "harvest-pick",
    `${characterName(player)} เลือก ${chosen!.name} จากยุ้งฉาง`,
    player.id,
    undefined,
    chosen!.id,
  );
  advanceHarvest(state);
}
const isQueuedResponseWindow = (type: string) =>
  type === "mass_dodge" || type === "mass_attack" || type === "multi_attack";
export function advanceMassResponseQueue(state: GameState) {
  const window = state.responseWindow,
    action = state.currentAction;
  if (!window || !action || !isQueuedResponseWindow(window.type)) return;
  if (state.status === "finished") return;
  const queue = window.responderQueue || [],
    next = queue.find((id) => {
      const player = getPlayerById(state, id);
      return (
        player?.alive &&
        !window.responses.some((response) => response.playerId === id)
      );
    });
  if (next) {
    window.currentResponderId = next;
    synchronizeGameState(state);
    return;
  }
  window.status = "resolved";
  state.responseWindow = null;
  resolveTargetedCardAction(state, action.actionId);
  logAction(
    state,
    "mass-trick-finished",
    `การ์ด ${action.card?.name || ""} จบการทำงาน`,
  );
  synchronizeGameState(state);
}
export function playMassResponseCard(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
) {
  const window = state.responseWindow;
  if (
    !window ||
    !isQueuedResponseWindow(window.type) ||
    window.currentResponderId !== playerId
  )
    throw new Error("You cannot respond to this mass trick now");
  const player = getPlayerById(state, playerId),
    card = player && findHandCard(player, cardInstanceId),
    required = window.type === "mass_attack" ? "attack" : "dodge";
  if (!player || !card || !cardActsAs(state, playerId, card, required))
    throw new Error("Required response card is not in your hand");
  player.hand = player.hand.filter((item) => item !== card);
  moveToDiscard(state, card, false);
  window.responses.push({
    playerId,
    response: "card",
    cardInstanceId: toCardInstance(card).instanceId,
    card: publicCardView(card),
    createdAt: new Date().toISOString(),
  });
  logAction(
    state,
    "mass-response",
    `${characterName(player)} ใช้ ${card.name}`,
    player.id,
  );
  advanceMassResponseQueue(state);
}
export function declineMassResponse(state: GameState, playerId: string) {
  const window = state.responseWindow,
    action = state.currentAction;
  if (
    !window ||
    !action ||
    !isQueuedResponseWindow(window.type) ||
    window.currentResponderId !== playerId
  )
    throw new Error("You cannot decline this mass trick now");
  window.responses.push({
    playerId,
    response: "decline",
    createdAt: new Date().toISOString(),
  });
  const actorId = action.actorId,
    damage = window.attackDamage ?? 1;
  logAction(
    state,
    "mass-response-declined",
    `${characterName(getPlayerById(state, playerId)!)} ไม่ตอบสนองและเสีย ${damage} หน่วยพลังชีวิต`,
    playerId,
  );
  applyDamage(state, playerId, damage, actorId);
  if (state.responseWindow?.type === "dying_heal") {
    state.suspendedResponseWindow = window;
    return;
  }
  advanceMassResponseQueue(state);
}
function prepareImmediateTrick(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
  effectKey: "draw_cards" | "heal_all_living",
) {
  if (state.responseWindow || state.currentAction)
    throw new Error("Resolve the current action first");
  const player = getPlayerById(state, playerId);
  if (!player || !player.alive) throw new Error("Choose a living player");
  if (!canPlayerAct(state, playerId))
    throw new Error(
      "Immediate tricks can only be played by the active player during the play phase",
    );
  const card = findHandCard(player, cardInstanceId);
  if (!card || card.effect !== effectKey)
    throw new Error("Immediate trick card is not in your hand");
  player.hand = player.hand.filter((item) => item !== card);
  return { player, card };
}

/** Draws from a card effect during play phase; this is distinct from the turn draw phase. */
export function playDrawCardsTrick(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
) {
  const { player, card } = prepareImmediateTrick(
    state,
    playerId,
    cardInstanceId,
    "draw_cards",
  );
  state.lastPlayedCard = card;
  const action: CurrentAction = {
    actionId: crypto.randomUUID(),
    actorId: playerId,
    card: toCardInstance(card),
    effectKey: "draw_cards",
    targetIds: [],
    status: "declared",
    createdAt: new Date().toISOString(),
  };
  state.currentAction = action;
  state.pendingTrickResolution = { effectKey: "draw_cards" };
  logAction(
    state,
    "trick-declared",
    `${characterName(player)} ประกาศใช้ ${card.name}`,
    player.id,
    undefined,
    card.id,
  );
  openNegateWindowForTrick(state, playerId);
}

/** TODO: dispatch before_heal/after_heal hooks here when character skills are implemented. */
export function playHealAllLiving(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
) {
  const { player, card } = prepareImmediateTrick(
    state,
    playerId,
    cardInstanceId,
    "heal_all_living",
  );
  state.lastPlayedCard = card;
  const action: CurrentAction = {
    actionId: crypto.randomUUID(),
    actorId: playerId,
    card: toCardInstance(card),
    effectKey: "heal_all_living",
    targetIds: [],
    status: "declared",
    createdAt: new Date().toISOString(),
  };
  state.currentAction = action;
  state.pendingTrickResolution = { effectKey: "heal_all_living" };
  logAction(
    state,
    "trick-declared",
    `${characterName(player)} ประกาศใช้ ${card.name}`,
    player.id,
    undefined,
    card.id,
  );
  openNegateWindowForTrick(state, playerId);
}
/** Targeted trick: discard a selected hidden hand position or visible equipment card. */
export function playDiscardTargetCard(
  state: GameState,
  actorId: string,
  targetId: string,
  cardInstanceId: string,
  selection: TargetCardSelection | string,
) {
  const actor = getPlayerById(state, actorId),
    trick = actor ? findHandCard(actor, cardInstanceId) : undefined;
  if (
    !actor ||
    !trick ||
    !cardActsAs(state, actorId, trick, "discard_target_card")
  )
    throw new Error("Discard-target card is not in your hand"); // กำเหลง บ้าบิ่น: ♠/♣ เป็น ถอนสะพาน
  if (typeof selection !== "string" && selection.zone === "decision_area")
    throw new Error("Decision-area selection is not implemented yet");
  if (typeof selection !== "string" && selection.zone === "hand")
    validateHiddenHandIndex(state, {
      targetPlayerId: targetId,
      handIndex: selection.handIndex,
    });
  // Eagerly validate the selected card exists before locking in the action
  else {
    const tgt = getPlayerById(state, targetId),
      tId =
        typeof selection === "string" ? selection : selection.cardInstanceId;
    if (
      !tgt ||
      (!findHandCard(tgt, tId) &&
        !Object.values(tgt.equipment).some(
          (e) => e && (e.id === tId || toCardInstance(e).instanceId === tId),
        ))
    )
      throw new Error("Selected target card is not available");
  }
  const prepared = createTargetedCardAction(
    state,
    actorId,
    cardInstanceId,
    [targetId],
    { minTargets: 1, maxTargets: 1, allowSelf: false },
    "discard_target_card",
  );
  state.pendingTrickResolution = {
    effectKey: "discard_target_card",
    targetId,
    selection,
  };
  logAction(
    state,
    "trick-declared",
    `${characterName(prepared.actor)} ประกาศใช้ ${prepared.card.name} ใส่ ${characterName(prepared.targets[0]!)}`,
    actorId,
    targetId,
    prepared.card.id,
  );
  openNegateWindowForTrick(state, actorId);
}

/** Targeted trick: transfer a selected hidden hand position or visible equipment card to the actor. */
export function playStealTargetCard(
  state: GameState,
  actorId: string,
  targetId: string,
  selection: TargetCardSelection | string,
  cardInstanceId: string,
) {
  const actor = getPlayerById(state, actorId),
    trick = actor ? findHandCard(actor, cardInstanceId) : undefined,
    target = getPlayerById(state, targetId);
  if (!actor || !trick || trick.effect !== "steal_target_card_in_range")
    throw new Error("Steal-target card is not in your hand");
  if (!target) throw new Error("Target is missing");
  if (hasCharacterSkill(state, targetId, "immune_steal"))
    throw new Error("เป้าหมายไม่สามารถถูกลอบขโมยได้ (อ่อนน้อมถ่อมตน)");
  if (typeof selection !== "string" && selection.zone === "decision_area")
    throw new Error("Decision-area selection is not implemented yet");
  if (typeof selection !== "string" && selection.zone === "hand")
    validateHiddenHandIndex(state, {
      targetPlayerId: targetId,
      handIndex: selection.handIndex,
    });
  // Eagerly validate the target card exists before locking in the action
  else {
    const tId =
      typeof selection === "string" ? selection : selection.cardInstanceId;
    if (
      !Object.values(target.equipment).some(
        (e) => e && (e.id === tId || toCardInstance(e).instanceId === tId),
      )
    )
      throw new Error("Selected target equipment is not available");
  }
  const stealRange = hasCharacterSkill(state, actorId, "trick_ignore_distance")
    ? undefined
    : 1; // หวงเย่อิง ผู้วิเศษ ignores trick range
  const prepared = createTargetedCardAction(
    state,
    actorId,
    cardInstanceId,
    [targetId],
    { minTargets: 1, maxTargets: 1, allowSelf: false, maxDistance: stealRange },
    "steal_target_card_in_range",
  );
  state.pendingTrickResolution = {
    effectKey: "steal_target_card_in_range",
    targetId,
    selection,
  };
  logAction(
    state,
    "trick-declared",
    `${characterName(prepared.actor)} ประกาศใช้ ${prepared.card.name} ใส่ ${characterName(target)}`,
    actorId,
    targetId,
    prepared.card.id,
  );
  openNegateWindowForTrick(state, actorId);
}
// ── Negate (คงกระพันชาตรี) infrastructure ──────────────────────────────────

/** Opens a negate response window for all alive players except the actor. */
function openNegateWindowForTrick(state: GameState, actorId: string): void {
  const alive = getAlivePlayersInSeatOrder(state),
    actorIndex = alive.findIndex((p) => p.id === actorId);
  const queue =
    actorIndex >= 0
      ? [...alive.slice(actorIndex + 1), ...alive.slice(0, actorIndex)]
      : alive;
  const queueIds = queue.map((p) => p.id);
  if (!queueIds.length) {
    resolveTrickEffect(state);
    return;
  }
  state.responseWindow = {
    windowId: crypto.randomUUID(),
    type: "negate",
    sourceActionId: state.currentAction!.actionId,
    requiredPlayerIds: queueIds,
    currentResponderId: queueIds[0]!,
    allowedResponseEffectKeys: ["negate_trick_effect"],
    responses: [],
    status: "open",
    createdAt: new Date().toISOString(),
    responderQueue: queueIds,
  };
  synchronizeGameState(state);
}

/** Executes the stored pending trick effect after all players have declined to negate. */
function resolveTrickEffect(state: GameState): void {
  const action = state.currentAction,
    params = state.pendingTrickResolution;
  if (!action) {
    state.pendingTrickResolution = undefined;
    synchronizeGameState(state);
    return;
  }
  const actor = getPlayerById(state, action.actorId),
    trickCard = state.lastPlayedCard;
  if (!actor || !trickCard) {
    action.status = "resolved";
    state.currentAction = null;
    state.pendingTrickResolution = undefined;
    synchronizeGameState(state);
    return;
  }
  if (params?.effectKey === "draw_cards") {
    const amount = numberParam(trickCard, "amount", 2);
    grantDraws(state, actor.id, amount);
    moveToDiscard(state, trickCard);
    logAction(
      state,
      "draw-cards-played",
      `${characterName(actor)} ใช้ ${trickCard.name} ได้รับสิทธิ์จั่วการ์ด ${amount} ใบ`,
      actor.id,
      undefined,
      trickCard.id,
    );
  } else if (params?.effectKey === "heal_all_living") {
    let healed = 0;
    for (const t of getAlivePlayers(state)) {
      if (t.hp === undefined || t.maxHp === undefined) continue;
      const r = Math.min(1, t.maxHp - t.hp);
      t.hp += r;
      if (r > 0) healed++;
    }
    moveToDiscard(state, trickCard);
    logAction(
      state,
      "heal-all-living-played",
      `${characterName(actor)} ใช้ ${trickCard.name} ฟื้นฟูพลังชีวิตให้ขุนพล ${healed} คน`,
      actor.id,
      undefined,
      trickCard.id,
    );
    flashTable(
      state,
      "🍑",
      "ร่วมสาบาน",
      `ขุนพลที่มีชีวิตทุกคนได้รับการฟื้นฟู (${healed} คน)`,
    );
  } else if (
    (params?.effectKey === "discard_target_card" ||
      params?.effectKey === "steal_target_card_in_range") &&
    params?.targetId &&
    params?.selection !== undefined
  ) {
    const target = getPlayerById(state, params.targetId),
      sel = params.selection;
    if (target) {
      let chosen: Card | undefined,
        hiddenHand = false;
      if (typeof sel !== "string" && "zone" in sel && sel.zone === "hand") {
        chosen = resolveHiddenHandCard(state, {
          targetPlayerId: target.id,
          handIndex: (sel as { zone: "hand"; handIndex: number }).handIndex,
        });
        hiddenHand = true;
      } else {
        const tId =
          typeof sel === "string"
            ? sel
            : (sel as { cardInstanceId: string }).cardInstanceId;
        if (params.effectKey === "steal_target_card_in_range") {
          for (const slot of Object.keys(
            target.equipment,
          ) as RuntimeEquipmentSlot[]) {
            const e = target.equipment[slot];
            if (e && (e.id === tId || toCardInstance(e).instanceId === tId)) {
              chosen = e;
              target.equipment[slot] = null;
              break;
            }
          }
        }
        if (!chosen) {
          chosen = findHandCard(target, tId);
          if (chosen) target.hand = target.hand.filter((c) => c !== chosen);
          else if (params.effectKey === "discard_target_card") {
            for (const slot of Object.keys(
              target.equipment,
            ) as RuntimeEquipmentSlot[]) {
              const e = target.equipment[slot];
              if (e && (e.id === tId || toCardInstance(e).instanceId === tId)) {
                chosen = e;
                target.equipment[slot] = null;
                break;
              }
            }
          }
        }
      }
      if (chosen) {
        if (params.effectKey === "steal_target_card_in_range")
          actor.hand.push(chosen);
        else moveToDiscard(state, chosen, false);
        logAction(
          state,
          params.effectKey === "steal_target_card_in_range"
            ? "target-card-stolen"
            : "target-card-discarded",
          hiddenHand
            ? params.effectKey === "steal_target_card_in_range"
              ? `${characterName(actor)} ขโมยไพ่บนมือของ ${characterName(target)} 1 ใบ`
              : `${characterName(actor)} ทิ้งไพ่บนมือของ ${characterName(target)} 1 ใบ`
            : params.effectKey === "steal_target_card_in_range"
              ? `${characterName(actor)} ขโมย ${chosen.name} จาก ${characterName(target)}`
              : `${characterName(actor)} ใช้ ${trickCard.name} ทิ้ง ${chosen.name} ของ ${characterName(target)}`,
          actor.id,
          target.id,
          hiddenHand ? undefined : chosen.id,
        );
      }
    }
    moveToDiscard(state, trickCard);
  } else if (params?.effectKey === "delayed_trick" && params.targetId) {
    const target = getPlayerById(state, params.targetId);
    if (
      target &&
      target.alive &&
      !target.decisionArea.some(
        (existing) => existing.effect === trickCard.effect,
      )
    ) {
      target.decisionArea.push(trickCard);
      logAction(
        state,
        "delayed-trick-placed",
        `${characterName(actor)} วาง ${trickCard.name} บนพื้นที่ตัดสินของ ${characterName(target)}`,
        actor.id,
        target.id,
        trickCard.id,
      );
    } else moveToDiscard(state, trickCard);
  } else if (
    params?.effectKey === "coerce" &&
    params.weaponHolderId &&
    params.victimId
  ) {
    executeCoerce(
      state,
      actor.id,
      params.weaponHolderId,
      params.victimId,
      trickCard,
    );
  } else if (params?.effectKey === "harvest") {
    executeHarvest(state, actor.id, trickCard);
  } else {
    moveToDiscard(state, trickCard);
  }
  action.status = "resolved";
  state.currentAction = null;
  state.pendingTrickResolution = undefined;
  synchronizeGameState(state);
}

/** Play a คงกระพันชาตรี card to cancel the current declared trick. Any player except the actor may call this. */
export function respondWithNegate(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
): void {
  const window = state.responseWindow;
  if (
    !window ||
    window.type !== "negate" ||
    window.currentResponderId !== playerId ||
    window.status !== "open"
  )
    throw new Error("คุณไม่สามารถใช้คงกระพันชาตรีในขณะนี้");
  const player = getPlayerById(state, playerId),
    card = player && findHandCard(player, cardInstanceId);
  if (!player || !card || card.effect !== "negate_trick_effect")
    throw new Error("การ์ดคงกระพันชาตรีไม่อยู่ในมือ");
  player.hand = player.hand.filter((item) => item !== card);
  moveToDiscard(state, card, false);
  window.responses.push({
    playerId,
    response: "card",
    cardInstanceId: toCardInstance(card).instanceId,
    card: publicCardView(card),
    createdAt: new Date().toISOString(),
  });
  window.status = "resolved";
  state.responseWindow = null;
  logAction(
    state,
    "trick-negated",
    `${characterName(player)} ใช้ คงกระพันชาตรี ยกเลิกการ์ดอุบาย`,
    player.id,
  );
  if (state.currentAction) {
    if (state.lastPlayedCard) moveToDiscard(state, state.lastPlayedCard);
    state.currentAction.status = "cancelled";
    state.currentAction = null;
  }
  state.pendingTrickResolution = undefined;
  synchronizeGameState(state);
}

/** Decline to negate — advances the queue; when all decline the trick resolves. */
export function declineNegate(state: GameState, playerId: string): void {
  const window = state.responseWindow;
  if (
    !window ||
    window.type !== "negate" ||
    window.currentResponderId !== playerId ||
    window.status !== "open"
  )
    throw new Error("ไม่มีคำถามการใช้คงกระพันชาตรีสำหรับคุณ");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  window.responses.push({
    playerId,
    response: "decline",
    createdAt: new Date().toISOString(),
  });
  logAction(
    state,
    "negate-declined",
    `${characterName(player)} ไม่ใช้คงกระพันชาตรี`,
    player.id,
  );
  const queue = window.responderQueue || window.requiredPlayerIds,
    next = queue.find((id) => !window.responses.some((r) => r.playerId === id));
  if (next) {
    window.currentResponderId = next;
    synchronizeGameState(state);
    return;
  }
  window.status = "resolved";
  state.responseWindow = null;
  resolveTrickEffect(state);
}

/** Play a คงกระพันชาตรี card inside a mass-dodge or mass-attack window to skip your response without taking damage. */
export function playNegateInMassWindow(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
): void {
  const window = state.responseWindow;
  if (
    !window ||
    (window.type !== "mass_dodge" && window.type !== "mass_attack") ||
    window.currentResponderId !== playerId ||
    window.status !== "open"
  )
    throw new Error("คุณไม่สามารถใช้คงกระพันชาตรีในขณะนี้");
  const player = getPlayerById(state, playerId),
    card = player && findHandCard(player, cardInstanceId);
  if (!player || !card || card.effect !== "negate_trick_effect")
    throw new Error("การ์ดคงกระพันชาตรีไม่อยู่ในมือ");
  player.hand = player.hand.filter((item) => item !== card);
  moveToDiscard(state, card, false);
  window.responses.push({
    playerId,
    response: "card",
    cardInstanceId: toCardInstance(card).instanceId,
    card: publicCardView(card),
    createdAt: new Date().toISOString(),
  });
  logAction(
    state,
    "mass-negate",
    `${characterName(player)} ใช้ คงกระพันชาตรี หลีกเลี่ยงผล${window.type === "mass_dodge" ? "สงคราม" : "ราชโองการ"}`,
    player.id,
  );
  advanceMassResponseQueue(state);
}
/** Declares a delayed trick. After the negate window passes it is placed in the target's decision area, resolving at their next judgment phase. */
export function playDelayedTrick(
  state: GameState,
  actorId: string,
  cardInstanceId: string,
  targetId: string,
) {
  if (!canPlayerAct(state, actorId))
    throw new Error("เล่นการ์ดได้เฉพาะช่วงเล่นไพ่ของคุณ");
  const actor = getPlayerById(state, actorId);
  if (!actor) throw new Error("Unknown player");
  const rawCard = findHandCard(actor, cardInstanceId);
  const asIndulgence =
    Boolean(rawCard) &&
    cardActsAs(state, actorId, rawCard!, "delayed_skip_play_phase");
  const asLightning = rawCard?.effect === "delayed_lightning_judgment";
  if (!rawCard || (!asIndulgence && !asLightning))
    throw new Error("ไม่ใช่การ์ดหน่วงเวลา");
  const effectiveEffect = asIndulgence
    ? "delayed_skip_play_phase"
    : "delayed_lightning_judgment";
  const target = getPlayerById(state, targetId);
  if (!target || !target.alive) throw new Error("เลือกเป้าหมายที่ยังมีชีวิต");
  if (asIndulgence && target.id === actor.id)
    throw new Error("มีสุขลืมเมืองใช้กับตัวเองไม่ได้");
  if (asIndulgence && hasCharacterSkill(state, target.id, "immune_indulgence"))
    throw new Error("เป้าหมายไม่สามารถถูกวางมีสุขลืมเมืองได้ (อ่อนน้อมถ่อมตน)");
  if (asLightning && target.id !== actor.id)
    throw new Error("ฟ้าลงโทษวางบนตัวเองเท่านั้น");
  if (
    target.decisionArea.some((existing) => existing.effect === effectiveEffect)
  )
    throw new Error("เป้าหมายมีการ์ดหน่วงเวลานี้อยู่แล้ว");
  // ไต้เกี้ยว โปรยเสน่ห์: a converted ♦ card is re-tagged so the delayed-trick machinery treats it as มีสุขลืมเมือง.
  const card =
    rawCard.effect === effectiveEffect
      ? rawCard
      : {
          ...rawCard,
          effect: effectiveEffect,
          name: asIndulgence ? "มีสุขลืมเมือง" : rawCard.name,
        };
  actor.hand = actor.hand.filter((item) => item !== rawCard);
  state.lastPlayedCard = card;
  state.currentAction = {
    actionId: crypto.randomUUID(),
    actorId,
    card: toCardInstance(card),
    effectKey: effectiveEffect,
    targetIds: [targetId],
    status: "declared",
    createdAt: new Date().toISOString(),
  };
  state.pendingTrickResolution = { effectKey: "delayed_trick", targetId };
  logAction(
    state,
    "trick-declared",
    `${characterName(actor)} ประกาศใช้ ${card.name} ใส่ ${characterName(target)}`,
    actor.id,
    target.id,
    card.id,
  );
  if (asLightning) resolveTrickEffect(state);
  else openNegateWindowForTrick(state, actorId); // ฟ้าลงโทษ: ยกเลิกตอนวางไม่ได้ (วางทันที) — คงกระพันใช้ตอนตัดสินแทน
}
