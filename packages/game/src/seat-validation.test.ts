import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createSeatedPlayer, type GameState, type Spectator } from './index.js';

// ────────────────────────────────────────────────────────
// Test fixtures
// ────────────────────────────────────────────────────────

const NOW = '2026-01-01T00:00:00.000Z';

const spectator = (id: string, username: string): Spectator => ({
  id, username, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW,
});

// ────────────────────────────────────────────────────────
// Helpers that mirror server socket handlers exactly
// ────────────────────────────────────────────────────────

function allMembers(game: GameState) {
  return [...game.players, ...game.spectators];
}

/** Mirror of server seat:select handler (sans socket/connection checks). */
function selectSeat(game: GameState, userId: string, seatInput: unknown): void {
  const seat = Number(seatInput);
  if (game.phase !== 'waiting') throw new Error('เกมเริ่มแล้ว ไม่สามารถเปลี่ยนที่นั่งได้');
  if (!Number.isInteger(seat) || seat < 1 || seat > 10) throw new Error('กรุณาเลือกที่นั่ง 1–10');
  if (game.players.some(p => p.seatIndex === seat && p.id !== userId))
    throw new Error('ที่นั่งนี้ถูกใช้งานแล้ว');
  const current = allMembers(game).find(m => m.id === userId);
  if (!current) throw new Error('คุณไม่ได้อยู่ในห้องนี้');
  const seated = game.players.find(p => p.id === userId);
  if (seated) {
    seated.seatIndex = seat;
    seated.ready = false;
  } else {
    game.spectators = game.spectators.filter(s => s.id !== userId);
    game.players.push(createSeatedPlayer(current as Spectator, seat));
  }
  game.players.sort((a, b) => a.seatIndex - b.seatIndex);
}

/** Mirror of server seat:random handler. */
function selectRandomSeat(game: GameState, userId: string): number {
  if (game.phase !== 'waiting') throw new Error('เกมเริ่มแล้ว ไม่สามารถเปลี่ยนที่นั่งได้');
  const occupied = new Set(game.players.map(p => p.seatIndex));
  const empty = Array.from({ length: 10 }, (_, i) => i + 1).filter(s => !occupied.has(s));
  if (!empty.length) throw new Error('ไม่มีที่นั่งว่าง');
  const seat = empty[Math.floor(Math.random() * empty.length)]!;
  const current = allMembers(game).find(m => m.id === userId);
  if (!current) throw new Error('คุณไม่ได้อยู่ในห้องนี้');
  const seated = game.players.find(p => p.id === userId);
  if (seated) { seated.seatIndex = seat; seated.ready = false; }
  else {
    game.spectators = game.spectators.filter(s => s.id !== userId);
    game.players.push(createSeatedPlayer(current as Spectator, seat));
  }
  game.players.sort((a, b) => a.seatIndex - b.seatIndex);
  return seat;
}

/** Mirror of server seat:spectate handler. */
function moveToSpectator(game: GameState, userId: string): void {
  if (game.phase !== 'waiting') throw new Error('เกมเริ่มแล้ว ไม่สามารถกลับเป็นผู้ชมได้');
  const player = game.players.find(p => p.id === userId);
  if (!player) throw new Error('คุณเป็นผู้ชมอยู่แล้ว');
  game.players = game.players.filter(p => p.id !== userId);
  game.spectators.push({
    id: player.id, username: player.username,
    connectionStatus: player.connectionStatus,
    joinedAt: player.joinedAt, lastSeenAt: NOW,
  });
}

// ────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────

describe('seat:select – range validation', () => {
  it('accepts seat 1 (lower bound)', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    selectSeat(game, 'h', 1);
    assert.equal(game.players[0]?.seatIndex, 1);
  });

  it('accepts seat 10 (upper bound)', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    selectSeat(game, 'h', 10);
    assert.equal(game.players[0]?.seatIndex, 10);
  });

  it('rejects seat 0', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    assert.throws(() => selectSeat(game, 'h', 0), /1–10/);
  });

  it('rejects seat 11', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    assert.throws(() => selectSeat(game, 'h', 11), /1–10/);
  });

  it('rejects fractional seat (1.5)', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    assert.throws(() => selectSeat(game, 'h', 1.5), /1–10/);
  });

  it('rejects NaN (undefined coerces via Number())', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    assert.throws(() => selectSeat(game, 'h', undefined), /1–10/);
  });

  it('rejects negative seat', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    assert.throws(() => selectSeat(game, 'h', -1), /1–10/);
  });
});

describe('seat:select – occupancy', () => {
  it('rejects a seat already taken by another player', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    const alice = spectator('alice', 'Alice');
    game.spectators.push(alice);
    selectSeat(game, 'h', 3);
    assert.throws(() => selectSeat(game, 'alice', 3), /ถูกใช้งาน/);
  });

  it('allows a player to re-select their own current seat', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    selectSeat(game, 'h', 3);
    game.players[0]!.ready = true;
    selectSeat(game, 'h', 3);
    assert.equal(game.players[0]?.seatIndex, 3);
    assert.equal(game.players[0]?.ready, false, 'ready should reset on re-selection');
  });

  it('allows player to move to a different unoccupied seat', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    selectSeat(game, 'h', 3);
    game.players[0]!.ready = true;
    selectSeat(game, 'h', 7);
    assert.equal(game.players[0]?.seatIndex, 7);
    assert.equal(game.players[0]?.ready, false);
  });

  it('allows two players to occupy different seats', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    game.spectators.push(spectator('b', 'Bob'));
    selectSeat(game, 'h', 1);
    selectSeat(game, 'b', 2);
    assert.equal(game.players.length, 2);
    assert.equal(game.players[0]?.id, 'h');
    assert.equal(game.players[1]?.id, 'b');
  });
});

describe('seat:select – spectator-to-player conversion', () => {
  it('removes user from spectator list when they take a seat', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    const guest = spectator('g', 'Guest');
    game.spectators.push(guest);
    selectSeat(game, 'g', 5);
    assert.equal(game.spectators.some(s => s.id === 'g'), false);
    assert.equal(game.players.some(p => p.id === 'g' && p.seatIndex === 5), true);
  });

  it('new player starts with ready=false', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    selectSeat(game, 'h', 1);
    assert.equal(game.players[0]?.ready, false);
  });

  it('preserves username and id when converting spectator to player', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    const guest = spectator('g', 'Guest');
    game.spectators.push(guest);
    selectSeat(game, 'g', 4);
    const player = game.players.find(p => p.id === 'g');
    assert.equal(player?.username, 'Guest');
  });
});

describe('seat:select – phase gate', () => {
  it('rejects seat change once game has started', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    selectSeat(game, 'h', 1);
    game.phase = 'playing';
    assert.throws(() => selectSeat(game, 'h', 2), /เกมเริ่มแล้ว/);
  });

  it('rejects seat change during character-select phase', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    selectSeat(game, 'h', 1);
    game.phase = 'character-select';
    assert.throws(() => selectSeat(game, 'h', 2), /เกมเริ่มแล้ว/);
  });
});

describe('seat:select – seat order', () => {
  it('players are sorted ascending by seatIndex after each selection', () => {
    const game = createGame('r', spectator('p1', 'P1'), []);
    ['p2', 'p3', 'p4'].forEach(id => game.spectators.push(spectator(id, id)));
    selectSeat(game, 'p1', 5);
    selectSeat(game, 'p2', 2);
    selectSeat(game, 'p3', 8);
    selectSeat(game, 'p4', 1);
    assert.deepEqual(
      game.players.map(p => p.seatIndex),
      [1, 2, 5, 8],
    );
  });
});

describe('seat:select – unknown user', () => {
  it('rejects a userId not present in the room', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    assert.throws(() => selectSeat(game, 'ghost', 3), /ไม่ได้อยู่ในห้อง/);
  });
});

describe('seat:random – random assignment', () => {
  it('assigns an empty seat from 1–10', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    const seat = selectRandomSeat(game, 'h');
    assert.ok(Number.isInteger(seat) && seat >= 1 && seat <= 10);
    assert.equal(game.players[0]?.seatIndex, seat);
  });

  it('never assigns an already-occupied seat', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    selectSeat(game, 'h', 3);
    for (let i = 0; i < 20; i++) {
      const game2 = createGame('r2', spectator('x', 'X'), []);
      game2.players = [...game.players];
      game2.spectators.push(spectator('y', 'Y'));
      const assigned = selectRandomSeat(game2, 'y');
      assert.notEqual(assigned, 3);
    }
  });

  it('throws when all 10 seats are occupied', () => {
    const game = createGame('r', spectator('p0', 'P0'), []);
    for (let i = 1; i <= 10; i++) {
      const p = spectator(`p${i}`, `P${i}`);
      game.spectators.push(p);
      selectSeat(game, `p${i}`, i);
    }
    // add 11th person as spectator
    const extra = spectator('e', 'Extra');
    game.spectators = [extra];
    assert.throws(() => selectRandomSeat(game, 'e'), /ไม่มีที่นั่งว่าง/);
  });

  it('rejects random seat if game is not in waiting phase', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    game.phase = 'playing';
    assert.throws(() => selectRandomSeat(game, 'h'), /เกมเริ่มแล้ว/);
  });
});

describe('seat:spectate – returning to spectator', () => {
  it('removes player from players list and adds to spectators', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    selectSeat(game, 'h', 2);
    assert.equal(game.players.length, 1);
    moveToSpectator(game, 'h');
    assert.equal(game.players.length, 0);
    assert.equal(game.spectators.some(s => s.id === 'h'), true);
  });

  it('throws if user is already a spectator', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    assert.throws(() => moveToSpectator(game, 'h'), /ผู้ชมอยู่แล้ว/);
  });

  it('rejects spectate request after game starts', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    selectSeat(game, 'h', 1);
    game.phase = 'playing';
    assert.throws(() => moveToSpectator(game, 'h'), /เกมเริ่มแล้ว/);
  });
});
