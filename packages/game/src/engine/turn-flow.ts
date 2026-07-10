// Turn hand-off primitives (L5 ของ layering: พึ่ง state + sync)
// ย้าย verbatim จาก turns.ts เพื่อให้ damage/combat เริ่มเทิร์นถัดไปหลังผู้เล่นตาย
// ได้โดยไม่ import turns.ts (ที่พึ่ง combat ผ่าน applyDamage สาย lightning)
import type { GameState, PendingJudgment, Player } from "./types.js";
import {
  characterName,
  getPlayerById,
  getPlayersInSeatOrder,
  logAction,
} from "./state.js";
import { synchronizeGameState } from "./sync.js";
export function getNextAlivePlayer(state: GameState, currentPlayerId: string) {
  const players = getPlayersInSeatOrder(state),
    currentIndex = players.findIndex((player) => player.id === currentPlayerId);
  if (currentIndex < 0) return undefined;
  for (let step = 1; step <= players.length; step++) {
    const index =
      (currentIndex + step * state.direction + players.length) % players.length;
    if (players[index].alive) return players[index];
  }
  return undefined;
}
/** Sets up the next unresolved delayed trick as a pending (manual) judgment. Returns false if none remain. */
export function beginNextJudgment(state: GameState, player: Player): boolean {
  const tricks = player.decisionArea.filter(
    (card) =>
      card.effect === "delayed_skip_play_phase" ||
      card.effect === "delayed_lightning_judgment",
  );
  const trick = tricks[tricks.length - 1]; // กฎ: ตัดสินใบที่วางล่าสุดก่อน (LIFO) — วางทีหลังผลก่อน
  if (!trick) return false;
  state.pendingJudgment = {
    playerId: player.id,
    trickEffect: trick.effect as PendingJudgment["trickEffect"],
    trickName: trick.name,
    trickCardId: trick.id,
    stage: "awaiting_draw",
  };
  logAction(
    state,
    "judgment-pending",
    `${characterName(player)} ต้องเปิดไพ่ตัดสิน ${trick.name}`,
    player.id,
  );
  return true;
}
export function startTurn(state: GameState, playerId: string) {
  const player = getPlayerById(state, playerId);
  if (!player || !player.alive)
    throw new Error("Cannot start a turn for this player");
  state.currentPlayerId = playerId;
  state.hasDrawnThisTurn = false;
  state.attacksThisTurn = 0;
  state.skipPlayPhase = false;
  player.skippedPlayThisTurn = false; // clear last turn's "โดนใบ้" indicator
  state.skillsUsedThisTurn = [];
  state.unarmedPowerActive = false;
  state.benevolenceGivenThisTurn = 0;
  state.arrogancePenalty = false;
  state.turn = {
    activePlayerId: playerId,
    phase: "judgment",
    direction: state.direction === 1 ? "clockwise" : "counterclockwise",
    turnNumber: Math.max(1, state.turn.turnNumber),
    attackUsedThisTurn: 0,
    drawnThisTurn: 0,
  };
  logAction(
    state,
    "turn-start",
    `${characterName(player)} เริ่มเทิร์น`,
    player.id,
  );
  if (!beginNextJudgment(state, player)) state.turn.phase = "draw"; // no delayed tricks → straight to draw
  synchronizeGameState(state);
}
