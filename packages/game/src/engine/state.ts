// Core state helpers: players, zones, logging, draws, sync. Extracted verbatim from index.ts.
import type {
  Card,
  CardInstance,
  EquipmentSlots,
  GamePhase,
  GameState,
  GameStatus,
  HiddenHandSelection,
  Player,
  TurnPhase,
} from "./types.js";
import { reconcileLossSkills } from "./handlers/character-skills.js";
export const shuffled = <T>(items: T[]) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};
export const createEmptyEquipmentSlots = <
  T = CardInstance,
>(): EquipmentSlots<T> => ({
  weapon: null,
  armor: null,
  offensiveMount: null,
  defensiveMount: null,
});
export const toCardInstance = (card: Card, index = 0): CardInstance => ({
  instanceId: `${card.id}:${index}`,
  definitionKey: card.id,
  name: card.name,
  cardType: card.cardType,
  suit: card.suit || undefined,
  rank: card.number || undefined,
  color: ["♥", "♦"].includes(card.suit)
    ? "red"
    : ["♠", "♣"].includes(card.suit)
      ? "black"
      : undefined,
  backendEffectKey: card.effect || undefined,
  effectParams: card.effectParams,
});
const gameStatusFor = (phase: GamePhase): GameStatus =>
  phase === "waiting" || phase === "role-vote"
    ? "setup"
    : phase === "character-select" || phase === "direction-select"
      ? "character_selection"
      : phase === "playing"
        ? "playing"
        : "finished";
const turnPhaseFor = (state: GameState): TurnPhase => {
  if (state.phase !== "playing") return "inactive";
  return state.turn.phase === "inactive"
    ? state.hasDrawnThisTurn
      ? "play"
      : "draw"
    : state.turn.phase;
};
/** Keeps the persisted model aligned with the existing prototype fields during migration. */
export function synchronizeGameState(state: GameState): GameState {
  state.gameId = state.id;
  state.roomId = state.id;
  state.status = gameStatusFor(state.phase);
  state.updatedAt = new Date().toISOString();
  state.turn = {
    activePlayerId: state.currentPlayerId || null,
    phase: turnPhaseFor(state),
    direction: state.direction === 1 ? "clockwise" : "counterclockwise",
    turnNumber: state.turn.turnNumber,
    attackUsedThisTurn: state.attacksThisTurn,
    drawnThisTurn: state.turn.drawnThisTurn ?? 0,
  };
  state.drawPile = state.deck.map(toCardInstance);
  state.discardPile = state.discard.map(toCardInstance);
  if (state.pendingAction && !state.currentAction)
    state.currentAction = {
      actionId: state.pendingAction.id,
      actorId: state.pendingAction.actorId,
      card: toCardInstance(
        state.lastPlayedCard ||
          state.discard.find(
            (card) => card.id === state.pendingAction!.cardId,
          ) || {
            id: state.pendingAction.cardId,
            name: "Unknown",
            type: "",
            cardType: "basic",
            suit: "",
            number: "",
            image: null,
            description: null,
            effect: "attack",
            effectParams: {},
            triggerTiming: "on_play",
            equipmentSlot: null,
            createsResponseWindow: true,
            conditions: null,
          },
      ),
      effectKey: "attack",
      targetIds: [state.pendingAction.targetId],
      status: "resolving",
      createdAt: state.updatedAt,
    };
  if (state.pendingAction && !state.responseWindow)
    state.responseWindow = {
      windowId: `response:${state.pendingAction.id}`,
      type: "attack_dodge",
      sourceActionId: state.pendingAction.id,
      requiredPlayerIds: [state.pendingAction.targetId],
      currentResponderId: state.pendingAction.targetId,
      allowedResponseEffectKeys: [state.pendingAction.responseKey],
      responses: [],
      status: "open",
      createdAt: state.updatedAt,
    };
  reconcileLossSkills(state);
  return state;
}
export const getPlayerById = (state: GameState, playerId: string) =>
  state.players.find((player) => player.id === playerId);
export const getAlivePlayers = (state: GameState) =>
  state.players.filter((player) => player.alive);
export const getPlayersInSeatOrder = (state: GameState) =>
  [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
export const getAlivePlayersInSeatOrder = (state: GameState) =>
  getPlayersInSeatOrder(state).filter((player) => player.alive);
export function getBaseDistanceBetweenPlayers(
  state: GameState,
  fromPlayerId: string,
  toPlayerId: string,
) {
  if (fromPlayerId === toPlayerId) return 0;
  const players = getAlivePlayersInSeatOrder(state),
    fromIndex = players.findIndex((player) => player.id === fromPlayerId),
    toIndex = players.findIndex((player) => player.id === toPlayerId);
  if (fromIndex < 0 || toIndex < 0) return null;
  const clockwise = Math.abs(fromIndex - toIndex);
  return Math.min(clockwise, players.length - clockwise);
}
export const getTopDiscardCard = (state: GameState) =>
  state.discardPile.at(-1) ?? null;
export const getCurrentActionSummary = (state: GameState) =>
  state.currentAction
    ? {
        actorId: state.currentAction.actorId,
        targetIds: state.currentAction.targetIds,
        effectKey: state.currentAction.effectKey,
        cardName: state.currentAction.card?.name ?? null,
        status: state.currentAction.status,
      }
    : null;
export function draw(state: GameState, playerId: string, count = 1) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error("Unknown player");
  for (let i = 0; i < count; i++) {
    if (!state.deck.length && state.discard.length)
      state.deck = shuffled(state.discard.splice(0));
    const card = state.deck.pop();
    if (card) player.hand.push(card);
  }
}
/** Records cards a player is owed from an effect; they draw them manually via drawPendingCard. */
export const owedDraws = (state: GameState, playerId: string) =>
  state.pendingDraws?.[playerId] ?? 0;
export function grantDraws(state: GameState, playerId: string, count: number) {
  if (count <= 0) return;
  state.pendingDraws = {
    ...state.pendingDraws,
    [playerId]: owedDraws(state, playerId) + count,
  };
}
/** Draws one owed card for the player and decrements the owed count. */
export function drawPendingCard(state: GameState, playerId: string) {
  if (owedDraws(state, playerId) <= 0)
    throw new Error("คุณไม่มีไพ่ที่ต้องจั่ว");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  if (!state.deck.length) reshuffleDiscardIntoDrawPile(state);
  const card = state.deck.pop();
  if (card) {
    player.hand.push(card);
    logAction(
      state,
      "pending-draw",
      `${characterName(player)} จั่วไพ่ที่ได้รับ 1 ใบ`,
      player.id,
    );
  } else logAction(state, "draw-pile-empty", "กองจั่วและกองทิ้งมีไพ่ไม่พอ");
  const remaining = owedDraws(state, playerId) - 1;
  const next = { ...state.pendingDraws };
  if (remaining > 0) next[playerId] = remaining;
  else delete next[playerId];
  state.pendingDraws = Object.keys(next).length ? next : undefined;
  synchronizeGameState(state);
}
export const numberParam = (card: Card, key: string, fallback: number) => {
  const value = card.effectParams[key];
  return typeof value === "number" ? value : fallback;
};
export const characterName = (player: Player) =>
  player.username || player.character?.name || "ผู้เล่น";
export const findHandCard = (player: Player, cardInstanceId: string) =>
  player.hand.find(
    (card, index) =>
      card.id === cardInstanceId ||
      toCardInstance(card, index).instanceId === cardInstanceId,
  );
/** Validates a zero-based hand position without exposing the card stored there. */
export function validateHiddenHandIndex(
  state: GameState,
  selection: HiddenHandSelection,
) {
  const target = getPlayerById(state, selection.targetPlayerId);
  if (!target || !target.alive)
    throw new Error("Hidden-hand target must be alive");
  if (
    !Number.isInteger(selection.handIndex) ||
    selection.handIndex < 0 ||
    selection.handIndex >= target.hand.length
  )
    throw new Error("Hidden-hand index is invalid");
  return target;
}
/** Removes the exact card at an already-hidden hand position. Call only after action validation. */
export function resolveHiddenHandCard(
  state: GameState,
  selection: HiddenHandSelection,
) {
  const target = validateHiddenHandIndex(state, selection),
    [card] = target.hand.splice(selection.handIndex, 1);
  if (!card) throw new Error("Hidden-hand card is missing");
  return card;
}
export const logAction = (
  state: GameState,
  type: string,
  message: string,
  actorId?: string,
  targetId?: string,
  cardId?: string,
) =>
  state.log.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    type,
    message,
    actorId,
    targetId,
    cardId,
  });
export const moveToDiscard = (
  state: GameState,
  card: Card,
  setLastPlayed = true,
) => {
  state.discard.push(card);
  state.discardPile.push(toCardInstance(card, state.discard.length - 1));
  if (setLastPlayed) state.lastPlayedCard = card;
};
export type RuntimeEquipmentSlot = keyof EquipmentSlots<Card>;
export const equipmentSlotForCard = (
  card: Card,
): RuntimeEquipmentSlot | undefined => {
  switch (card.cardType) {
    case "weapon":
      return "weapon";
    case "armor":
      return "armor";
    case "offensive_mount":
      return "offensiveMount";
    case "defensive_mount":
      return "defensiveMount";
    default:
      break;
  }
  switch (card.equipmentSlot) {
    case "weapon":
      return "weapon";
    case "armor":
      return "armor";
    case "offensive_mount":
      return "offensiveMount";
    case "defensive_mount":
      return "defensiveMount";
    default:
      return undefined;
  }
};
export const isEquipmentCard = (card: Card) =>
  Boolean(equipmentSlotForCard(card));
/** Reveals the top draw-pile card for a judgment, logs it, and moves it to the discard pile. */
/** Records the latest judgment outcome so every client can flash it. */
export const recordJudgment = (
  state: GameState,
  playerId: string,
  trickName: string,
  judged: Card | null,
  result: string,
) => {
  state.lastJudgment = {
    playerId,
    trickName,
    cardName: judged?.name ?? "—",
    cardNumber: judged?.number ?? "",
    cardSuit: judged?.suit ?? "",
    result,
    at: new Date().toISOString(),
  };
};
/** ประกาศเหตุการณ์กลางโต๊ะให้ทุกคนเห็น (แบนเนอร์ชั่วคราว) — ใครทำอะไรสำคัญก็เรียกอันนี้ */
export const flashTable = (
  state: GameState,
  icon: string,
  title: string,
  detail?: string,
  card?: { name: string; number: string; suit: string },
) => {
  state.tableFlash = {
    icon,
    title,
    detail,
    card: card
      ? { name: card.name, number: card.number, suit: card.suit }
      : undefined,
    at: new Date().toISOString(),
  };
};
/** Keeps the visible top discard card on the table and shuffles older discards. TODO: seeded RNG for replay. */
export function reshuffleDiscardIntoDrawPile(state: GameState) {
  if (state.deck.length || state.discard.length < 2) return 0;
  const topDiscard = state.discard.at(-1)!,
    recycled = state.discard.slice(0, -1);
  state.deck = shuffled(recycled);
  state.discard = [topDiscard];
  state.lastPlayedCard = topDiscard;
  logAction(
    state,
    "draw-pile-reshuffled",
    "กองจั่วหมด จึงสับกองทิ้งเป็นกองจั่วใหม่",
  );
  synchronizeGameState(state);
  return recycled.length;
}
