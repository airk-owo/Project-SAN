import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, dealRoles, beginPlayAfterCharacters,
  playCoerceAttack, resolveCoerceWithAttack, declineCoerce, respondToAttack, playDodge, declineNegate,
  type Card, type Character, type GameState, type Spectator,
} from './index.js';

/** Decline the negate window that every trick now opens, so its effect resolves. */
function passNegate(game: GameState): void {
  while (game.responseWindow?.type === 'negate' && game.responseWindow.currentResponderId) {
    declineNegate(game, game.responseWindow.currentResponderId);
  }
}

const NOW = '2026-01-01T00:00:00.000Z';

const spectator = (id: string): Spectator => ({
  id, username: id, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW,
});

const makeCard = (id: string, effect: string, cardType: string = 'basic', extra: Partial<Card> = {}): Card => ({
  id, name: id, type: cardType, cardType: cardType as Card['cardType'], suit: '♥', number: 'K',
  image: null, description: null, effect, effectParams: { damage: 1 },
  triggerTiming: 'on_play', equipmentSlot: null, createsResponseWindow: false, conditions: null, ...extra,
});
const coerceCard = (id: string): Card => makeCard(id, 'coerce_attack_or_take_weapon', 'trick');
const attackCard = (id: string): Card => makeCard(id, 'attack', 'basic');
const dodgeCard = (id: string): Card => makeCard(id, 'dodge', 'basic');
const weapon = (id: string): Card => makeCard(id, 'unlimited_attack_per_turn', 'weapon', { type: 'weapon', equipmentSlot: 'weapon', effectParams: { range: 1 } });
const makeCharacter = (id: string): Character => ({ id, name: id, hp: 4, faction: 'test', skills: [] });

/** p0 = actor holding the coerce card; p1 = weapon holder with an Attack; p2 = victim in p1's range. */
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
  game.players.find(p => p.id === 'p0')!.hand = [coerceCard('c1')];
  const holder = game.players.find(p => p.id === 'p1')!;
  holder.equipment.weapon = weapon('wpn');
  holder.hand = [attackCard('atk')];
  return game;
}

describe('Borrowed Knife – coerce_attack_or_take_weapon', () => {
  it('opens a coerce window on the weapon holder', () => {
    const game = makeGame();
    playCoerceAttack(game, 'p0', 'c1', 'p1', 'p2'); passNegate(game);
    assert.ok(game.pendingCoerce, 'pendingCoerce set');
    assert.equal(game.responseWindow?.type, 'coerce_attack');
    assert.equal(game.responseWindow?.currentResponderId, 'p1');
    assert.ok(game.discard.some(c => c.id === 'c1'), 'trick discarded');
  });

  it('coerced attack: holder attacks the victim, who takes damage on decline', () => {
    const game = makeGame();
    playCoerceAttack(game, 'p0', 'c1', 'p1', 'p2'); passNegate(game);
    resolveCoerceWithAttack(game, 'p1', 'atk');
    assert.equal(game.responseWindow?.type, 'attack_dodge');
    assert.equal(game.responseWindow?.currentResponderId, 'p2');
    assert.equal(game.pendingCoerce, undefined);
    respondToAttack(game, 'p2'); // decline dodge
    assert.equal(game.players.find(p => p.id === 'p2')!.hp, 3, 'victim took damage');
  });

  it('coerced attack can be dodged by the victim', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p2')!.hand = [dodgeCard('d1')];
    playCoerceAttack(game, 'p0', 'c1', 'p1', 'p2'); passNegate(game);
    resolveCoerceWithAttack(game, 'p1', 'atk');
    playDodge(game, 'p2', 'd1');
    assert.equal(game.players.find(p => p.id === 'p2')!.hp, 4, 'victim dodged');
    assert.equal(game.responseWindow, null);
  });

  it('declining hands the weapon to the actor', () => {
    const game = makeGame();
    playCoerceAttack(game, 'p0', 'c1', 'p1', 'p2'); passNegate(game);
    declineCoerce(game, 'p1');
    assert.equal(game.players.find(p => p.id === 'p1')!.equipment.weapon, null, 'holder lost the weapon');
    assert.ok(game.players.find(p => p.id === 'p0')!.hand.some(c => c.id === 'wpn'), 'actor gained the weapon');
    assert.equal(game.responseWindow, null);
  });

  it('rejects a holder with no equipped weapon', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p1')!.equipment.weapon = null;
    assert.throws(() => playCoerceAttack(game, 'p0', 'c1', 'p1', 'p2'));
  });

  it('rejects a victim outside the holder attack range', () => {
    const game = makeGame();
    assert.throws(() => playCoerceAttack(game, 'p0', 'c1', 'p1', 'p3'), /ระยะ/); // p1→p3 is distance 2, weapon range 1
  });

  it('cannot coerce yourself', () => {
    const game = makeGame();
    assert.throws(() => playCoerceAttack(game, 'p0', 'c1', 'p0', 'p2'));
  });
});
