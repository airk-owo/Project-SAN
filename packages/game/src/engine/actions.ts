// Targeted-card action framework and play-permission checks. Extracted verbatim from index.ts.
import type {
  Card,
  CurrentAction,
  GameState,
  Player,
  TargetRules,
  TargetedCardAction,
} from "./types.js";
import {
  characterName,
  findHandCard,
  getPlayerById,
  isEquipmentCard,
  logAction,
  moveToDiscard,
  toCardInstance,
} from "./state.js";
import { getAttackRange } from "./handlers/equipment.js";
import { getEffectiveDistanceBetweenPlayers } from "./handlers/combat.js";
export function createTargetedCardAction(
  state: GameState,
  actorId: string,
  cardInstanceId: string,
  targetIds: string[],
  rules: TargetRules,
  effectKey: string,
): TargetedCardAction {
  if (state.currentAction || state.responseWindow)
    throw new Error("Resolve the current action first");
  const actor = getPlayerById(state, actorId);
  if (!actor || !actor.alive) throw new Error("Choose a living actor");
  if (!canPlayerAct(state, actorId))
    throw new Error(
      "Only the active player may play a targeted card during the play phase",
    );
  const card = findHandCard(actor, cardInstanceId);
  if (!card) throw new Error("Card is not in your hand");
  const uniqueTargetIds = [...new Set(targetIds)];
  if (uniqueTargetIds.length !== targetIds.length)
    throw new Error("Targets must be unique");
  if (
    uniqueTargetIds.length < rules.minTargets ||
    uniqueTargetIds.length > rules.maxTargets
  )
    throw new Error("Invalid target count");
  const targets = uniqueTargetIds.map((id) => getPlayerById(state, id));
  if (targets.some((target) => !target || !target.alive))
    throw new Error("Every target must be alive");
  const resolvedTargets = targets as Player[];
  if (
    !rules.allowSelf &&
    resolvedTargets.some((target) => target.id === actorId)
  )
    throw new Error("You cannot target yourself");
  const maxDistance =
    rules.maxDistance === "attack"
      ? getAttackRange(state, actorId)
      : rules.maxDistance;
  if (
    maxDistance !== undefined &&
    resolvedTargets.some((target) => {
      const distance = getEffectiveDistanceBetweenPlayers(
        state,
        actorId,
        target.id,
      );
      return distance === null || distance > maxDistance;
    })
  )
    throw new Error("Target is out of range");
  actor.hand = actor.hand.filter((item) => item !== card);
  state.lastPlayedCard = card;
  const action: CurrentAction = {
    actionId: crypto.randomUUID(),
    actorId,
    card: toCardInstance(card),
    effectKey,
    targetIds: uniqueTargetIds,
    status: "declared",
    createdAt: new Date().toISOString(),
  };
  state.currentAction = action;
  logAction(
    state,
    "targeted-card-declared",
    `${characterName(actor)} ใช้ ${card.name} ใส่ ${resolvedTargets.map(characterName).join(", ")}`,
    actor.id,
    uniqueTargetIds[0],
    card.id,
  );
  return { action, actor, card, targets: resolvedTargets };
}

export function resolveTargetedCardAction(state: GameState, actionId: string) {
  const action = state.currentAction;
  if (!action || action.actionId !== actionId)
    throw new Error("Targeted action is not active");
  if (state.lastPlayedCard && !state.discard.includes(state.lastPlayedCard))
    moveToDiscard(state, state.lastPlayedCard);
  action.status = "resolved";
  state.currentAction = null;
  return action; // กันทิ้งซ้ำ: ถ้าไพ่ที่เล่นล่าสุดอยู่ในกองทิ้งแล้ว (เช่น โจโฉ รีเซ็ต lastPlayed เป็นไพ่ในกองทิ้ง) ไม่ต้องทิ้งอีก
}
export function canPlayerAct(state: GameState, playerId: string) {
  return (
    state.phase === "playing" &&
    state.turn.activePlayerId === playerId &&
    state.turn.phase === "play" &&
    !state.responseWindow &&
    !state.currentAction
  );
}
export function canPlayCardNow(state: GameState, playerId: string, card: Card) {
  if (card.effect === "negate_trick_effect") {
    const w = state.responseWindow;
    return (
      (w?.type === "negate" ||
        w?.type === "mass_dodge" ||
        w?.type === "mass_attack") &&
      w.currentResponderId === playerId &&
      w.status === "open"
    );
  }
  if (card.effect === "attack" && state.responseWindow?.type === "duel_attack")
    return (
      state.responseWindow.currentResponderId === playerId &&
      state.responseWindow.status === "open"
    );
  if (
    (card.effect === "dodge" || card.effect === "attack") &&
    (state.responseWindow?.type === "mass_dodge" ||
      state.responseWindow?.type === "mass_attack")
  )
    return (
      state.responseWindow.currentResponderId === playerId &&
      state.responseWindow.status === "open"
    );
  if (card.effect === "dodge")
    return (
      state.responseWindow?.type === "attack_dodge" &&
      state.responseWindow.currentResponderId === playerId &&
      state.responseWindow.status === "open"
    );
  if (card.effect === "heal" && state.responseWindow?.type === "dying_heal")
    return (
      state.responseWindow.currentResponderId === playerId &&
      state.responseWindow.status === "open"
    );
  return (
    (card.effect === "attack" ||
      card.effect === "duel_attack_response" ||
      card.effect === "all_others_dodge_or_damage" ||
      card.effect === "all_others_attack_or_damage" ||
      card.effect === "heal" ||
      card.effect === "draw_cards" ||
      card.effect === "heal_all_living" ||
      card.effect === "discard_target_card" ||
      card.effect === "steal_target_card_in_range" ||
      isEquipmentCard(card)) &&
    canPlayerAct(state, playerId)
  );
}
