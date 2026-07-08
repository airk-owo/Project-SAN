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
