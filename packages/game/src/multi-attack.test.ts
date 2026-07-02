import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, dealRoles, beginPlayAfterCharacters,
  playLastHandMultiAttack, playMassResponseCard, declineMassResponse,
  type Card, type Character, type GameState, type Spectator,
} from './index.js';

const NOW = '2026-01-01T00:00:00.000Z';

const spectator = (id: string): Spectator => ({
  id, username: id, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW,
});

const makeCard = (id: string, effect: string, cardType: string = 'basic', extra: Partial<Card> = {}): Card => ({
  id, name: id, type: cardType, cardType: cardType as Card['cardType'], suit: '♥', number: 'K',
  image: null, description: null, effect, effectParams: { damage: 1 },
  triggerTiming: 'on_play', equipmentSlot: null, createsResponseWindow: false, conditions: null, ...extra,
});
const attackCard = (id: string): Card => makeCard(id, 'attack', 'basic');
const dodgeCard = (id: string): Card => makeCard(id, 'dodge', 'basic');
const zhangbaSpear = (id: string): Card => makeCard(id, 'last_hand_multi_target_attack', 'weapon', { type: 'weapon', equipmentSlot: 'weapon', effectParams: { range: 3 } });
const makeCharacter = (id: string): Character => ({ id, name: id, hp: 4, faction: 'test', skills: [] });

function makeGame(): GameState {
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
  const attacker = game.players.find(p => p.id === 'p0')!;
  attacker.equipment.weapon = zhangbaSpear('spear');
  attacker.hand = [attackCard('atk1')];
  return game;
}

describe('Zhangba Spear – last_hand_multi_target_attack', () => {
  it('opens a multi_attack window queued on the chosen targets', () => {
    const game = makeGame();
    playLastHandMultiAttack(game, 'p0', 'atk1', ['p1', 'p2']);
    assert.equal(game.responseWindow?.type, 'multi_attack');
    assert.equal(game.responseWindow?.currentResponderId, 'p1');
    assert.deepEqual(game.responseWindow?.responderQueue, ['p1', 'p2']);
    assert.equal(game.turn.attackUsedThisTurn, 1);
  });

  it('resolves each target independently: one dodges, one takes damage', () => {
    const game = makeGame();
    const p1 = game.players.find(p => p.id === 'p1')!;
    const p2 = game.players.find(p => p.id === 'p2')!;
    p2.hand = [dodgeCard('d2')];
    playLastHandMultiAttack(game, 'p0', 'atk1', ['p1', 'p2']);
    declineMassResponse(game, 'p1');            // p1 takes damage
    playMassResponseCard(game, 'p2', 'd2');     // p2 dodges
    assert.equal(p1.hp, 3, 'p1 took 1 damage');
    assert.equal(p2.hp, 4, 'p2 dodged, unharmed');
    assert.equal(game.responseWindow, null, 'all targets resolved');
    assert.ok(game.discard.some(c => c.id === 'atk1'), 'the attack card is discarded once at the end');
  });

  it('handles three targets in order', () => {
    const game = makeGame();
    const [p1, p2, p3] = ['p1', 'p2', 'p3'].map(id => game.players.find(p => p.id === id)!);
    playLastHandMultiAttack(game, 'p0', 'atk1', ['p1', 'p2', 'p3']);
    declineMassResponse(game, 'p1');
    declineMassResponse(game, 'p2');
    declineMassResponse(game, 'p3');
    assert.equal(p1!.hp, 3); assert.equal(p2!.hp, 3); assert.equal(p3!.hp, 3);
    assert.equal(game.responseWindow, null);
  });

  it('a target dropping to 0 opens a dying window, then the queue resumes', () => {
    const game = makeGame();
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.hp = 1;
    playLastHandMultiAttack(game, 'p0', 'atk1', ['p1', 'p2']);
    declineMassResponse(game, 'p1'); // p1 → 0 HP, dying window opens
    assert.equal(game.responseWindow?.type, 'dying_heal', 'dying window interrupts the queue');
    assert.equal(game.responseWindow?.dyingPlayerId, 'p1');
  });

  it('throws when the attack is not the last hand card', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p0')!.hand = [attackCard('atk1'), attackCard('extra')];
    assert.throws(() => playLastHandMultiAttack(game, 'p0', 'atk1', ['p1', 'p2']), /ใบสุดท้าย/);
  });

  it('throws when more than three targets are chosen', () => {
    const game = makeGame();
    assert.throws(() => playLastHandMultiAttack(game, 'p0', 'atk1', ['p1', 'p2', 'p3', 'p0']));
  });

  it('throws without the multi-target weapon', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p0')!.equipment.weapon = null;
    assert.throws(() => playLastHandMultiAttack(game, 'p0', 'atk1', ['p1', 'p2']));
  });
});
