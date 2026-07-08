// Equipment-card handlers: passives, weapon effects, armor judgment, and equipping. Extracted verbatim from index.ts.
import type { Card, GameState, Player, TargetCardSelection } from "../types.js";
import {
  characterName,
  equipmentSlotForCard,
  findHandCard,
  getPlayerById,
  grantDraws,
  logAction,
  moveToDiscard,
  numberParam,
  toCardInstance,
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
  attackDamageBonus,
  attackDodgesRequired,
  hasCharacterSkill,
  isImmuneToAttack,
} from "../skills.js";
import { assertForcedAttackTarget } from "./character-skills.js";
import {
  applyDamage,
  canTargetWithAttack,
  openAttackDodgeWindow,
  playAttack,
  resolveCurrentAction,
} from "./combat.js";
/** TODO: import each weapon's source range into effectParams.range during card-data ingestion. */
export function getAttackRange(state: GameState, playerId: string) {
  const range = getPlayerById(state, playerId)?.equipment.weapon?.effectParams
    .range;
  return typeof range === "number" && Number.isFinite(range) && range > 0
    ? range
    : 1;
}
export const hasUnlimitedAttackPerTurn = (state: GameState, playerId: string) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "unlimited_attack_per_turn";
/** True if the player ignores the one-attack-per-turn limit (Crossbow weapon or เตียวหุย's คำราม skill). */
export const hasUnlimitedAttack = (state: GameState, playerId: string) =>
  hasUnlimitedAttackPerTurn(state, playerId) ||
  hasCharacterSkill(state, playerId, "unlimited_attack");
export const hasRepeatAttackAfterDodge = (state: GameState, playerId: string) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "repeat_attack_after_dodge";
export const attackIgnoresTargetArmor = (state: GameState, playerId: string) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "ignore_target_armor";
export const hasDamageDestroyTargetMount = (
  state: GameState,
  playerId: string,
) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "damage_destroy_target_mount";
export const hasDiscardTwoForceAttackDamage = (
  state: GameState,
  playerId: string,
) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "discard_two_force_attack_damage";
export const hasReplaceDamageWithDiscardTwo = (
  state: GameState,
  playerId: string,
) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "replace_damage_with_discard_two";
export const hasDiscardTwoAsAttack = (state: GameState, playerId: string) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "discard_two_as_attack";
export const hasOppositeGenderAttackChoice = (
  state: GameState,
  playerId: string,
) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "opposite_gender_attack_choice";
export const areOppositeGenders = (a: Player, b: Player) =>
  Boolean(
    a.character?.gender &&
    b.character?.gender &&
    a.character.gender !== b.character.gender,
  );
/** Twin Swords choice — target discards one hand card, then the attack proceeds. */
export function resolveTwinSwordsDiscard(
  state: GameState,
  targetId: string,
  cardInstanceId: string,
) {
  const pending = state.pendingTwinSwords;
  if (!pending || pending.targetId !== targetId)
    throw new Error("No twin-swords choice is pending");
  const attacker = getPlayerById(state, pending.attackerId),
    target = getPlayerById(state, targetId);
  if (!attacker || !target) throw new Error("Participant is missing");
  const card = findHandCard(target, cardInstanceId);
  if (!card) throw new Error("Card is not in your hand");
  target.hand = target.hand.filter((c) => c !== card);
  moveToDiscard(state, card, false);
  logAction(
    state,
    "twin-swords-discard",
    `${characterName(target)} ทิ้งไพ่ 1 ใบจากผลของ ${pending.weaponName}`,
    target.id,
  );
  state.pendingTwinSwords = undefined;
  openAttackDodgeWindow(
    state,
    attacker,
    target,
    pending.actionId,
    pending.attackCardId,
    pending.damage,
  );
}
/** Twin Swords choice — target lets the attacker draw one card, then the attack proceeds. */
export function resolveTwinSwordsLetDraw(state: GameState, targetId: string) {
  const pending = state.pendingTwinSwords;
  if (!pending || pending.targetId !== targetId)
    throw new Error("No twin-swords choice is pending");
  const attacker = getPlayerById(state, pending.attackerId),
    target = getPlayerById(state, targetId);
  if (!attacker || !target) throw new Error("Participant is missing");
  grantDraws(state, attacker.id, 1);
  logAction(
    state,
    "twin-swords-draw",
    `${characterName(target)} ให้ ${characterName(attacker)} ได้รับสิทธิ์จั่ว 1 ใบ`,
    attacker.id,
  );
  state.pendingTwinSwords = undefined;
  openAttackDodgeWindow(
    state,
    attacker,
    target,
    pending.actionId,
    pending.attackCardId,
    pending.damage,
  );
}
/** Snake Spear: discard exactly two hand cards to launch a virtual attack. The combined attack counts as black only when both cards are black. */
export function useDiscardTwoAsAttack(
  state: GameState,
  attackerId: string,
  cardIds: string[],
  targetId: string,
) {
  const attacker = getPlayerById(state, attackerId);
  if (!attacker) throw new Error("Unknown player");
  if (!hasDiscardTwoAsAttack(state, attackerId))
    throw new Error(
      "You do not have a weapon that converts cards into an attack",
    );
  if (
    !Array.isArray(cardIds) ||
    cardIds.length !== 2 ||
    cardIds[0] === cardIds[1]
  )
    throw new Error("Choose exactly two different hand cards");
  if (
    state.turn.attackUsedThisTurn >= 1 &&
    !hasUnlimitedAttack(state, attackerId)
  )
    throw new Error("You may only use one attack per turn");
  const target = getPlayerById(state, targetId);
  if (!target || !target.alive || target.id === attackerId)
    throw new Error("Choose a living opponent");
  const card1 = findHandCard(attacker, cardIds[0]!),
    card2 = findHandCard(attacker, cardIds[1]!);
  if (!card1 || !card2) throw new Error("Both cards must be in your hand");
  const bothBlack =
    ["♠", "♣"].includes(card1.suit) && ["♠", "♣"].includes(card2.suit);
  // card1 becomes the representative attack card (removed from hand, discarded at resolution); card2 is discarded immediately.
  const prepared = createTargetedCardAction(
    state,
    attackerId,
    cardIds[0]!,
    [targetId],
    { minTargets: 1, maxTargets: 1, allowSelf: false, maxDistance: "attack" },
    "attack",
  );
  const actionId = prepared.action.actionId;
  attacker.hand = attacker.hand.filter((c) => c !== card2);
  moveToDiscard(state, card2, false);
  logAction(
    state,
    "snake-spear-attack",
    `${characterName(attacker)} ทิ้งไพ่ 2 ใบใช้เป็นการโจมตีใส่ ${characterName(target)}`,
    attacker.id,
    target.id,
  );
  if (
    target.equipment.armor?.effect === "black_attack_immunity" &&
    bothBlack &&
    !attackIgnoresTargetArmor(state, attacker.id)
  ) {
    logAction(
      state,
      "armor-blocked-attack",
      `${characterName(target)} ใช้เกราะป้องกันการโจมตีสีดำ`,
      target.id,
      attacker.id,
    );
    resolveTargetedCardAction(state, actionId);
    synchronizeGameState(state);
    return;
  }
  state.attacksThisTurn++;
  state.turn.attackUsedThisTurn++;
  state.responseWindow = {
    windowId: crypto.randomUUID(),
    type: "attack_dodge",
    sourceActionId: actionId,
    requiredPlayerIds: [target.id],
    currentResponderId: target.id,
    allowedResponseEffectKeys: ["dodge"],
    responses: [],
    status: "open",
    createdAt: new Date().toISOString(),
  };
  state.pendingAction = {
    id: actionId,
    kind: "attack",
    actorId: attacker.id,
    targetId: target.id,
    cardId: card1.id,
    responseKey: "dodge",
    damage: numberParam(card1, "damage", 1),
    dodgesRequired: attackDodgesRequired(state, attacker.id),
  };
  synchronizeGameState(state);
}
export const hasLastHandMultiTargetAttack = (
  state: GameState,
  playerId: string,
) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "last_hand_multi_target_attack";
/** Zhangba Spear: when the Attack is your last hand card, target up to 3 players; each dodges independently or takes the damage. */
export function playLastHandMultiAttack(
  state: GameState,
  attackerId: string,
  cardInstanceId: string,
  targetIds: string[],
) {
  const attacker = getPlayerById(state, attackerId);
  if (!attacker) throw new Error("Unknown player");
  if (!hasLastHandMultiTargetAttack(state, attackerId))
    throw new Error("You do not have a multi-target weapon");
  const card = findHandCard(attacker, cardInstanceId);
  if (!card || card.effect !== "attack")
    throw new Error("Choose an Attack card");
  if (attacker.hand.length !== 1)
    throw new Error("การ์ดโจมตีต้องเป็นไพ่ใบสุดท้ายบนมือ");
  const unique = [...new Set(targetIds)];
  if (unique.length !== targetIds.length)
    throw new Error("เป้าหมายต้องไม่ซ้ำกัน");
  if (unique.length < 1 || unique.length > 3)
    throw new Error("เลือกเป้าหมาย 1–3 คน");
  if (unique.includes(attackerId)) throw new Error("โจมตีตัวเองไม่ได้");
  if (unique.some((id) => isImmuneToAttack(state, id)))
    throw new Error(
      "เป้าหมายมือว่างและไม่สามารถถูกโจมตีได้ (กลยุทธ์เมืองว่าง)",
    );
  assertForcedAttackTarget(state, attackerId, unique);
  if (
    state.turn.attackUsedThisTurn >= 1 &&
    !hasUnlimitedAttack(state, attackerId)
  )
    throw new Error("You may only use one attack per turn");
  const damage = numberParam(card, "damage", 1);
  const prepared = createTargetedCardAction(
    state,
    attackerId,
    cardInstanceId,
    unique,
    { minTargets: 1, maxTargets: 3, allowSelf: false, maxDistance: "attack" },
    "attack",
  );
  if (prepared.card.effect !== "attack")
    throw new Error("Attack card is not in your hand");
  state.attacksThisTurn++;
  state.turn.attackUsedThisTurn++;
  state.responseWindow = {
    windowId: crypto.randomUUID(),
    type: "multi_attack",
    sourceActionId: prepared.action.actionId,
    requiredPlayerIds: unique,
    currentResponderId: unique[0]!,
    allowedResponseEffectKeys: ["dodge"],
    responses: [],
    status: "open",
    createdAt: new Date().toISOString(),
    responderQueue: unique,
    attackDamage: damage + attackDamageBonus(state, attackerId),
  };
  logAction(
    state,
    "multi-attack",
    `${characterName(attacker)} ใช้ ${prepared.card.name} โจมตี ${unique.map((id) => characterName(getPlayerById(state, id)!)).join(", ")}`,
    attacker.id,
  );
  synchronizeGameState(state);
}
export function destroyTargetMountAfterDamage(
  state: GameState,
  attackerId: string,
  targetId: string,
  mountSlot: "offensiveMount" | "defensiveMount",
) {
  const pending = state.pendingDestroyMount;
  if (
    !pending ||
    pending.attackerId !== attackerId ||
    pending.targetId !== targetId
  )
    throw new Error("No mount destruction is pending");
  const target = getPlayerById(state, targetId),
    mount = target?.equipment[mountSlot];
  if (!target || !mount) throw new Error("Selected mount is not available");
  target.equipment[mountSlot] = null;
  moveToDiscard(state, mount, false);
  state.pendingDestroyMount = undefined;
  logAction(
    state,
    "target-mount-destroyed",
    `${characterName(getPlayerById(state, attackerId)!)} ทำลาย ${mount.name} ของ ${characterName(target)}`,
    attackerId,
    targetId,
    mount.id,
  );
  synchronizeGameState(state);
}
export function declineDestroyTargetMount(
  state: GameState,
  attackerId: string,
) {
  if (state.pendingDestroyMount?.attackerId !== attackerId)
    throw new Error("No mount destruction is pending");
  state.pendingDestroyMount = undefined;
  logAction(
    state,
    "target-mount-destruction-declined",
    `${characterName(getPlayerById(state, attackerId)!)} ไม่ทำลายพาหนะ`,
    attackerId,
  );
  synchronizeGameState(state);
}
export function forceAttackDamageByDiscardingTwo(
  state: GameState,
  attackerId: string,
  cardRefs: string[],
) {
  const pending = state.pendingForceAttackDamage;
  if (
    !pending ||
    pending.attackerId !== attackerId ||
    cardRefs.length !== 2 ||
    new Set(cardRefs).size !== 2
  )
    throw new Error("Choose exactly two cards");
  const attacker = getPlayerById(state, attackerId),
    target = getPlayerById(state, pending.targetId);
  if (!attacker || !target?.alive)
    throw new Error("Force attack target is unavailable");
  const discarded: Card[] = [];
  for (const ref of cardRefs) {
    let card = findHandCard(attacker, ref);
    if (card) attacker.hand = attacker.hand.filter((item) => item !== card);
    else
      for (const slot of Object.keys(
        attacker.equipment,
      ) as RuntimeEquipmentSlot[]) {
        const equipped = attacker.equipment[slot];
        if (equipped && equipped.id === ref) {
          card = equipped;
          attacker.equipment[slot] = null;
          break;
        }
      }
    if (!card) throw new Error("Selected card is not yours");
    discarded.push(card);
  }
  discarded.forEach((card) => moveToDiscard(state, card, false));
  state.pendingForceAttackDamage = undefined;
  logAction(
    state,
    "force-attack-damage",
    `${characterName(attacker)} ทิ้งไพ่ 2 ใบบังคับให้โจมตีโดน`,
    attacker.id,
    target.id,
  );
  applyDamage(state, target.id, 1, attacker.id);
  synchronizeGameState(state);
}
export function declineForceAttackDamage(state: GameState, attackerId: string) {
  if (state.pendingForceAttackDamage?.attackerId !== attackerId)
    throw new Error("No forced damage is pending");
  state.pendingForceAttackDamage = undefined;
  logAction(
    state,
    "force-attack-damage-declined",
    `${characterName(getPlayerById(state, attackerId)!)} ไม่บังคับให้โจมตีโดน`,
    attackerId,
  );
  synchronizeGameState(state);
}
/** Ice Sword: instead of dealing attack damage, discard one or two of the target's cards. Selections are hidden hand positions or visible equipment. */
export function replaceAttackDamageByDiscarding(
  state: GameState,
  attackerId: string,
  selections: TargetCardSelection[],
) {
  const pending = state.pendingReplaceDamage;
  if (!pending || pending.attackerId !== attackerId)
    throw new Error("No damage-replacement decision is pending");
  const attacker = getPlayerById(state, attackerId),
    target = getPlayerById(state, pending.targetId);
  if (!attacker || !target) throw new Error("Participant is missing");
  if (
    !Array.isArray(selections) ||
    selections.length < 1 ||
    selections.length > 2
  )
    throw new Error("Choose one or two cards to discard");
  const available =
    target.hand.length + Object.values(target.equipment).filter(Boolean).length;
  if (selections.length > available)
    throw new Error("Target does not have that many cards");
  const chosen: { card: Card; slot?: RuntimeEquipmentSlot }[] = [];
  const seenHand = new Set<number>();
  for (const sel of selections) {
    if (sel.zone === "hand") {
      if (seenHand.has(sel.handIndex))
        throw new Error("Duplicate hand selection");
      seenHand.add(sel.handIndex);
      const card = target.hand[sel.handIndex];
      if (!card) throw new Error("Selected hand card is missing");
      chosen.push({ card });
    } else if (sel.zone === "equipment") {
      let found: { card: Card; slot: RuntimeEquipmentSlot } | undefined;
      for (const slot of Object.keys(
        target.equipment,
      ) as RuntimeEquipmentSlot[]) {
        const e = target.equipment[slot];
        if (
          e &&
          (e.id === sel.cardInstanceId ||
            toCardInstance(e).instanceId === sel.cardInstanceId)
        ) {
          found = { card: e, slot };
          break;
        }
      }
      if (!found) throw new Error("Selected equipment is missing");
      if (chosen.some((c) => c.card === found!.card))
        throw new Error("Duplicate equipment selection");
      chosen.push(found);
    } else throw new Error("Decision-area selection is not supported");
  }
  for (const { card, slot } of chosen) {
    if (slot) target.equipment[slot] = null;
    else target.hand = target.hand.filter((c) => c !== card);
    moveToDiscard(state, card, false);
  }
  state.pendingReplaceDamage = undefined;
  logAction(
    state,
    "replace-damage-used",
    `${characterName(attacker)} ใช้ ${pending.weaponName} ทิ้งไพ่ ${chosen.length} ใบของ ${characterName(target)} แทนความเสียหาย`,
    attacker.id,
    target.id,
  );
  synchronizeGameState(state);
}
export function declineReplaceAttackDamage(
  state: GameState,
  attackerId: string,
) {
  const pending = state.pendingReplaceDamage;
  if (!pending || pending.attackerId !== attackerId)
    throw new Error("No damage-replacement decision is pending");
  state.pendingReplaceDamage = undefined;
  applyDamage(state, pending.targetId, pending.damage, attackerId);
  logAction(
    state,
    "replace-damage-declined",
    `${characterName(getPlayerById(state, attackerId)!)} เลือกให้เกิดความเสียหายตามปกติ`,
    attackerId,
    pending.targetId,
  );
  synchronizeGameState(state);
}
export function continueRepeatAttackAfterDodge(
  state: GameState,
  attackerId: string,
  attackCardInstanceId: string,
) {
  const pending = state.pendingRepeatAttack;
  if (!pending || pending.attackerId !== attackerId)
    throw new Error("No repeat attack is pending");
  const target = getPlayerById(state, pending.targetId),
    attacker = getPlayerById(state, attackerId);
  if (
    !target?.alive ||
    !attacker ||
    !canTargetWithAttack(state, attackerId, target.id)
  )
    throw new Error("Repeat target is no longer legal");
  const card = findHandCard(attacker, attackCardInstanceId);
  if (!card || card.effect !== "attack")
    throw new Error("Choose another Attack card");
  state.pendingRepeatAttack = undefined;
  const prior = state.turn.attackUsedThisTurn;
  state.turn.attackUsedThisTurn = 0;
  state.attacksThisTurn = 0;
  playAttack(state, attackerId, target.id, attackCardInstanceId);
  state.turn.attackUsedThisTurn = Math.max(
    prior + 1,
    state.turn.attackUsedThisTurn,
  );
  state.attacksThisTurn = state.turn.attackUsedThisTurn;
}
export function declineRepeatAttackAfterDodge(
  state: GameState,
  attackerId: string,
) {
  if (state.pendingRepeatAttack?.attackerId !== attackerId)
    throw new Error("No repeat attack is pending");
  state.pendingRepeatAttack = undefined;
  logAction(
    state,
    "repeat-attack-declined",
    `${characterName(getPlayerById(state, attackerId)!)} ไม่โจมตีซ้ำ`,
    attackerId,
  );
  synchronizeGameState(state);
}
export function useArmorJudgment(state: GameState, playerId: string) {
  const window = state.responseWindow,
    player = getPlayerById(state, playerId),
    attackerId = state.currentAction?.actorId;
  if (
    !window ||
    window.type !== "attack_dodge" ||
    window.currentResponderId !== playerId ||
    player?.equipment.armor?.effect !== "judgment_dodge" ||
    (attackerId && attackIgnoresTargetArmor(state, attackerId))
  )
    throw new Error("Armor judgment is not available");
  if (!state.deck.length) reshuffleDiscardIntoDrawPile(state);
  const judgment = state.deck.pop();
  if (!judgment) {
    logAction(
      state,
      "armor-judgment-empty",
      "กองจั่วไม่มีไพ่สำหรับการตัดสิน",
      playerId,
    );
    return false;
  }
  moveToDiscard(state, judgment, false);
  const success = ["♥", "♦"].includes(judgment.suit);
  logAction(
    state,
    "armor-judgment",
    `${characterName(player)} ตัดสิน ${judgment.suit}${judgment.number} ${success ? "สำเร็จ" : "ไม่สำเร็จ"}`,
    playerId,
  );
  if (success) {
    window.responses.push({
      playerId,
      response: "card",
      createdAt: new Date().toISOString(),
    });
    resolveCurrentAction(state);
  } else synchronizeGameState(state);
  return success;
}
/** Equips a card by metadata only. Individual equipment effects remain TODO. */
export function playEquipment(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
) {
  if (state.responseWindow || state.currentAction)
    throw new Error("Resolve the current action first");
  const player = getPlayerById(state, playerId);
  if (!player || !player.alive) throw new Error("Choose a living player");
  if (!canPlayerAct(state, playerId))
    throw new Error(
      "Equipment can only be played by the active player during the play phase",
    );
  const card = findHandCard(player, cardInstanceId),
    slot = card ? equipmentSlotForCard(card) : undefined;
  if (!card || !slot) throw new Error("Equipment card is not in your hand");
  player.hand = player.hand.filter((item) => item !== card);
  const replaced = player.equipment[slot];
  if (replaced) {
    moveToDiscard(state, replaced, false);
    logAction(
      state,
      "equipment-replaced",
      `${characterName(player)} เปลี่ยนอุปกรณ์จาก ${replaced.name} เป็น ${card.name}`,
      player.id,
      undefined,
      card.id,
    );
  } else
    logAction(
      state,
      "equipment-equipped",
      `${characterName(player)} ติดตั้ง ${card.name}`,
      player.id,
      undefined,
      card.id,
    );
  player.equipment[slot] = card;
  synchronizeGameState(state);
}
