/**
 * Shared test fixtures for the engine test suite.
 *
 * ไฟล์นี้ไม่ใช่เทสต์ (npm test เป็น explicit file list) — เป็น helper กลางที่
 * เทสต์ทุกไฟล์ import แทนการ copy-paste fixture เดิม
 *
 * ค่า default ของ makeCard คือตระกูลเสียงข้างมาก (♥/K/{damage:1}) —
 * ไฟล์ที่ default ต่าง (เช่น ♠ ใน character-skills, ♣/5 ใน duel) ให้คง wrapper
 * ในไฟล์นั้นแล้ว override ผ่าน `extra` เพื่อไม่เปลี่ยน shape ของ object เดิม
 */
import {
  createGame,
  createSeatedPlayer,
  dealRoles,
  beginPlayAfterCharacters,
  declineNegate,
  type Card,
  type Character,
  type GameState,
  type Spectator,
} from "./index.js";

export const TEST_NOW = "2026-01-01T00:00:00.000Z";

export const makeSpectator = (id: string, username: string = id): Spectator => ({
  id,
  username,
  connectionStatus: "online",
  joinedAt: TEST_NOW,
  lastSeenAt: TEST_NOW,
});

export const makeCard = (
  id: string,
  effect: string,
  cardType: string = "basic",
  extra: Partial<Card> = {},
): Card => ({
  id,
  name: id,
  type: cardType,
  cardType: cardType as Card["cardType"],
  suit: "♥",
  number: "K",
  image: null,
  description: null,
  effect,
  effectParams: { damage: 1 },
  triggerTiming: "on_play",
  equipmentSlot: null,
  createsResponseWindow: false,
  conditions: null,
  ...extra,
});

export const attackCard = (id: string): Card => makeCard(id, "attack", "basic");
export const dodgeCard = (id: string): Card => makeCard(id, "dodge", "basic");

export const makeCharacter = (
  id: string,
  extra: Partial<Character> = {},
): Character => ({
  id,
  name: id,
  hp: 4,
  faction: "test",
  skills: [],
  ...extra,
});

export interface StandardGameOptions {
  /** สร้าง character ให้ผู้เล่นแต่ละที่นั่ง — default: makeCharacter(`char${i}`) */
  characterFor?: (playerId: string, seatIndex: number) => Character;
  /** maxHp/hp เริ่มต้นของทุกคน — default 4 (character-skills ใช้ 8) */
  maxHp?: number;
  /** override สำรับหลัง setup (harvest) */
  deck?: Card[];
}

/**
 * เกมมาตรฐาน 4 คน (p0..p3) เข้าสู่ play phase ของ p0 แล้ว —
 * body เดิมที่ซ้ำอยู่ในเทสต์ ~12 ไฟล์ ย้ายมาไว้ที่เดียว
 */
export function makeStandardGame(opts: StandardGameOptions = {}): GameState {
  const { characterFor, maxHp = 4, deck } = opts;
  const host = makeSpectator("p0");
  const game = createGame("room1", host, []);
  game.spectators = [];
  game.players.push(createSeatedPlayer(host, 1));
  for (let i = 1; i < 4; i++)
    game.players.push(createSeatedPlayer(makeSpectator(`p${i}`), i + 1));
  dealRoles(game, { emperor: 1, rebel: 2, loyalist: 0, traitor: 1 });
  game.players.forEach((p, i) => {
    p.character = characterFor ? characterFor(p.id, i) : makeCharacter(`char${i}`);
    p.confirmedCharacter = true;
    p.maxHp = maxHp;
    p.hp = maxHp;
    p.characterOptions = [];
  });
  beginPlayAfterCharacters(game, 0);
  game.turn.phase = "play";
  game.turn.activePlayerId = "p0";
  game.currentPlayerId = "p0";
  game.hasDrawnThisTurn = true;
  if (deck) game.deck = deck;
  return game;
}

/** Decline the negate window that every trick now opens, so its effect resolves. */
export function passNegate(game: GameState): void {
  while (
    game.responseWindow?.type === "negate" &&
    game.responseWindow.currentResponderId
  ) {
    declineNegate(game, game.responseWindow.currentResponderId);
  }
}
