import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, dealRoles, beginPlayAfterCharacters,
  playAttack, respondToAttack, playDodge, resolveTwinSwordsDiscard, resolveTwinSwordsLetDraw, owedDraws,
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
const twinSwords = (id: string): Card => makeCard(id, 'opposite_gender_attack_choice', 'weapon', { type: 'weapon', equipmentSlot: 'weapon' });
const makeCharacter = (id: string, gender: string): Character => ({ id, name: id, hp: 4, faction: 'test', gender, skills: [] });

/** p0 = male attacker with Twin Swords, p1 = female target. */
function makeGame(targetGender = 'หญิง'): GameState {
  const host = spectator('p0');
  const game = createGame('room1', host, []);
  game.spectators = [];
  game.players.push(createSeatedPlayer(host, 1));
  for (let i = 1; i < 4; i++) game.players.push(createSeatedPlayer(spectator(`p${i}`), i + 1));
  dealRoles(game, { emperor: 1, rebel: 2, loyalist: 0, traitor: 1 });
  game.players.forEach((p, i) => { p.character = makeCharacter(`char${i}`, i === 1 ? targetGender : 'ชาย'); p.confirmedCharacter = true; p.maxHp = 4; p.hp = 4; p.characterOptions = []; });
  beginPlayAfterCharacters(game, 0);
  game.turn.phase = 'play';
  game.turn.activePlayerId = 'p0';
  game.hasDrawnThisTurn = true;
  const attacker = game.players.find(p => p.id === 'p0')!;
  attacker.equipment.weapon = twinSwords('sword');
  attacker.hand = [attackCard('atk1')];
  return game;
}

describe('Twin Swords – opposite_gender_attack_choice', () => {
  it('pauses for a choice (no dodge window yet) when attacking the opposite gender', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p1')!.hand = [attackCard('v1')];
    playAttack(game, 'p0', 'p1', 'atk1');
    assert.ok(game.pendingTwinSwords, 'twin-swords choice should be pending');
    assert.equal(game.pendingTwinSwords?.targetId, 'p1');
    assert.equal(game.responseWindow, null, 'the dodge window has not opened yet');
    assert.equal(game.turn.attackUsedThisTurn, 0, 'attack not counted until it proceeds');
  });

  it('does NOT pause when attacking the same gender', () => {
    const game = makeGame('ชาย'); // target same gender as attacker
    playAttack(game, 'p0', 'p1', 'atk1');
    assert.equal(game.pendingTwinSwords, undefined, 'no twin-swords choice');
    assert.equal(game.responseWindow?.type, 'attack_dodge', 'normal dodge window opens directly');
  });

  it('discard choice removes a target card and then opens the dodge window', () => {
    const game = makeGame();
    const target = game.players.find(p => p.id === 'p1')!;
    target.hand = [attackCard('v1')];
    playAttack(game, 'p0', 'p1', 'atk1');
    resolveTwinSwordsDiscard(game, 'p1', 'v1');
    assert.ok(!target.hand.some(c => c.id === 'v1'), 'target card discarded');
    assert.equal(game.pendingTwinSwords, undefined, 'choice cleared');
    assert.equal(game.responseWindow?.type, 'attack_dodge', 'dodge window now open');
    assert.equal(game.turn.attackUsedThisTurn, 1, 'attack now counted');
  });

  it('let-draw choice draws a card for the attacker and then opens the dodge window', () => {
    const game = makeGame();
    const attacker = game.players.find(p => p.id === 'p0')!;
    game.deck = [attackCard('deck1')];
    playAttack(game, 'p0', 'p1', 'atk1');
    resolveTwinSwordsLetDraw(game, 'p1');
    assert.equal(owedDraws(game, 'p0'), 1, 'attacker is owed a manual draw');
    assert.equal(game.responseWindow?.type, 'attack_dodge', 'dodge window now open');
  });

  it('after the choice the target can still dodge normally', () => {
    const game = makeGame();
    const target = game.players.find(p => p.id === 'p1')!;
    target.hand = [dodgeCard('d1'), attackCard('v1')];
    playAttack(game, 'p0', 'p1', 'atk1');
    resolveTwinSwordsLetDraw(game, 'p1');
    playDodge(game, 'p1', 'd1');
    assert.equal(target.hp, 4, 'dodged, no damage');
    assert.equal(game.responseWindow, null, 'window resolved');
  });

  it('declining to dodge after the choice deals damage', () => {
    const game = makeGame();
    const target = game.players.find(p => p.id === 'p1')!;
    target.hand = [attackCard('v1')];
    playAttack(game, 'p0', 'p1', 'atk1');
    resolveTwinSwordsDiscard(game, 'p1', 'v1');
    respondToAttack(game, 'p1'); // decline dodge
    assert.equal(target.hp, 3, 'takes 1 damage');
  });

  it('rejects a choice from someone who is not the pending target', () => {
    const game = makeGame();
    playAttack(game, 'p0', 'p1', 'atk1');
    assert.throws(() => resolveTwinSwordsLetDraw(game, 'p2'));
  });
});
