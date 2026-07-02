import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, dealRoles, beginPlayAfterCharacters,
  playCard, playAttackResponse, declineResponse,
  type Card, type Character, type GameState, type Spectator,
} from './index.js';

const NOW = '2026-01-01T00:00:00.000Z';
const spectator = (id: string): Spectator => ({ id, username: id, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW });
const makeCard = (id: string, effect: string, cardType = 'basic'): Card => ({
  id, name: id, type: cardType, cardType: cardType as Card['cardType'], suit: '♣', number: '5',
  image: null, description: null, effect, effectParams: {}, triggerTiming: 'on_play', equipmentSlot: null, createsResponseWindow: false, conditions: null,
});
const attackCard = (id: string): Card => makeCard(id, 'attack', 'basic');
const duelCard = (id: string): Card => makeCard(id, 'duel_attack_response', 'trick');
const character = (id: string): Character => ({ id, name: id, hp: 4, faction: 'test', skills: [] });

function makeGame(): GameState {
  const host = spectator('p0');
  const game = createGame('room1', host, []);
  game.spectators = [];
  game.players.push(createSeatedPlayer(host, 1));
  for (let i = 1; i < 4; i++) game.players.push(createSeatedPlayer(spectator(`p${i}`), i + 1));
  dealRoles(game, { emperor: 1, rebel: 2, loyalist: 0, traitor: 1 });
  game.players.forEach((p, i) => { p.character = character(`C${i}`); p.confirmedCharacter = true; p.maxHp = 4; p.hp = 4; p.characterOptions = []; });
  beginPlayAfterCharacters(game, 0);
  game.turn.phase = 'play';
  game.turn.activePlayerId = 'p0';
  game.currentPlayerId = 'p0';
  game.hasDrawnThisTurn = true;
  return game;
}

describe('Duel (ท้าสู้) – normal flow', () => {
  it('opens on the target, who must respond first', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p0')!.hand = [duelCard('duel')];
    playCard(game, 'p0', 'duel', 'p1');
    assert.equal(game.responseWindow?.type, 'duel_attack');
    assert.equal(game.responseWindow?.currentResponderId, 'p1');
  });

  it('flips responders after each single attack (normal characters)', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p0')!.hand = [duelCard('duel'), attackCard('a0')];
    game.players.find(p => p.id === 'p1')!.hand = [attackCard('a1')];
    playCard(game, 'p0', 'duel', 'p1');
    playAttackResponse(game, 'p1', 'a1');
    assert.equal(game.responseWindow?.currentResponderId, 'p0', 'flips to actor after one attack');
    playAttackResponse(game, 'p0', 'a0');
    assert.equal(game.responseWindow?.currentResponderId, 'p1', 'flips back to target');
  });

  it('the player who cannot answer loses the duel and takes 1 damage', () => {
    const game = makeGame();
    const p1 = game.players.find(p => p.id === 'p1')!;
    game.players.find(p => p.id === 'p0')!.hand = [duelCard('duel')];
    p1.hand = []; // target cannot respond at all
    const hpBefore = p1.hp!;
    playCard(game, 'p0', 'duel', 'p1');
    declineResponse(game, 'p1');
    assert.equal(p1.hp, hpBefore - 1, 'target lost the duel');
    assert.equal(game.responseWindow, null, 'duel resolved');
  });
});
