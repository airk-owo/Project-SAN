import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createSeatedPlayer, dealRoles, dealEmperorOptions, dealOtherCharacterOptions,
  selectCharacter, type Character, type GameState, type RoleComposition, type Spectator,
} from './index.js';

// ────────────────────────────────────────────────────────
// Test fixtures
// ────────────────────────────────────────────────────────

const NOW = '2026-01-01T00:00:00.000Z';

const spectator = (id: string, username: string): Spectator => ({
  id, username, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW,
});

const character = (id: string, name: string, hp = 4): Character => ({
  id, name, hp, faction: 'test', skills: [],
});

// Three required emperor characters (Thai names match what dealEmperorOptions checks)
const CAOCAO  = character('cao-cao',  'โจโฉ',   4);
const LIUBEI  = character('liu-bei',  'เล่าปี่', 4);
const SUNQUAN = character('sun-quan', 'ซุนกวน', 4);

/** Build a pool of N generic characters plus the 3 required emperor ones. */
function makeCharacters(extras: number): Character[] {
  const pool = Array.from({ length: extras }, (_, i) => character(`c${i}`, `Char${i}`));
  return [CAOCAO, LIUBEI, SUNQUAN, ...pool];
}

/**
 * Create a game that already has `count` seated, ready players.
 * The host occupies seat 1; additional players fill seats 2..count.
 */
function makeWaitingGame(count: number): GameState {
  const host = spectator('p0', 'P0');
  const game = createGame('r', host, []);
  // Convert host spectator → player at seat 1
  game.spectators = [];
  game.players.push(createSeatedPlayer(host, 1));
  for (let i = 1; i < count; i++) {
    const p = spectator(`p${i}`, `P${i}`);
    game.players.push(createSeatedPlayer(p, i + 1));
  }
  game.players.forEach(p => { p.ready = true; });
  return game;
}

// ────────────────────────────────────────────────────────
// dealRoles
// ────────────────────────────────────────────────────────

describe('dealRoles – phase and preconditions', () => {
  it('transitions phase from waiting to character-select', () => {
    const game = makeWaitingGame(4);
    const comp: RoleComposition = { emperor: 1, rebel: 2, loyalist: 0, traitor: 1 };
    dealRoles(game, comp);
    assert.equal(game.phase, 'character-select');
  });

  it('throws if the game is not in waiting phase', () => {
    const game = makeWaitingGame(4);
    game.phase = 'playing';
    const comp: RoleComposition = { emperor: 1, rebel: 2, loyalist: 0, traitor: 1 };
    assert.throws(() => dealRoles(game, comp), /waiting/i);
  });

  it('throws if composition does not have exactly 1 emperor', () => {
    const game = makeWaitingGame(4);
    const bad: RoleComposition = { emperor: 2, rebel: 1, loyalist: 0, traitor: 1 };
    assert.throws(() => dealRoles(game, bad), /Invalid role composition/i);
  });

  it('throws if total roles do not match player count', () => {
    const game = makeWaitingGame(4);
    const bad: RoleComposition = { emperor: 1, rebel: 3, loyalist: 0, traitor: 1 }; // 5 roles for 4 players
    assert.throws(() => dealRoles(game, bad), /Invalid role composition/i);
  });
});

describe('dealRoles – role assignment', () => {
  it('every player receives a role', () => {
    const game = makeWaitingGame(5);
    const comp: RoleComposition = { emperor: 1, rebel: 2, loyalist: 1, traitor: 1 };
    dealRoles(game, comp);
    assert.ok(game.players.every(p => p.role !== undefined));
  });

  it('exactly one player receives the emperor role', () => {
    const game = makeWaitingGame(5);
    const comp: RoleComposition = { emperor: 1, rebel: 2, loyalist: 1, traitor: 1 };
    dealRoles(game, comp);
    assert.equal(game.players.filter(p => p.role === 'emperor').length, 1);
  });

  it('role counts match the requested composition', () => {
    const comp: RoleComposition = { emperor: 1, rebel: 3, loyalist: 1, traitor: 1 };
    const game = makeWaitingGame(6);
    dealRoles(game, comp);
    const counts = { emperor: 0, rebel: 0, loyalist: 0, traitor: 0 };
    game.players.forEach(p => { if (p.role) counts[p.role]++; });
    assert.deepEqual(counts, comp);
  });

  it('emperor role is revealed (roleRevealed=true)', () => {
    const game = makeWaitingGame(4);
    dealRoles(game, { emperor: 1, rebel: 2, loyalist: 0, traitor: 1 });
    const emperor = game.players.find(p => p.role === 'emperor');
    assert.equal(emperor?.roleRevealed, true);
  });

  it('non-emperor roles are hidden (roleRevealed=false)', () => {
    const game = makeWaitingGame(4);
    dealRoles(game, { emperor: 1, rebel: 2, loyalist: 0, traitor: 1 });
    const others = game.players.filter(p => p.role !== 'emperor');
    assert.ok(others.every(p => p.roleRevealed === false));
  });

  it('roles are shuffled — same composition should produce varied orderings', () => {
    const comp: RoleComposition = { emperor: 1, rebel: 2, loyalist: 1, traitor: 1 };
    const roleLists = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const game = makeWaitingGame(5);
      dealRoles(game, comp);
      roleLists.add(game.players.map(p => p.role).join(','));
    }
    // Over 40 trials, at least 2 distinct orderings must appear (probability of all same: (1/120)^39 ≈ 0)
    assert.ok(roleLists.size > 1, 'roles should be shuffled randomly');
  });
});

// ────────────────────────────────────────────────────────
// dealEmperorOptions
// ────────────────────────────────────────────────────────

describe('dealEmperorOptions – emperor character pool', () => {
  it('emperor receives exactly 5 character options', () => {
    const game = makeWaitingGame(5);
    dealRoles(game, { emperor: 1, rebel: 2, loyalist: 1, traitor: 1 });
    const chars = makeCharacters(10);
    dealEmperorOptions(game, chars);
    const emperor = game.players.find(p => p.role === 'emperor')!;
    assert.equal(emperor.characterOptions.length, 5);
  });

  it('emperor options always include โจโฉ, เล่าปี่, and ซุนกวน', () => {
    const game = makeWaitingGame(5);
    dealRoles(game, { emperor: 1, rebel: 2, loyalist: 1, traitor: 1 });
    const chars = makeCharacters(10);
    dealEmperorOptions(game, chars);
    const emperor = game.players.find(p => p.role === 'emperor')!;
    const names = emperor.characterOptions.map(c => c.name);
    assert.ok(names.includes('โจโฉ'),   'must include โจโฉ');
    assert.ok(names.includes('เล่าปี่'), 'must include เล่าปี่');
    assert.ok(names.includes('ซุนกวน'), 'must include ซุนกวน');
  });

  it('emperor options have no duplicates', () => {
    const game = makeWaitingGame(5);
    dealRoles(game, { emperor: 1, rebel: 2, loyalist: 1, traitor: 1 });
    dealEmperorOptions(game, makeCharacters(10));
    const emperor = game.players.find(p => p.role === 'emperor')!;
    const ids = emperor.characterOptions.map(c => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('throws when a required emperor character is missing from data', () => {
    const game = makeWaitingGame(4);
    dealRoles(game, { emperor: 1, rebel: 2, loyalist: 0, traitor: 1 });
    // Characters that don't include the required three
    const incomplete = [character('c1', 'Char1'), character('c2', 'Char2')];
    assert.throws(() => dealEmperorOptions(game, incomplete), /Required emperor/i);
  });

  it('non-emperor players receive no character options from dealEmperorOptions', () => {
    const game = makeWaitingGame(4);
    dealRoles(game, { emperor: 1, rebel: 2, loyalist: 0, traitor: 1 });
    dealEmperorOptions(game, makeCharacters(5));
    const others = game.players.filter(p => p.role !== 'emperor');
    assert.ok(others.every(p => p.characterOptions.length === 0));
  });
});

// ────────────────────────────────────────────────────────
// dealOtherCharacterOptions (called after emperor selects)
// ────────────────────────────────────────────────────────

describe('dealOtherCharacterOptions – non-emperor pools after emperor selects', () => {
  function setupAfterEmperorSelects(playerCount: number) {
    const game = makeWaitingGame(playerCount);
    dealRoles(game, { emperor: 1, rebel: playerCount - 2, loyalist: 0, traitor: 1 });
    const chars = makeCharacters(playerCount * 4);
    dealEmperorOptions(game, chars);
    const emperor = game.players.find(p => p.role === 'emperor')!;
    // Select first option
    selectCharacter(game, emperor.id, emperor.characterOptions[0]!.id, chars);
    return { game, chars };
  }

  it('all non-emperor players receive character options after emperor selects', () => {
    const { game } = setupAfterEmperorSelects(5);
    const others = game.players.filter(p => p.role !== 'emperor');
    assert.ok(others.every(p => p.characterOptions.length > 0));
  });

  it('non-emperor players receive 3 options in a 5-player game', () => {
    const { game } = setupAfterEmperorSelects(5);
    const others = game.players.filter(p => p.role !== 'emperor');
    assert.ok(others.every(p => p.characterOptions.length === 3));
  });

  it('non-emperor players receive 2 options in a 10-player game', () => {
    const game = makeWaitingGame(10);
    dealRoles(game, { emperor: 1, rebel: 5, loyalist: 2, traitor: 2 });
    const chars = makeCharacters(30);
    dealEmperorOptions(game, chars);
    const emperor = game.players.find(p => p.role === 'emperor')!;
    selectCharacter(game, emperor.id, emperor.characterOptions[0]!.id, chars);
    const others = game.players.filter(p => p.role !== 'emperor');
    assert.ok(others.every(p => p.characterOptions.length === 2));
  });

  it('no character appears in two different players option pools', () => {
    const { game } = setupAfterEmperorSelects(6);
    const others = game.players.filter(p => p.role !== 'emperor');
    const allOptionIds = others.flatMap(p => p.characterOptions.map(c => c.id));
    assert.equal(new Set(allOptionIds).size, allOptionIds.length, 'each character should appear only once across all pools');
  });

  it("emperor's chosen character does not appear in others' pools", () => {
    const { game } = setupAfterEmperorSelects(5);
    const emperor = game.players.find(p => p.role === 'emperor')!;
    const emperorCharId = emperor.character!.id;
    const others = game.players.filter(p => p.role !== 'emperor');
    assert.ok(others.every(p => p.characterOptions.every(c => c.id !== emperorCharId)));
  });
});
