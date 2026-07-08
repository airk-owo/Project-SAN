// QA God Mode socket layer. registerDevSandbox is only called from server.ts behind an
// explicit opt-in guard (NODE_ENV !== 'production' AND DEV_SANDBOX === '1') and refuses
// again here as defence in depth — fail-safe: forgetting the env means OFF, not on.
// Until registered, `deps` stays null: isTimerFrozen always returns false and devAutoTick is a no-op,
// so nothing in this module can affect a production game.
import type { Server, Socket } from 'socket.io';
import { devForceJudgment, devInsertTopDeck, devLoadSnapshot, devSetCharacter, devSetHp, devSnapshot, devSpawnCard, discardForHandLimit, drawForTurn, drawPendingCard, endTurn, getDiscardRequirement, getPlayerById, logAction, owedDraws, type Card, type Character, type GameState } from '@wtk/game';

export type DevSandboxDeps = {
 io: Server;
 games: Map<string, GameState>;
 connections: Map<string, string>;
 cards: Card[];
 characters: Character[];
 emitGame: (game: GameState) => void;
 pendingTimeoutFor: (game: GameState) => { key: string; run: () => void } | null;
};

let deps: DevSandboxDeps | null = null;
const frozenGames = new Set<string>(); // dev:toggle-freeze-timer — games whose decision timers are suspended
const dummyGames = new Set<string>();  // dev:set-dummy-mode — games where unfocused seats auto-decline/auto-play
const dummyTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DUMMY_STEP_MS = 450; // slow enough that the tester can watch each auto action land in the UI

/** True when the QA sandbox froze this game's timers. Always false in production: the set only fills via dev handlers. */
export const isTimerFrozen = (gameId: string) => frozenGames.has(gameId);

/** Re-arms the dummy auto-pass loop after every broadcast. No-op unless the sandbox is registered and dummy mode is on. */
export function devAutoTick(game: GameState) {
 if (!deps || !dummyGames.has(game.id) || dummyTimers.has(game.id)) return;
 const timer = setTimeout(() => { dummyTimers.delete(game.id); runDummyStep(game); }, DUMMY_STEP_MS);
 dummyTimers.set(game.id, timer);
}

/** Seats with a live socket attached — everyone else is a dummy while dummy mode is on. */
const focusedIds = (game: GameState) => {
 const d = deps!; const ids = new Set<string>();
 for (const player of game.players) { const socketId = d.connections.get(player.id); if (socketId && d.io.sockets.sockets.get(socketId)) ids.add(player.id); }
 return ids;
};

/** One dummy action per tick: decline the pending response (reusing the same "decline" closures the timeout system
 * uses, so auto-take-damage / auto-negate-decline stay rule-correct), or advance the dummy's own turn (draw → discard → end). */
function runDummyStep(game: GameState) {
 const d = deps; if (!d || !dummyGames.has(game.id) || !d.games.has(game.id)) return;
 const focused = focusedIds(game), isDummy = (playerId: string) => !focused.has(playerId) && Boolean(getPlayerById(game, playerId));
 let acted = false;
 try {
  const pending = d.pendingTimeoutFor(game);
  if (pending) { const responderId = pending.key.split(':').slice(1).join(':'); if (isDummy(responderId)) { pending.run(); acted = true; } }
  else if (game.phase === 'playing') {
   const activeId = game.turn.activePlayerId || game.currentPlayerId;
   if (activeId && isDummy(activeId)) {
    const player = getPlayerById(game, activeId)!;
    if (owedDraws(game, activeId) > 0) drawPendingCard(game, activeId);
    else if (!game.hasDrawnThisTurn) drawForTurn(game, activeId);
    else { const required = getDiscardRequirement(game, activeId); if (required > 0) discardForHandLimit(game, activeId, [...new Set(player.hand.map(card => card.id))].slice(0, required)); else endTurn(game, activeId); }
    acted = true;
   }
  }
 } catch { acted = false; } // engine rejected the auto step — stall; the loop re-arms on the next broadcast
 if (acted) d.emitGame(game); // emitGame → devAutoTick → next step
}

function attachDevHandlers(socket: Socket) {
 const d = deps!;
 const now = () => new Date().toISOString();
 const handle = (event: string, fn: (payload: Record<string, unknown>) => void) => socket.on(event, (payload: unknown) => { try { fn((payload ?? {}) as Record<string, unknown>); } catch (error) { socket.emit('game:error', (error as Error).message); } });
 const requireGame = (gameId: unknown) => { const game = d.games.get(String(gameId ?? '')); if (!game) throw new Error('Game not found'); return game; };
 const resolveTarget = (game: GameState, payload: Record<string, unknown>) => {
  const byId = payload.targetPlayerId ?? payload.playerId;
  if (byId !== undefined && byId !== null && byId !== '') { const player = getPlayerById(game, String(byId)); if (!player) throw new Error('Unknown player'); return player; }
  if (payload.seatIndex !== undefined) { const seat = Number(payload.seatIndex); const player = game.players.find(p => p.seatIndex === seat); if (!player) throw new Error(`ไม่มีผู้เล่นที่ที่นั่ง ${seat}`); return player; }
  const self = typeof socket.data.userId === 'string' ? getPlayerById(game, socket.data.userId) : undefined;
  if (!self) throw new Error('ระบุ targetPlayerId หรือ seatIndex'); return self;
 };

 // Hot-seat control: rebind this socket's identity to another seat so one tester plays all seats from one tab.
 handle('dev:switch-control', payload => {
  const game = requireGame(payload.gameId), player = resolveTarget(game, payload);
  const previousId = typeof socket.data.userId === 'string' ? socket.data.userId : undefined;
  if (previousId && previousId !== player.id && d.connections.get(previousId) === socket.id) d.connections.delete(previousId);
  socket.data.userId = player.id; d.connections.set(player.id, socket.id); socket.join(game.id);
  player.connectionStatus = 'online'; player.lastSeenAt = now();
  logAction(game, 'dev-switch-control', `🛠 QA: สลับการควบคุมไปยังที่นั่ง ${player.seatIndex} (${player.username})`, player.id);
  d.emitGame(game);
 });
 handle('dev:spawn-card', payload => { const game = requireGame(payload.gameId), player = resolveTarget(game, payload); devSpawnCard(game, d.cards, player.id, String(payload.card ?? payload.cardId ?? ''), payload.zone === 'equipment' ? 'equipment' : 'hand'); d.emitGame(game); });
 handle('dev:set-character', payload => { const game = requireGame(payload.gameId), player = resolveTarget(game, payload); devSetCharacter(game, d.characters, player.id, String(payload.character ?? payload.characterId ?? '')); d.emitGame(game); });
 handle('dev:set-hp', payload => { const game = requireGame(payload.gameId), player = resolveTarget(game, payload); devSetHp(game, player.id, Number(payload.hp), payload.maxHp === undefined ? undefined : Number(payload.maxHp)); d.emitGame(game); });
 handle('dev:toggle-freeze-timer', payload => {
  const game = requireGame(payload.gameId);
  const frozen = payload.frozen === undefined ? !frozenGames.has(game.id) : Boolean(payload.frozen);
  if (frozen) frozenGames.add(game.id); else frozenGames.delete(game.id);
  logAction(game, 'dev-freeze-timer', `🛠 QA: ${frozen ? 'หยุด' : 'เปิด'}นาฬิกาจับเวลาตอบสนอง`);
  d.emitGame(game); // refreshTimeout sees the flag, clears any running timer, and broadcasts responseDeadline: null
 });
 handle('dev:insert-top-deck', payload => { const game = requireGame(payload.gameId); devInsertTopDeck(game, d.cards, String(payload.card ?? payload.cardId ?? '')); d.emitGame(game); });
 handle('dev:force-judgment', payload => { const game = requireGame(payload.gameId); devForceJudgment(game, d.cards, String(payload.suit ?? ''), String(payload.rank ?? payload.number ?? '')); d.emitGame(game); });
 handle('dev:set-dummy-mode', payload => {
  const game = requireGame(payload.gameId);
  const enabled = payload.enabled === undefined ? !dummyGames.has(game.id) : Boolean(payload.enabled);
  if (enabled) dummyGames.add(game.id);
  else { dummyGames.delete(game.id); const timer = dummyTimers.get(game.id); if (timer) { clearTimeout(timer); dummyTimers.delete(game.id); } }
  logAction(game, 'dev-dummy-mode', `🛠 QA: โหมดหุ่นอัตโนมัติ (auto-pass) ${enabled ? 'เปิด' : 'ปิด'}`);
  d.emitGame(game);
 });
 handle('dev:load-snapshot', payload => {
  const game = requireGame(payload.gameId);
  devLoadSnapshot(game, typeof payload.snapshot === 'string' ? JSON.parse(payload.snapshot) : payload.snapshot);
  const userId = typeof socket.data.userId === 'string' ? socket.data.userId : undefined;
  if (userId && ![...game.players, ...game.spectators].some(member => member.id === userId)) game.spectators.push({ id: userId, username: 'QA', connectionStatus: 'online', joinedAt: now(), lastSeenAt: now() });
  d.emitGame(game);
 });
 // Companion to dev:load-snapshot: full authoritative state, via ack callback or a dev:snapshot event.
 socket.on('dev:export-snapshot', (payload: { gameId?: string } | undefined, ack?: (snapshot: GameState | null) => void) => {
  try { const game = requireGame(payload?.gameId); const snapshot = devSnapshot(game); if (typeof ack === 'function') ack(snapshot); else socket.emit('dev:snapshot', { gameId: game.id, snapshot }); }
  catch (error) { if (typeof ack === 'function') ack(null); socket.emit('game:error', (error as Error).message); }
 });
}

/** Wires the QA sandbox. Requires explicit DEV_SANDBOX=1 opt-in (and never in production) — re-checked here as defence in depth. */
export function registerDevSandbox(dependencies: DevSandboxDeps) {
 if (process.env.NODE_ENV === 'production' || process.env.DEV_SANDBOX !== '1') return;
 deps = dependencies;
 dependencies.io.on('connection', socket => attachDevHandlers(socket));
 console.log('⚠️  QA dev sandbox enabled (dev:* socket handlers active) — เปิดเพราะ DEV_SANDBOX=1; ห้ามตั้งบน production');
}
