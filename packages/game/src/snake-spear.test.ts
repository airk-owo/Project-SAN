import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, dealRoles, beginPlayAfterCharacters,
  useDiscardTwoAsAttack, respondToAttack, playDodge,
  type Card, type Character, type GameState, type Spectator,
} from './index.js';

const NOW = '2026-01-01T00:00:00.000Z';

const spectator = (id: string): Spectator => ({
  id, username: id, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW,
});

const makeCard = (id: string, effect: string, cardType: string = 'basic', extra: Partial<Card> = {}): Card => ({
  id, name: id, type: cardType, cardType: cardType as Card['cardType'], suit: '♠', number: 'K',
  image: null, description: null, effect, effectParams: { damage: 1 },
  triggerTiming: 'on_play', equipmentSlot: null, createsResponseWindow: false, conditions: null, ...extra,
});
const handCard = (id: string, suit: string = '♠'): Card => makeCard(id, 'attack', 'basic', { suit });
const dodgeCard = (id: string): Card => makeCard(id, 'dodge', 'basic');
const snakeSpear = (id: string): Card => makeCard(id, 'discard_two_as_attack', 'weapon', { type: 'weapon', equipmentSlot: 'weapon' });
const renwangShield = (id: string): Card => makeCard(id, 'black_attack_immunity', 'armor', { type: 'armor', equipmentSlot: 'armor' });
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
  game.hasDrawnThisTurn = true;
  return game;
}

describe('Snake Spear – discard_two_as_attack', () => {
  it('discards both chosen cards and opens an attack-dodge window on the target', () => {
    const game = makePlayingGame();
    const attacker = game.players.find(p => p.id === 'p0')!;
    attacker.equipment.weapon = snakeSpear('spear');
    attacker.hand = [handCard('a'), handCard('b'), handCard('keep')];
    useDiscardTwoAsAttack(game, 'p0', ['a', 'b'], 'p1');
    assert.equal(attacker.hand.length, 1, 'two cards leave the hand');
    assert.ok(game.discard.some(c => c.id === 'b'), 'second card discarded immediately');
    assert.equal(game.responseWindow?.type, 'attack_dodge');
    assert.equal(game.responseWindow?.currentResponderId, 'p1');
    assert.equal(game.turn.attackUsedThisTurn, 1, 'counts as the turn attack');
  });

  it('deals damage when the target declines to dodge', () => {
    const game = makePlayingGame();
    const attacker = game.players.find(p => p.id === 'p0')!;
    const target = game.players.find(p => p.id === 'p1')!;
    attacker.equipment.weapon = snakeSpear('spear');
    attacker.hand = [handCard('a'), handCard('b')];
    useDiscardTwoAsAttack(game, 'p0', ['a', 'b'], 'p1');
    respondToAttack(game, 'p1'); // decline
    assert.equal(target.hp, 3, 'target takes 1 damage');
  });

  it('is cancelled when the target dodges', () => {
    const game = makePlayingGame();
    const attacker = game.players.find(p => p.id === 'p0')!;
    const target = game.players.find(p => p.id === 'p1')!;
    attacker.equipment.weapon = snakeSpear('spear');
    attacker.hand = [handCard('a'), handCard('b')];
    target.hand = [dodgeCard('d1')];
    useDiscardTwoAsAttack(game, 'p0', ['a', 'b'], 'p1');
    playDodge(game, 'p1', 'd1');
    assert.equal(target.hp, 4, 'no damage after dodge');
    assert.equal(game.responseWindow, null, 'window closed');
  });

  it('two black cards are blocked by Renwang Shield', () => {
    const game = makePlayingGame();
    const attacker = game.players.find(p => p.id === 'p0')!;
    const target = game.players.find(p => p.id === 'p1')!;
    attacker.equipment.weapon = snakeSpear('spear');
    target.equipment.armor = renwangShield('shield');
    attacker.hand = [handCard('a', '♠'), handCard('b', '♣')];
    useDiscardTwoAsAttack(game, 'p0', ['a', 'b'], 'p1');
    assert.equal(game.responseWindow, null, 'no dodge window — attack blocked');
    assert.equal(target.hp, 4, 'no damage');
  });

  it('a red + black pair is NOT blocked by Renwang Shield', () => {
    const game = makePlayingGame();
    const attacker = game.players.find(p => p.id === 'p0')!;
    const target = game.players.find(p => p.id === 'p1')!;
    attacker.equipment.weapon = snakeSpear('spear');
    target.equipment.armor = renwangShield('shield');
    attacker.hand = [handCard('a', '♥'), handCard('b', '♣')];
    useDiscardTwoAsAttack(game, 'p0', ['a', 'b'], 'p1');
    assert.equal(game.responseWindow?.type, 'attack_dodge', 'attack proceeds');
  });

  it('throws without the Snake Spear weapon', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [handCard('a'), handCard('b')];
    assert.throws(() => useDiscardTwoAsAttack(game, 'p0', ['a', 'b'], 'p1'));
  });

  it('throws when fewer than two distinct cards are chosen', () => {
    const game = makePlayingGame();
    const attacker = game.players.find(p => p.id === 'p0')!;
    attacker.equipment.weapon = snakeSpear('spear');
    attacker.hand = [handCard('a'), handCard('b')];
    assert.throws(() => useDiscardTwoAsAttack(game, 'p0', ['a', 'a'], 'p1'));
  });

  it('respects the one-attack-per-turn limit', () => {
    const game = makePlayingGame();
    const attacker = game.players.find(p => p.id === 'p0')!;
    attacker.equipment.weapon = snakeSpear('spear');
    attacker.hand = [handCard('a'), handCard('b')];
    game.turn.attackUsedThisTurn = 1;
    assert.throws(() => useDiscardTwoAsAttack(game, 'p0', ['a', 'b'], 'p1'));
  });
});
