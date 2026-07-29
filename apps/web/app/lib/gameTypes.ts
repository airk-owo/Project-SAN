// Client-side socket view-model types for the online game page.
//
// These describe the shape of the game state as the server broadcasts it to the
// web client (viewer-safe, hand counts for opponents, pending-decision hints, etc.).
// They are deliberately separate from the @wtk/game engine types: the engine models
// the authoritative game, this models what a single spectator/player is allowed to see.
// Shared across app/page.tsx and the extracted modal components in components/.

export type Role = "emperor" | "loyalist" | "rebel" | "traitor";

export type RoleDefinition = {
  role_key: Role;
  role_th: string;
  visibility: string;
  win_condition_th: string;
  team: string;
};

export type Character = {
  id: string;
  name: string;
  hp: number;
  kingdom?: string;
  kingdomTh?: string;
  gender?: string;
  image?: string | null;
  skills: { name: string; description: string; condition?: string | null }[];
};

export type Card = {
  id: string;
  name: string;
  oldName?: string | null;
  type: string;
  cardType: string;
  suit: string;
  number: string;
  description: string | null;
  effect: string | null;
  equipmentSlot: string | null;
  image?: string | null;
  effectParams?: { range?: number } | null;
};

export type EquipmentSlots = {
  weapon: Card | null;
  armor: Card | null;
  offensiveMount: Card | null;
  defensiveMount: Card | null;
};

export type Player = {
  id: string;
  username: string;
  seatIndex: number;
  connectionStatus: "online" | "disconnected";
  joinedAt: string;
  lastSeenAt: string;
  role?: Role;
  roleRevealed: boolean;
  character?: Character;
  characterOptions: Character[];
  hand: Card[];
  handCount: number;
  equipment: EquipmentSlots;
  decisionArea: Card[];
  alive: boolean;
  hp?: number;
  maxHp?: number;
  skippedPlayThisTurn?: boolean; // "โดนใบ้" — skipped by มีสุขลืมเมือง this turn
  ready: boolean;
  confirmedCharacter: boolean;
};

export type Member = {
  id: string;
  username: string;
  connectionStatus: "online" | "disconnected";
  joinedAt: string;
  lastSeenAt: string;
};

export type ResponseWindow = {
  type: string;
  currentResponderId: string | null;
  status: "open" | "resolved";
  responses: {
    playerId: string;
    response: "card" | "decline" | "timeout";
    card?: Card;
  }[];
  requiredPlayerIds?: string[];
  dyingPlayerId?: string;
};

export type Turn = {
  activePlayerId: string | null;
  phase: string;
  attackUsedThisTurn: number;
  drawnThisTurn?: number;
  turnNumber?: number;
};

export type RoleAliveCounts = {
  emperor: number;
  loyalist: number;
  rebel: number;
  traitor: number;
};

export type RoleSet = {
  emperor: number;
  loyalist: number;
  rebel: number;
  traitor: number;
};

export type Room = {
  id: string;
  playerCount: number;
  spectatorCount: number;
  host: string;
  status: string;
  hasPassword: boolean;
};

export type Game = {
  viewerId: string;
  hostId: string;
  isSpectator: boolean;
  phase: string;
  currentPlayerId?: string;
  hasDrawnThisTurn: boolean;
  lastPlayedCard?: Card;
  pendingAction?: {
    kind: "attack";
    actorId: string;
    targetId: string;
    dodgesRequired?: number;
    noDodge?: boolean;
  } | null;
  players: Player[];
  spectators: Member[];
  roleDefinitions?: RoleDefinition[];
  deck: { length: number };
  discard: Card[];
  log: {
    id: string;
    message: string;
    at: string;
    type: string;
    actorId?: string;
    targetId?: string;
    cardId?: string;
  }[];
  turn: Turn | null;
  responseWindow: ResponseWindow | null;
  winner?: string;
  cardNameVersion?: "modern" | "classic";
  pendingRepeatAttack?: { attackerId: string; weaponName: string } | null;
  pendingDestroyMount?: { attackerId: string; targetId: string } | null;
  pendingForceAttackDamage?: { attackerId: string } | null;
  pendingReplaceDamage?: {
    attackerId: string;
    targetId: string;
    damage: number;
    weaponName: string;
  } | null;
  pendingTwinSwords?: {
    attackerId: string;
    targetId: string;
    weaponName: string;
  } | null;
  pendingCoerce?: {
    actorId: string;
    weaponHolderId: string;
    victimId: string;
    trickName: string;
  } | null;
  pendingHarvest?: { revealed: Card[] } | null;
  pendingJudgment?: {
    playerId: string;
    trickEffect: string;
    trickName: string;
    stage: "awaiting_draw" | "revealed";
    revealed?: Card;
  } | null;
  pendingFankui?: { playerId: string; damagerId: string } | null;
  pendingArrogance?: { playerId: string } | null;
  pendingRetaliate?: { damagerId: string; victimId: string } | null;
  pendingRetaliateJudgment?: { ownerId: string; damagerId: string } | null;
  pendingLegacy?: { ownerId: string; cards: Card[] } | null;
  pendingPeek?: { playerId: string; cards: Card[] } | null;
  pendingDischord?: { jiuyiId: string; targetId: string } | null;
  pendingAllyAssist?: {
    emperorId: string;
    allyId: string;
    kind: "attack" | "dodge";
    targetId?: string;
  } | null;
  pendingDraws?: Record<string, number>;
  lastJudgment?: {
    playerId: string;
    trickName: string;
    cardName: string;
    cardNumber: string;
    cardSuit: string;
    result: string;
    at: string;
  };
  tableFlash?: {
    icon: string;
    title: string;
    detail?: string;
    card?: { name: string; number: string; suit: string };
    at: string;
  } | null;
  roleAliveCounts?: RoleAliveCounts;
  distances?: Record<string, number | null>;
  responseDeadline?: number | null;
  startDeadline?: number | null;
  characterSkillKeys?: Record<string, string[]>;
  skillsUsedThisTurn?: string[];
};

export type IceSelection =
  | { zone: "hand"; handIndex: number }
  | { zone: "equipment"; cardInstanceId: string };
