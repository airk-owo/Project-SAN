// Shared type definitions for the game engine. Extracted verbatim from index.ts.
import type { PublicCardView } from './view.js';
export type Role = 'emperor' | 'rebel' | 'loyalist' | 'traitor';
export type GameStatus = 'setup'|'character_selection'|'playing'|'finished';
export type TurnPhase = 'inactive'|'start'|'judgment'|'draw'|'play'|'discard'|'end';
export type CardZone = 'draw_pile'|'discard_pile'|'hand'|'equipment'|'decision_area'|'current_action'|'revealed';
export type PlayerIdentity = { userId:string; username:string; displayName?:string };
export type CharacterState = { characterKey:string; name:string; kingdom?:string; gender?:string; maxHp:number; skillKeys:string[] };
export type CardInstance = { instanceId:string; definitionKey:string; name:string; cardType:string; suit?:string; rank?:string; color?:'red'|'black'; backendEffectKey?:string; effectParams?:Record<string,unknown> };
export type EquipmentSlots<T=CardInstance> = { weapon:T|null; armor:T|null; offensiveMount:T|null; defensiveMount:T|null };
export type TurnState = { activePlayerId:string|null; phase:TurnPhase; direction:'clockwise'|'counterclockwise'; turnNumber:number; attackUsedThisTurn:number; drawnThisTurn?:number };
export type ResponseRecord = { playerId:string; response:'card'|'decline'|'timeout'; cardInstanceId?:string; card?:PublicCardView; createdAt:string };
export type ResponseWindow = { windowId:string; type:'attack_dodge'|'dying_heal'|'mass_dodge'|'mass_attack'|'multi_attack'|'coerce_attack'|'harvest_pick'|'duel_attack'|'negate'; sourceActionId:string; requiredPlayerIds:string[]; currentResponderId:string|null; allowedResponseEffectKeys:string[]; responses:ResponseRecord[]; status:'open'|'resolved'|'cancelled'; createdAt:string; dyingPlayerId?:string; dyingKillerId?:string; responderQueue?:string[]; attackDamage?:number; duelResponderAttacks?:number };
export type CurrentAction = { actionId:string; actorId:string; card:CardInstance|null; effectKey:string; targetIds:string[]; status:'declared'|'resolving'|'resolved'|'cancelled'; createdAt:string };
export type TargetRules = { minTargets:number; maxTargets:number; allowSelf?:boolean; maxDistance?:number|'attack' };
export type TargetedCardAction = { action:CurrentAction; actor:Player; card:Card; targets:Player[] };
export type HiddenHandSelection = { targetPlayerId:string; handIndex:number };
export type TargetCardSelection = { zone:'hand'; handIndex:number }|{ zone:'equipment'; cardInstanceId:string }|{ zone:'decision_area'; cardInstanceId:string };
export type GameLogEntry = { id:string; type:string; message:string; actorId?:string; targetIds?:string[]; cardInstanceId?:string; createdAt:string };
export type ChatMessage = { id:string; userId:string; username:string; message:string; createdAt:string };
/** Canonical player shape for persistence and future engine migration. */
export type PlayerState = PlayerIdentity & { seatIndex:number; connectionStatus:'online'|'disconnected'; roleKey:string; roleRevealed:boolean; character:CharacterState|null; hp:number; maxHp:number; isAlive:boolean; hand:CardInstance[]; equipment:EquipmentSlots; decisionArea:CardInstance[]; handLimitOverride?:number|null; flags:string[] };
export type CardType = 'basic'|'instant_trick'|'delayed_trick'|'weapon'|'armor'|'offensive_mount'|'defensive_mount';
export type TriggerTiming = 'on_play'|'on_response'|'on_judgment'|'on_damage'|'after_damage'|'on_attack_declared'|'on_attack_dodged'|'passive';
export type EquipmentSlot = 'weapon'|'armor'|'offensive_mount'|'defensive_mount';
export type EffectParams = Record<string,unknown>;
export type CardNameVersion = 'modern'|'classic';
export type Card = { id:string; name:string; oldName?:string|null; type:string; cardType:CardType; suit:string; number:string; image:string|null; description:string|null; effect:string|null; effectParams:EffectParams; triggerTiming:TriggerTiming; equipmentSlot:EquipmentSlot|null; createsResponseWindow:boolean; conditions:unknown };
export type Character = { id:string; name:string; hp:number; faction:string; kingdom?:string; kingdomTh?:string; gender?:string; skills: { name:string; description:string; condition?:string|null }[]; image?:string };
export type ConnectionStatus = 'online'|'disconnected';
export type Player = { id:string; username:string; seatIndex:number; connectionStatus:ConnectionStatus; joinedAt:string; lastSeenAt:string; role?:Role; roleRevealed:boolean; character?:Character; characterOptions:Character[]; hand:Card[]; equipment:EquipmentSlots<Card>; decisionArea:Card[]; ready:boolean; confirmedCharacter:boolean; alive:boolean; hp?:number; maxHp?:number };
export type GamePhase = 'waiting'|'role-vote'|'character-select'|'direction-select'|'playing'|'ended';
export type PendingAction = { id:string; kind:'attack'; actorId:string; targetId:string; cardId:string; responseKey:'dodge'; damage:number; dodgesRequired?:number; noDodge?:boolean };
export type GameEventName = 'before_attack'|'after_attack'|'before_damage'|'after_damage'|'before_judgment'|'after_judgment'|'before_heal'|'after_heal';
export type GameEvent = { name:GameEventName; actorId?:string; targetId?:string; card?:Card; amount?:number; cancelled?:boolean; metadata?:Record<string,unknown> };
export type EventSubscriber = { id:string; event:GameEventName; priority?:number; handle:(state:GameState,event:GameEvent)=>void };
export type EffectResolverContext = { state:GameState; actor:Player; card:Card; target?:Player; targetId?:string; subscribers?:EventSubscriber[] };
export type EffectResolver = (context:EffectResolverContext)=>boolean;
export type Spectator = { id:string; username:string; connectionStatus:ConnectionStatus; joinedAt:string; lastSeenAt:string };
/**
 * The canonical state is serializable. Legacy fields remain temporarily so the
 * playable prototype and its Socket payload can migrate without a flag day.
 */
export type WinningSide = 'emperor_loyalists'|'rebels'|'traitor';
export type PendingRepeatAttack = { attackerId:string; targetId:string; weaponName:string };
export type PendingDestroyMount = { attackerId:string; targetId:string };
export type PendingForceAttackDamage = { attackerId:string; targetId:string };
export type PendingReplaceDamage = { attackerId:string; targetId:string; damage:number; weaponName:string };
export type PendingTwinSwords = { attackerId:string; targetId:string; actionId:string; attackCardId:string; damage:number; weaponName:string };
export type PendingCoerce = { actorId:string; weaponHolderId:string; victimId:string; trickName:string };
export type PendingHarvest = { revealed:Card[] };
export type PendingJudgment = { playerId:string; trickEffect:'delayed_skip_play_phase'|'delayed_lightning_judgment'; trickName:string; trickCardId:string; stage:'awaiting_draw'|'revealed'; revealed?:Card };
export type PendingFankui = { playerId:string; damagerId:string };
export type PendingRetaliate = { damagerId:string; victimId:string };
export type PendingRetaliateJudgment = { ownerId:string; damagerId:string };
export type PendingLegacy = { ownerId:string; cards:Card[] };
export type PendingPeek = { playerId:string; cards:Card[] };
export type PendingDischord = { jiuyiId:string; targetId:string };
export type PendingAllyAssist = { emperorId:string; allyId:string; kind:'attack'|'dodge'; targetId?:string };
export type GameState = { gameId:string; roomId:string; status:GameStatus; createdAt:string; updatedAt:string; turn:TurnState; drawPile:CardInstance[]; discardPile:CardInstance[]; currentAction:CurrentAction|null; responseWindow:ResponseWindow|null; suspendedResponseWindow?:ResponseWindow; pendingRepeatAttack?:PendingRepeatAttack; pendingDestroyMount?:PendingDestroyMount; pendingForceAttackDamage?:PendingForceAttackDamage; pendingReplaceDamage?:PendingReplaceDamage; pendingTwinSwords?:PendingTwinSwords; pendingCoerce?:PendingCoerce; pendingHarvest?:PendingHarvest; pendingJudgment?:PendingJudgment; pendingFankui?:PendingFankui; pendingRetaliate?:PendingRetaliate; pendingRetaliateJudgment?:PendingRetaliateJudgment; pendingLegacy?:PendingLegacy; pendingPeek?:PendingPeek; pendingDischord?:PendingDischord; pendingAllyAssist?:PendingAllyAssist; pendingDraws?:Record<string,number>; unarmedPowerActive?:boolean; benevolenceGivenThisTurn?:number; arrogancePenalty?:boolean; lossTracking?:Record<string,{hand:number;equip:string[]}>; lastJudgment?:{playerId:string;trickName:string;cardName:string;cardNumber:string;cardSuit:string;result:string;at:string}; tableFlash?:{icon:string;title:string;detail?:string;card?:{name:string;number:string;suit:string};at:string}; skipPlayPhase?:boolean; skillsUsedThisTurn?:string[]; chat:ChatMessage[]; id:string; hostId:string; phase:GamePhase; winner?:WinningSide; cardNameVersion?:CardNameVersion; players:Player[]; spectators:Spectator[]; deck:Card[]; discard:Card[]; lastPlayedCard?:Card; direction:1|-1; currentPlayerId?:string; hasDrawnThisTurn:boolean; log:GameLog[]; pendingRoleComposition?: Record<Role,number>; pendingAction?:PendingAction; attacksThisTurn:number; pendingTrickResolution?:{effectKey:string;targetId?:string;selection?:TargetCardSelection|string;weaponHolderId?:string;victimId?:string} };
export type GameLog = { id:string; at:string; type:string; actorId?:string; targetId?:string; cardId?:string; message:string };
