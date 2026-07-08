// QA God Mode mutations (dev sandbox). Pure state helpers — no env access here; the server
// only wires these behind its NODE_ENV !== 'production' guard, so they can never run in production.
// Every mutation ends in synchronizeGameState so drawPile/discardPile mirrors and skill reconciliation stay coherent before broadcast.
import type { Card, Character, GameState } from "../types.js";
import {
  characterName,
  equipmentSlotForCard,
  flashTable,
  getPlayerById,
  logAction,
  moveToDiscard,
} from "../state.js";
import { synchronizeGameState } from "../sync.js";

let devCardCounter = 0;
const normalize = (value: string) => value.trim().toLowerCase();
/** Catalogue definitions matching an id or (old)name; exact matches win over partial name matches. */
function findCardDefs(catalogue: Card[], idOrName: string): Card[] {
  const query = normalize(idOrName);
  if (!query) return [];
  const exact = catalogue.filter(
    (def) =>
      normalize(def.id) === query ||
      normalize(def.name) === query ||
      normalize(def.oldName ?? "") === query,
  );
  return exact.length
    ? exact
    : catalogue.filter(
        (def) =>
          normalize(def.name).includes(query) ||
          normalize(def.oldName ?? "").includes(query),
      );
}
/** Sources a physical copy: prefers pulling the real card from the draw pile, then the discard pile, else clones the definition with a fresh unique id. */
function takeCardCopy(
  state: GameState,
  catalogue: Card[],
  idOrName: string,
): Card {
  const defs = findCardDefs(catalogue, idOrName);
  if (!defs.length) throw new Error(`ไม่พบการ์ด "${idOrName}" ในคลังข้อมูล`);
  for (const def of defs) {
    const index = state.deck.findIndex((card) => card.id === def.id);
    if (index >= 0) return state.deck.splice(index, 1)[0];
  }
  for (const def of defs) {
    const index = state.discard.findIndex((card) => card.id === def.id);
    if (index >= 0) return state.discard.splice(index, 1)[0];
  }
  return { ...defs[0], id: `${defs[0].id}-dev-${++devCardCounter}` };
}

/** dev:spawn-card — gives any card (by id or name) directly to a player's hand or equipment zone. */
export function devSpawnCard(
  state: GameState,
  catalogue: Card[],
  targetPlayerId: string,
  cardIdOrName: string,
  zone: "hand" | "equipment" = "hand",
) {
  const player = getPlayerById(state, targetPlayerId);
  if (!player) throw new Error("Unknown player");
  const card = takeCardCopy(state, catalogue, cardIdOrName);
  if (zone === "equipment") {
    const slot = equipmentSlotForCard(card);
    if (!slot) throw new Error(`"${card.name}" ไม่ใช่การ์ดอุปกรณ์`);
    const existing = player.equipment[slot];
    if (existing) moveToDiscard(state, existing, false);
    player.equipment[slot] = card;
  } else player.hand.push(card);
  logAction(
    state,
    "dev-spawn-card",
    `🛠 QA: เสก ${card.name} (${card.number}${card.suit}) ให้ ${characterName(player)} (${zone === "equipment" ? "ช่องอุปกรณ์" : "มือ"})`,
    player.id,
    undefined,
    card.id,
  );
  return synchronizeGameState(state);
}

/** dev:set-character — swaps a player's character mid-game. Skills resolve live from CHARACTER_SKILLS[character.id],
 * so the swap only needs the character reference + fresh HP; loss tracking is reseeded so the swap itself never triggers loss-skill draws. */
export function devSetCharacter(
  state: GameState,
  catalogue: Character[],
  targetPlayerId: string,
  characterIdOrName: string,
) {
  const player = getPlayerById(state, targetPlayerId);
  if (!player) throw new Error("Unknown player");
  const query = normalize(characterIdOrName);
  const character =
    catalogue.find(
      (c) => normalize(c.id) === query || normalize(c.name) === query,
    ) ?? catalogue.find((c) => normalize(c.name).includes(query));
  if (!character) throw new Error(`ไม่พบขุนพล "${characterIdOrName}"`);
  player.character = character;
  player.confirmedCharacter = true;
  player.maxHp =
    character.hp +
    (player.role === "emperor" && state.players.length !== 4 ? 1 : 0);
  player.hp = player.maxHp;
  if (state.lossTracking)
    state.lossTracking[player.id] = {
      hand: player.hand.length,
      equip: Object.values(player.equipment)
        .filter((card): card is Card => Boolean(card))
        .map((card) => card.id),
    };
  flashTable(
    state,
    "🛠",
    `QA: ${player.username} เปลี่ยนขุนพลเป็น ${character.name}`,
  );
  logAction(
    state,
    "dev-set-character",
    `🛠 QA: ${player.username} เปลี่ยนขุนพลเป็น ${character.name} (HP ${player.hp}/${player.maxHp})`,
    player.id,
  );
  return synchronizeGameState(state);
}

/** dev:set-hp — sets exact current/max HP; hp above 0 revives a dead player so QA can rewind lethal outcomes. */
export function devSetHp(
  state: GameState,
  targetPlayerId: string,
  hp: number,
  maxHp?: number,
) {
  const player = getPlayerById(state, targetPlayerId);
  if (!player) throw new Error("Unknown player");
  if (typeof maxHp === "number" && Number.isFinite(maxHp))
    player.maxHp = Math.max(1, Math.floor(maxHp));
  if (!Number.isFinite(hp)) throw new Error("ค่า HP ไม่ถูกต้อง");
  player.hp = Math.min(Math.floor(hp), player.maxHp ?? Math.floor(hp));
  if (player.hp > 0 && !player.alive) {
    player.alive = true;
    logAction(
      state,
      "dev-revive",
      `🛠 QA: ${characterName(player)} ฟื้นคืนชีพ`,
      player.id,
    );
  }
  logAction(
    state,
    "dev-set-hp",
    `🛠 QA: ตั้งพลังชีวิต ${characterName(player)} เป็น ${player.hp}/${player.maxHp ?? "—"}`,
    player.id,
  );
  return synchronizeGameState(state);
}

/** dev:insert-top-deck — puts a copy of the card on the very top of the draw pile (deck.pop() draws from the array tail). */
export function devInsertTopDeck(
  state: GameState,
  catalogue: Card[],
  cardIdOrName: string,
) {
  const card = takeCardCopy(state, catalogue, cardIdOrName);
  state.deck.push(card);
  logAction(
    state,
    "dev-top-deck",
    `🛠 QA: วาง ${card.name} (${card.number}${card.suit}) ไว้บนสุดของกองจั่ว`,
    undefined,
    undefined,
    card.id,
  );
  return synchronizeGameState(state);
}

const SUIT_ALIASES: Record<string, string> = {
  "♠": "♠",
  spade: "♠",
  spades: "♠",
  s: "♠",
  "♥": "♥",
  heart: "♥",
  hearts: "♥",
  h: "♥",
  "♦": "♦",
  diamond: "♦",
  diamonds: "♦",
  d: "♦",
  "♣": "♣",
  club: "♣",
  clubs: "♣",
  c: "♣",
};
/** dev:force-judgment — rigs the next judgment reveal (Lightning, Indulgence, Guicai fortune, armor, retaliate …) by
 * placing a card with the exact suit/rank on top of the draw pile; every judgment path reveals via state.deck.pop(). */
export function devForceJudgment(
  state: GameState,
  catalogue: Card[],
  suit: string,
  rank: string | number,
) {
  const wantSuit = SUIT_ALIASES[normalize(String(suit))];
  if (!wantSuit) throw new Error("ดอกไพ่ไม่ถูกต้อง (♠ ♥ ♦ ♣)");
  const wantRank = String(rank).trim().toUpperCase();
  if (!wantRank) throw new Error("กรุณาระบุแต้มไพ่ (A, 2–10, J, Q, K)");
  const matches = (card: Card) =>
    card.suit === wantSuit && card.number.toUpperCase() === wantRank;
  let card: Card | undefined;
  const deckIndex = state.deck.findIndex(matches);
  if (deckIndex >= 0) card = state.deck.splice(deckIndex, 1)[0];
  if (!card) {
    const discardIndex = state.discard.findIndex(matches);
    if (discardIndex >= 0) card = state.discard.splice(discardIndex, 1)[0];
  }
  if (!card) {
    const def = catalogue.find(matches) ?? catalogue[0];
    if (!def) throw new Error("คลังการ์ดว่างเปล่า");
    card = {
      ...def,
      suit: wantSuit,
      number: wantRank,
      id: `${def.id}-dev-${++devCardCounter}`,
    };
  }
  state.deck.push(card);
  logAction(
    state,
    "dev-force-judgment",
    `🛠 QA: ล็อกผลตัดสินถัดไปเป็น ${wantRank}${wantSuit} (${card.name})`,
    undefined,
    undefined,
    card.id,
  );
  return synchronizeGameState(state);
}

/** dev:export-snapshot — deep-serializable export of the full authoritative table state. */
export const devSnapshot = (state: GameState): GameState =>
  JSON.parse(JSON.stringify(state)) as GameState;

/** dev:load-snapshot — replaces the table state in place from an exported snapshot. Mutating the existing object
 * (instead of swapping the Map entry) keeps the reference captured by server timers and closures valid; room identity survives. */
export function devLoadSnapshot(state: GameState, snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object")
    throw new Error("Snapshot ต้องเป็น JSON object");
  const next = JSON.parse(JSON.stringify(snapshot)) as GameState;
  if (
    !Array.isArray(next.players) ||
    !Array.isArray(next.deck) ||
    !next.phase ||
    !next.turn
  )
    throw new Error("Snapshot ไม่ใช่สถานะเกมที่ถูกต้อง");
  next.log ??= [];
  next.chat ??= [];
  next.spectators ??= [];
  next.discard ??= [];
  const preserved = {
    id: state.id,
    gameId: state.id,
    roomId: state.id,
    hostId: next.hostId || state.hostId,
  };
  for (const key of Object.keys(state))
    delete (state as unknown as Record<string, unknown>)[key];
  Object.assign(state, next, preserved);
  logAction(state, "dev-load-snapshot", "🛠 QA: โหลดสถานะเกมจาก snapshot");
  return synchronizeGameState(state);
}
