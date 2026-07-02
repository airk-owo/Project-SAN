import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, dealRoles, beginPlayAfterCharacters,
  playCard, playHarvest, playCoerceAttack, respondWithNegate, declineNegate,
  type Card, type Character, type GameState, type Spectator,
} from './index.js';

const NOW = '2026-01-01T00:00:00.000Z';
const spectator = (id: string): Spectator => ({ id, username: id, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW });
const makeCard = (id: string, effect: string, cardType: string = 'trick', extra: Partial<Card> = {}): Card => ({
  id, name: id, type: cardType, cardType: cardType as Card['cardType'], suit: '♥', number: 'K',
  image: null, description: null, effect, effectParams: {}, triggerTiming: 'on_play', equipmentSlot: null, createsResponseWindow: false, conditions: null, ...extra,
});
const negateCard = (id: string): Card => makeCard(id, 'negate_trick_effect');
const indulgence = (id: string): Card => makeCard(id, 'delayed_skip_play_phase', 'delayed_trick');
const lightning = (id: string): Card => makeCard(id, 'delayed_lightning_judgment', 'delayed_trick');
const attackCard = (id: string): Card => makeCard(id, 'attack', 'basic');
const weapon = (id: string): Card => makeCard(id, 'unlimited_attack_per_turn', 'weapon', { type: 'weapon', equipmentSlot: 'weapon', effectParams: { range: 1 } });
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
  return game;
}

/** First responder in the negate queue plays คงกระพันชาตรี. */
function negateWith(game: GameState, negateId: string): void {
  const responder = game.responseWindow!.currentResponderId!;
  game.players.find(p => p.id === responder)!.hand.push(negateCard(negateId));
  respondWithNegate(game, responder, negateId);
}

describe('Negate integration – newly-routed tricks open a negate window', () => {
  it('every delayed trick opens a negate window when played', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p0')!.hand = [indulgence('ind')];
    playCard(game, 'p0', 'ind', 'p1');
    assert.equal(game.responseWindow?.type, 'negate');
  });

  it('negating an Indulgence prevents placement and discards it', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p0')!.hand = [indulgence('ind')];
    playCard(game, 'p0', 'ind', 'p1');
    negateWith(game, 'neg');
    assert.ok(!game.players.find(p => p.id === 'p1')!.decisionArea.some(c => c.id === 'ind'), 'not placed');
    assert.ok(game.discard.some(c => c.id === 'ind'), 'trick discarded');
    assert.equal(game.responseWindow, null);
  });

  it('negating Lightning prevents it from entering the decision area', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p0')!.hand = [lightning('lig')];
    playCard(game, 'p0', 'lig');
    negateWith(game, 'neg');
    assert.ok(!game.players.find(p => p.id === 'p0')!.decisionArea.some(c => c.id === 'lig'));
  });

  it('negating Harvest reveals nothing and opens no pick window', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p0')!.hand = [makeCard('h', 'reveal_and_draft_cards')];
    game.deck = [attackCard('a'), attackCard('b'), attackCard('c'), attackCard('d')];
    playHarvest(game, 'p0', 'h');
    assert.equal(game.responseWindow?.type, 'negate');
    negateWith(game, 'neg');
    assert.equal(game.pendingHarvest, undefined, 'no pool revealed');
    assert.equal(game.responseWindow, null, 'no pick window');
  });

  it('negating Borrowed Knife stops the coercion', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p0')!.hand = [makeCard('c1', 'coerce_attack_or_take_weapon')];
    const holder = game.players.find(p => p.id === 'p1')!;
    holder.equipment.weapon = weapon('wpn');
    holder.hand = [attackCard('atk')];
    playCoerceAttack(game, 'p0', 'c1', 'p1', 'p2');
    negateWith(game, 'neg');
    assert.equal(game.pendingCoerce, undefined, 'coercion cancelled');
    assert.ok(holder.equipment.weapon, 'holder keeps the weapon');
    assert.equal(game.responseWindow, null);
  });

  it('Harvest still resolves when every player declines to negate', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p0')!.hand = [makeCard('h', 'reveal_and_draft_cards')];
    game.deck = [attackCard('a'), attackCard('b'), attackCard('c'), attackCard('d')];
    playHarvest(game, 'p0', 'h');
    while (game.responseWindow?.type === 'negate' && game.responseWindow.currentResponderId) declineNegate(game, game.responseWindow.currentResponderId);
    assert.equal(game.responseWindow?.type, 'harvest_pick');
    assert.equal(game.pendingHarvest?.revealed.length, 4);
  });
});
