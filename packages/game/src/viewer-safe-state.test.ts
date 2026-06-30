import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, createPublicGameState, dealRoles,
  type Card, type Character, type GameState, type Spectator,
} from './index.js';

// ────────────────────────────────────────────────────────
// Test fixtures
// ────────────────────────────────────────────────────────

const NOW = '2026-01-01T00:00:00.000Z';

const spectator = (id: string, username: string): Spectator => ({
  id, username, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW,
});

const makeCard = (id: string): Card => ({
  id, name: id, type: 'basic', cardType: 'basic', suit: '♥', number: '7',
  image: null, description: null, effect: 'attack', effectParams: { damage: 1 },
  triggerTiming: 'on_play', equipmentSlot: null, createsResponseWindow: true, conditions: null,
});

const makeCharacter = (id: string, name: string): Character => ({
  id, name, hp: 4, faction: 'test', skills: [],
});

/**
 * Build a game with `count` seated players and deal roles.
 * Returns the state ready for character-select phase.
 */
function makeCharacterSelectGame(count: number): GameState {
  const host = spectator('p0', 'P0');
  const game = createGame('r', host, []);
  game.spectators = [];
  game.players.push(createSeatedPlayer(host, 1));
  for (let i = 1; i < count; i++) {
    const p = spectator(`p${i}`, `P${i}`);
    game.players.push(createSeatedPlayer(p, i + 1));
  }
  // Assign roles so roleRevealed flags are set
  const rebels = count - 2;
  dealRoles(game, { emperor: 1, rebel: rebels, loyalist: 0, traitor: 1 });
  return game;
}

/** Give every player a character and confirm selection. */
function assignCharacters(game: GameState): void {
  game.players.forEach((p, i) => {
    const char = makeCharacter(`char${i}`, `Character${i}`);
    p.character = char;
    p.confirmedCharacter = true;
    p.maxHp = char.hp + (p.role === 'emperor' && game.players.length !== 4 ? 1 : 0);
    p.hp = p.maxHp;
  });
}

// ────────────────────────────────────────────────────────
// viewerId and isSpectator
// ────────────────────────────────────────────────────────

describe('viewer-safe state – viewerId and isSpectator', () => {
  it('viewerId matches the id passed in', () => {
    const game = makeCharacterSelectGame(4);
    const view = createPublicGameState(game, 'p0');
    assert.equal(view.viewerId, 'p0');
  });

  it('isSpectator=false for a seated player', () => {
    const game = makeCharacterSelectGame(4);
    const view = createPublicGameState(game, 'p0');
    assert.equal(view.isSpectator, false);
  });

  it('isSpectator=true for a spectator', () => {
    const game = createGame('r', spectator('host', 'Host'), []);
    const guest = spectator('g', 'Guest');
    game.spectators.push(guest);
    const view = createPublicGameState(game, 'g');
    assert.equal(view.isSpectator, true);
  });
});

// ────────────────────────────────────────────────────────
// Role visibility
// ────────────────────────────────────────────────────────

describe('viewer-safe state – role visibility', () => {
  it('viewer sees their own role', () => {
    const game = makeCharacterSelectGame(4);
    const viewer = game.players[1]!; // non-emperor
    const view = createPublicGameState(game, viewer.id);
    const viewerInView = view.players.find(p => p.id === viewer.id)!;
    assert.equal(viewerInView.role, viewer.role);
  });

  it('viewer cannot see another player\'s unrevealed role', () => {
    const game = makeCharacterSelectGame(5);
    const viewer = game.players[0]!;
    // Pick a non-emperor, non-viewer player whose role is unrevealed
    const hidden = game.players.find(p => p.id !== viewer.id && !p.roleRevealed)!;
    const view = createPublicGameState(game, viewer.id);
    const hiddenInView = view.players.find(p => p.id === hidden.id)!;
    assert.equal(hiddenInView.role, undefined);
  });

  it('emperor role is always visible to everyone (roleRevealed=true)', () => {
    const game = makeCharacterSelectGame(4);
    const emperor = game.players.find(p => p.role === 'emperor')!;
    const nonEmperor = game.players.find(p => p.role !== 'emperor')!;
    const view = createPublicGameState(game, nonEmperor.id);
    const emperorInView = view.players.find(p => p.id === emperor.id)!;
    assert.equal(emperorInView.role, 'emperor');
  });

  it('revealed role is visible to all viewers', () => {
    const game = makeCharacterSelectGame(4);
    const rebel = game.players.find(p => p.role === 'rebel')!;
    rebel.roleRevealed = true;
    const viewer = game.players.find(p => p.id !== rebel.id)!;
    const view = createPublicGameState(game, viewer.id);
    const rebelInView = view.players.find(p => p.id === rebel.id)!;
    assert.equal(rebelInView.role, 'rebel');
  });
});

// ────────────────────────────────────────────────────────
// Hand visibility
// ────────────────────────────────────────────────────────

describe('viewer-safe state – hand visibility', () => {
  it('viewer sees their own hand with full card details', () => {
    const game = makeCharacterSelectGame(4);
    const viewer = game.players[0]!;
    viewer.hand = [makeCard('a1'), makeCard('a2')];
    const view = createPublicGameState(game, viewer.id);
    const viewerInView = view.players.find(p => p.id === viewer.id)!;
    assert.equal(viewerInView.hand.length, 2);
    assert.equal(viewerInView.hand[0]?.id, 'a1');
  });

  it('viewer sees only public card fields (no effectParams)', () => {
    const game = makeCharacterSelectGame(4);
    const viewer = game.players[0]!;
    viewer.hand = [makeCard('c1')];
    const view = createPublicGameState(game, viewer.id);
    const card = view.players.find(p => p.id === viewer.id)!.hand[0] as Record<string, unknown>;
    assert.ok('id' in card && 'name' in card && 'suit' in card);
    assert.ok(!('effectParams' in card), 'effectParams should not be in public hand view');
  });

  it("other players' hands are empty arrays", () => {
    const game = makeCharacterSelectGame(4);
    const viewer = game.players[0]!;
    const other = game.players[1]!;
    other.hand = [makeCard('b1'), makeCard('b2'), makeCard('b3')];
    const view = createPublicGameState(game, viewer.id);
    const otherInView = view.players.find(p => p.id === other.id)!;
    assert.deepEqual(otherInView.hand, []);
  });

  it('handCount reflects the real hand size even for hidden hands', () => {
    const game = makeCharacterSelectGame(4);
    const viewer = game.players[0]!;
    const other = game.players[1]!;
    other.hand = [makeCard('b1'), makeCard('b2'), makeCard('b3')];
    const view = createPublicGameState(game, viewer.id);
    const otherInView = view.players.find(p => p.id === other.id)!;
    assert.equal(otherInView.handCount, 3);
  });

  it("viewer's own handCount matches their hand length", () => {
    const game = makeCharacterSelectGame(4);
    const viewer = game.players[0]!;
    viewer.hand = [makeCard('v1'), makeCard('v2')];
    const view = createPublicGameState(game, viewer.id);
    const viewerInView = view.players.find(p => p.id === viewer.id)!;
    assert.equal(viewerInView.handCount, 2);
  });
});

// ────────────────────────────────────────────────────────
// Character visibility
// ────────────────────────────────────────────────────────

describe('viewer-safe state – character visibility', () => {
  it("viewer sees their own character", () => {
    const game = makeCharacterSelectGame(4);
    const viewer = game.players[0]!;
    viewer.character = makeCharacter('cv', 'ViewerChar');
    viewer.confirmedCharacter = true;
    const view = createPublicGameState(game, viewer.id);
    assert.equal(view.players.find(p => p.id === viewer.id)?.character?.id, 'cv');
  });

  it("emperor's character is visible to all once confirmed", () => {
    const game = makeCharacterSelectGame(4);
    const emperor = game.players.find(p => p.role === 'emperor')!;
    emperor.character = makeCharacter('emp', 'EmperorChar');
    emperor.confirmedCharacter = true;
    const nonEmperor = game.players.find(p => p.role !== 'emperor')!;
    const view = createPublicGameState(game, nonEmperor.id);
    assert.equal(view.players.find(p => p.id === emperor.id)?.character?.id, 'emp');
  });

  it("other non-emperor characters are hidden during character selection", () => {
    const game = makeCharacterSelectGame(5);
    const rebel = game.players.find(p => p.role === 'rebel')!;
    rebel.character = makeCharacter('reb', 'RebelChar');
    rebel.confirmedCharacter = true;
    const viewer = game.players.find(p => p.id !== rebel.id && p.role !== 'emperor')!;
    const view = createPublicGameState(game, viewer.id);
    assert.equal(view.players.find(p => p.id === rebel.id)?.character, undefined);
  });

  it('all characters become visible once everyone has confirmed', () => {
    const game = makeCharacterSelectGame(4);
    assignCharacters(game);
    const viewer = game.players[0]!;
    const view = createPublicGameState(game, viewer.id);
    assert.ok(view.players.every(p => p.character !== undefined));
  });
});

// ────────────────────────────────────────────────────────
// Character options
// ────────────────────────────────────────────────────────

describe('viewer-safe state – character options', () => {
  it('viewer sees their own characterOptions', () => {
    const game = makeCharacterSelectGame(4);
    const viewer = game.players[0]!;
    viewer.characterOptions = [makeCharacter('opt1', 'Option1'), makeCharacter('opt2', 'Option2')];
    const view = createPublicGameState(game, viewer.id);
    assert.equal(view.players.find(p => p.id === viewer.id)?.characterOptions.length, 2);
  });

  it("other players' characterOptions are empty", () => {
    const game = makeCharacterSelectGame(4);
    const viewer = game.players[0]!;
    const other = game.players[1]!;
    other.characterOptions = [makeCharacter('o1', 'O1'), makeCharacter('o2', 'O2')];
    const view = createPublicGameState(game, viewer.id);
    assert.deepEqual(view.players.find(p => p.id === other.id)?.characterOptions, []);
  });
});

// ────────────────────────────────────────────────────────
// Deck / draw pile
// ────────────────────────────────────────────────────────

describe('viewer-safe state – deck and draw pile', () => {
  it('deck is replaced by a length-only summary', () => {
    const game = createGame('r', spectator('h', 'Host'), [
      makeCard('d1'), makeCard('d2'), makeCard('d3'),
    ]);
    const view = createPublicGameState(game, 'h');
    // The deck field should be {length: N} not a full array
    assert.equal(typeof (view as unknown as Record<string, unknown>).deck, 'object');
    const deckSummary = (view as unknown as { deck: { length: number } }).deck;
    assert.equal(deckSummary.length, 3);
  });

  it('drawPileCount matches deck size', () => {
    const game = createGame('r', spectator('h', 'Host'), [makeCard('x1'), makeCard('x2')]);
    const view = createPublicGameState(game, 'h');
    assert.equal(view.drawPileCount, 2);
  });
});

// ────────────────────────────────────────────────────────
// Response window – cardInstanceId scrubbing
// ────────────────────────────────────────────────────────

describe('viewer-safe state – response window privacy', () => {
  it('cardInstanceId is stripped from responseWindow responses for non-participants', () => {
    const game = makeCharacterSelectGame(4);
    assignCharacters(game);
    game.phase = 'playing';
    // Manually inject a response window with a cardInstanceId
    game.responseWindow = {
      windowId: 'w1',
      type: 'attack_dodge',
      sourceActionId: 'a1',
      requiredPlayerIds: ['p1'],
      currentResponderId: 'p1',
      allowedResponseEffectKeys: ['dodge'],
      responses: [{
        playerId: 'p1',
        response: 'card',
        cardInstanceId: 'secret-instance-id',
        createdAt: NOW,
      }],
      status: 'open',
      createdAt: NOW,
    };
    // A third player watches
    const view = createPublicGameState(game, 'p2');
    const responseInView = view.responseWindow?.responses[0] as Record<string, unknown> | undefined;
    assert.ok(responseInView, 'response should still appear in the window');
    assert.ok(!('cardInstanceId' in (responseInView ?? {})), 'cardInstanceId must be stripped');
  });

  it('responseWindow is null when there is no active response window', () => {
    const game = makeCharacterSelectGame(4);
    game.responseWindow = null;
    const view = createPublicGameState(game, 'p0');
    assert.equal(view.responseWindow, null);
  });
});
