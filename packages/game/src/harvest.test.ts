import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, dealRoles, beginPlayAfterCharacters,
  playHarvest, pickHarvestCard, declineNegate,
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

const makeCard = (id: string, effect: string, cardType: string = 'basic'): Card => ({
  id, name: id, type: cardType, cardType: cardType as Card['cardType'], suit: '♥', number: 'K',
  image: null, description: null, effect, effectParams: {},
  triggerTiming: 'on_play', equipmentSlot: null, createsResponseWindow: false, conditions: null,
});
const harvestCard = (id: string): Card => makeCard(id, 'reveal_and_draft_cards', 'trick');
const poolCard = (id: string): Card => makeCard(id, 'attack', 'basic');
const makeCharacter = (id: string): Character => ({ id, name: id, hp: 4, faction: 'test', skills: [] });

function makeGame(deck: Card[]): GameState {
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
  game.players.find(p => p.id === 'p0')!.hand = [harvestCard('h1')];
  game.deck = deck;
  return game;
}

describe('Harvest – reveal_and_draft_cards', () => {
  it('reveals one card per living player and opens a pick window on the actor', () => {
    const game = makeGame([poolCard('a'), poolCard('b'), poolCard('c'), poolCard('d')]);
    playHarvest(game, 'p0', 'h1'); passNegate(game);
    assert.equal(game.pendingHarvest?.revealed.length, 4, 'one card per living player');
    assert.equal(game.responseWindow?.type, 'harvest_pick');
    assert.equal(game.responseWindow?.currentResponderId, 'p0', 'actor picks first');
    assert.deepEqual(game.responseWindow?.responderQueue, ['p0', 'p1', 'p2', 'p3']);
  });

  it('each player drafts one card in turn order, then the window closes', () => {
    const game = makeGame([poolCard('a'), poolCard('b'), poolCard('c'), poolCard('d')]);
    playHarvest(game, 'p0', 'h1'); passNegate(game);
    for (const pid of ['p0', 'p1', 'p2', 'p3']) {
      assert.equal(game.responseWindow?.currentResponderId, pid, `it is ${pid}'s turn`);
      pickHarvestCard(game, pid, game.pendingHarvest!.revealed[0]!.id);
    }
    assert.equal(game.responseWindow, null, 'window closed after everyone drafts');
    assert.equal(game.pendingHarvest, undefined);
    assert.ok(game.players.every(p => p.hand.length === 1), 'each player drafted exactly one card');
  });

  it('rejects picking out of turn', () => {
    const game = makeGame([poolCard('a'), poolCard('b'), poolCard('c'), poolCard('d')]);
    playHarvest(game, 'p0', 'h1'); passNegate(game);
    assert.throws(() => pickHarvestCard(game, 'p1', game.pendingHarvest!.revealed[0]!.id));
  });

  it('rejects picking a card that is not in the revealed pool', () => {
    const game = makeGame([poolCard('a'), poolCard('b'), poolCard('c'), poolCard('d')]);
    playHarvest(game, 'p0', 'h1'); passNegate(game);
    assert.throws(() => pickHarvestCard(game, 'p0', 'not-there'));
  });

  it('when the deck is short, only the earliest pickers draft and the window still closes', () => {
    const game = makeGame([poolCard('a'), poolCard('b')]); // only 2 cards for 4 players
    playHarvest(game, 'p0', 'h1'); passNegate(game);
    assert.equal(game.pendingHarvest?.revealed.length, 2);
    pickHarvestCard(game, 'p0', game.pendingHarvest!.revealed[0]!.id);
    pickHarvestCard(game, 'p1', game.pendingHarvest!.revealed[0]!.id);
    assert.equal(game.responseWindow, null, 'window closes once the pool is empty');
    assert.equal(game.players.find(p => p.id === 'p0')!.hand.length, 1);
    assert.equal(game.players.find(p => p.id === 'p1')!.hand.length, 1);
    assert.equal(game.players.find(p => p.id === 'p2')!.hand.length, 0, 'no card left for p2');
  });

  it('leftover revealed cards are discarded', () => {
    const game = makeGame([poolCard('a'), poolCard('b'), poolCard('c'), poolCard('d')]);
    playHarvest(game, 'p0', 'h1'); passNegate(game);
    // Kill p2 and p3 so only p0 and p1 remain in the pick queue while 4 cards are revealed.
    game.players.find(p => p.id === 'p2')!.alive = false;
    game.players.find(p => p.id === 'p3')!.alive = false;
    pickHarvestCard(game, 'p0', game.pendingHarvest!.revealed[0]!.id);
    pickHarvestCard(game, 'p1', game.pendingHarvest!.revealed[0]!.id);
    assert.equal(game.responseWindow, null, 'window closed with leftovers');
    assert.equal(game.pendingHarvest, undefined);
    assert.ok(game.discard.some(c => c.id === 'a' || c.id === 'b' || c.id === 'c' || c.id === 'd'), 'leftovers discarded');
  });
});
