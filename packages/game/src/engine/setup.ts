// Lobby, role dealing, character selection, and game start. Extracted verbatim from index.ts.
import type {
  Card,
  CardNameVersion,
  Character,
  GameState,
  Player,
  Role,
  Spectator,
} from "./types.js";
import {
  createEmptyEquipmentSlots,
  draw,
  shuffled,
  toCardInstance,
} from "./state.js";
export function createGame(
  id: string,
  host: Pick<Spectator, "id" | "username">,
  cards: Card[],
): GameState {
  const now = new Date().toISOString();
  const deck = shuffled(cards);
  return {
    gameId: id,
    roomId: id,
    status: "setup",
    createdAt: now,
    updatedAt: now,
    turn: {
      activePlayerId: null,
      phase: "inactive",
      direction: "clockwise",
      turnNumber: 0,
      attackUsedThisTurn: 0,
      drawnThisTurn: 0,
    },
    drawPile: deck.map(toCardInstance),
    discardPile: [],
    currentAction: null,
    responseWindow: null,
    chat: [],
    id,
    hostId: host.id,
    phase: "waiting",
    cardNameVersion: "modern",
    players: [],
    spectators: [
      { ...host, connectionStatus: "online", joinedAt: now, lastSeenAt: now },
    ],
    deck,
    discard: [],
    direction: 1,
    hasDrawnThisTurn: false,
    log: [],
    attacksThisTurn: 0,
  };
}
export const createSeatedPlayer = (
  member: Spectator,
  seatIndex: number,
): Player => ({
  ...member,
  seatIndex,
  role: undefined,
  roleRevealed: false,
  character: undefined,
  characterOptions: [],
  hand: [],
  equipment: createEmptyEquipmentSlots<Card>(),
  decisionArea: [],
  ready: false,
  confirmedCharacter: false,
  alive: true,
});
/** Room-setup option: choose Classic (old_name_th) vs Modern (name_th) card text. Locked once the game starts. */
export function setCardNameVersion(state: GameState, version: CardNameVersion) {
  if (state.phase !== "waiting")
    throw new Error("เลือกเวอร์ชันชื่อการ์ดได้เฉพาะก่อนเริ่มเกม");
  if (version !== "modern" && version !== "classic")
    throw new Error("เวอร์ชันชื่อการ์ดไม่ถูกต้อง");
  state.cardNameVersion = version;
}
export type RoleComposition = Record<Role, number>;
export function dealRoles(state: GameState, composition: RoleComposition) {
  if (state.phase !== "waiting")
    throw new Error("Roles can only be dealt from the waiting room");
  const roles = shuffled(
    (Object.entries(composition) as [Role, number][]).flatMap(([role, count]) =>
      Array.from({ length: count }, () => role),
    ),
  );
  if (roles.length !== state.players.length || composition.emperor !== 1)
    throw new Error("Invalid role composition");
  state.players.forEach((player, index) => {
    player.role = roles[index];
    player.roleRevealed = player.role === "emperor";
  });
  state.phase = "character-select";
}
const uniqueById = (characters: Character[]) => [
  ...new Map(characters.map((c) => [c.id, c])).values(),
];
/** The manual: emperor chooses Cao Cao, Liu Bei, Sun Quan plus two random cards. */
export function dealEmperorOptions(state: GameState, characters: Character[]) {
  const emperor = state.players.find((p) => p.role === "emperor");
  if (!emperor) throw new Error("Emperor has not been dealt");
  const required = ["โจโฉ", "เล่าปี่", "ซุนกวน"].map((name) =>
    characters.find((c) => c.name === name),
  );
  if (required.some((c) => !c))
    throw new Error(
      "Required emperor characters are missing from imported data",
    );
  const chosenIds = new Set(required.map((c) => c!.id));
  const random = shuffled(characters.filter((c) => !chosenIds.has(c.id))).slice(
    0,
    2,
  );
  emperor.characterOptions = [...(required as Character[]), ...random];
}
/** Must run only after emperor selection: all unchosen character cards are reshuffled and redealt. */
export function dealOtherCharacterOptions(
  state: GameState,
  characters: Character[],
) {
  const emperor = state.players.find((p) => p.role === "emperor");
  if (!emperor?.character || !emperor.confirmedCharacter)
    throw new Error("Emperor must select a character first");
  const otherPlayers = state.players.filter((p) => p.id !== emperor.id),
    optionCount = state.players.length === 10 ? 2 : 3;
  const pool = shuffled(
    characters.filter((c) => c.id !== emperor.character!.id),
  );
  if (pool.length < otherPlayers.length * optionCount)
    throw new Error("Not enough characters to deal unique options");
  otherPlayers.forEach((player, index) => {
    player.characterOptions = pool.slice(
      index * optionCount,
      (index + 1) * optionCount,
    );
  });
}
export function selectCharacter(
  state: GameState,
  playerId: string,
  characterId: string,
  characters: Character[],
) {
  if (state.phase !== "character-select")
    throw new Error("Character selection is closed");
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.confirmedCharacter)
    throw new Error("Character choice is locked");
  const character = player.characterOptions.find((c) => c.id === characterId);
  if (!character) throw new Error("Character is not one of your options");
  if (state.players.some((p) => p.character?.id === characterId))
    throw new Error("Character is already selected");
  player.character = character;
  player.confirmedCharacter = true;
  player.maxHp =
    character.hp +
    (player.role === "emperor" && state.players.length !== 4 ? 1 : 0);
  player.hp = player.maxHp;
  if (player.role === "emperor") dealOtherCharacterOptions(state, characters);
}
export function beginPlayAfterCharacters(
  state: GameState,
  initialHandSize: number,
) {
  if (!state.players.every((p) => p.confirmedCharacter))
    throw new Error("All players must confirm a character");
  state.players.forEach((p) => draw(state, p.id, initialHandSize));
  state.direction = -1;
  state.currentPlayerId = state.players.find((p) => p.role === "emperor")?.id;
  state.phase = "playing";
  state.turn = {
    activePlayerId: state.currentPlayerId || null,
    phase: "draw",
    direction: "counterclockwise",
    turnNumber: 1,
    attackUsedThisTurn: 0,
    drawnThisTurn: 0,
  };
  state.hasDrawnThisTurn = false;
  state.attacksThisTurn = 0;
  state.log.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    type: "game-started",
    message: "เปิดเผยขุนพลแล้ว จักรพรรดิเป็นผู้เล่นคนแรก และเล่นทวนเข็มนาฬิกา",
  });
}
