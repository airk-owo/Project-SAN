import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, dealRoles, beginPlayAfterCharacters,
  playDrawCardsTrick, declineNegate, drawPendingCard, owedDraws, endTurn,
  type Card, type Character, type GameState, type Spectator,
} from './index.js';

const NOW = '2026-01-01T00:00:00.000Z';
const spectator = (id: string): Spectator => ({ id, username: id, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW });
const makeCard = (id: string, effect: string, cardType: string = 'basic'): Card => ({
  id, name: id, type: cardType, cardType: cardType as Card['cardType'], suit: '♥', number: 'K',
  image: null, description: null, effect, effectParams: effect === 'draw_cards' ? { amount: 2 } : {},
  triggerTiming: 'on_play', equipmentSlot: null, createsResponseWindow: false, conditions: null,
});
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

function passNegate(game: GameState): void {
  while (game.responseWindow?.type === 'negate' && game.responseWindow.currentResponderId) declineNegate(game, game.responseWindow.currentResponderId);
}

describe('Manual draws – pendingDraws', () => {
  it('draw_cards grants owed draws that the player takes one at a time', () => {
    const game = makeGame();
    const actor = game.players.find(p => p.id === 'p0')!;
    game.deck = [makeCard('a', 'attack'), makeCard('b', 'attack'), makeCard('c', 'attack')];
    actor.hand = [makeCard('trick', 'draw_cards', 'trick')];
    playDrawCardsTrick(game, 'p0', 'trick');
    passNegate(game);
    assert.equal(owedDraws(game, 'p0'), 2, 'owed 2 (not auto-drawn)');
    assert.equal(actor.hand.length, 0, 'no cards drawn automatically');
    drawPendingCard(game, 'p0');
    assert.equal(owedDraws(game, 'p0'), 1);
    assert.equal(actor.hand.length, 1);
    drawPendingCard(game, 'p0');
    assert.equal(owedDraws(game, 'p0'), 0, 'debt cleared');
    assert.equal(actor.hand.length, 2);
  });

  it('cannot end the turn while owed draws remain', () => {
    const game = makeGame();
    const actor = game.players.find(p => p.id === 'p0')!;
    game.deck = [makeCard('a', 'attack'), makeCard('b', 'attack')];
    actor.hand = [makeCard('trick', 'draw_cards', 'trick')];
    playDrawCardsTrick(game, 'p0', 'trick');
    passNegate(game);
    assert.throws(() => endTurn(game, 'p0'), /ได้รับ/, 'blocked until owed draws are taken');
    drawPendingCard(game, 'p0');
    drawPendingCard(game, 'p0');
    endTurn(game, 'p0'); // now allowed
    assert.notEqual(game.turn.activePlayerId, 'p0', 'turn advanced');
  });

  it('drawPendingCard throws when nothing is owed', () => {
    const game = makeGame();
    assert.equal(owedDraws(game, 'p0'), 0);
    assert.throws(() => drawPendingCard(game, 'p0'));
  });
});
