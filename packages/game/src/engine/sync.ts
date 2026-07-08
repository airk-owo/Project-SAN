// State synchronization + draw-pile recycling (L3 ของ layering: พึ่ง state + skills)
// ย้าย verbatim จาก state.ts เพื่อตัดวง state → handlers → state:
// synchronizeGameState เรียก reconcileLossSkills (skills) — ชั้นล่างกว่า handlers
import type {
  GamePhase,
  GameState,
  GameStatus,
  TurnPhase,
} from "./types.js";
import {
  characterName,
  getPlayerById,
  logAction,
  owedDraws,
  shuffled,
  toCardInstance,
} from "./state.js";
import { reconcileLossSkills } from "./skills.js";
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
