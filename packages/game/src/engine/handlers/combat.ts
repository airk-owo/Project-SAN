// Basic-card combat handlers: attack/dodge/heal, damage, dying, death, and duels. Extracted verbatim from index.ts.
import type {
  Card,
  EffectParams,
  GameState,
  Player,
  WinningSide,
} from "../types.js";
import {
  characterName,
  findHandCard,
  getAlivePlayersInSeatOrder,
  getBaseDistanceBetweenPlayers,
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
import { getNextAlivePlayer, startTurn } from "../turns.js";
import { publicCardView } from "../view.js";
import {
  attackDamageBonus,
  attackDodgesRequired,
  cardActsAs,
  hasCharacterSkill,
  isImmuneToAttack,
} from "../skills.js";
import { dispatchGameEvent } from "../events.js";
import { assertForcedAttackTarget } from "./character-skills.js";
import {
  areOppositeGenders,
  attackIgnoresTargetArmor,
  getAttackRange,
  hasDamageDestroyTargetMount,
  hasDiscardTwoForceAttackDamage,
  hasOppositeGenderAttackChoice,
  hasRepeatAttackAfterDodge,
  hasReplaceDamageWithDiscardTwo,
  hasUnlimitedAttack,
} from "./equipment.js";
import { advanceMassResponseQueue } from "./tricks.js";
/**
 * Distance used by effects. It deliberately remains separate from the base
 * seat distance so the UI can show both values for debugging.
 */
export function getEffectiveDistanceBetweenPlayers(
  state: GameState,
  fromPlayerId: string,
  toPlayerId: string,
) {
  const baseDistance = getBaseDistanceBetweenPlayers(
    state,
    fromPlayerId,
    toPlayerId,
  );
  if (baseDistance === null) return null;
  if (fromPlayerId === toPlayerId) return 0;
  const from = getPlayerById(state, fromPlayerId),
    to = getPlayerById(state, toPlayerId);
  if (!from || !to) return null;
  const outgoingModifier =
    (from.equipment.offensiveMount ? 1 : 0) +
    (hasCharacterSkill(state, from.id, "outgoing_distance_minus_one") ? 1 : 0);
  const incomingModifier = to.equipment.defensiveMount ? 1 : 0;
  return Math.max(1, baseDistance - outgoingModifier + incomingModifier);
}
const playerHasAnyCard = (player: Player) =>
  player.hand.length > 0 || Object.values(player.equipment).some(Boolean);
export function canTargetWithAttack(
  state: GameState,
  attackerId: string,
  targetId: string,
) {
  const attacker = getPlayerById(state, attackerId),
    target = getPlayerById(state, targetId),
    distance = getEffectiveDistanceBetweenPlayers(state, attackerId, targetId);
  return Boolean(
    attacker &&
    target &&
    attacker.alive &&
    target.alive &&
    attackerId !== targetId &&
    !isImmuneToAttack(state, targetId) &&
    distance !== null &&
    distance <= getAttackRange(state, attackerId),
  );
}
export function openDyingRescueWindow(
  state: GameState,
  dyingPlayerId: string,
  killerId?: string,
  sourceActionId = state.currentAction?.actionId || crypto.randomUUID(),
) {
  const dyingPlayer = getPlayerById(state, dyingPlayerId);
  if (!dyingPlayer || !dyingPlayer.alive)
    throw new Error("Dying player is not eligible for rescue");
  const alive = getAlivePlayersInSeatOrder(state),
    dyingIndex = alive.findIndex((player) => player.id === dyingPlayerId);
  if (dyingIndex < 0)
    throw new Error("Dying player is missing from seat order");
  const queue = [...alive.slice(dyingIndex), ...alive.slice(0, dyingIndex)].map(
      (player) => player.id,
    ),
    now = new Date().toISOString();
  state.responseWindow = {
    windowId: crypto.randomUUID(),
    type: "dying_heal",
    sourceActionId,
    dyingPlayerId,
    dyingKillerId: killerId,
    requiredPlayerIds: queue,
    currentResponderId: queue[0] || null,
    allowedResponseEffectKeys: ["heal"],
    responses: [],
    status: "open",
    createdAt: now,
    responderQueue: queue,
  };
  logAction(
    state,
    "dying",
    `${characterName(dyingPlayer)} เข้าสู่สถานะใกล้ตาย`,
    undefined,
    dyingPlayer.id,
  );
  logAction(
    state,
    "dying-heal-request",
    `กำลังขอ เสบียง เพื่อช่วย ${characterName(dyingPlayer)}`,
    undefined,
    dyingPlayer.id,
  );
}

/** Damage opens a dying-heal window at 0 HP; death waits until every responder declines. */
export function applyDamage(
  state: GameState,
  targetId: string,
  amount: number,
  killerId?: string,
  sourceCard?: Card,
) {
  const target = getPlayerById(state, targetId);
  if (!target || !target.alive || target.hp === undefined)
    throw new Error("Choose a living target");
  target.hp = Math.max(0, target.hp - amount);
  logAction(
    state,
    "damage",
    `${characterName(target)} เสีย ${amount} HP`,
    undefined,
    target.id,
  );
  dispatchGameEvent(state, {
    name: "after_damage",
    targetId,
    actorId: killerId,
    amount,
    card: sourceCard,
  }); // character-skill triggers (โจโฉ/กุยแก ฯลฯ)
  if (target.alive && target.hp === 0)
    openDyingRescueWindow(state, target.id, killerId);
}
function discardPlayerZones(
  state: GameState,
  player: Player,
  includeDecisionArea = true,
) {
  for (const card of player.hand.splice(0)) moveToDiscard(state, card, false);
  for (const slot of Object.keys(player.equipment) as RuntimeEquipmentSlot[]) {
    const card = player.equipment[slot];
    if (card) {
      player.equipment[slot] = null;
      moveToDiscard(state, card, false);
    }
  }
  if (includeDecisionArea)
    for (const card of player.decisionArea.splice(0))
      moveToDiscard(state, card, false);
}
function finishGame(state: GameState, winner: WinningSide) {
  state.winner = winner;
  state.phase = "ended";
  state.status = "finished";
  state.currentPlayerId = undefined;
  state.turn.activePlayerId = null;
  state.turn.phase = "inactive";
  state.players.forEach((p) => {
    p.roleRevealed = true;
  });
  logAction(
    state,
    "game-finished",
    winner === "traitor"
      ? "คนทรยศชนะ"
      : winner === "rebels"
        ? "กบฏชนะ"
        : "จักรพรรดิและผู้ภักดีชนะ",
  );
}
function checkWinCondition(state: GameState, dead: Player) {
  if (dead.role === "emperor") {
    const living = state.players.filter((player) => player.alive);
    finishGame(
      state,
      living.length > 0 && living.every((player) => player.role === "traitor")
        ? "traitor"
        : "rebels",
    );
    return true;
  }
  if (
    !state.players.some(
      (player) =>
        player.alive && (player.role === "rebel" || player.role === "traitor"),
    )
  ) {
    finishGame(state, "emperor_loyalists");
    return true;
  }
  return false;
}
/** Resolves role reveal, zone cleanup, death rewards, and safe turn handoff. */
export function resolvePlayerDeath(
  state: GameState,
  playerId: string,
  killerId?: string,
) {
  const dead = getPlayerById(state, playerId);
  if (!dead || !dead.alive) throw new Error("Player is not alive");
  const killer = killerId ? getPlayerById(state, killerId) : undefined;
  dead.roleRevealed = true;
  discardPlayerZones(state, dead);
  dead.alive = false;
  logAction(
    state,
    "player-died",
    `${characterName(dead)} ตาย และเปิดเผยบทบาท ${dead.role || "ไม่ทราบ"}`,
    undefined,
    dead.id,
  );
  if (killer?.alive && dead.role === "rebel") {
    grantDraws(state, killer.id, 3);
    logAction(
      state,
      "rebel-kill-reward",
      `${characterName(killer)} กำจัดกบฏ ได้รับสิทธิ์จั่วการ์ด 3 ใบ`,
      killer.id,
      dead.id,
    );
  }
  if (killer?.alive && killer.role === "emperor" && dead.role === "loyalist") {
    discardPlayerZones(state, killer, false);
    logAction(
      state,
      "emperor-loyalist-penalty",
      `${characterName(killer)} กำจัดผู้ภักดี จึงทิ้งไพ่บนมือและอุปกรณ์ทั้งหมด`,
      killer.id,
      dead.id,
    );
  }
  if (checkWinCondition(state, dead)) {
    synchronizeGameState(state);
    return;
  }
  if (state.turn.activePlayerId === dead.id) {
    const next = getNextAlivePlayer(state, dead.id);
    if (next) {
      state.turn.turnNumber++;
      startTurn(state, next.id);
    }
  }
  synchronizeGameState(state);
}
/** Voluntary surrender: the player forces their own death so a game isn't blocked when someone has to step away. */
export function surrenderPlayer(state: GameState, playerId: string) {
  const p = getPlayerById(state, playerId);
  if (!p || !p.alive) throw new Error("ผู้เล่นไม่อยู่ในเกมหรือถูกกำจัดแล้ว");
  logAction(
    state,
    "surrender",
    `${characterName(p)} ยอมแพ้ (บังคับตนเองตาย)`,
    playerId,
  );
  const rw = state.responseWindow,
    act = state.currentAction,
    pa = state.pendingAction;
  const involved = Boolean(
    (rw &&
      (rw.currentResponderId === playerId ||
        rw.requiredPlayerIds?.includes(playerId) ||
        rw.dyingPlayerId === playerId)) ||
    (act && (act.actorId === playerId || act.targetIds?.includes(playerId))) ||
    (pa && (pa.actorId === playerId || pa.targetId === playerId)),
  );
  if (involved) {
    state.responseWindow = null;
    state.suspendedResponseWindow = undefined;
    state.currentAction = null;
    state.pendingAction = undefined;
  }
  if (state.pendingJudgment?.playerId === playerId)
    state.pendingJudgment = undefined;
  resolvePlayerDeath(state, playerId);
}

export function healPlayer(state: GameState, playerId: string, amount: number) {
  const player = getPlayerById(state, playerId);
  if (
    !player ||
    !player.alive ||
    player.hp === undefined ||
    player.maxHp === undefined
  )
    throw new Error("Choose a living player");
  const restored = Math.min(amount, player.maxHp - player.hp);
  player.hp += restored;
  logAction(
    state,
    "healed",
    `${characterName(player)} ฟื้นฟู ${restored} HP`,
    player.id,
  );
  return restored;
}

export function declineResponse(state: GameState, playerId: string) {
  const window = state.responseWindow;
  if (
    !window ||
    window.status !== "open" ||
    window.currentResponderId !== playerId
  )
    throw new Error("You cannot decline this response");
  const responder = getPlayerById(state, playerId);
  if (!responder) throw new Error("Unknown responder");
  window.responses.push({
    playerId,
    response: "decline",
    createdAt: new Date().toISOString(),
  });
  if (window.type === "attack_dodge") {
    logAction(
      state,
      "attack-declined",
      `${characterName(responder)} ไม่ตอบสนอง`,
      responder.id,
    );
    return resolveCurrentAction(state);
  }
  if (window.type === "duel_attack") {
    logAction(
      state,
      "duel-declined",
      `${characterName(responder)} ไม่สามารถตอบโต้ได้`,
      responder.id,
    );
    return resolveDuel(state, responder.id);
  }
  if (window.type !== "dying_heal")
    throw new Error("Unsupported response window");
  const dying = getPlayerById(state, window.dyingPlayerId || "");
  if (!dying) throw new Error("Dying player is missing");
  const queue = window.responderQueue || window.requiredPlayerIds;
  const next = queue.find(
    (id) => !window.responses.some((response) => response.playerId === id),
  );
  if (next) {
    const nextPlayer = getPlayerById(state, next);
    if (!nextPlayer) throw new Error("Responder is missing");
    window.currentResponderId = next;
    logAction(
      state,
      "dying-heal-request",
      `กำลังรอ ${characterName(nextPlayer)} ว่าจะใช้ เสบียง ช่วย ${characterName(dying)} หรือไม่`,
      next,
      dying.id,
    );
    synchronizeGameState(state);
    return;
  }
  window.status = "resolved";
  state.responseWindow = null;
  logAction(
    state,
    "dying-unrescued",
    `ไม่มีผู้เล่นช่วย ${characterName(dying)}`,
    undefined,
    dying.id,
  );
  resolvePlayerDeath(state, dying.id, window.dyingKillerId);
  if (state.suspendedResponseWindow && state.status !== "finished") {
    state.responseWindow = state.suspendedResponseWindow;
    state.suspendedResponseWindow = undefined;
    advanceMassResponseQueue(state);
  }
}
export function playAttack(
  state: GameState,
  attackerId: string,
  targetId: string,
  cardInstanceId: string,
) {
  const initiatingCard =
    getPlayerById(state, attackerId) &&
    findHandCard(getPlayerById(state, attackerId)!, cardInstanceId);
  if (initiatingCard?.effect === "duel_attack_response")
    return playDuel(state, attackerId, targetId, cardInstanceId);
  if (
    state.turn.attackUsedThisTurn >= 1 &&
    !hasUnlimitedAttack(state, attackerId)
  )
    throw new Error("You may only use one attack per turn");
  if (isImmuneToAttack(state, targetId))
    throw new Error(
      "เป้าหมายมือว่างและไม่สามารถถูกโจมตีได้ (กลยุทธ์เมืองว่าง)",
    );
  assertForcedAttackTarget(state, attackerId, [targetId]);
  const prepared = createTargetedCardAction(
    state,
    attackerId,
    cardInstanceId,
    [targetId],
    { minTargets: 1, maxTargets: 1, allowSelf: false, maxDistance: "attack" },
    "attack",
  );
  const attacker = prepared.actor,
    target = prepared.targets[0]!;
  const card = prepared.card,
    actionId = prepared.action.actionId;
  if (!cardActsAs(state, attacker.id, card, "attack"))
    throw new Error("Attack card is not in your hand");
  if (
    target.equipment.armor?.effect === "black_attack_immunity" &&
    ["♠", "♣"].includes(card.suit) &&
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
  // Twin Swords: attacking an opposite-gender target pauses for the target to discard a card or let the attacker draw, before the normal dodge window opens.
  if (
    hasOppositeGenderAttackChoice(state, attacker.id) &&
    areOppositeGenders(attacker, target)
  ) {
    state.pendingTwinSwords = {
      attackerId: attacker.id,
      targetId: target.id,
      actionId,
      attackCardId: card.id,
      damage: numberParam(card, "damage", 1),
      weaponName: attacker.equipment.weapon?.name || "อาวุธ",
    };
    logAction(
      state,
      "twin-swords-choice",
      `${characterName(attacker)} ใช้ ${attacker.equipment.weapon?.name || "อาวุธ"} — ${characterName(target)} ต้องเลือกทิ้งไพ่ หรือให้ผู้โจมตีจั่ว`,
      attacker.id,
      target.id,
    );
    synchronizeGameState(state);
    return;
  }
  // ม้าเฉียว ม้าคะนองศึก: reveal a judgment on attack; if red (♥/♦) the target cannot dodge.
  let noDodge = false;
  if (hasCharacterSkill(state, attacker.id, "attack_judgment_no_dodge")) {
    if (!state.deck.length) reshuffleDiscardIntoDrawPile(state);
    const judge = state.deck.pop();
    if (judge) {
      moveToDiscard(state, judge, false);
      noDodge = ["♥", "♦"].includes(judge.suit);
      logAction(
        state,
        "skill-horse-charge",
        `${characterName(attacker)} ใช้ ม้าคะนองศึก เปิดตัดสิน ${judge.name} (${judge.number}${judge.suit}) — ${noDodge ? "เป้าหมายหลบไม่ได้" : "หลบได้ตามปกติ"}`,
        attacker.id,
        target.id,
        judge.id,
      );
    }
  }
  openAttackDodgeWindow(
    state,
    attacker,
    target,
    actionId,
    card.id,
    numberParam(card, "damage", 1),
    noDodge,
  );
}
/** Increments the per-turn attack counters and opens the standard attack-dodge window. */
export function openAttackDodgeWindow(
  state: GameState,
  attacker: Player,
  target: Player,
  actionId: string,
  cardId: string,
  damage: number,
  noDodge = false,
) {
  state.attacksThisTurn++;
  state.turn.attackUsedThisTurn++;
  state.responseWindow = {
    windowId: crypto.randomUUID(),
    type: "attack_dodge",
    sourceActionId: actionId,
    requiredPlayerIds: [target.id],
    currentResponderId: target.id,
    allowedResponseEffectKeys: noDodge ? [] : ["dodge"],
    responses: [],
    status: "open",
    createdAt: new Date().toISOString(),
  };
  state.pendingAction = {
    id: actionId,
    kind: "attack",
    actorId: attacker.id,
    targetId: target.id,
    cardId,
    responseKey: "dodge",
    damage: damage + attackDamageBonus(state, attacker.id),
    dodgesRequired: attackDodgesRequired(state, attacker.id),
    noDodge,
  };
  synchronizeGameState(state);
}
export function playDuel(
  state: GameState,
  actorId: string,
  targetId: string,
  cardInstanceId: string,
) {
  if (isImmuneToAttack(state, targetId))
    throw new Error(
      "เป้าหมายมือว่างและไม่สามารถถูกท้าสู้ได้ (กลยุทธ์เมืองว่าง)",
    ); // จูกัดเหลียง กลยุทธ์เมืองว่าง
  const prepared = createTargetedCardAction(
    state,
    actorId,
    cardInstanceId,
    [targetId],
    { minTargets: 1, maxTargets: 1, allowSelf: false },
    "duel_attack_response",
  );
  const target = prepared.targets[0]!;
  if (prepared.card.effect !== "duel_attack_response")
    throw new Error("Duel card is not in your hand");
  state.responseWindow = {
    windowId: crypto.randomUUID(),
    type: "duel_attack",
    sourceActionId: prepared.action.actionId,
    requiredPlayerIds: [actorId, targetId],
    currentResponderId: targetId,
    allowedResponseEffectKeys: ["attack"],
    responses: [],
    status: "open",
    createdAt: new Date().toISOString(),
  };
  synchronizeGameState(state);
}
export function playAttackResponse(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
) {
  const window = state.responseWindow,
    action = state.currentAction;
  if (
    !window ||
    !action ||
    window.type !== "duel_attack" ||
    window.currentResponderId !== playerId
  )
    throw new Error("You cannot respond to this duel now");
  const player = getPlayerById(state, playerId),
    card = player && findHandCard(player, cardInstanceId);
  if (!player || !card || !cardActsAs(state, playerId, card, "attack"))
    throw new Error("Attack card is not in your hand");
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
    "duel-attack-response",
    `${characterName(player)} ตอบโต้ด้วย โจมตี`,
    player.id,
  );
  const opponent =
    playerId === action.actorId ? action.targetIds[0]! : action.actorId;
  const attacksNeeded = hasCharacterSkill(
    state,
    opponent,
    "attack_needs_two_dodges",
  )
    ? 2
    : 1; // ลิโป้ ไร้เทียมทาน: ต้องใช้ "โจมตี" 2 ใบในดวล
  const provided = (window.duelResponderAttacks ?? 0) + 1;
  if (provided < attacksNeeded) {
    window.duelResponderAttacks = provided;
    logAction(
      state,
      "duel-need-more-attack",
      `${characterName(player)} ต้องใช้ โจมตี อีก ${attacksNeeded - provided} ใบ (ไร้เทียมทาน)`,
      player.id,
    );
    synchronizeGameState(state);
    return;
  }
  window.duelResponderAttacks = 0;
  window.currentResponderId = opponent;
  synchronizeGameState(state);
}
export function resolveDuel(state: GameState, failedPlayerId: string) {
  const action = state.currentAction,
    window = state.responseWindow;
  if (
    !action ||
    !window ||
    window.type !== "duel_attack" ||
    window.currentResponderId !== failedPlayerId
  )
    throw new Error("Duel is not awaiting this player");
  const failed = getPlayerById(state, failedPlayerId),
    killerId =
      failedPlayerId === action.actorId ? action.targetIds[0] : action.actorId;
  if (!failed) throw new Error("Duel participant is missing");
  window.status = "resolved";
  state.responseWindow = null;
  const sourceCard = state.lastPlayedCard;
  /* ไพ่ท้าสู้/สาวงามยุยง ที่ก่อความเสียหาย → โจโฉ ไม่ยอมให้โลกทรยศ เก็บเข้ามือ */ applyDamage(
    state,
    failedPlayerId,
    1 + (killerId ? attackDamageBonus(state, killerId) : 0),
    killerId,
    sourceCard,
  );
  resolveTargetedCardAction(state, action.actionId);
  synchronizeGameState(state);
}
export function resolveCurrentAction(state: GameState) {
  const action = state.currentAction;
  if (!action) throw new Error("There is no current action to resolve");
  if (action.effectKey !== "attack")
    throw new Error("Only attack resolution is supported");
  const targetId = action.targetIds[0],
    target = getPlayerById(state, targetId),
    attacker = getPlayerById(state, action.actorId);
  if (!target || !attacker) throw new Error("Action participant is missing");
  const attackWindow = state.responseWindow;
  if (!attackWindow?.responses.some((item) => item.playerId === targetId))
    throw new Error("Attack response is still required");
  const dodgesProvided = attackWindow.responses.filter(
      (item) => item.playerId === targetId && item.response === "card",
    ).length,
    dodgesNeeded = state.pendingAction?.dodgesRequired ?? 1;
  if (dodgesProvided >= dodgesNeeded)
    logAction(
      state,
      "attack-cancelled",
      "โจมตีถูกยกเลิก",
      attacker.id,
      target.id,
      action.card?.definitionKey,
    );
  else {
    const damage =
      numberParam(
        state.lastPlayedCard || ({ effectParams: {} as EffectParams } as Card),
        "damage",
        1,
      ) + attackDamageBonus(state, attacker.id);
    if (
      hasReplaceDamageWithDiscardTwo(state, attacker.id) &&
      playerHasAnyCard(target)
    ) {
      const weaponName = attacker.equipment.weapon?.name || "อาวุธ";
      state.pendingReplaceDamage = {
        attackerId: attacker.id,
        targetId: target.id,
        damage,
        weaponName,
      };
      logAction(
        state,
        "replace-damage-window",
        `${characterName(attacker)} อาจใช้ ${weaponName} ทิ้งไพ่ของ ${characterName(target)} แทนความเสียหาย`,
        attacker.id,
        target.id,
      );
    } else {
      applyDamage(state, target.id, damage, attacker.id, state.lastPlayedCard);
      if (
        target.alive &&
        hasDamageDestroyTargetMount(state, attacker.id) &&
        (target.equipment.offensiveMount || target.equipment.defensiveMount)
      )
        state.pendingDestroyMount = {
          attackerId: attacker.id,
          targetId: target.id,
        };
    }
  }
  if (attackWindow) attackWindow.status = "resolved";
  resolveTargetedCardAction(state, action.actionId);
  if (state.responseWindow === attackWindow) state.responseWindow = null;
  state.pendingAction = undefined;
  synchronizeGameState(state);
}
export function playDodge(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
) {
  const window = state.responseWindow,
    action = state.currentAction;
  if (
    !window ||
    !action ||
    window.type !== "attack_dodge" ||
    window.status !== "open" ||
    window.currentResponderId !== playerId
  )
    throw new Error("You cannot dodge now");
  if (state.pendingAction?.noDodge)
    throw new Error("เป้าหมายหลบไม่ได้ (ม้าคะนองศึก)");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  const card = findHandCard(player, cardInstanceId);
  if (!card || !cardActsAs(state, playerId, card, "dodge"))
    throw new Error("Dodge card is not in your hand");
  const attacker = getPlayerById(state, action.actorId),
    canRepeat = Boolean(
      attacker &&
      hasRepeatAttackAfterDodge(state, attacker.id) &&
      player.alive &&
      canTargetWithAttack(state, attacker.id, player.id),
    );
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
    "attack-dodged",
    `${characterName(player)} ใช้ หลบ`,
    player.id,
    action.actorId,
    card.id,
  );
  const dodgesNeeded = state.pendingAction?.dodgesRequired ?? 1,
    dodgesProvided = window.responses.filter(
      (r) => r.playerId === playerId && r.response === "card",
    ).length;
  if (dodgesProvided < dodgesNeeded) {
    logAction(
      state,
      "attack-need-more-dodge",
      `${characterName(player)} ต้องใช้ หลบ อีก ${dodgesNeeded - dodgesProvided} ใบ (ไร้เทียมทาน)`,
      player.id,
    );
    synchronizeGameState(state);
    return;
  }
  resolveCurrentAction(state);
  if (canRepeat && attacker)
    state.pendingRepeatAttack = {
      attackerId: attacker.id,
      targetId: player.id,
      weaponName: attacker.equipment.weapon?.name || "อาวุธ",
    };
  if (attacker && hasDiscardTwoForceAttackDamage(state, attacker.id)) {
    const discardable =
      attacker.hand.length +
      Object.values(attacker.equipment).filter(Boolean).length;
    if (discardable >= 2)
      state.pendingForceAttackDamage = {
        attackerId: attacker.id,
        targetId: player.id,
      };
  }
}
export function playHeal(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
) {
  const player = getPlayerById(state, playerId);
  if (!player || !player.alive) throw new Error("Choose a living player");
  const card = findHandCard(player, cardInstanceId);
  if (!card || !cardActsAs(state, playerId, card, "heal"))
    throw new Error("Heal card is not in your hand");
  const window = state.responseWindow;
  if (window?.type === "dying_heal") {
    if (window.status !== "open" || window.currentResponderId !== playerId)
      throw new Error("You cannot use Heal in this rescue window");
    const dying = getPlayerById(state, window.dyingPlayerId || "");
    if (!dying || dying.hp === undefined)
      throw new Error("Dying player is missing");
    player.hand = player.hand.filter((item) => item !== card);
    logAction(
      state,
      "dying-heal-played",
      `${characterName(player)} ใช้ เสบียง ช่วย ${characterName(dying)}`,
      player.id,
      dying.id,
      card.id,
    );
    const rescueBonus =
      dying.role === "emperor" &&
      hasCharacterSkill(state, dying.id, "emperor_rescue_double") &&
      state.players.some(
        (p) => p.alive && p.id !== dying.id && p.character?.kingdom === "WU",
      )
        ? 1
        : 0; // ซุนกวน ค้ำจุน
    if (rescueBonus)
      logAction(
        state,
        "skill-guardian",
        `${characterName(dying)} ใช้ ค้ำจุน ฟื้นฟูเพิ่มอีก 1 หน่วย`,
        dying.id,
      );
    healPlayer(
      state,
      dying.id,
      numberParam(card, "heal_amount", 1) + rescueBonus,
    );
    moveToDiscard(state, card);
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
      "dying-rescued",
      `${characterName(dying)} รอดจากสถานะใกล้ตาย`,
      undefined,
      dying.id,
    );
    if (state.suspendedResponseWindow) {
      state.responseWindow = state.suspendedResponseWindow;
      state.suspendedResponseWindow = undefined;
      advanceMassResponseQueue(state);
    }
    synchronizeGameState(state);
    return;
  }
  if (state.currentAction || window)
    throw new Error("Resolve the current action first");
  if (
    player.hp === undefined ||
    player.maxHp === undefined ||
    player.hp >= player.maxHp
  )
    throw new Error("You can only heal yourself while wounded");
  if (!canPlayerAct(state, playerId))
    throw new Error(
      "Heal can only be played by the active player during the play phase",
    );
  player.hand = player.hand.filter((item) => item !== card);
  logAction(
    state,
    "heal-played",
    `${characterName(player)} ใช้ เสบียง`,
    player.id,
    undefined,
    card.id,
  );
  healPlayer(state, player.id, numberParam(card, "heal_amount", 1));
  moveToDiscard(state, card);
  synchronizeGameState(state);
}
