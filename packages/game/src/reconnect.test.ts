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

function allMembers(game: GameState) {
  return [...game.players, ...game.spectators];
}

// ────────────────────────────────────────────────────────
// Helpers mirroring server handlers
// ────────────────────────────────────────────────────────

/**
 * Mirror of the "existing member reconnects" branch in server's room:join handler.
 * Returns true when the user was already in the room (reconnect), false if they were new.
 */
function handleJoin(game: GameState, userId: string, username: string): boolean {
  const existing = allMembers(game).find(m => m.id === userId);
  if (existing) {
    existing.connectionStatus = 'online';
    existing.lastSeenAt = new Date().toISOString();
    return true; // reconnect
  }
  // New member joins as spectator (duplicate-name check omitted — server concern)
  game.spectators.push({ id: userId, username, connectionStatus: 'online', joinedAt: NOW, lastSeenAt: NOW });
  return false;
}

/** Mirror of server disconnect handler applied to a single game. */
function handleDisconnect(game: GameState, userId: string): void {
  const member = allMembers(game).find(m => m.id === userId);
  if (member) {
    member.connectionStatus = 'disconnected';
    member.lastSeenAt = new Date().toISOString();
  }
}

/** Mirror of server room:leave handler. */
function handleLeave(game: GameState, userId: string): void {
  if (game.phase !== 'waiting') {
    // Active game: mark as disconnected, do NOT remove
    const player = game.players.find(p => p.id === userId);
    if (player) { player.connectionStatus = 'disconnected'; }
    return;
  }
  // Lobby: fully remove
  game.players = game.players.filter(p => p.id !== userId);
  game.spectators = game.spectators.filter(s => s.id !== userId);
  // Transfer host if needed
  if (game.hostId === userId) {
    const next = allMembers(game).find(m => m.connectionStatus === 'online') ?? allMembers(game)[0];
    if (next) game.hostId = next.id;
  }
}

// ────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────

describe('reconnect – existing member rejoins', () => {
  it('sets connectionStatus to online for a disconnected player', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    game.spectators[0]!.connectionStatus = 'disconnected';
    handleJoin(game, 'h', 'Host');
    assert.equal(game.spectators[0]?.connectionStatus, 'online');
  });

  it('sets connectionStatus to online for a disconnected seated player', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    // seat the host
    game.spectators = [];
    game.players.push(createSeatedPlayer(spectator('h', 'Host'), 1));
    game.players[0]!.connectionStatus = 'disconnected';
    handleJoin(game, 'h', 'Host');
    assert.equal(game.players[0]?.connectionStatus, 'online');
  });

  it('updates lastSeenAt on reconnect', async () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    const before = game.spectators[0]!.lastSeenAt;
    await new Promise(r => setTimeout(r, 5)); // ensure time advances
    handleJoin(game, 'h', 'Host');
    assert.ok(game.spectators[0]!.lastSeenAt >= before);
  });

  it('returns true (reconnect) when user was already in the room', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    const wasReconnect = handleJoin(game, 'h', 'Host');
    assert.equal(wasReconnect, true);
  });

  it('does not add a duplicate member on reconnect', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    const countBefore = allMembers(game).length;
    handleJoin(game, 'h', 'Host');
    assert.equal(allMembers(game).length, countBefore);
  });
});

describe('reconnect – new member joins for the first time', () => {
  it('returns false (new join) and adds them as spectator', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    const wasReconnect = handleJoin(game, 'new', 'NewPlayer');
    assert.equal(wasReconnect, false);
    assert.equal(game.spectators.some(s => s.id === 'new'), true);
  });
});

describe('disconnect – connection status', () => {
  it('marks a spectator as disconnected', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    handleDisconnect(game, 'h');
    assert.equal(game.spectators[0]?.connectionStatus, 'disconnected');
  });

  it('marks a seated player as disconnected', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    game.spectators = [];
    game.players.push(createSeatedPlayer(spectator('h', 'Host'), 1));
    handleDisconnect(game, 'h');
    assert.equal(game.players[0]?.connectionStatus, 'disconnected');
  });

  it('is a no-op for an unknown userId', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    // should not throw
    handleDisconnect(game, 'ghost');
    assert.equal(game.spectators[0]?.connectionStatus, 'online');
  });

  it('reconnect after disconnect restores online status', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    handleDisconnect(game, 'h');
    assert.equal(game.spectators[0]?.connectionStatus, 'disconnected');
    handleJoin(game, 'h', 'Host');
    assert.equal(game.spectators[0]?.connectionStatus, 'online');
  });
});

describe('room:leave – lobby (waiting phase)', () => {
  it('removes a spectator from the room entirely', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    game.spectators.push(spectator('g', 'Guest'));
    handleLeave(game, 'g');
    assert.equal(game.spectators.some(s => s.id === 'g'), false);
  });

  it('removes a seated player from the room entirely', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    const bob = spectator('b', 'Bob');
    game.spectators.push(bob);
    game.spectators = game.spectators.filter(s => s.id !== bob.id);
    game.players.push(createSeatedPlayer(bob, 2));
    handleLeave(game, 'b');
    assert.equal(game.players.some(p => p.id === 'b'), false);
  });

  it('transfers host to the next online member when host leaves lobby', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    const alice = spectator('alice', 'Alice');
    game.spectators.push(alice);
    assert.equal(game.hostId, 'h');
    handleLeave(game, 'h');
    assert.equal(game.hostId, 'alice');
  });

  it('does not transfer host when a non-host leaves', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    game.spectators.push(spectator('g', 'Guest'));
    handleLeave(game, 'g');
    assert.equal(game.hostId, 'h');
  });
});

describe('room:leave – active game', () => {
  it('marks player as disconnected instead of removing them', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    const bob = spectator('b', 'Bob');
    game.spectators = [];
    game.players.push(createSeatedPlayer(spectator('h', 'Host'), 1));
    game.players.push(createSeatedPlayer(bob, 2));
    game.phase = 'playing';
    handleLeave(game, 'b');
    const bob2 = game.players.find(p => p.id === 'b');
    assert.equal(bob2?.connectionStatus, 'disconnected');
    assert.equal(game.players.length, 2, 'player is NOT removed from the game');
  });

  it('keeps hostId unchanged when a player leaves an active game', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    game.spectators = [];
    game.players.push(createSeatedPlayer(spectator('h', 'Host'), 1));
    game.players.push(createSeatedPlayer(spectator('b', 'Bob'), 2));
    game.phase = 'playing';
    handleLeave(game, 'b');
    assert.equal(game.hostId, 'h');
  });

  it('a disconnected player can reconnect and rejoin the active game', () => {
    const game = createGame('r', spectator('h', 'Host'), []);
    game.spectators = [];
    game.players.push(createSeatedPlayer(spectator('h', 'Host'), 1));
    game.players.push(createSeatedPlayer(spectator('b', 'Bob'), 2));
    game.phase = 'playing';
    handleLeave(game, 'b');
    assert.equal(game.players.find(p => p.id === 'b')?.connectionStatus, 'disconnected');
    handleJoin(game, 'b', 'Bob');
    assert.equal(game.players.find(p => p.id === 'b')?.connectionStatus, 'online');
  });
});
