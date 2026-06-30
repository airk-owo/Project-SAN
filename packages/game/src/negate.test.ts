import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, dealRoles, beginPlayAfterCharacters, draw,
  respondWithNegate, declineNegate, playNegateInMassWindow,
  playDrawCardsTrick, playHealAllLiving, playDiscardTargetCard, playStealTargetCard,
  playMassDodgeOrDamage, playMassAttackOrDamage, playMassResponseCard, declineMassResponse,
  type Card, type Character, type GameState, type Spectator,
} from './index.js';

// ────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────

const NOW = '2026-01-01T00:00:00.000Z';

const spectator = (id: string): Spectator => ({
  id, username: id, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW,
});

const makeCard = (id: string, effect: string, cardType: string = 'trick'): Card => ({
  id, name: id, type: 'trick', cardType: cardType as Card['cardType'], suit: '♠', number: 'K',
  image: null, description: null, effect,
  effectParams: effect === 'draw_cards' ? { amount: 2 } : effect === 'heal' ? { heal_amount: 1 } : {},
  triggerTiming: 'on_play', equipmentSlot: null, createsResponseWindow: false, conditions: null,
});

const negateCard = (id: string): Card => makeCard(id, 'negate_trick_effect');
const drawCard = (id: string): Card => makeCard(id, 'draw_cards');
const healAllCard = (id: string): Card => makeCard(id, 'heal_all_living');
const dodgeCard = (id: string): Card => makeCard(id, 'dodge', 'basic');
const attackCard = (id: string): Card => makeCard(id, 'attack', 'basic');

const makeCharacter = (id: string): Character => ({
  id, name: id, hp: 4, faction: 'test', skills: [],
});

/**
 * Build a 4-player game that is in the 'play' phase with p0 as the active player.
 * Each player has their character assigned and 0 cards initially.
 */
function makePlayingGame(): GameState {
  const host = spectator('p0');
  const game = createGame('room1', host, []);
  game.spectators = [];
  game.players.push(createSeatedPlayer(host, 1));
  for (let i = 1; i < 4; i++) {
    game.players.push(createSeatedPlayer(spectator(`p${i}`), i + 1));
  }
  dealRoles(game, { emperor: 1, rebel: 2, loyalist: 0, traitor: 1 });
  game.players.forEach((p, i) => {
    p.character = makeCharacter(`char${i}`);
    p.confirmedCharacter = true;
    p.maxHp = 4;
    p.hp = 4;
    p.characterOptions = [];
  });
  beginPlayAfterCharacters(game, 0);
  game.turn.phase = 'play';
  game.turn.activePlayerId = 'p0';
  return game;
}

// ────────────────────────────────────────────────────────
// openNegateWindowForTrick / negate window opening
// ────────────────────────────────────────────────────────

describe('negate window – opens after trick declared', () => {
  it('playing drawCardsTrick opens a negate window', () => {
    const game = makePlayingGame();
    const actor = game.players.find(p => p.id === 'p0')!;
    actor.hand = [drawCard('d1')];
    playDrawCardsTrick(game, 'p0', 'd1');
    assert.ok(game.responseWindow, 'response window should open');
    assert.equal(game.responseWindow?.type, 'negate');
  });

  it('negate window includes all alive players except the actor', () => {
    const game = makePlayingGame();
    const actor = game.players.find(p => p.id === 'p0')!;
    actor.hand = [drawCard('d1')];
    playDrawCardsTrick(game, 'p0', 'd1');
    const required = game.responseWindow?.requiredPlayerIds ?? [];
    assert.ok(!required.includes('p0'), 'actor must not be in queue');
    assert.ok(required.includes('p1'));
    assert.ok(required.includes('p2'));
    assert.ok(required.includes('p3'));
  });

  it('negate window currentResponderId is the first player after actor', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [drawCard('d1')];
    playDrawCardsTrick(game, 'p0', 'd1');
    // First responder should not be p0
    assert.notEqual(game.responseWindow?.currentResponderId, 'p0');
    assert.ok(['p1', 'p2', 'p3'].includes(game.responseWindow?.currentResponderId ?? ''));
  });

  it('pendingTrickResolution stores the effectKey', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [drawCard('d1')];
    playDrawCardsTrick(game, 'p0', 'd1');
    assert.equal((game as any).pendingTrickResolution?.effectKey, 'draw_cards');
  });
});

// ────────────────────────────────────────────────────────
// respondWithNegate – cancels the trick
// ────────────────────────────────────────────────────────

describe('respondWithNegate – cancel the trick', () => {
  it('cancels the pending trick (currentAction becomes null)', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [drawCard('d1')];
    playDrawCardsTrick(game, 'p0', 'd1');
    const firstResponder = game.responseWindow!.currentResponderId!;
    const responder = game.players.find(p => p.id === firstResponder)!;
    responder.hand.push(negateCard('neg1'));
    respondWithNegate(game, firstResponder, 'neg1');
    assert.equal(game.currentAction, null, 'action should be cancelled');
  });

  it('closes the response window after negate', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [drawCard('d1')];
    playDrawCardsTrick(game, 'p0', 'd1');
    const responder = game.responseWindow!.currentResponderId!;
    game.players.find(p => p.id === responder)!.hand.push(negateCard('neg1'));
    respondWithNegate(game, responder, 'neg1');
    assert.equal(game.responseWindow, null);
  });

  it('negate card is moved to discard pile', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [drawCard('d1')];
    playDrawCardsTrick(game, 'p0', 'd1');
    const responder = game.responseWindow!.currentResponderId!;
    const player = game.players.find(p => p.id === responder)!;
    player.hand.push(negateCard('neg1'));
    respondWithNegate(game, responder, 'neg1');
    assert.ok(!player.hand.some(c => c.id === 'neg1'), 'negate card removed from hand');
    assert.ok(game.discard.some(c => c.id === 'neg1'), 'negate card in discard');
  });

  it('trick card (draw_cards) is moved to discard pile after negate', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [drawCard('d1')];
    playDrawCardsTrick(game, 'p0', 'd1');
    const responder = game.responseWindow!.currentResponderId!;
    game.players.find(p => p.id === responder)!.hand.push(negateCard('neg1'));
    respondWithNegate(game, responder, 'neg1');
    assert.ok(game.discard.some(c => c.id === 'd1'), 'trick card should be in discard');
  });

  it('throws if the player is not the currentResponderId', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [drawCard('d1')];
    playDrawCardsTrick(game, 'p0', 'd1');
    // p0 is the actor, so not in the queue; playing from p0 should fail
    game.players.find(p => p.id === 'p0')!.hand.push(negateCard('neg-x'));
    assert.throws(() => respondWithNegate(game, 'p0', 'neg-x'));
  });

  it('throws if the card is not a negate card', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [drawCard('d1')];
    playDrawCardsTrick(game, 'p0', 'd1');
    const responder = game.responseWindow!.currentResponderId!;
    game.players.find(p => p.id === responder)!.hand.push(dodgeCard('dodge1'));
    assert.throws(() => respondWithNegate(game, responder, 'dodge1'));
  });
});

// ────────────────────────────────────────────────────────
// declineNegate – all decline → trick resolves
// ────────────────────────────────────────────────────────

describe('declineNegate – trick resolves when all decline', () => {
  it('all players declining causes draw_cards effect to fire', () => {
    const game = makePlayingGame();
    const actor = game.players.find(p => p.id === 'p0')!;
    // Give deck some cards
    game.deck = [makeCard('dk1', 'attack', 'basic'), makeCard('dk2', 'attack', 'basic'), makeCard('dk3', 'attack', 'basic')];
    actor.hand = [drawCard('d1')];
    const handBefore = actor.hand.length;
    playDrawCardsTrick(game, 'p0', 'd1');
    // All 3 other players decline
    const queue = [...(game.responseWindow?.responderQueue ?? [])];
    for (const pid of queue) {
      declineNegate(game, pid);
    }
    assert.equal(game.responseWindow, null, 'window should close after all decline');
    assert.ok(actor.hand.length > handBefore, 'actor should have drawn cards');
  });

  it('partial decline advances currentResponderId', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [drawCard('d1')];
    game.deck = [makeCard('dk1', 'attack', 'basic'), makeCard('dk2', 'attack', 'basic')];
    playDrawCardsTrick(game, 'p0', 'd1');
    const first = game.responseWindow!.currentResponderId!;
    declineNegate(game, first);
    // Window should still be open
    assert.equal(game.responseWindow?.status, 'open');
    assert.notEqual(game.responseWindow?.currentResponderId, first);
  });

  it('currentAction is null after all decline and trick resolves', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p0')!.hand = [drawCard('d1')];
    game.deck = [makeCard('dk1', 'attack', 'basic'), makeCard('dk2', 'attack', 'basic')];
    playDrawCardsTrick(game, 'p0', 'd1');
    const queue = [...(game.responseWindow?.responderQueue ?? [])];
    for (const pid of queue) declineNegate(game, pid);
    assert.equal(game.currentAction, null);
  });

  it('heal_all_living resolves: all living players heal 1 HP', () => {
    const game = makePlayingGame();
    const actor = game.players.find(p => p.id === 'p0')!;
    actor.hand = [healAllCard('h1')];
    // Damage all players by 1
    game.players.forEach(p => { if (p.hp !== undefined) p.hp -= 1; });
    playHealAllLiving(game, 'p0', 'h1');
    const queue = [...(game.responseWindow?.responderQueue ?? [])];
    for (const pid of queue) declineNegate(game, pid);
    assert.ok(game.players.every(p => p.hp === p.maxHp), 'all players should be healed');
  });

  it('discard_target_card resolves: target loses their card', () => {
    const game = makePlayingGame();
    const actor = game.players.find(p => p.id === 'p0')!;
    const target = game.players.find(p => p.id === 'p1')!;
    const victimCard = attackCard('victim1');
    target.hand = [victimCard];
    actor.hand = [makeCard('discard1', 'discard_target_card')];
    playDiscardTargetCard(game, 'p0', 'p1', 'discard1', 'victim1');
    const queue = [...(game.responseWindow?.responderQueue ?? [])];
    for (const pid of queue) declineNegate(game, pid);
    assert.ok(!target.hand.some(c => c.id === 'victim1'), "target's card should be discarded");
  });

  it('steal_target_card_in_range resolves: actor gains target hand card', () => {
    const game = makePlayingGame();
    const actor = game.players.find(p => p.id === 'p0')!;
    const target = game.players.find(p => p.id === 'p1')!;
    const lootCard = attackCard('loot1');
    target.hand = [lootCard];
    actor.hand = [makeCard('steal1', 'steal_target_card_in_range')];
    // Hidden hand selection — must use {zone:'hand', handIndex} for hand cards
    playStealTargetCard(game, 'p0', 'p1', { zone: 'hand', handIndex: 0 }, 'steal1');
    const queue = [...(game.responseWindow?.responderQueue ?? [])];
    for (const pid of queue) declineNegate(game, pid);
    assert.ok(target.hand.length === 0, "target's card should be removed");
    assert.equal(actor.hand.length, 1, 'actor should have the stolen card');
  });
});

// ────────────────────────────────────────────────────────
// playNegateInMassWindow – skip mass trick damage
// ────────────────────────────────────────────────────────

describe('playNegateInMassWindow – skip mass damage', () => {
  it('negate in mass_dodge window skips damage for that player', () => {
    const game = makePlayingGame();
    const actor = game.players.find(p => p.id === 'p0')!;
    actor.hand = [makeCard('mw1', 'mass_dodge_or_damage', 'trick')];
    // Replace trick card with one that has the right effect
    const massTrick: Card = { ...actor.hand[0]!, effect: 'all_others_dodge_or_damage', effectParams: { damage: 1 } };
    actor.hand = [massTrick];
    playMassDodgeOrDamage(game, 'p0', massTrick.id);
    const firstResponder = game.responseWindow!.currentResponderId!;
    const respPlayer = game.players.find(p => p.id === firstResponder)!;
    const hpBefore = respPlayer.hp!;
    respPlayer.hand.push(negateCard('neg2'));
    playNegateInMassWindow(game, firstResponder, 'neg2');
    // Player should not have taken damage
    assert.equal(respPlayer.hp, hpBefore, 'HP should not change after negate');
  });

  it('throws if not in a mass window', () => {
    const game = makePlayingGame();
    game.players.find(p => p.id === 'p1')!.hand.push(negateCard('neg3'));
    assert.throws(() => playNegateInMassWindow(game, 'p1', 'neg3'));
  });
});
