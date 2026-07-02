import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, dealRoles, beginPlayAfterCharacters,
  playCard, startTurn, drawOneTurnCard, declineNegate, endTurn,
  drawJudgmentCard, resolveJudgmentCard, keepJudgmentCard,
  type Card, type Character, type GameState, type Spectator,
} from './index.js';

/** Decline the negate window that every trick now opens, so its effect resolves. */
function passNegate(game: GameState): void {
  while (game.responseWindow?.type === 'negate' && game.responseWindow.currentResponderId) {
    declineNegate(game, game.responseWindow.currentResponderId);
  }
}

/** Manually reveal the pending judgment then let it resolve (goes to discard). */
function runJudgment(game: GameState, playerId: string): void {
  drawJudgmentCard(game, playerId);
  resolveJudgmentCard(game, playerId);
}

const NOW = '2026-01-01T00:00:00.000Z';

const spectator = (id: string): Spectator => ({
  id, username: id, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW,
});

const makeCard = (id: string, effect: string, cardType: string, suit: string, number: string): Card => ({
  id, name: id, type: cardType, cardType: cardType as Card['cardType'], suit, number,
  image: null, description: null, effect, effectParams: {},
  triggerTiming: effect.startsWith('delayed') ? 'on_judgment' : 'on_play', equipmentSlot: null, createsResponseWindow: false, conditions: null,
});
const indulgence = (id: string): Card => makeCard(id, 'delayed_skip_play_phase', 'delayed_trick', '♣', 'Q');
const lightning = (id: string): Card => makeCard(id, 'delayed_lightning_judgment', 'delayed_trick', '♠', '2');
const plain = (id: string, suit: string, number: string): Card => makeCard(id, 'attack', 'basic', suit, number);
const makeCharacter = (id: string): Character => ({ id, name: id, hp: 4, faction: 'test', skills: [] });

function makePlayingGame(): GameState {
  const host = spectator('p0');
  const game = createGame('room1', host, []);
  game.spectators = [];
  game.players.push(createSeatedPlayer(host, 1));
  for (let i = 1; i < 4; i++) game.players.push(createSeatedPlayer(spectator(`p${i}`), i + 1));
  dealRoles(game, { emperor: 1, rebel: 2, loyalist: 0, traitor: 1 });
  game.players.forEach((p, i) => { p.character = makeCharacter(`char${i}`); p.confirmedCharacter = true; p.maxHp = 4; p.hp = 4; p.characterOptions = []; });
  beginPlayAfterCharacters(game, 0);
  game.turn.phase = 'play';
  game.turn.activePlayerId = 'p0';
  game.currentPlayerId = 'p0';
  game.hasDrawnThisTurn = true;
  return game;
}

describe('Delayed tricks – placement', () => {
  it('Indulgence goes into the target decision area, not self', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [indulgence('ind1')];
    playCard(game, 'p0', 'ind1', 'p1'); passNegate(game);
    assert.ok(game.players.find(p => p.id === 'p1')!.decisionArea.some(c => c.id === 'ind1'));
    assert.throws(() => { const g = makePlayingGame(); g.players.find(p => p.id === 'p0')!.hand = [indulgence('x')]; playCard(g, 'p0', 'x', 'p0'); }, /ตัวเอง/);
  });

  it('Lightning goes into the actor own decision area', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [lightning('lig1')];
    playCard(game, 'p0', 'lig1'); passNegate(game);
    assert.ok(game.players.find(p => p.id === 'p0')!.decisionArea.some(c => c.id === 'lig1'));
  });

  it('cannot place a duplicate delayed trick on the same player', () => {
    const game = makePlayingGame();
    const target = game.players.find(p => p.id === 'p1')!;
    target.decisionArea = [indulgence('existing')];
    game.players.find(p => p.id === 'p0')!.hand = [indulgence('ind2')];
    assert.throws(() => playCard(game, 'p0', 'ind2', 'p1'));
  });
});

describe('Judgment phase – Indulgence (delayed_skip_play_phase)', () => {
  it('a non-heart judgment skips the play phase (draw jumps to discard)', () => {
    const game = makePlayingGame();
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.decisionArea = [indulgence('ind')];
    game.deck = [plain('d1', '♣', '5'), plain('d2', '♣', '6'), plain('judge', '♠', 'K')]; // top (popped first) is ♠K = non-heart
    startTurn(game, 'p1');
    assert.equal(game.pendingJudgment?.stage, 'awaiting_draw', 'judgment waits for a manual draw');
    runJudgment(game, 'p1');
    assert.ok(!p1.decisionArea.some(c => c.id === 'ind'), 'indulgence discarded after judgment');
    drawOneTurnCard(game, 'p1');
    drawOneTurnCard(game, 'p1');
    assert.equal(game.turn.phase, 'discard', 'play phase was skipped');
  });

  it('a heart judgment does NOT skip the play phase', () => {
    const game = makePlayingGame();
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.decisionArea = [indulgence('ind')];
    game.deck = [plain('d1', '♣', '5'), plain('d2', '♣', '6'), plain('judge', '♥', '3')]; // ♥ = heart
    startTurn(game, 'p1');
    runJudgment(game, 'p1');
    drawOneTurnCard(game, 'p1');
    drawOneTurnCard(game, 'p1');
    assert.equal(game.turn.phase, 'play', 'play phase proceeds normally');
  });

  it('judgment is manual: reveal, then the card can be kept into hand instead of discarded', () => {
    const game = makePlayingGame();
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.decisionArea = [indulgence('ind')];
    p1.hand = [];
    game.deck = [plain('judge', '♠', 'K')]; // non-heart → skip
    startTurn(game, 'p1');
    drawJudgmentCard(game, 'p1');
    assert.equal(game.pendingJudgment?.stage, 'revealed');
    assert.equal(game.pendingJudgment?.revealed?.id, 'judge', 'the revealed card is shown to everyone');
    keepJudgmentCard(game, 'p1');
    assert.ok(p1.hand.some(c => c.id === 'judge'), 'kept judgment card went to hand');
    assert.ok(!game.discard.some(c => c.id === 'judge'), 'and NOT to the discard pile');
    assert.equal(game.pendingJudgment, undefined, 'judgment resolved');
  });

  it('cannot end the turn while a judgment is pending', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p1')!.decisionArea = [indulgence('ind')];
    game.deck = [plain('judge', '♠', 'K')];
    startTurn(game, 'p1');
    assert.throws(() => endTurn(game, 'p1'), /ตัดสิน/);
  });
});

describe('Judgment phase – Lightning (delayed_lightning_judgment)', () => {
  it('spade 2–9 strikes for 3 damage and discards the lightning', () => {
    const game = makePlayingGame();
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.decisionArea = [lightning('lig')];
    p1.hp = 4;
    game.deck = [plain('judge', '♠', '5')]; // spade 5 → strike
    startTurn(game, 'p1');
    runJudgment(game, 'p1');
    assert.equal(p1.hp, 1, 'took 3 lightning damage');
    assert.ok(!p1.decisionArea.some(c => c.id === 'lig'), 'lightning discarded after striking');
    // the judgment reveal is recorded so all clients can display it
    assert.equal(game.lastJudgment?.playerId, 'p1');
    assert.equal(game.lastJudgment?.cardSuit, '♠');
    assert.ok(game.lastJudgment?.result.includes('ฟ้าผ่า'));
  });

  it('a non-strike judgment moves the lightning to the next player', () => {
    const game = makePlayingGame();
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.decisionArea = [lightning('lig')];
    game.deck = [plain('judge', '♥', 'K')]; // heart → no strike, moves on
    startTurn(game, 'p1');
    runJudgment(game, 'p1');
    assert.ok(!p1.decisionArea.some(c => c.id === 'lig'), 'lightning left this player');
    const holders = game.players.filter(p => p.decisionArea.some(c => c.id === 'lig'));
    assert.equal(holders.length, 1, 'lightning moved to exactly one other player');
    assert.notEqual(holders[0]!.id, 'p1');
  });

  it('lightning that strikes to 0 HP opens a dying window and pauses the draw', () => {
    const game = makePlayingGame();
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.decisionArea = [lightning('lig')];
    p1.hp = 2;
    game.deck = [plain('judge', '♠', '4')];
    startTurn(game, 'p1');
    runJudgment(game, 'p1');
    assert.equal(p1.hp, 0, 'reduced to 0');
    assert.equal(game.responseWindow?.type, 'dying_heal', 'dying window opened');
    assert.throws(() => drawOneTurnCard(game, 'p1'), /ค้างอยู่/, 'cannot draw while the dying window is open');
  });
});
