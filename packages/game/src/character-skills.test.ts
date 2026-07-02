import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, dealRoles, beginPlayAfterCharacters,
  playAttack, playDuel, respondToAttack, getEffectiveDistanceBetweenPlayers, getDiscardRequirement,
  forcedAttackTargets, hasCharacterSkill,
  playCard, playStealTargetCard, playDodge, playMassDodgeOrDamage, playMassResponseCard,
  applyDamage, owedDraws, drawOneTurnCard, endTurn, playAttackResponse, declineResponse,
  useSelfDamageDraw, useDiscardThenDraw, playHeal,
  startTurn, drawJudgmentCard, resolveJudgmentCard, replaceJudgmentCard,
  takeCardFromDamager, declineFankui,
  type Card, type Character, type GameState, type Spectator,
} from './index.js';
const suited = (id: string, effect: string, cardType: string, suit: string, number: string): Card => ({
  id, name: id, type: cardType, cardType: cardType as Card['cardType'], suit, number,
  image: null, description: null, effect, effectParams: {}, triggerTiming: 'on_play', equipmentSlot: null, createsResponseWindow: false, conditions: null,
});

const duelCard = (id: string): Card => ({
  id, name: id, type: 'trick', cardType: 'instant_trick', suit: '♣', number: '3',
  image: null, description: null, effect: 'duel_attack_response', effectParams: {}, triggerTiming: 'on_play', equipmentSlot: null, createsResponseWindow: true, conditions: null,
});

const dodgeCard = (id: string): Card => ({
  id, name: id, type: 'basic', cardType: 'basic', suit: '♦', number: '2',
  image: null, description: null, effect: 'dodge', effectParams: {}, triggerTiming: 'on_response', equipmentSlot: null, createsResponseWindow: false, conditions: null,
});

const NOW = '2026-01-01T00:00:00.000Z';
const spectator = (id: string): Spectator => ({ id, username: id, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW });
const makeCard = (id: string, effect: string, cardType = 'basic'): Card => ({
  id, name: id, type: cardType, cardType: cardType as Card['cardType'], suit: '♠', number: 'K',
  image: null, description: null, effect, effectParams: { damage: 1 }, triggerTiming: 'on_play', equipmentSlot: null, createsResponseWindow: false, conditions: null,
});
const attackCard = (id: string): Card => makeCard(id, 'attack');
/** Character with a specific id so the engine's skill registry (keyed by character id) applies. */
const character = (id: string): Character => ({ id, name: id, hp: 4, faction: 'test', skills: [] });

function makeGame(charIds: Record<string, string> = {}): GameState {
  const host = spectator('p0');
  const game = createGame('room1', host, []);
  game.spectators = [];
  game.players.push(createSeatedPlayer(host, 1));
  for (let i = 1; i < 4; i++) game.players.push(createSeatedPlayer(spectator(`p${i}`), i + 1));
  dealRoles(game, { emperor: 1, rebel: 2, loyalist: 0, traitor: 1 });
  game.players.forEach((p, i) => { p.character = character(charIds[p.id] ?? `CHAR_generic_${i}`); p.confirmedCharacter = true; p.maxHp = 8; p.hp = 8; p.characterOptions = []; });
  beginPlayAfterCharacters(game, 0);
  game.turn.phase = 'play';
  game.turn.activePlayerId = 'p0';
  game.currentPlayerId = 'p0';
  game.hasDrawnThisTurn = true;
  return game;
}

describe('Character skill – เตียวหุย คำราม (unlimited_attack)', () => {
  it('lets เตียวหุย attack more than once per turn', () => {
    const game = makeGame({ p0: 'CHAR011' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hand = [attackCard('a1'), attackCard('a2')];
    assert.ok(hasCharacterSkill(game, 'p0', 'unlimited_attack'));
    playAttack(game, 'p0', 'p1', 'a1');
    respondToAttack(game, 'p1'); // resolve first attack
    assert.doesNotThrow(() => playAttack(game, 'p0', 'p1', 'a2'), 'second attack allowed');
  });

  it('a normal character cannot attack twice', () => {
    const game = makeGame(); // p0 has no skill
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hand = [attackCard('a1'), attackCard('a2')];
    playAttack(game, 'p0', 'p1', 'a1');
    respondToAttack(game, 'p1');
    assert.throws(() => playAttack(game, 'p0', 'p1', 'a2'), /one attack per turn/);
  });
});

describe('Character skill – ม้าเฉียว ทหารม้า (outgoing_distance_minus_one)', () => {
  it('reduces the distance from ม้าเฉียว to other players by 1', () => {
    const skilled = makeGame({ p0: 'CHAR014' });
    const plain = makeGame(); // p0 has no skill
    // p0 (seat 1) → p2 (seat 3): base distance 2
    assert.equal(getEffectiveDistanceBetweenPlayers(plain, 'p0', 'p2'), 2, 'normal effective distance');
    assert.equal(getEffectiveDistanceBetweenPlayers(skilled, 'p0', 'p2'), 1, 'ทหารม้า shortens it by 1');
  });

  it('never drops below 1', () => {
    const game = makeGame({ p0: 'CHAR014' });
    // p0 → p1 are adjacent (base 1); minus 1 clamps to 1
    assert.equal(getEffectiveDistanceBetweenPlayers(game, 'p0', 'p1'), 1);
  });

  it('does not affect other players', () => {
    const game = makeGame({ p0: 'CHAR014' });
    assert.ok(!hasCharacterSkill(game, 'p1', 'outgoing_distance_minus_one'));
    assert.equal(getEffectiveDistanceBetweenPlayers(game, 'p1', 'p3'), 2, 'p1 has no skill');
  });
});

describe('Character skill – ลกซุน อ่อนน้อมถ่อมตน (immune indulgence + steal)', () => {
  it('cannot be targeted by มีสุขลืมเมือง', () => {
    const game = makeGame({ p1: 'CHAR007' });
    game.players.find(p => p.id === 'p0')!.hand = [makeCard('ind', 'delayed_skip_play_phase', 'delayed_trick')];
    assert.throws(() => playCard(game, 'p0', 'ind', 'p1'), /อ่อนน้อมถ่อมตน/);
  });

  it('cannot be the target of ลอบขโมย', () => {
    const game = makeGame({ p1: 'CHAR007' });
    game.players.find(p => p.id === 'p0')!.hand = [makeCard('steal', 'steal_target_card_in_range', 'trick')];
    game.players.find(p => p.id === 'p1')!.hand = [attackCard('loot')];
    assert.throws(() => playStealTargetCard(game, 'p0', 'p1', { zone: 'hand', handIndex: 0 }, 'steal'), /อ่อนน้อมถ่อมตน/);
  });
});

describe('Character skill – จูกัดเหลียง กลยุทธ์เมืองว่าง (immune to attack when handless)', () => {
  it('a handless จูกัดเหลียง cannot be attacked', () => {
    const game = makeGame({ p1: 'CHAR012' });
    game.players.find(p => p.id === 'p0')!.hand = [attackCard('a1')];
    game.players.find(p => p.id === 'p1')!.hand = []; // empty
    assert.throws(() => playAttack(game, 'p0', 'p1', 'a1'), /เมืองว่าง/);
  });

  it('but can be attacked while holding cards', () => {
    const game = makeGame({ p1: 'CHAR012' });
    game.players.find(p => p.id === 'p0')!.hand = [attackCard('a1')];
    game.players.find(p => p.id === 'p1')!.hand = [attackCard('x')]; // has a card
    assert.doesNotThrow(() => playAttack(game, 'p0', 'p1', 'a1'));
  });
});

describe('Character skill – หวงเย่อิง ผู้วิเศษ (tricks ignore distance)', () => {
  it('lets หวงเย่อิง ลอบขโมย a player beyond range 1', () => {
    const game = makeGame({ p0: 'CHAR015' });
    game.players.find(p => p.id === 'p0')!.hand = [makeCard('steal', 'steal_target_card_in_range', 'trick')];
    game.players.find(p => p.id === 'p2')!.hand = [attackCard('loot')]; // p2 is at distance 2
    playStealTargetCard(game, 'p0', 'p2', { zone: 'hand', handIndex: 0 }, 'steal');
    assert.equal(game.responseWindow?.type, 'negate', 'steal declared (range ignored)');
  });

  it('a normal character cannot steal beyond range 1', () => {
    const game = makeGame(); // p0 has no skill
    game.players.find(p => p.id === 'p0')!.hand = [makeCard('steal', 'steal_target_card_in_range', 'trick')];
    game.players.find(p => p.id === 'p2')!.hand = [attackCard('loot')];
    assert.throws(() => playStealTargetCard(game, 'p0', 'p2', { zone: 'hand', handIndex: 0 }, 'steal'), /range/);
  });
});

describe('Character skill – จูล่ง กล้าหาญ (attack ⇄ dodge swap)', () => {
  it('lets จูล่ง dodge an Attack using an Attack card', () => {
    const game = makeGame({ p1: 'CHAR013' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    game.players.find(p => p.id === 'p0')!.hand = [attackCard('a1')];
    p1.hand = [attackCard('as-dodge')]; // only an Attack, no dodge
    const hpBefore = p1.hp!;
    playAttack(game, 'p0', 'p1', 'a1');
    playDodge(game, 'p1', 'as-dodge'); // attack used as dodge
    assert.equal(p1.hp, hpBefore, 'attack was dodged — no damage');
    assert.equal(game.responseWindow, null);
  });

  it('a normal character cannot dodge with an Attack card', () => {
    const game = makeGame(); // p1 has no skill
    game.players.find(p => p.id === 'p0')!.hand = [attackCard('a1')];
    game.players.find(p => p.id === 'p1')!.hand = [attackCard('nope')];
    playAttack(game, 'p0', 'p1', 'a1');
    assert.throws(() => playDodge(game, 'p1', 'nope'), /Dodge card/);
  });

  it('lets จูล่ง answer a mass-dodge trick with an Attack card', () => {
    const game = makeGame({ p1: 'CHAR013' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    game.players.find(p => p.id === 'p0')!.hand = [makeCard('mass', 'all_others_dodge_or_damage', 'trick')];
    p1.hand = [attackCard('as-dodge')];
    const hpBefore = p1.hp!;
    playMassDodgeOrDamage(game, 'p0', 'mass');
    // p1 is first in the mass queue; respond with an attack card (swap)
    assert.equal(game.responseWindow?.currentResponderId, 'p1');
    playMassResponseCard(game, 'p1', 'as-dodge');
    assert.equal(p1.hp, hpBefore, 'no damage — attack counted as dodge');
  });

  it('proactive: จูล่ง plays a Dodge card AS an Attack on their turn', () => {
    const game = makeGame({ p0: 'CHAR013' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    game.players.find(p => p.id === 'p0')!.hand = [dodgeCard('dodge-as-attack')];
    const hpBefore = p1.hp!;
    playCard(game, 'p0', 'dodge-as-attack', 'p1'); // dodge routed to playAttack
    assert.equal(game.responseWindow?.type, 'attack_dodge');
    assert.equal(game.responseWindow?.currentResponderId, 'p1');
    respondToAttack(game, 'p1'); // take the hit
    assert.equal(p1.hp, hpBefore - 1, 'the dodge card dealt attack damage');
  });

  it('a normal character cannot play a Dodge card as an Attack', () => {
    const game = makeGame(); // p0 no skill
    game.players.find(p => p.id === 'p0')!.hand = [dodgeCard('d1')];
    assert.throws(() => playCard(game, 'p0', 'd1', 'p1'), /response/);
  });
});

describe('Character skill – ลิโป้ ไร้เทียมทาน in a duel (needs two attacks)', () => {
  it('the opponent must play two attacks before the duel passes back', () => {
    const game = makeGame({ p0: 'CHAR024' });
    game.players.find(p => p.id === 'p0')!.hand = [duelCard('duel'), attackCard('lb1')];
    game.players.find(p => p.id === 'p1')!.hand = [attackCard('a1'), attackCard('a2')];
    playCard(game, 'p0', 'duel', 'p1');
    assert.equal(game.responseWindow?.type, 'duel_attack');
    assert.equal(game.responseWindow?.currentResponderId, 'p1', 'target responds first');
    playAttackResponse(game, 'p1', 'a1');
    assert.equal(game.responseWindow?.currentResponderId, 'p1', 'still p1 — needs a second attack vs ลิโป้');
    playAttackResponse(game, 'p1', 'a2');
    assert.equal(game.responseWindow?.currentResponderId, 'p0', 'now it is ลิโป้ turn');
  });

  it('one attack then giving up loses the duel', () => {
    const game = makeGame({ p0: 'CHAR024' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    game.players.find(p => p.id === 'p0')!.hand = [duelCard('duel')];
    p1.hand = [attackCard('a1')];
    const hpBefore = p1.hp!;
    playCard(game, 'p0', 'duel', 'p1');
    playAttackResponse(game, 'p1', 'a1');
    declineResponse(game, 'p1'); // cannot provide the second attack
    assert.equal(p1.hp, hpBefore - 1, 'p1 lost the duel and took damage');
  });
});

describe('Character skill – ลิโป้ ไร้เทียมทาน (attack needs two dodges)', () => {
  it('a single dodge is not enough — the window stays open', () => {
    const game = makeGame({ p0: 'CHAR024' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    game.players.find(p => p.id === 'p0')!.hand = [attackCard('a1')];
    p1.hand = [dodgeCard('d1')];
    playAttack(game, 'p0', 'p1', 'a1');
    assert.equal(game.pendingAction?.dodgesRequired, 2, 'ลิโป้ requires two dodges');
    playDodge(game, 'p1', 'd1');
    assert.equal(game.responseWindow?.type, 'attack_dodge', 'still waiting for another dodge');
    assert.equal(game.responseWindow?.currentResponderId, 'p1');
  });

  it('one dodge then no more → the attack still hits', () => {
    const game = makeGame({ p0: 'CHAR024' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    game.players.find(p => p.id === 'p0')!.hand = [attackCard('a1')];
    p1.hand = [dodgeCard('d1')];
    const hpBefore = p1.hp!;
    playAttack(game, 'p0', 'p1', 'a1');
    playDodge(game, 'p1', 'd1');
    respondToAttack(game, 'p1'); // cannot provide a second dodge → decline
    assert.equal(p1.hp, hpBefore - 1, 'took damage — one dodge was not enough');
    assert.equal(game.responseWindow, null);
  });

  it('two dodges fully cancel the attack', () => {
    const game = makeGame({ p0: 'CHAR024' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    game.players.find(p => p.id === 'p0')!.hand = [attackCard('a1')];
    p1.hand = [dodgeCard('d1'), dodgeCard('d2')];
    const hpBefore = p1.hp!;
    playAttack(game, 'p0', 'p1', 'a1');
    playDodge(game, 'p1', 'd1');
    playDodge(game, 'p1', 'd2');
    assert.equal(p1.hp, hpBefore, 'no damage — two dodges cancelled it');
    assert.equal(game.responseWindow, null);
  });

  it('a normal attacker is fully dodged by one dodge', () => {
    const game = makeGame(); // p0 has no skill
    const p1 = game.players.find(p => p.id === 'p1')!;
    game.players.find(p => p.id === 'p0')!.hand = [attackCard('a1')];
    p1.hand = [dodgeCard('d1')];
    const hpBefore = p1.hp!;
    playAttack(game, 'p0', 'p1', 'a1');
    playDodge(game, 'p1', 'd1');
    assert.equal(p1.hp, hpBefore, 'one dodge is enough vs a normal attacker');
    assert.equal(game.responseWindow, null);
  });
});

describe('Character skill – กุยแก คำสั่งเสีย (draw_on_damage, event)', () => {
  it('grants 2 owed draws per point of damage taken', () => {
    const game = makeGame({ p1: 'CHAR021' });
    applyDamage(game, 'p1', 1);
    assert.equal(owedDraws(game, 'p1'), 2, '1 damage → 2 draws');
    applyDamage(game, 'p1', 2);
    assert.equal(owedDraws(game, 'p1'), 6, '+2 damage → +4 draws (total 6)');
  });

  it('fires when กุยแก takes attack damage', () => {
    const game = makeGame({ p1: 'CHAR021' });
    game.players.find(p => p.id === 'p0')!.hand = [attackCard('a1')];
    playAttack(game, 'p0', 'p1', 'a1');
    respondToAttack(game, 'p1'); // take the hit
    assert.equal(owedDraws(game, 'p1'), 2);
  });

  it('does not fire for a character without the skill', () => {
    const game = makeGame();
    applyDamage(game, 'p1', 2);
    assert.equal(owedDraws(game, 'p1'), 0);
  });
});

describe('Character skill – โจโฉ ไม่ยอมให้โลกทรยศ (gain_damage_card, event)', () => {
  it('takes the Attack card that damaged him into hand instead of the discard pile', () => {
    const game = makeGame({ p1: 'CHAR016' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.hand = [];
    game.players.find(p => p.id === 'p0')!.hand = [attackCard('atk')];
    playAttack(game, 'p0', 'p1', 'atk');
    respondToAttack(game, 'p1'); // take the hit
    assert.ok(p1.hand.some(c => c.id === 'atk'), 'โจโฉ gained the attack card');
    assert.ok(!game.discard.some(c => c.id === 'atk'), 'and it is NOT in the discard pile');
  });

  it('gains nothing when the damage has no card source (e.g. a mass trick)', () => {
    const game = makeGame({ p1: 'CHAR016' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.hand = [];
    applyDamage(game, 'p1', 1); // no source card
    assert.equal(p1.hand.length, 0, 'no card gained');
  });
});

describe('Character skill – จิวยี่ ยอดวีรชน (draw phase +1)', () => {
  it('draws 3 cards in the draw phase instead of 2', () => {
    const game = makeGame({ p0: 'CHAR005' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hand = [];
    game.deck = [attackCard('c1'), attackCard('c2'), attackCard('c3'), attackCard('c4')];
    game.turn.phase = 'draw';
    game.hasDrawnThisTurn = false;
    game.turn.drawnThisTurn = 0;
    drawOneTurnCard(game, 'p0');
    drawOneTurnCard(game, 'p0');
    assert.equal(game.turn.phase, 'draw', 'still drawing after 2 (needs 3)');
    drawOneTurnCard(game, 'p0');
    assert.equal(game.turn.phase, 'play', 'enters play after the 3rd draw');
    assert.equal(p0.hand.length, 3);
  });
});

describe('Character skill – เตียวเสี้ยน งามกลบแสงจันทร์ (draw at turn end)', () => {
  it('grants an owed draw when เตียวเสี้ยน ends their turn', () => {
    const game = makeGame({ p0: 'CHAR025' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hand = [];
    endTurn(game, 'p0');
    assert.equal(owedDraws(game, 'p0'), 1, 'end-of-turn draw granted');
    assert.notEqual(game.turn.activePlayerId, 'p0', 'turn passed on');
  });

  it('a normal character gets no end-of-turn draw', () => {
    const game = makeGame();
    game.players.find(p => p.id === 'p0')!.hand = [];
    endTurn(game, 'p0');
    assert.equal(owedDraws(game, 'p0'), 0);
  });
});

describe('Character skill – อุยกาย พลีชีพ (active: lose 1 HP, draw 2)', () => {
  it('loses 1 HP and gains 2 owed draws', () => {
    const game = makeGame({ p0: 'CHAR004' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hp = 5;
    useSelfDamageDraw(game, 'p0');
    assert.equal(p0.hp, 4);
    assert.equal(owedDraws(game, 'p0'), 2);
  });

  it('can drop the user to a dying state', () => {
    const game = makeGame({ p0: 'CHAR004' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hp = 1;
    useSelfDamageDraw(game, 'p0');
    assert.equal(p0.hp, 0);
    assert.equal(game.responseWindow?.type, 'dying_heal');
  });

  it('a normal character cannot use it', () => {
    const game = makeGame();
    assert.throws(() => useSelfDamageDraw(game, 'p0'));
  });
});

describe('Character skill – ซุนกวน ถ่วงดุล (active: discard N, draw N, once/turn)', () => {
  it('discards the chosen cards and grants an equal number of draws', () => {
    const game = makeGame({ p0: 'CHAR001' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hand = [attackCard('a'), attackCard('b'), attackCard('c')];
    useDiscardThenDraw(game, 'p0', ['a', 'b', 'c']);
    assert.equal(p0.hand.length, 0, 'chosen cards discarded');
    assert.equal(owedDraws(game, 'p0'), 3, 'gained 3 draws');
    assert.ok(game.discard.some(c => c.id === 'a'));
  });

  it('can only be used once per turn', () => {
    const game = makeGame({ p0: 'CHAR001' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hand = [attackCard('a'), attackCard('b')];
    useDiscardThenDraw(game, 'p0', ['a']);
    assert.throws(() => useDiscardThenDraw(game, 'p0', ['b']), /1 ครั้ง/);
  });
});

describe('Card conversion – กวนอู เทพสงคราม (red as Attack)', () => {
  it('plays a red Dodge card as an Attack', () => {
    const game = makeGame({ p0: 'CHAR010' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    game.players.find(p => p.id === 'p0')!.hand = [dodgeCard('rd')]; // ♦ red dodge
    const hpBefore = p1.hp!;
    playCard(game, 'p0', 'rd', 'p1');
    assert.equal(game.responseWindow?.type, 'attack_dodge');
    respondToAttack(game, 'p1'); // decline
    assert.equal(p1.hp, hpBefore - 1, 'red card dealt attack damage');
  });

  it('cannot use a black card as an attack', () => {
    const game = makeGame({ p0: 'CHAR010' });
    game.players.find(p => p.id === 'p0')!.hand = [makeCard('bd', 'dodge', 'basic')]; // ♠ black
    assert.throws(() => playCard(game, 'p0', 'bd', 'p1'), /response/);
  });
});

describe('Card conversion – เอียนสี สาวงามล่มเมือง (black as Dodge)', () => {
  it('uses a black card to dodge an attack', () => {
    const game = makeGame({ p1: 'CHAR022' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    game.players.find(p => p.id === 'p0')!.hand = [attackCard('a1')];
    p1.hand = [attackCard('blk')]; // ♠ black attack card, used as dodge
    const hpBefore = p1.hp!;
    playAttack(game, 'p0', 'p1', 'a1');
    playDodge(game, 'p1', 'blk');
    assert.equal(p1.hp, hpBefore, 'dodged with a black card');
  });
});

describe('Character skill – สุมาอี้ กำหนดชะตา (replace judgment)', () => {
  it('replaces the revealed judgment card with a hand card', () => {
    const game = makeGame({ p0: 'CHAR017' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.decisionArea = [suited('ind', 'delayed_skip_play_phase', 'delayed_trick', '♠', 'K')];
    game.deck = [attackCard('x1'), attackCard('x2'), suited('judge', 'attack', 'basic', '♠', 'K')];
    game.players.find(p => p.id === 'p0')!.hand = [suited('rep', 'dodge', 'basic', '♥', '5')];
    startTurn(game, 'p1');
    drawJudgmentCard(game, 'p1');
    assert.equal(game.pendingJudgment?.revealed?.id, 'judge');
    replaceJudgmentCard(game, 'p0', 'rep');
    assert.equal(game.pendingJudgment?.revealed?.id, 'rep', 'judgment now shows สุมาอี้ card');
    assert.ok(game.discard.some(c => c.id === 'judge'), 'old judgment discarded');
  });

  it('the replaced card decides the outcome (♥ → Indulgence passes, play not skipped)', () => {
    const game = makeGame({ p0: 'CHAR017' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.decisionArea = [suited('ind', 'delayed_skip_play_phase', 'delayed_trick', '♠', 'K')];
    game.deck = [attackCard('x1'), attackCard('x2'), suited('judge', 'attack', 'basic', '♠', 'K')]; // ♠ = non-heart → would skip
    game.players.find(p => p.id === 'p0')!.hand = [suited('rep', 'dodge', 'basic', '♥', '5')]; // ♥ → pass
    startTurn(game, 'p1');
    drawJudgmentCard(game, 'p1');
    replaceJudgmentCard(game, 'p0', 'rep');
    resolveJudgmentCard(game, 'p1');
    drawOneTurnCard(game, 'p1');
    drawOneTurnCard(game, 'p1');
    assert.equal(game.turn.phase, 'play', 'play NOT skipped thanks to the ♥ replacement');
  });

  it('a non-สุมาอี้ cannot replace the judgment', () => {
    const game = makeGame(); // p0 no skill
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.decisionArea = [suited('ind', 'delayed_skip_play_phase', 'delayed_trick', '♠', 'K')];
    game.deck = [attackCard('x1'), attackCard('x2'), suited('judge', 'attack', 'basic', '♠', 'K')];
    game.players.find(p => p.id === 'p0')!.hand = [suited('rep', 'dodge', 'basic', '♥', '5')];
    startTurn(game, 'p1');
    drawJudgmentCard(game, 'p1');
    assert.throws(() => replaceJudgmentCard(game, 'p0', 'rep'), /กำหนดชะตา/);
  });
});

describe('Character skill – สุมาอี้ กลยุทธ์โต้กลับ (take card from damager)', () => {
  it('opens a pending decision when สุมาอี้ takes damage from someone with cards', () => {
    const game = makeGame({ p0: 'CHAR017' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.hand = [suited('d1', 'attack', 'basic', '♠', '7'), suited('d2', 'dodge', 'basic', '♥', '3')];
    applyDamage(game, 'p0', 1, 'p1');
    assert.equal(game.pendingFankui?.playerId, 'p0');
    assert.equal(game.pendingFankui?.damagerId, 'p1');
  });

  it('takes one hand card from the damager into สุมาอี้ hand', () => {
    const game = makeGame({ p0: 'CHAR017' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    const p1 = game.players.find(p => p.id === 'p1')!;
    p0.hand = [];
    p1.hand = [suited('d1', 'attack', 'basic', '♠', '7'), suited('d2', 'dodge', 'basic', '♥', '3')];
    applyDamage(game, 'p0', 1, 'p1');
    takeCardFromDamager(game, 'p0', { zone: 'hand', handIndex: 0 });
    assert.equal(p0.hand.length, 1, 'สุมาอี้ gained a card');
    assert.equal(p1.hand.length, 1, 'damager lost a card');
    assert.equal(game.pendingFankui, undefined, 'decision cleared');
  });

  it('can take a visible equipment card from the damager', () => {
    const game = makeGame({ p0: 'CHAR017' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    const p1 = game.players.find(p => p.id === 'p1')!;
    p0.hand = [];
    p1.hand = [];
    const wpn = suited('w1', 'none', 'weapon', '♠', 'K'); wpn.equipmentSlot = 'weapon';
    p1.equipment.weapon = wpn;
    applyDamage(game, 'p0', 1, 'p1');
    takeCardFromDamager(game, 'p0', { zone: 'equipment', cardInstanceId: 'w1' });
    assert.equal(p1.equipment.weapon, null, 'weapon removed from damager');
    assert.ok(p0.hand.some(c => c.id === 'w1'), 'สุมาอี้ took the weapon into hand');
  });

  it('declining clears the pending decision without taking a card', () => {
    const game = makeGame({ p0: 'CHAR017' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.hand = [suited('d1', 'attack', 'basic', '♠', '7')];
    applyDamage(game, 'p0', 1, 'p1');
    declineFankui(game, 'p0');
    assert.equal(game.pendingFankui, undefined);
    assert.equal(p1.hand.length, 1, 'damager keeps their card');
  });

  it('no window opens when the damager has no cards at all', () => {
    const game = makeGame({ p0: 'CHAR017' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.hand = [];
    p1.equipment = { weapon: null, armor: null, offensiveMount: null, defensiveMount: null };
    applyDamage(game, 'p0', 1, 'p1');
    assert.equal(game.pendingFankui, undefined);
  });

  it('a non-สุมาอี้ does not get the window on damage', () => {
    const game = makeGame(); // p0 has no skill
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.hand = [suited('d1', 'attack', 'basic', '♠', '7')];
    applyDamage(game, 'p0', 1, 'p1');
    assert.equal(game.pendingFankui, undefined);
  });

  it('no window opens for self-inflicted damage (no distinct damager)', () => {
    const game = makeGame({ p0: 'CHAR017' });
    applyDamage(game, 'p0', 1, 'p0');
    assert.equal(game.pendingFankui, undefined);
  });
});

describe('Card conversion – ฮัวโต๋ ปฐมพยาบาล (red as เสบียง)', () => {
  it('uses a red card as Heal to rescue a dying player', () => {
    const game = makeGame({ p2: 'CHAR023' });
    const p1 = game.players.find(p => p.id === 'p1')!;
    const p2 = game.players.find(p => p.id === 'p2')!;
    p1.hp = 1;
    p2.hand = [dodgeCard('rh')]; // ♦ red card used as heal
    applyDamage(game, 'p1', 1, 'p0'); // p1 → 0, dying window
    assert.equal(game.responseWindow?.type, 'dying_heal');
    declineResponse(game, 'p1'); // dying player has no heal, passes to p2
    assert.equal(game.responseWindow?.currentResponderId, 'p2');
    playHeal(game, 'p2', 'rh');
    assert.ok(p1.hp! > 0, 'ฮัวโต๋ healed the dying player with a red card');
  });
});

describe('Character skill – ลิบอง ยับยั้งชั่งใจ (skip discard if no attack)', () => {
  it('needs no discard when over the hand limit but no attack was used', () => {
    const game = makeGame({ p0: 'CHAR003' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hp = 1;
    p0.hand = [attackCard('c1'), attackCard('c2'), attackCard('c3')];
    game.attacksThisTurn = 0;
    assert.equal(getDiscardRequirement(game, 'p0'), 0, 'ลิบอง may skip the discard step');
  });

  it('must discard normally if an attack was used this turn', () => {
    const game = makeGame({ p0: 'CHAR003' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hp = 1;
    p0.hand = [attackCard('c1'), attackCard('c2'), attackCard('c3')];
    game.attacksThisTurn = 1;
    assert.equal(getDiscardRequirement(game, 'p0'), 2, 'attacking removes the discard exemption');
  });

  it('a normal character always discards down to the hand limit', () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hp = 1;
    p0.hand = [attackCard('c1'), attackCard('c2'), attackCard('c3')];
    game.attacksThisTurn = 0;
    assert.equal(getDiscardRequirement(game, 'p0'), 2);
  });
});

describe('Character skill – จูกัดเหลียง กลยุทธ์เมืองว่าง (empty city vs. duel)', () => {
  it('cannot be the target of ท้าสู้ while handless', () => {
    const game = makeGame({ p1: 'CHAR012' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.hand = [];
    p0.hand = [duelCard('d1')];
    assert.throws(() => playDuel(game, 'p0', 'p1', 'd1'), /เมืองว่าง/);
  });

  it('can be dueled once holding at least one card', () => {
    const game = makeGame({ p1: 'CHAR012' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.hand = [attackCard('x')];
    p0.hand = [duelCard('d1')];
    assert.doesNotThrow(() => playDuel(game, 'p0', 'p1', 'd1'));
  });
});

describe('Character skill – อ้วนสุด ศัตรูหมายหัว (forced taunt when loaded)', () => {
  it('forces the attacker to target อ้วนสุด when his hand exceeds his HP', () => {
    const game = makeGame({ p1: 'CHAR027' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.hp = 1;
    p1.hand = [attackCard('h1'), attackCard('h2')]; // hand(2) > hp(1)
    p0.hand = [attackCard('a1')];
    assert.deepEqual(forcedAttackTargets(game, 'p0'), ['p1']);
    assert.throws(() => playAttack(game, 'p0', 'p3', 'a1'), /ศัตรูหมายหัว/);
  });

  it('attacking อ้วนสุด himself is allowed', () => {
    const game = makeGame({ p1: 'CHAR027' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.hp = 1;
    p1.hand = [attackCard('h1'), attackCard('h2')];
    p0.hand = [attackCard('a1')];
    assert.doesNotThrow(() => playAttack(game, 'p0', 'p1', 'a1'));
  });

  it('imposes no constraint when อ้วนสุด is not over the hand limit', () => {
    const game = makeGame({ p1: 'CHAR027' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    const p1 = game.players.find(p => p.id === 'p1')!;
    p1.hp = 4;
    p1.hand = [attackCard('h1')]; // hand(1) <= hp(4)
    p0.hand = [attackCard('a1')];
    assert.deepEqual(forcedAttackTargets(game, 'p0'), []);
    assert.doesNotThrow(() => playAttack(game, 'p0', 'p3', 'a1'));
  });
});

describe('Character skill – หวงเย่อิง คลังปัญญา (draw on non-delayed trick)', () => {
  it('grants a draw right when an instant trick is played', () => {
    const game = makeGame({ p0: 'CHAR015' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hand = [suited('t1', 'none', 'instant_trick', '♠', '5')];
    playCard(game, 'p0', 't1');
    assert.equal(owedDraws(game, 'p0'), 1);
  });

  it('does not grant a draw for a basic card', () => {
    const game = makeGame({ p0: 'CHAR015' });
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hp = 1; p0.maxHp = 4;
    p0.hand = [suited('h1', 'heal', 'basic', '♥', '5')];
    playCard(game, 'p0', 'h1');
    assert.equal(owedDraws(game, 'p0'), 0);
  });

  it('does not grant a draw for a non-หวงเย่อิง character', () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find(p => p.id === 'p0')!;
    p0.hand = [suited('t1', 'none', 'instant_trick', '♠', '5')];
    playCard(game, 'p0', 't1');
    assert.equal(owedDraws(game, 'p0'), 0);
  });
});
