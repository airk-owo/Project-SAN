export type Role = 'emperor' | 'rebel' | 'loyalist' | 'traitor';
export type GameStatus = 'setup'|'character_selection'|'playing'|'finished';
export type TurnPhase = 'inactive'|'start'|'judgment'|'draw'|'play'|'discard'|'end';
export type CardZone = 'draw_pile'|'discard_pile'|'hand'|'equipment'|'decision_area'|'current_action'|'revealed';
export type PlayerIdentity = { userId:string; username:string; displayName?:string };
export type CharacterState = { characterKey:string; name:string; kingdom?:string; gender?:string; maxHp:number; skillKeys:string[] };
export type CardInstance = { instanceId:string; definitionKey:string; name:string; cardType:string; suit?:string; rank?:string; color?:'red'|'black'; backendEffectKey?:string; effectParams?:Record<string,unknown> };
export type EquipmentSlots<T=CardInstance> = { weapon:T|null; armor:T|null; offensiveMount:T|null; defensiveMount:T|null };
export type TurnState = { activePlayerId:string|null; phase:TurnPhase; direction:'clockwise'|'counterclockwise'; turnNumber:number; attackUsedThisTurn:number; drawnThisTurn?:number };
export type ResponseRecord = { playerId:string; response:'card'|'decline'|'timeout'; cardInstanceId?:string; createdAt:string };
export type ResponseWindow = { windowId:string; type:'attack_dodge'|'dying_heal'|'mass_dodge'|'mass_attack'|'duel_attack'|'negate'; sourceActionId:string; requiredPlayerIds:string[]; currentResponderId:string|null; allowedResponseEffectKeys:string[]; responses:ResponseRecord[]; status:'open'|'resolved'|'cancelled'; createdAt:string; dyingPlayerId?:string; dyingKillerId?:string; responderQueue?:string[] };
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
export type Card = { id:string; name:string; type:string; cardType:CardType; suit:string; number:string; image:string|null; description:string|null; effect:string|null; effectParams:EffectParams; triggerTiming:TriggerTiming; equipmentSlot:EquipmentSlot|null; createsResponseWindow:boolean; conditions:unknown };
export type Character = { id:string; name:string; hp:number; faction:string; kingdomTh?:string; skills: { name:string; description:string; condition?:string|null }[]; image?:string };
export type ConnectionStatus = 'online'|'disconnected';
export type Player = { id:string; username:string; seatIndex:number; connectionStatus:ConnectionStatus; joinedAt:string; lastSeenAt:string; role?:Role; roleRevealed:boolean; character?:Character; characterOptions:Character[]; hand:Card[]; equipment:EquipmentSlots<Card>; decisionArea:Card[]; ready:boolean; confirmedCharacter:boolean; alive:boolean; hp?:number; maxHp?:number };
export type GamePhase = 'waiting'|'role-vote'|'character-select'|'direction-select'|'playing'|'ended';
export type PendingAction = { id:string; kind:'attack'; actorId:string; targetId:string; cardId:string; responseKey:'dodge'; damage:number };
export type GameEventName = 'before_attack'|'after_attack'|'before_damage'|'after_damage'|'before_judgment'|'after_judgment'|'before_heal'|'after_heal';
export type GameEvent = { name:GameEventName; actorId?:string; targetId?:string; card?:Card; amount?:number; cancelled?:boolean; metadata?:Record<string,unknown> };
export type EventSubscriber = { id:string; event:GameEventName; priority?:number; handle:(state:GameState,event:GameEvent)=>void };
export const dispatchGameEvent=(state:GameState,event:GameEvent,subscribers:EventSubscriber[]=[])=>([...subscribers].filter(subscriber=>subscriber.event===event.name).sort((a,b)=>(b.priority||0)-(a.priority||0)).forEach(subscriber=>subscriber.handle(state,event)),event);
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
export type GameState = { gameId:string; roomId:string; status:GameStatus; createdAt:string; updatedAt:string; turn:TurnState; drawPile:CardInstance[]; discardPile:CardInstance[]; currentAction:CurrentAction|null; responseWindow:ResponseWindow|null; suspendedResponseWindow?:ResponseWindow; pendingRepeatAttack?:PendingRepeatAttack; pendingDestroyMount?:PendingDestroyMount; pendingForceAttackDamage?:PendingForceAttackDamage; chat:ChatMessage[]; id:string; hostId:string; phase:GamePhase; winner?:WinningSide; players:Player[]; spectators:Spectator[]; deck:Card[]; discard:Card[]; lastPlayedCard?:Card; direction:1|-1; currentPlayerId?:string; hasDrawnThisTurn:boolean; log:GameLog[]; pendingRoleComposition?: Record<Role,number>; pendingAction?:PendingAction; attacksThisTurn:number; pendingTrickResolution?:{effectKey:string;targetId?:string;selection?:TargetCardSelection|string} };
export type GameLog = { id:string; at:string; type:string; actorId?:string; targetId?:string; cardId?:string; message:string };
export const shuffled = <T>(items:T[]) => { const result=[...items]; for(let index=result.length-1;index>0;index--){const swapIndex=Math.floor(Math.random()*(index+1));[result[index],result[swapIndex]]=[result[swapIndex],result[index]];} return result; };
export const createEmptyEquipmentSlots=<T=CardInstance>():EquipmentSlots<T>=>({weapon:null,armor:null,offensiveMount:null,defensiveMount:null});
export const toCardInstance=(card:Card,index=0):CardInstance=>({instanceId:`${card.id}:${index}`,definitionKey:card.id,name:card.name,cardType:card.cardType,suit:card.suit||undefined,rank:card.number||undefined,color:['♥','♦'].includes(card.suit)?'red':['♠','♣'].includes(card.suit)?'black':undefined,backendEffectKey:card.effect||undefined,effectParams:card.effectParams});
const gameStatusFor=(phase:GamePhase):GameStatus=>phase==='waiting'||phase==='role-vote'?'setup':phase==='character-select'||phase==='direction-select'?'character_selection':phase==='playing'?'playing':'finished';
const turnPhaseFor=(state:GameState):TurnPhase=>{if(state.phase!=='playing')return 'inactive';return state.turn.phase==='inactive'?(state.hasDrawnThisTurn?'play':'draw'):state.turn.phase};
/** Keeps the persisted model aligned with the existing prototype fields during migration. */
export function synchronizeGameState(state:GameState):GameState {
  state.gameId=state.id; state.roomId=state.id; state.status=gameStatusFor(state.phase); state.updatedAt=new Date().toISOString();
  state.turn={activePlayerId:state.currentPlayerId||null,phase:turnPhaseFor(state),direction:state.direction===1?'clockwise':'counterclockwise',turnNumber:state.turn.turnNumber,attackUsedThisTurn:state.attacksThisTurn,drawnThisTurn:state.turn.drawnThisTurn??0};
  state.drawPile=state.deck.map(toCardInstance); state.discardPile=state.discard.map(toCardInstance);
  if(state.pendingAction&&!state.currentAction) state.currentAction={actionId:state.pendingAction.id,actorId:state.pendingAction.actorId,card:toCardInstance(state.lastPlayedCard||state.discard.find(card=>card.id===state.pendingAction!.cardId)||{id:state.pendingAction.cardId,name:'Unknown',type:'',cardType:'basic',suit:'',number:'',image:null,description:null,effect:'attack',effectParams:{},triggerTiming:'on_play',equipmentSlot:null,createsResponseWindow:true,conditions:null}),effectKey:'attack',targetIds:[state.pendingAction.targetId],status:'resolving',createdAt:state.updatedAt};
  if(state.pendingAction&&!state.responseWindow) state.responseWindow={windowId:`response:${state.pendingAction.id}`,type:'attack_dodge',sourceActionId:state.pendingAction.id,requiredPlayerIds:[state.pendingAction.targetId],currentResponderId:state.pendingAction.targetId,allowedResponseEffectKeys:[state.pendingAction.responseKey],responses:[],status:'open',createdAt:state.updatedAt};
  return state;
}
export const getPlayerById=(state:GameState,playerId:string)=>state.players.find(player=>player.id===playerId);
export const getAlivePlayers=(state:GameState)=>state.players.filter(player=>player.alive);
export const getPlayersInSeatOrder=(state:GameState)=>[...state.players].sort((a,b)=>a.seatIndex-b.seatIndex);
export const getAlivePlayersInSeatOrder=(state:GameState)=>getPlayersInSeatOrder(state).filter(player=>player.alive);
export function getBaseDistanceBetweenPlayers(state:GameState,fromPlayerId:string,toPlayerId:string){
  if(fromPlayerId===toPlayerId)return 0;
  const players=getAlivePlayersInSeatOrder(state),fromIndex=players.findIndex(player=>player.id===fromPlayerId),toIndex=players.findIndex(player=>player.id===toPlayerId);
  if(fromIndex<0||toIndex<0)return null;
  const clockwise=Math.abs(fromIndex-toIndex);return Math.min(clockwise,players.length-clockwise);
}
/**
 * Distance used by effects. It deliberately remains separate from the base
 * seat distance so the UI can show both values for debugging.
 */
export function getEffectiveDistanceBetweenPlayers(state:GameState,fromPlayerId:string,toPlayerId:string){
  const baseDistance=getBaseDistanceBetweenPlayers(state,fromPlayerId,toPlayerId);
  if(baseDistance===null)return null;
  if(fromPlayerId===toPlayerId)return 0;
  const from=getPlayerById(state,fromPlayerId),to=getPlayerById(state,toPlayerId);
  if(!from||!to)return null;
  const outgoingModifier=from.equipment.offensiveMount?1:0;
  const incomingModifier=to.equipment.defensiveMount?1:0;
  return Math.max(1,baseDistance-outgoingModifier+incomingModifier);
}
/** TODO: import each weapon's source range into effectParams.range during card-data ingestion. */
export function getAttackRange(state:GameState,playerId:string){
  const range=getPlayerById(state,playerId)?.equipment.weapon?.effectParams.range;
  return typeof range==='number'&&Number.isFinite(range)&&range>0?range:1;
}
export const hasUnlimitedAttackPerTurn=(state:GameState,playerId:string)=>getPlayerById(state,playerId)?.equipment.weapon?.effect==='unlimited_attack_per_turn';
export const hasRepeatAttackAfterDodge=(state:GameState,playerId:string)=>getPlayerById(state,playerId)?.equipment.weapon?.effect==='repeat_attack_after_dodge';
export const attackIgnoresTargetArmor=(state:GameState,playerId:string)=>getPlayerById(state,playerId)?.equipment.weapon?.effect==='ignore_target_armor';
export const hasDamageDestroyTargetMount=(state:GameState,playerId:string)=>getPlayerById(state,playerId)?.equipment.weapon?.effect==='damage_destroy_target_mount';
export const hasDiscardTwoForceAttackDamage=(state:GameState,playerId:string)=>getPlayerById(state,playerId)?.equipment.weapon?.effect==='discard_two_force_attack_damage';
export function canTargetWithAttack(state:GameState,attackerId:string,targetId:string){
  const attacker=getPlayerById(state,attackerId),target=getPlayerById(state,targetId),distance=getEffectiveDistanceBetweenPlayers(state,attackerId,targetId);
  return Boolean(attacker&&target&&attacker.alive&&target.alive&&attackerId!==targetId&&distance!==null&&distance<=getAttackRange(state,attackerId));
}
export const getTopDiscardCard=(state:GameState)=>state.discardPile.at(-1)??null;
export const getCurrentActionSummary=(state:GameState)=>state.currentAction?{actorId:state.currentAction.actorId,targetIds:state.currentAction.targetIds,effectKey:state.currentAction.effectKey,cardName:state.currentAction.card?.name??null,status:state.currentAction.status}:null;
export type PublicCardView = Pick<Card,'id'|'name'|'type'|'cardType'|'suit'|'number'|'image'|'description'|'effect'|'equipmentSlot'>;
export type PublicPlayerState = Omit<Player,'hand'|'characterOptions'> & { hand:PublicCardView[]; handCount:number; characterOptions:Character[] };
export type PublicResponseRecord = Omit<ResponseRecord,'cardInstanceId'>;
export type PublicResponseWindow = Omit<ResponseWindow,'responses'> & { responses:PublicResponseRecord[] };
export type PublicGameState = Omit<GameState,'players'|'deck'|'drawPile'|'responseWindow'> & { viewerId:string; isSpectator:boolean; deck:{length:number}; drawPileCount:number; responseWindow:PublicResponseWindow|null; players:PublicPlayerState[] };
export function createGame(id:string, host:Pick<Spectator,'id'|'username'>, cards:Card[]):GameState {
  const now=new Date().toISOString();
  const deck=shuffled(cards);
  return { gameId:id, roomId:id, status:'setup', createdAt:now, updatedAt:now, turn:{activePlayerId:null,phase:'inactive',direction:'clockwise',turnNumber:0,attackUsedThisTurn:0,drawnThisTurn:0}, drawPile:deck.map(toCardInstance), discardPile:[], currentAction:null, responseWindow:null, chat:[], id, hostId:host.id, phase:'waiting', players:[], spectators:[{...host,connectionStatus:'online',joinedAt:now,lastSeenAt:now}], deck, discard:[], direction:1, hasDrawnThisTurn:false, log:[], attacksThisTurn:0 };
}
export const createSeatedPlayer=(member:Spectator,seatIndex:number):Player=>({...member,seatIndex,role:undefined,roleRevealed:false,character:undefined,characterOptions:[],hand:[],equipment:createEmptyEquipmentSlots<Card>(),decisionArea:[],ready:false,confirmedCharacter:false,alive:true});
export type RoleComposition=Record<Role,number>;
export function dealRoles(state:GameState, composition:RoleComposition){
  if(state.phase!=='waiting') throw new Error('Roles can only be dealt from the waiting room');
  const roles=shuffled((Object.entries(composition) as [Role,number][]).flatMap(([role,count])=>Array.from({length:count},()=>role)));
  if(roles.length!==state.players.length||composition.emperor!==1) throw new Error('Invalid role composition');
  state.players.forEach((player,index)=>{player.role=roles[index];player.roleRevealed=player.role==='emperor'}); state.phase='character-select';
}
const uniqueById=(characters:Character[])=>[...new Map(characters.map(c=>[c.id,c])).values()];
/** The manual: emperor chooses Cao Cao, Liu Bei, Sun Quan plus two random cards. */
export function dealEmperorOptions(state:GameState, characters:Character[]){
  const emperor=state.players.find(p=>p.role==='emperor'); if(!emperor) throw new Error('Emperor has not been dealt');
  const required=['โจโฉ','เล่าปี่','ซุนกวน'].map(name=>characters.find(c=>c.name===name));
  if(required.some(c=>!c)) throw new Error('Required emperor characters are missing from imported data');
  const chosenIds=new Set(required.map(c=>c!.id));
  const random=shuffled(characters.filter(c=>!chosenIds.has(c.id))).slice(0,2);
  emperor.characterOptions=[...(required as Character[]),...random];
}
/** Must run only after emperor selection: all unchosen character cards are reshuffled and redealt. */
export function dealOtherCharacterOptions(state:GameState, characters:Character[]){
  const emperor=state.players.find(p=>p.role==='emperor'); if(!emperor?.character||!emperor.confirmedCharacter) throw new Error('Emperor must select a character first');
  const otherPlayers=state.players.filter(p=>p.id!==emperor.id), optionCount=state.players.length===10?2:3;
  const pool=shuffled(characters.filter(c=>c.id!==emperor.character!.id));
  if(pool.length<otherPlayers.length*optionCount) throw new Error('Not enough characters to deal unique options');
  otherPlayers.forEach((player,index)=>{player.characterOptions=pool.slice(index*optionCount,(index+1)*optionCount)});
}
export function selectCharacter(state:GameState, playerId:string, characterId:string, characters:Character[]){
  if(state.phase!=='character-select') throw new Error('Character selection is closed');
  const player=state.players.find(p=>p.id===playerId); if(!player||player.confirmedCharacter) throw new Error('Character choice is locked');
  const character=player.characterOptions.find(c=>c.id===characterId); if(!character) throw new Error('Character is not one of your options');
  if(state.players.some(p=>p.character?.id===characterId)) throw new Error('Character is already selected');
  player.character=character; player.confirmedCharacter=true; player.maxHp=character.hp+(player.role==='emperor'&&state.players.length!==4?1:0); player.hp=player.maxHp;
  if(player.role==='emperor') dealOtherCharacterOptions(state,characters);
}
export function beginPlayAfterCharacters(state:GameState, initialHandSize:number){
  if(!state.players.every(p=>p.confirmedCharacter)) throw new Error('All players must confirm a character');
  state.players.forEach(p=>draw(state,p.id,initialHandSize));
  state.direction=-1; state.currentPlayerId=state.players.find(p=>p.role==='emperor')?.id; state.phase='playing'; state.turn={activePlayerId:state.currentPlayerId||null,phase:'draw',direction:'counterclockwise',turnNumber:1,attackUsedThisTurn:0,drawnThisTurn:0}; state.hasDrawnThisTurn=false; state.attacksThisTurn=0;
  state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'game-started',message:'เปิดเผยขุนพลแล้ว จักรพรรดิเป็นผู้เล่นคนแรก และเล่นทวนเข็มนาฬิกา'});
}
export function draw(state:GameState, playerId:string, count=1) {
  const player = state.players.find(p=>p.id===playerId); if (!player) throw new Error('Unknown player');
  for(let i=0;i<count;i++) { if(!state.deck.length && state.discard.length) state.deck=shuffled(state.discard.splice(0)); const card=state.deck.pop(); if(card) player.hand.push(card); }
}
const numberParam=(card:Card,key:string,fallback:number)=>{const value=card.effectParams[key];return typeof value==='number'?value:fallback};
const characterName=(player:Player)=>player.character?.name||player.username;
const findHandCard=(player:Player,cardInstanceId:string)=>player.hand.find((card,index)=>card.id===cardInstanceId||toCardInstance(card,index).instanceId===cardInstanceId);
/** Validates a zero-based hand position without exposing the card stored there. */
export function validateHiddenHandIndex(state:GameState,selection:HiddenHandSelection){
  const target=getPlayerById(state,selection.targetPlayerId);if(!target||!target.alive)throw new Error('Hidden-hand target must be alive');
  if(!Number.isInteger(selection.handIndex)||selection.handIndex<0||selection.handIndex>=target.hand.length)throw new Error('Hidden-hand index is invalid');
  return target;
}
/** Removes the exact card at an already-hidden hand position. Call only after action validation. */
export function resolveHiddenHandCard(state:GameState,selection:HiddenHandSelection){
  const target=validateHiddenHandIndex(state,selection),[card]=target.hand.splice(selection.handIndex,1);if(!card)throw new Error('Hidden-hand card is missing');return card;
}
const logAction=(state:GameState,type:string,message:string,actorId?:string,targetId?:string,cardId?:string)=>state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type,message,actorId,targetId,cardId});
const moveToDiscard=(state:GameState,card:Card,setLastPlayed=true)=>{state.discard.push(card);state.discardPile.push(toCardInstance(card,state.discard.length-1));if(setLastPlayed)state.lastPlayedCard=card};
type RuntimeEquipmentSlot=keyof EquipmentSlots<Card>;
const equipmentSlotForCard=(card:Card):RuntimeEquipmentSlot|undefined=>{switch(card.cardType){case 'weapon':return 'weapon';case 'armor':return 'armor';case 'offensive_mount':return 'offensiveMount';case 'defensive_mount':return 'defensiveMount';default:break;}switch(card.equipmentSlot){case 'weapon':return 'weapon';case 'armor':return 'armor';case 'offensive_mount':return 'offensiveMount';case 'defensive_mount':return 'defensiveMount';default:return undefined;}};
export const isEquipmentCard=(card:Card)=>Boolean(equipmentSlotForCard(card));

export function createTargetedCardAction(state:GameState,actorId:string,cardInstanceId:string,targetIds:string[],rules:TargetRules,effectKey:string):TargetedCardAction{
  if(state.currentAction||state.responseWindow)throw new Error('Resolve the current action first');
  const actor=getPlayerById(state,actorId);if(!actor||!actor.alive)throw new Error('Choose a living actor');
  if(!canPlayerAct(state,actorId))throw new Error('Only the active player may play a targeted card during the play phase');
  const card=findHandCard(actor,cardInstanceId);if(!card)throw new Error('Card is not in your hand');
  const uniqueTargetIds=[...new Set(targetIds)];if(uniqueTargetIds.length!==targetIds.length)throw new Error('Targets must be unique');if(uniqueTargetIds.length<rules.minTargets||uniqueTargetIds.length>rules.maxTargets)throw new Error('Invalid target count');
  const targets=uniqueTargetIds.map(id=>getPlayerById(state,id));if(targets.some(target=>!target||!target.alive))throw new Error('Every target must be alive');
  const resolvedTargets=targets as Player[];
  if(!rules.allowSelf&&resolvedTargets.some(target=>target.id===actorId))throw new Error('You cannot target yourself');
  const maxDistance=rules.maxDistance==='attack'?getAttackRange(state,actorId):rules.maxDistance;if(maxDistance!==undefined&&resolvedTargets.some(target=>{const distance=getEffectiveDistanceBetweenPlayers(state,actorId,target.id);return distance===null||distance>maxDistance;}))throw new Error('Target is out of range');
  actor.hand=actor.hand.filter(item=>item!==card);state.lastPlayedCard=card;const action:CurrentAction={actionId:crypto.randomUUID(),actorId,card:toCardInstance(card),effectKey,targetIds:uniqueTargetIds,status:'declared',createdAt:new Date().toISOString()};state.currentAction=action;
  logAction(state,'targeted-card-declared',`${characterName(actor)} ใช้ ${card.name} ใส่ ${resolvedTargets.map(characterName).join(', ')}`,actor.id,uniqueTargetIds[0],card.id);
  return {action,actor,card,targets:resolvedTargets};
}

export function resolveTargetedCardAction(state:GameState,actionId:string){
  const action=state.currentAction;if(!action||action.actionId!==actionId)throw new Error('Targeted action is not active');
  if(state.lastPlayedCard)moveToDiscard(state,state.lastPlayedCard);action.status='resolved';state.currentAction=null;return action;
}

export const getDiscardRequirement=(state:GameState,playerId:string)=>{const player=getPlayerById(state,playerId);return player?.hp===undefined?0:Math.max(0,player.hand.length-player.hp)};
export function getNextAlivePlayer(state:GameState,currentPlayerId:string){
  const players=getPlayersInSeatOrder(state),currentIndex=players.findIndex(player=>player.id===currentPlayerId); if(currentIndex<0)return undefined;
  for(let step=1;step<=players.length;step++){const index=(currentIndex+step*state.direction+players.length)%players.length; if(players[index].alive)return players[index];}
  return undefined;
}
export function canPlayerAct(state:GameState,playerId:string){return state.phase==='playing'&&state.turn.activePlayerId===playerId&&state.turn.phase==='play'&&!state.responseWindow&&!state.currentAction;}
export function canPlayCardNow(state:GameState,playerId:string,card:Card){
  if(card.effect==='negate_trick_effect'){const w=state.responseWindow;return (w?.type==='negate'||w?.type==='mass_dodge'||w?.type==='mass_attack')&&w.currentResponderId===playerId&&w.status==='open';}
  if(card.effect==='attack'&&state.responseWindow?.type==='duel_attack')return state.responseWindow.currentResponderId===playerId&&state.responseWindow.status==='open';
  if((card.effect==='dodge'||card.effect==='attack')&&(state.responseWindow?.type==='mass_dodge'||state.responseWindow?.type==='mass_attack'))return state.responseWindow.currentResponderId===playerId&&state.responseWindow.status==='open';
  if(card.effect==='dodge')return state.responseWindow?.type==='attack_dodge'&&state.responseWindow.currentResponderId===playerId&&state.responseWindow.status==='open';
  if(card.effect==='heal'&&state.responseWindow?.type==='dying_heal')return state.responseWindow.currentResponderId===playerId&&state.responseWindow.status==='open';
  return (card.effect==='attack'||card.effect==='duel_attack_response'||card.effect==='all_others_dodge_or_damage'||card.effect==='all_others_attack_or_damage'||card.effect==='heal'||card.effect==='draw_cards'||card.effect==='heal_all_living'||card.effect==='discard_target_card'||card.effect==='steal_target_card_in_range'||isEquipmentCard(card))&&canPlayerAct(state,playerId);
}
export function startTurn(state:GameState,playerId:string){
  const player=getPlayerById(state,playerId); if(!player||!player.alive)throw new Error('Cannot start a turn for this player');
  state.currentPlayerId=playerId; state.hasDrawnThisTurn=false; state.attacksThisTurn=0; state.turn={activePlayerId:playerId,phase:'draw',direction:state.direction===1?'clockwise':'counterclockwise',turnNumber:Math.max(1,state.turn.turnNumber),attackUsedThisTurn:0,drawnThisTurn:0};
  logAction(state,'turn-start',`${characterName(player)} เริ่มเทิร์น`,player.id); synchronizeGameState(state);
}
/** Keeps the visible top discard card on the table and shuffles older discards. TODO: seeded RNG for replay. */
export function reshuffleDiscardIntoDrawPile(state:GameState){
  if(state.deck.length||state.discard.length<2)return 0;
  const topDiscard=state.discard.at(-1)!,recycled=state.discard.slice(0,-1);
  state.deck=shuffled(recycled);state.discard=[topDiscard];state.lastPlayedCard=topDiscard;
  logAction(state,'draw-pile-reshuffled','กองจั่วหมด จึงสับกองทิ้งเป็นกองจั่วใหม่');synchronizeGameState(state);return recycled.length;
}
export function drawCards(state:GameState,playerId:string,amount:number){
  if(state.turn.activePlayerId!==playerId||state.turn.phase!=='draw')throw new Error('It is not the draw phase for this player');
  const player=getPlayerById(state,playerId); if(!player)throw new Error('Unknown player'); let drawn=0;
  for(let index=0;index<amount;index++){if(!state.deck.length)reshuffleDiscardIntoDrawPile(state);const card=state.deck.pop();if(!card){if(index===0||drawn<amount)logAction(state,'draw-pile-empty','กองจั่วและกองทิ้งมีไพ่ไม่พอสำหรับการจั่ว');break;}player.hand.push(card);drawn++;}
  state.hasDrawnThisTurn=true; state.turn.phase='play'; state.turn.drawnThisTurn=drawn; logAction(state,'turn-draw',`${characterName(player)} จั่วการ์ด ${drawn} ใบ`,player.id); logAction(state,'turn-play',`${characterName(player)} เข้าสู่ช่วงเล่นไพ่`,player.id); synchronizeGameState(state); return drawn;
}
/** Draw exactly one card from the deck. Advances to play phase only after `allowance` cards have been drawn this turn (default 2). */
export function drawOneTurnCard(state:GameState,playerId:string,allowance=2):void{
  if(state.turn.activePlayerId!==playerId||state.turn.phase!=='draw')throw new Error('ยังไม่ถึงเวลาจั่วไพ่');
  const player=getPlayerById(state,playerId);if(!player)throw new Error('Unknown player');
  if(!state.deck.length)reshuffleDiscardIntoDrawPile(state);
  const card=state.deck.pop();
  if(card){player.hand.push(card);state.turn.drawnThisTurn=(state.turn.drawnThisTurn||0)+1;logAction(state,'turn-draw-one',`${characterName(player)} จั่วการ์ด 1 ใบ (${state.turn.drawnThisTurn}/${allowance})`,player.id);}
  else{logAction(state,'draw-pile-empty','กองจั่วและกองทิ้งมีไพ่ไม่พอ');state.turn.drawnThisTurn=allowance;}
  if(state.turn.drawnThisTurn>=allowance){state.hasDrawnThisTurn=true;state.turn.phase='play';logAction(state,'turn-play',`${characterName(player)} เข้าสู่ช่วงเล่นไพ่`,player.id);}
  synchronizeGameState(state);
}
export function advancePhase(state:GameState){
  if(state.responseWindow||state.currentAction)throw new Error('Resolve the current action first');
  const playerId=state.turn.activePlayerId,player=playerId?getPlayerById(state,playerId):undefined; if(!player)throw new Error('There is no active player');
  if(state.turn.phase==='start'){state.turn.phase='draw';logAction(state,'turn-draw-phase',`${characterName(player)} เข้าสู่ช่วงจั่ว`,player.id);}
  else if(state.turn.phase==='play'){state.turn.phase='discard';logAction(state,'turn-discard-phase',`${characterName(player)} เข้าสู่ช่วงทิ้งไพ่`,player.id);}
  else if(state.turn.phase==='discard'){if(getDiscardRequirement(state,player.id)>0)throw new Error('Discard cards until your hand is at or below HP');state.turn.phase='end';}
  else throw new Error('Use Draw or End Turn for the current phase');
  synchronizeGameState(state);
}

function openDyingRescueWindow(state:GameState,dyingPlayerId:string,killerId?:string,sourceActionId=state.currentAction?.actionId||crypto.randomUUID()){
  const dyingPlayer=getPlayerById(state,dyingPlayerId);if(!dyingPlayer||!dyingPlayer.alive)throw new Error('Dying player is not eligible for rescue');
  const alive=getAlivePlayersInSeatOrder(state),dyingIndex=alive.findIndex(player=>player.id===dyingPlayerId);if(dyingIndex<0)throw new Error('Dying player is missing from seat order');
  const queue=[...alive.slice(dyingIndex),...alive.slice(0,dyingIndex)].map(player=>player.id),now=new Date().toISOString();
  state.responseWindow={windowId:crypto.randomUUID(),type:'dying_heal',sourceActionId,dyingPlayerId,dyingKillerId:killerId,requiredPlayerIds:queue,currentResponderId:queue[0]||null,allowedResponseEffectKeys:['heal'],responses:[],status:'open',createdAt:now,responderQueue:queue};
  logAction(state,'dying',`${characterName(dyingPlayer)} เข้าสู่สถานะใกล้ตาย`,undefined,dyingPlayer.id);
  logAction(state,'dying-heal-request',`กำลังขอ เสบียง เพื่อช่วย ${characterName(dyingPlayer)}`,undefined,dyingPlayer.id);
}

/** Damage opens a dying-heal window at 0 HP; death waits until every responder declines. */
export function applyDamage(state:GameState,targetId:string,amount:number,killerId?:string){
  const target=getPlayerById(state,targetId); if(!target||!target.alive||target.hp===undefined) throw new Error('Choose a living target');
  target.hp=Math.max(0,target.hp-amount); logAction(state,'damage',`${characterName(target)} เสีย ${amount} HP`,undefined,target.id);
  if(target.hp===0)openDyingRescueWindow(state,target.id,killerId);
}

function discardPlayerZones(state:GameState,player:Player,includeDecisionArea=true){
  for(const card of player.hand.splice(0))moveToDiscard(state,card,false);
  for(const slot of Object.keys(player.equipment) as RuntimeEquipmentSlot[]){const card=player.equipment[slot];if(card){player.equipment[slot]=null;moveToDiscard(state,card,false);}}
  if(includeDecisionArea)for(const card of player.decisionArea.splice(0))moveToDiscard(state,card,false);
}
function finishGame(state:GameState,winner:WinningSide){state.winner=winner;state.phase='ended';state.status='finished';state.currentPlayerId=undefined;state.turn.activePlayerId=null;state.turn.phase='inactive';logAction(state,'game-finished',winner==='traitor'?'คนทรยศชนะ':winner==='rebels'?'กบฏชนะ':'จักรพรรดิและผู้ภักดีชนะ');}
function checkWinCondition(state:GameState,dead:Player){
  if(dead.role==='emperor'){const living=state.players.filter(player=>player.alive);finishGame(state,living.length>0&&living.every(player=>player.role==='traitor')?'traitor':'rebels');return true;}
  if(!state.players.some(player=>player.alive&&(player.role==='rebel'||player.role==='traitor'))){finishGame(state,'emperor_loyalists');return true;}
  return false;
}
/** Resolves role reveal, zone cleanup, death rewards, and safe turn handoff. */
export function resolvePlayerDeath(state:GameState,playerId:string,killerId?:string){
  const dead=getPlayerById(state,playerId);if(!dead||!dead.alive)throw new Error('Player is not alive');const killer=killerId?getPlayerById(state,killerId):undefined;
  dead.roleRevealed=true;discardPlayerZones(state,dead);dead.alive=false;logAction(state,'player-died',`${characterName(dead)} ตาย และเปิดเผยบทบาท ${dead.role||'ไม่ทราบ'}`,undefined,dead.id);
  if(killer?.alive&&dead.role==='rebel'){draw(state,killer.id,3);logAction(state,'rebel-kill-reward',`${characterName(killer)} กำจัดกบฏ จั่วการ์ด 3 ใบ`,killer.id,dead.id);}
  if(killer?.alive&&killer.role==='emperor'&&dead.role==='loyalist'){discardPlayerZones(state,killer,false);logAction(state,'emperor-loyalist-penalty',`${characterName(killer)} กำจัดผู้ภักดี จึงทิ้งไพ่บนมือและอุปกรณ์ทั้งหมด`,killer.id,dead.id);}
  if(checkWinCondition(state,dead)){synchronizeGameState(state);return;}
  if(state.turn.activePlayerId===dead.id){const next=getNextAlivePlayer(state,dead.id);if(next){state.turn.turnNumber++;startTurn(state,next.id);}}
  synchronizeGameState(state);
}

export function healPlayer(state:GameState,playerId:string,amount:number){
  const player=getPlayerById(state,playerId); if(!player||!player.alive||player.hp===undefined||player.maxHp===undefined) throw new Error('Choose a living player');
  const restored=Math.min(amount,player.maxHp-player.hp); player.hp+=restored; logAction(state,'healed',`${characterName(player)} ฟื้นฟู ${restored} HP`,player.id);
  return restored;
}

export function declineResponse(state:GameState,playerId:string){
  const window=state.responseWindow;if(!window||window.status!=='open'||window.currentResponderId!==playerId)throw new Error('You cannot decline this response');
  const responder=getPlayerById(state,playerId);if(!responder)throw new Error('Unknown responder');window.responses.push({playerId,response:'decline',createdAt:new Date().toISOString()});
  if(window.type==='attack_dodge'){logAction(state,'attack-declined',`${characterName(responder)} ไม่ตอบสนอง`,responder.id);return resolveCurrentAction(state);}
  if(window.type==='duel_attack'){logAction(state,'duel-declined',`${characterName(responder)} ไม่สามารถตอบโต้ได้`,responder.id);return resolveDuel(state,responder.id);}
  if(window.type!=='dying_heal')throw new Error('Unsupported response window');
  const dying=getPlayerById(state,window.dyingPlayerId||'');if(!dying)throw new Error('Dying player is missing');const queue=window.responderQueue||window.requiredPlayerIds;
  const next=queue.find(id=>!window.responses.some(response=>response.playerId===id));
  if(next){const nextPlayer=getPlayerById(state,next);if(!nextPlayer)throw new Error('Responder is missing');window.currentResponderId=next;logAction(state,'dying-heal-request',`กำลังรอ ${characterName(nextPlayer)} ว่าจะใช้ เสบียง ช่วย ${characterName(dying)} หรือไม่`,next,dying.id);synchronizeGameState(state);return;}
  window.status='resolved';state.responseWindow=null;logAction(state,'dying-unrescued',`ไม่มีผู้เล่นช่วย ${characterName(dying)}`,undefined,dying.id);resolvePlayerDeath(state,dying.id,window.dyingKillerId);if(state.suspendedResponseWindow&&state.status!=='finished'){state.responseWindow=state.suspendedResponseWindow;state.suspendedResponseWindow=undefined;advanceMassResponseQueue(state);}
}

export function playAttack(state:GameState,attackerId:string,targetId:string,cardInstanceId:string){
  const initiatingCard=getPlayerById(state,attackerId)&&findHandCard(getPlayerById(state,attackerId)!,cardInstanceId);if(initiatingCard?.effect==='duel_attack_response')return playDuel(state,attackerId,targetId,cardInstanceId);
  if(state.turn.attackUsedThisTurn>=1&&!hasUnlimitedAttackPerTurn(state,attackerId)) throw new Error('You may only use one attack per turn');
  const prepared=createTargetedCardAction(state,attackerId,cardInstanceId,[targetId],{minTargets:1,maxTargets:1,allowSelf:false,maxDistance:'attack'},'attack');
  const attacker=prepared.actor,target=prepared.targets[0]!;
  const card=prepared.card,actionId=prepared.action.actionId;if(card.effect!=='attack')throw new Error('Attack card is not in your hand');
  if(target.equipment.armor?.effect==='black_attack_immunity'&&['♠','♣'].includes(card.suit)&&!attackIgnoresTargetArmor(state,attacker.id)){logAction(state,'armor-blocked-attack',`${characterName(target)} ใช้เกราะป้องกันการโจมตีสีดำ`,target.id,attacker.id);resolveTargetedCardAction(state,actionId);synchronizeGameState(state);return;}
  state.attacksThisTurn++; state.turn.attackUsedThisTurn++;
  state.responseWindow={windowId:crypto.randomUUID(),type:'attack_dodge',sourceActionId:actionId,requiredPlayerIds:[target.id],currentResponderId:target.id,allowedResponseEffectKeys:['dodge'],responses:[],status:'open',createdAt:new Date().toISOString()};
  state.pendingAction={id:actionId,kind:'attack',actorId:attacker.id,targetId:target.id,cardId:card.id,responseKey:'dodge',damage:numberParam(card,'damage',1)};
  synchronizeGameState(state);
}

export function playDuel(state:GameState,actorId:string,targetId:string,cardInstanceId:string){
  const prepared=createTargetedCardAction(state,actorId,cardInstanceId,[targetId],{minTargets:1,maxTargets:1,allowSelf:false},'duel_attack_response');const target=prepared.targets[0]!;
  if(prepared.card.effect!=='duel_attack_response')throw new Error('Duel card is not in your hand');
  state.responseWindow={windowId:crypto.randomUUID(),type:'duel_attack',sourceActionId:prepared.action.actionId,requiredPlayerIds:[actorId,targetId],currentResponderId:targetId,allowedResponseEffectKeys:['attack'],responses:[],status:'open',createdAt:new Date().toISOString()};
  synchronizeGameState(state);
}
export function playAttackResponse(state:GameState,playerId:string,cardInstanceId:string){
  const window=state.responseWindow,action=state.currentAction;if(!window||!action||window.type!=='duel_attack'||window.currentResponderId!==playerId)throw new Error('You cannot respond to this duel now');const player=getPlayerById(state,playerId),card=player&&findHandCard(player,cardInstanceId);if(!player||!card||card.effect!=='attack')throw new Error('Attack card is not in your hand');
  player.hand=player.hand.filter(item=>item!==card);moveToDiscard(state,card,false);window.responses.push({playerId,response:'card',cardInstanceId:toCardInstance(card).instanceId,createdAt:new Date().toISOString()});logAction(state,'duel-attack-response',`${characterName(player)} ตอบโต้ด้วย โจมตี`,player.id);window.currentResponderId=playerId===action.actorId?action.targetIds[0]!:action.actorId;synchronizeGameState(state);
}
export function resolveDuel(state:GameState,failedPlayerId:string){
  const action=state.currentAction,window=state.responseWindow;if(!action||!window||window.type!=='duel_attack'||window.currentResponderId!==failedPlayerId)throw new Error('Duel is not awaiting this player');const failed=getPlayerById(state,failedPlayerId),killerId=failedPlayerId===action.actorId?action.targetIds[0]:action.actorId;if(!failed)throw new Error('Duel participant is missing');window.status='resolved';state.responseWindow=null;applyDamage(state,failedPlayerId,1,killerId);resolveTargetedCardAction(state,action.actionId);synchronizeGameState(state);
}

function massQueue(state:GameState,actorId:string){const alive=getAlivePlayersInSeatOrder(state),index=alive.findIndex(player=>player.id===actorId);return index<0?[]:[...alive.slice(index+1),...alive.slice(0,index)].map(player=>player.id);}
function playMassTrick(state:GameState,actorId:string,cardInstanceId:string,effect:'all_others_dodge_or_damage'|'all_others_attack_or_damage'){
  const prepared=createTargetedCardAction(state,actorId,cardInstanceId,[],{minTargets:0,maxTargets:0,allowSelf:false},effect);if(prepared.card.effect!==effect)throw new Error('Mass trick card is not in your hand');const queue=massQueue(state,actorId),type=effect==='all_others_dodge_or_damage'?'mass_dodge':'mass_attack',required=type==='mass_dodge'?'dodge':'attack';state.responseWindow={windowId:crypto.randomUUID(),type,sourceActionId:prepared.action.actionId,requiredPlayerIds:queue,currentResponderId:queue[0]||null,allowedResponseEffectKeys:[required],responses:[],status:'open',createdAt:new Date().toISOString(),responderQueue:queue};logAction(state,'mass-trick-played',`${characterName(prepared.actor)} ใช้ ${prepared.card.name}`,actorId);if(!queue.length)advanceMassResponseQueue(state);synchronizeGameState(state);
}
export const playMassDodgeOrDamage=(state:GameState,actorId:string,cardInstanceId:string)=>playMassTrick(state,actorId,cardInstanceId,'all_others_dodge_or_damage');
export const playMassAttackOrDamage=(state:GameState,actorId:string,cardInstanceId:string)=>playMassTrick(state,actorId,cardInstanceId,'all_others_attack_or_damage');
export function advanceMassResponseQueue(state:GameState){const window=state.responseWindow,action=state.currentAction;if(!window||!action||(window.type!=='mass_dodge'&&window.type!=='mass_attack'))return;if(state.status==='finished')return;const queue=window.responderQueue||[],next=queue.find(id=>{const player=getPlayerById(state,id);return player?.alive&&!window.responses.some(response=>response.playerId===id);});if(next){window.currentResponderId=next;synchronizeGameState(state);return;}window.status='resolved';state.responseWindow=null;resolveTargetedCardAction(state,action.actionId);logAction(state,'mass-trick-finished',`การ์ด ${action.card?.name||''} จบการทำงาน`);synchronizeGameState(state);}
export function playMassResponseCard(state:GameState,playerId:string,cardInstanceId:string){const window=state.responseWindow;if(!window||(window.type!=='mass_dodge'&&window.type!=='mass_attack')||window.currentResponderId!==playerId)throw new Error('You cannot respond to this mass trick now');const player=getPlayerById(state,playerId),card=player&&findHandCard(player,cardInstanceId),required=window.type==='mass_dodge'?'dodge':'attack';if(!player||!card||card.effect!==required)throw new Error('Required response card is not in your hand');player.hand=player.hand.filter(item=>item!==card);moveToDiscard(state,card,false);window.responses.push({playerId,response:'card',cardInstanceId:toCardInstance(card).instanceId,createdAt:new Date().toISOString()});logAction(state,'mass-response',`${characterName(player)} ใช้ ${card.name}`,player.id);advanceMassResponseQueue(state);}
export function declineMassResponse(state:GameState,playerId:string){const window=state.responseWindow,action=state.currentAction;if(!window||!action||(window.type!=='mass_dodge'&&window.type!=='mass_attack')||window.currentResponderId!==playerId)throw new Error('You cannot decline this mass trick now');window.responses.push({playerId,response:'decline',createdAt:new Date().toISOString()});const actorId=action.actorId;logAction(state,'mass-response-declined',`${characterName(getPlayerById(state,playerId)!)} ไม่ตอบสนองและเสีย 1 HP`,playerId);applyDamage(state,playerId,1,actorId);if(state.responseWindow?.type==='dying_heal'){state.suspendedResponseWindow=window;return;}advanceMassResponseQueue(state);}

export function resolveCurrentAction(state:GameState){
  const action=state.currentAction; if(!action) throw new Error('There is no current action to resolve');
  if(action.effectKey!=='attack') throw new Error('Only attack resolution is supported');
  const targetId=action.targetIds[0],target=getPlayerById(state,targetId),attacker=getPlayerById(state,action.actorId); if(!target||!attacker) throw new Error('Action participant is missing');
  const attackWindow=state.responseWindow,response=attackWindow?.responses.find(item=>item.playerId===targetId);
  if(!response) throw new Error('Attack response is still required');
  if(response?.response==='card') logAction(state,'attack-cancelled','โจมตีถูกยกเลิก',attacker.id,target.id,action.card?.definitionKey);
  else {applyDamage(state,target.id,numberParam(state.lastPlayedCard||{effectParams:{} as EffectParams} as Card,'damage',1),attacker.id);if(target.alive&&hasDamageDestroyTargetMount(state,attacker.id)&&(target.equipment.offensiveMount||target.equipment.defensiveMount))state.pendingDestroyMount={attackerId:attacker.id,targetId:target.id};}
  if(attackWindow)attackWindow.status='resolved';resolveTargetedCardAction(state,action.actionId);if(state.responseWindow===attackWindow)state.responseWindow=null;state.pendingAction=undefined;
  synchronizeGameState(state);
}
export function destroyTargetMountAfterDamage(state:GameState,attackerId:string,targetId:string,mountSlot:'offensiveMount'|'defensiveMount'){const pending=state.pendingDestroyMount;if(!pending||pending.attackerId!==attackerId||pending.targetId!==targetId)throw new Error('No mount destruction is pending');const target=getPlayerById(state,targetId),mount=target?.equipment[mountSlot];if(!target||!mount)throw new Error('Selected mount is not available');target.equipment[mountSlot]=null;moveToDiscard(state,mount,false);state.pendingDestroyMount=undefined;logAction(state,'target-mount-destroyed',`${characterName(getPlayerById(state,attackerId)!)} ทำลาย ${mount.name} ของ ${characterName(target)}`,attackerId,targetId,mount.id);synchronizeGameState(state);}
export function declineDestroyTargetMount(state:GameState,attackerId:string){if(state.pendingDestroyMount?.attackerId!==attackerId)throw new Error('No mount destruction is pending');state.pendingDestroyMount=undefined;logAction(state,'target-mount-destruction-declined',`${characterName(getPlayerById(state,attackerId)!)} ไม่ทำลายพาหนะ`,attackerId);synchronizeGameState(state);}

export function playDodge(state:GameState,playerId:string,cardInstanceId:string){
  const window=state.responseWindow,action=state.currentAction; if(!window||!action||window.type!=='attack_dodge'||window.status!=='open'||window.currentResponderId!==playerId) throw new Error('You cannot dodge now');
  const player=getPlayerById(state,playerId); if(!player) throw new Error('Unknown player'); const card=findHandCard(player,cardInstanceId); if(!card||card.effect!=='dodge') throw new Error('Dodge card is not in your hand');
  const attacker=getPlayerById(state,action.actorId),canRepeat=Boolean(attacker&&hasRepeatAttackAfterDodge(state,attacker.id)&&player.alive&&canTargetWithAttack(state,attacker.id,player.id));player.hand=player.hand.filter(item=>item!==card); moveToDiscard(state,card,false); window.responses.push({playerId,response:'card',cardInstanceId:toCardInstance(card).instanceId,createdAt:new Date().toISOString()});
  logAction(state,'attack-dodged',`${characterName(player)} ใช้ หลบ`,player.id,action.actorId,card.id); resolveCurrentAction(state);if(canRepeat&&attacker)state.pendingRepeatAttack={attackerId:attacker.id,targetId:player.id,weaponName:attacker.equipment.weapon?.name||'อาวุธ'};if(attacker&&hasDiscardTwoForceAttackDamage(state,attacker.id)){const discardable=attacker.hand.length+Object.values(attacker.equipment).filter(Boolean).length;if(discardable>=2)state.pendingForceAttackDamage={attackerId:attacker.id,targetId:player.id};
  }
}
export function forceAttackDamageByDiscardingTwo(state:GameState,attackerId:string,cardRefs:string[]){const pending=state.pendingForceAttackDamage;if(!pending||pending.attackerId!==attackerId||cardRefs.length!==2||new Set(cardRefs).size!==2)throw new Error('Choose exactly two cards');const attacker=getPlayerById(state,attackerId),target=getPlayerById(state,pending.targetId);if(!attacker||!target?.alive)throw new Error('Force attack target is unavailable');const discarded:Card[]=[];for(const ref of cardRefs){let card=findHandCard(attacker,ref);if(card)attacker.hand=attacker.hand.filter(item=>item!==card);else for(const slot of Object.keys(attacker.equipment) as RuntimeEquipmentSlot[]){const equipped=attacker.equipment[slot];if(equipped&&equipped.id===ref){card=equipped;attacker.equipment[slot]=null;break;}}if(!card)throw new Error('Selected card is not yours');discarded.push(card);}discarded.forEach(card=>moveToDiscard(state,card,false));state.pendingForceAttackDamage=undefined;logAction(state,'force-attack-damage',`${characterName(attacker)} ทิ้งไพ่ 2 ใบบังคับให้โจมตีโดน`,attacker.id,target.id);applyDamage(state,target.id,1,attacker.id);synchronizeGameState(state);}
export function declineForceAttackDamage(state:GameState,attackerId:string){if(state.pendingForceAttackDamage?.attackerId!==attackerId)throw new Error('No forced damage is pending');state.pendingForceAttackDamage=undefined;logAction(state,'force-attack-damage-declined',`${characterName(getPlayerById(state,attackerId)!)} ไม่บังคับให้โจมตีโดน`,attackerId);synchronizeGameState(state);}
export function continueRepeatAttackAfterDodge(state:GameState,attackerId:string,attackCardInstanceId:string){const pending=state.pendingRepeatAttack;if(!pending||pending.attackerId!==attackerId)throw new Error('No repeat attack is pending');const target=getPlayerById(state,pending.targetId),attacker=getPlayerById(state,attackerId);if(!target?.alive||!attacker||!canTargetWithAttack(state,attackerId,target.id))throw new Error('Repeat target is no longer legal');const card=findHandCard(attacker,attackCardInstanceId);if(!card||card.effect!=='attack')throw new Error('Choose another Attack card');state.pendingRepeatAttack=undefined;const prior=state.turn.attackUsedThisTurn;state.turn.attackUsedThisTurn=0;state.attacksThisTurn=0;playAttack(state,attackerId,target.id,attackCardInstanceId);state.turn.attackUsedThisTurn=Math.max(prior+1,state.turn.attackUsedThisTurn);state.attacksThisTurn=state.turn.attackUsedThisTurn;}
export function declineRepeatAttackAfterDodge(state:GameState,attackerId:string){if(state.pendingRepeatAttack?.attackerId!==attackerId)throw new Error('No repeat attack is pending');state.pendingRepeatAttack=undefined;logAction(state,'repeat-attack-declined',`${characterName(getPlayerById(state,attackerId)!)} ไม่โจมตีซ้ำ`,attackerId);synchronizeGameState(state);}
export function useArmorJudgment(state:GameState,playerId:string){
  const window=state.responseWindow,player=getPlayerById(state,playerId),attackerId=state.currentAction?.actorId;if(!window||window.type!=='attack_dodge'||window.currentResponderId!==playerId||player?.equipment.armor?.effect!=='judgment_dodge'||(attackerId&&attackIgnoresTargetArmor(state,attackerId)))throw new Error('Armor judgment is not available');
  if(!state.deck.length)reshuffleDiscardIntoDrawPile(state);const judgment=state.deck.pop();if(!judgment){logAction(state,'armor-judgment-empty','กองจั่วไม่มีไพ่สำหรับการตัดสิน',playerId);return false;}moveToDiscard(state,judgment,false);const success=['♥','♦'].includes(judgment.suit);logAction(state,'armor-judgment',`${characterName(player)} ตัดสิน ${judgment.suit}${judgment.number} ${success?'สำเร็จ':'ไม่สำเร็จ'}`,playerId);
  if(success){window.responses.push({playerId,response:'card',createdAt:new Date().toISOString()});resolveCurrentAction(state);}else synchronizeGameState(state);return success;
}

export function playHeal(state:GameState,playerId:string,cardInstanceId:string){
  const player=getPlayerById(state,playerId);if(!player||!player.alive)throw new Error('Choose a living player');const card=findHandCard(player,cardInstanceId);if(!card||card.effect!=='heal')throw new Error('Heal card is not in your hand');
  const window=state.responseWindow;
  if(window?.type==='dying_heal'){
    if(window.status!=='open'||window.currentResponderId!==playerId)throw new Error('You cannot use Heal in this rescue window');
    const dying=getPlayerById(state,window.dyingPlayerId||'');if(!dying||dying.hp===undefined)throw new Error('Dying player is missing');
    player.hand=player.hand.filter(item=>item!==card);logAction(state,'dying-heal-played',`${characterName(player)} ใช้ เสบียง ช่วย ${characterName(dying)}`,player.id,dying.id,card.id);healPlayer(state,dying.id,numberParam(card,'heal_amount',1));moveToDiscard(state,card);
    window.responses.push({playerId,response:'card',cardInstanceId:toCardInstance(card).instanceId,createdAt:new Date().toISOString()});window.status='resolved';state.responseWindow=null;logAction(state,'dying-rescued',`${characterName(dying)} รอดจากสถานะใกล้ตาย`,undefined,dying.id);if(state.suspendedResponseWindow){state.responseWindow=state.suspendedResponseWindow;state.suspendedResponseWindow=undefined;advanceMassResponseQueue(state);}synchronizeGameState(state);return;
  }
  if(state.currentAction||window) throw new Error('Resolve the current action first');
  if(player.hp===undefined||player.maxHp===undefined||player.hp>=player.maxHp) throw new Error('You can only heal yourself while wounded');
  if(!canPlayerAct(state,playerId)) throw new Error('Heal can only be played by the active player during the play phase');
  player.hand=player.hand.filter(item=>item!==card); logAction(state,'heal-played',`${characterName(player)} ใช้ เสบียง`,player.id,undefined,card.id); healPlayer(state,player.id,numberParam(card,'heal_amount',1)); moveToDiscard(state,card); synchronizeGameState(state);
}

function prepareImmediateTrick(state:GameState,playerId:string,cardInstanceId:string,effectKey:'draw_cards'|'heal_all_living'){
  if(state.responseWindow||state.currentAction)throw new Error('Resolve the current action first');
  const player=getPlayerById(state,playerId);if(!player||!player.alive)throw new Error('Choose a living player');
  if(!canPlayerAct(state,playerId))throw new Error('Immediate tricks can only be played by the active player during the play phase');
  const card=findHandCard(player,cardInstanceId);if(!card||card.effect!==effectKey)throw new Error('Immediate trick card is not in your hand');
  player.hand=player.hand.filter(item=>item!==card);return {player,card};
}

/** Draws from a card effect during play phase; this is distinct from the turn draw phase. */
export function playDrawCardsTrick(state:GameState,playerId:string,cardInstanceId:string){
  const {player,card}=prepareImmediateTrick(state,playerId,cardInstanceId,'draw_cards');
  state.lastPlayedCard=card;const action:CurrentAction={actionId:crypto.randomUUID(),actorId:playerId,card:toCardInstance(card),effectKey:'draw_cards',targetIds:[],status:'declared',createdAt:new Date().toISOString()};state.currentAction=action;
  state.pendingTrickResolution={effectKey:'draw_cards'};
  logAction(state,'trick-declared',`${characterName(player)} ประกาศใช้ ${card.name}`,player.id,undefined,card.id);
  openNegateWindowForTrick(state,playerId);
}

/** TODO: dispatch before_heal/after_heal hooks here when character skills are implemented. */
export function playHealAllLiving(state:GameState,playerId:string,cardInstanceId:string){
  const {player,card}=prepareImmediateTrick(state,playerId,cardInstanceId,'heal_all_living');
  state.lastPlayedCard=card;const action:CurrentAction={actionId:crypto.randomUUID(),actorId:playerId,card:toCardInstance(card),effectKey:'heal_all_living',targetIds:[],status:'declared',createdAt:new Date().toISOString()};state.currentAction=action;
  state.pendingTrickResolution={effectKey:'heal_all_living'};
  logAction(state,'trick-declared',`${characterName(player)} ประกาศใช้ ${card.name}`,player.id,undefined,card.id);
  openNegateWindowForTrick(state,playerId);
}

/** Equips a card by metadata only. Individual equipment effects remain TODO. */
export function playEquipment(state:GameState,playerId:string,cardInstanceId:string){
  if(state.responseWindow||state.currentAction)throw new Error('Resolve the current action first');
  const player=getPlayerById(state,playerId);if(!player||!player.alive)throw new Error('Choose a living player');
  if(!canPlayerAct(state,playerId))throw new Error('Equipment can only be played by the active player during the play phase');
  const card=findHandCard(player,cardInstanceId),slot=card?equipmentSlotForCard(card):undefined;if(!card||!slot)throw new Error('Equipment card is not in your hand');
  player.hand=player.hand.filter(item=>item!==card);const replaced=player.equipment[slot];
  if(replaced){moveToDiscard(state,replaced,false);logAction(state,'equipment-replaced',`${characterName(player)} เปลี่ยนอุปกรณ์จาก ${replaced.name} เป็น ${card.name}`,player.id,undefined,card.id);}
  else logAction(state,'equipment-equipped',`${characterName(player)} ติดตั้ง ${card.name}`,player.id,undefined,card.id);
  player.equipment[slot]=card;synchronizeGameState(state);
}

/** Targeted trick: discard a selected hidden hand position or visible equipment card. */
export function playDiscardTargetCard(state:GameState,actorId:string,targetId:string,cardInstanceId:string,selection:TargetCardSelection|string){
  const actor=getPlayerById(state,actorId),trick=actor?findHandCard(actor,cardInstanceId):undefined;if(!actor||!trick||trick.effect!=='discard_target_card')throw new Error('Discard-target card is not in your hand');
  if(typeof selection!=='string'&&selection.zone==='decision_area')throw new Error('Decision-area selection is not implemented yet');if(typeof selection!=='string'&&selection.zone==='hand')validateHiddenHandIndex(state,{targetPlayerId:targetId,handIndex:selection.handIndex});
  // Eagerly validate the selected card exists before locking in the action
  else {const tgt=getPlayerById(state,targetId),tId=typeof selection==='string'?selection:selection.cardInstanceId;if(!tgt||(!findHandCard(tgt,tId)&&!Object.values(tgt.equipment).some(e=>e&&(e.id===tId||toCardInstance(e).instanceId===tId))))throw new Error('Selected target card is not available');}
  const prepared=createTargetedCardAction(state,actorId,cardInstanceId,[targetId],{minTargets:1,maxTargets:1,allowSelf:false},'discard_target_card');
  state.pendingTrickResolution={effectKey:'discard_target_card',targetId,selection};
  logAction(state,'trick-declared',`${characterName(prepared.actor)} ประกาศใช้ ${prepared.card.name} ใส่ ${characterName(prepared.targets[0]!)}`,actorId,targetId,prepared.card.id);
  openNegateWindowForTrick(state,actorId);
}

/** Targeted trick: transfer a selected hidden hand position or visible equipment card to the actor. */
export function playStealTargetCard(state:GameState,actorId:string,targetId:string,selection:TargetCardSelection|string,cardInstanceId:string){
  const actor=getPlayerById(state,actorId),trick=actor?findHandCard(actor,cardInstanceId):undefined,target=getPlayerById(state,targetId);if(!actor||!trick||trick.effect!=='steal_target_card_in_range')throw new Error('Steal-target card is not in your hand');if(!target)throw new Error('Target is missing');
  if(typeof selection!=='string'&&selection.zone==='decision_area')throw new Error('Decision-area selection is not implemented yet');if(typeof selection!=='string'&&selection.zone==='hand')validateHiddenHandIndex(state,{targetPlayerId:targetId,handIndex:selection.handIndex});
  // Eagerly validate the target card exists before locking in the action
  else {const tId=typeof selection==='string'?selection:selection.cardInstanceId;if(!Object.values(target.equipment).some(e=>e&&(e.id===tId||toCardInstance(e).instanceId===tId)))throw new Error('Selected target equipment is not available');}
  const prepared=createTargetedCardAction(state,actorId,cardInstanceId,[targetId],{minTargets:1,maxTargets:1,allowSelf:false,maxDistance:1},'steal_target_card_in_range');
  state.pendingTrickResolution={effectKey:'steal_target_card_in_range',targetId,selection};
  logAction(state,'trick-declared',`${characterName(prepared.actor)} ประกาศใช้ ${prepared.card.name} ใส่ ${characterName(target)}`,actorId,targetId,prepared.card.id);
  openNegateWindowForTrick(state,actorId);
}
// ── Negate (คงกระพันชาตรี) infrastructure ──────────────────────────────────

/** Opens a negate response window for all alive players except the actor. */
function openNegateWindowForTrick(state:GameState,actorId:string):void{
  const alive=getAlivePlayersInSeatOrder(state),actorIndex=alive.findIndex(p=>p.id===actorId);
  const queue=actorIndex>=0?[...alive.slice(actorIndex+1),...alive.slice(0,actorIndex)]:alive;
  const queueIds=queue.map(p=>p.id);
  if(!queueIds.length){resolveTrickEffect(state);return;}
  state.responseWindow={windowId:crypto.randomUUID(),type:'negate',sourceActionId:state.currentAction!.actionId,requiredPlayerIds:queueIds,currentResponderId:queueIds[0]!,allowedResponseEffectKeys:['negate_trick_effect'],responses:[],status:'open',createdAt:new Date().toISOString(),responderQueue:queueIds};
  synchronizeGameState(state);
}

/** Executes the stored pending trick effect after all players have declined to negate. */
function resolveTrickEffect(state:GameState):void{
  const action=state.currentAction,params=state.pendingTrickResolution;
  if(!action){state.pendingTrickResolution=undefined;synchronizeGameState(state);return;}
  const actor=getPlayerById(state,action.actorId),trickCard=state.lastPlayedCard;
  if(!actor||!trickCard){action.status='resolved';state.currentAction=null;state.pendingTrickResolution=undefined;synchronizeGameState(state);return;}
  if(params?.effectKey==='draw_cards'){
    const amount=numberParam(trickCard,'amount',2),before=actor.hand.length;draw(state,actor.id,amount);const drawn=actor.hand.length-before;
    moveToDiscard(state,trickCard);logAction(state,'draw-cards-played',`${characterName(actor)} ใช้ ${trickCard.name} จั่วการ์ด ${drawn} ใบ`,actor.id,undefined,trickCard.id);
  }else if(params?.effectKey==='heal_all_living'){
    let healed=0;for(const t of getAlivePlayers(state)){if(t.hp===undefined||t.maxHp===undefined)continue;const r=Math.min(1,t.maxHp-t.hp);t.hp+=r;if(r>0)healed++;}
    moveToDiscard(state,trickCard);logAction(state,'heal-all-living-played',`${characterName(actor)} ใช้ ${trickCard.name} ฟื้นฟูพลังชีวิตให้ขุนพล ${healed} คน`,actor.id,undefined,trickCard.id);
  }else if((params?.effectKey==='discard_target_card'||params?.effectKey==='steal_target_card_in_range')&&params?.targetId&&params?.selection!==undefined){
    const target=getPlayerById(state,params.targetId),sel=params.selection;
    if(target){
      let chosen:Card|undefined,hiddenHand=false;
      if(typeof sel!=='string'&&'zone' in sel&&sel.zone==='hand'){chosen=resolveHiddenHandCard(state,{targetPlayerId:target.id,handIndex:(sel as {zone:'hand';handIndex:number}).handIndex});hiddenHand=true;}
      else{const tId=typeof sel==='string'?sel:(sel as {cardInstanceId:string}).cardInstanceId;
        if(params.effectKey==='steal_target_card_in_range'){for(const slot of Object.keys(target.equipment) as RuntimeEquipmentSlot[]){const e=target.equipment[slot];if(e&&(e.id===tId||toCardInstance(e).instanceId===tId)){chosen=e;target.equipment[slot]=null;break;}}}
        if(!chosen){chosen=findHandCard(target,tId);if(chosen)target.hand=target.hand.filter(c=>c!==chosen);else if(params.effectKey==='discard_target_card'){for(const slot of Object.keys(target.equipment) as RuntimeEquipmentSlot[]){const e=target.equipment[slot];if(e&&(e.id===tId||toCardInstance(e).instanceId===tId)){chosen=e;target.equipment[slot]=null;break;}}}}
      }
      if(chosen){
        if(params.effectKey==='steal_target_card_in_range')actor.hand.push(chosen);else moveToDiscard(state,chosen,false);
        logAction(state,params.effectKey==='steal_target_card_in_range'?'target-card-stolen':'target-card-discarded',
          hiddenHand?(params.effectKey==='steal_target_card_in_range'?`${characterName(actor)} ขโมยไพ่บนมือของ ${characterName(target)} 1 ใบ`:`${characterName(actor)} ทิ้งไพ่บนมือของ ${characterName(target)} 1 ใบ`):(params.effectKey==='steal_target_card_in_range'?`${characterName(actor)} ขโมย ${chosen.name} จาก ${characterName(target)}`:`${characterName(actor)} ใช้ ${trickCard.name} ทิ้ง ${chosen.name} ของ ${characterName(target)}`),
          actor.id,target.id,hiddenHand?undefined:chosen.id);
      }
    }
    moveToDiscard(state,trickCard);
  }else{moveToDiscard(state,trickCard);}
  action.status='resolved';state.currentAction=null;state.pendingTrickResolution=undefined;synchronizeGameState(state);
}

/** Play a คงกระพันชาตรี card to cancel the current declared trick. Any player except the actor may call this. */
export function respondWithNegate(state:GameState,playerId:string,cardInstanceId:string):void{
  const window=state.responseWindow;
  if(!window||window.type!=='negate'||window.currentResponderId!==playerId||window.status!=='open')throw new Error('คุณไม่สามารถใช้คงกระพันชาตรีในขณะนี้');
  const player=getPlayerById(state,playerId),card=player&&findHandCard(player,cardInstanceId);
  if(!player||!card||card.effect!=='negate_trick_effect')throw new Error('การ์ดคงกระพันชาตรีไม่อยู่ในมือ');
  player.hand=player.hand.filter(item=>item!==card);moveToDiscard(state,card,false);
  window.responses.push({playerId,response:'card',cardInstanceId:toCardInstance(card).instanceId,createdAt:new Date().toISOString()});
  window.status='resolved';state.responseWindow=null;
  logAction(state,'trick-negated',`${characterName(player)} ใช้ คงกระพันชาตรี ยกเลิกการ์ดอุบาย`,player.id);
  if(state.currentAction){if(state.lastPlayedCard)moveToDiscard(state,state.lastPlayedCard);state.currentAction.status='cancelled';state.currentAction=null;}
  state.pendingTrickResolution=undefined;synchronizeGameState(state);
}

/** Decline to negate — advances the queue; when all decline the trick resolves. */
export function declineNegate(state:GameState,playerId:string):void{
  const window=state.responseWindow;
  if(!window||window.type!=='negate'||window.currentResponderId!==playerId||window.status!=='open')throw new Error('ไม่มีคำถามการใช้คงกระพันชาตรีสำหรับคุณ');
  const player=getPlayerById(state,playerId);if(!player)throw new Error('Unknown player');
  window.responses.push({playerId,response:'decline',createdAt:new Date().toISOString()});
  logAction(state,'negate-declined',`${characterName(player)} ไม่ใช้คงกระพันชาตรี`,player.id);
  const queue=window.responderQueue||window.requiredPlayerIds,next=queue.find(id=>!window.responses.some(r=>r.playerId===id));
  if(next){window.currentResponderId=next;synchronizeGameState(state);return;}
  window.status='resolved';state.responseWindow=null;resolveTrickEffect(state);
}

/** Play a คงกระพันชาตรี card inside a mass-dodge or mass-attack window to skip your response without taking damage. */
export function playNegateInMassWindow(state:GameState,playerId:string,cardInstanceId:string):void{
  const window=state.responseWindow;
  if(!window||(window.type!=='mass_dodge'&&window.type!=='mass_attack')||window.currentResponderId!==playerId||window.status!=='open')throw new Error('คุณไม่สามารถใช้คงกระพันชาตรีในขณะนี้');
  const player=getPlayerById(state,playerId),card=player&&findHandCard(player,cardInstanceId);
  if(!player||!card||card.effect!=='negate_trick_effect')throw new Error('การ์ดคงกระพันชาตรีไม่อยู่ในมือ');
  player.hand=player.hand.filter(item=>item!==card);moveToDiscard(state,card,false);
  window.responses.push({playerId,response:'card',cardInstanceId:toCardInstance(card).instanceId,createdAt:new Date().toISOString()});
  logAction(state,'mass-negate',`${characterName(player)} ใช้ คงกระพันชาตรี หลีกเลี่ยงผล${window.type==='mass_dodge'?'สงคราม':'ราชโองการ'}`,player.id);
  advanceMassResponseQueue(state);
}

const effectResolvers:Record<string,EffectResolver>={
  attack:({state,actor,card,target,targetId,subscribers=[]})=>{if(!targetId||!target||target.id===actor.id||!target.alive)throw new Error('Choose a living opponent to attack');if(state.attacksThisTurn>=1)throw new Error('You may only use one attack per turn');const event=dispatchGameEvent(state,{name:'before_attack',actorId:actor.id,targetId:target.id,card,amount:numberParam(card,'damage',1)},subscribers);if(event.cancelled)return true;state.attacksThisTurn++;state.discard.push(card);state.pendingAction={id:crypto.randomUUID(),kind:'attack',actorId:actor.id,targetId:target.id,cardId:card.id,responseKey:'dodge',damage:event.amount||1};state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'attack-pending',actorId:actor.id,targetId:target.id,cardId:card.id,message:`${actor.username} ใช้โจมตีใส่ ${target.username} กำลังรอการตอบโต้`});dispatchGameEvent(state,{name:'after_attack',actorId:actor.id,targetId:target.id,card,amount:event.amount},subscribers);return true},
  heal:({state,actor,card,target,subscribers=[]})=>{const recipient=target||actor;if(!recipient.alive||recipient.hp===undefined||recipient.maxHp===undefined)throw new Error('Choose a living player');if(recipient.id===actor.id&&recipient.hp>=recipient.maxHp)throw new Error('You can only heal yourself while wounded');if(recipient.id!==actor.id&&recipient.hp>0)throw new Error('You can only heal another player during a dying window');const amount=numberParam(card,'heal_amount',1),event=dispatchGameEvent(state,{name:'before_heal',actorId:actor.id,targetId:recipient.id,card,amount},subscribers);if(event.cancelled)return true;recipient.hp=Math.min(recipient.maxHp,recipient.hp+(event.amount||amount));state.discard.push(card);state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'healed',actorId:actor.id,targetId:recipient.id,cardId:card.id,message:`${actor.username} ใช้เสบียงฟื้นฟูพลังชีวิตให้ ${recipient.username}`});dispatchGameEvent(state,{name:'after_heal',actorId:actor.id,targetId:recipient.id,card,amount:event.amount},subscribers);return true}
};
export function playCard(state:GameState, actorId:string, cardId:string, targetId?:string, subscribers:EventSubscriber[]=[]){
  if(state.phase!=='playing'||state.currentPlayerId!==actorId)throw new Error('It is not your turn');if(!state.hasDrawnThisTurn)throw new Error('ต้องจั่วไพ่ก่อนเล่นการ์ด');if(state.pendingAction)throw new Error('Resolve the pending response first');
  const actor=state.players.find(player=>player.id===actorId);if(!actor)throw new Error('Unknown player');const card=actor.hand.find(item=>item.id===cardId);if(!card)throw new Error('Card is not in your hand');const target=targetId?state.players.find(player=>player.id===targetId):undefined;
  if(card.effect==='attack'){if(!targetId)throw new Error('Choose a target');return playAttack(state,actorId,targetId,cardId);}
  if(card.effect==='duel_attack_response'){if(!targetId)throw new Error('Choose a target');return playDuel(state,actorId,targetId,cardId);}
  if(card.effect==='all_others_dodge_or_damage')return playMassDodgeOrDamage(state,actorId,cardId);
  if(card.effect==='all_others_attack_or_damage')return playMassAttackOrDamage(state,actorId,cardId);
  if(card.effect==='heal') return playHeal(state,actorId,cardId);
  if(card.effect==='draw_cards') return playDrawCardsTrick(state,actorId,cardId);
  if(card.effect==='heal_all_living') return playHealAllLiving(state,actorId,cardId);
  if(isEquipmentCard(card)) return playEquipment(state,actorId,cardId);
  actor.hand=actor.hand.filter(item=>item.id!==cardId);state.lastPlayedCard=card;
  if(card.effect==='dodge')throw new Error('Dodge can only be used in response to an attack');
  const resolved=card.effect?effectResolvers[card.effect]?.({state,actor,card,target,targetId,subscribers}):false;if(resolved)return;
  state.discard.push(card);
  state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'card-played',actorId,targetId,cardId,message:`${actor.username} ใช้ไพ่ ${card.name}`});
}
export function respondToAttack(state:GameState, responderId:string, cardId?:string, subscribers:EventSubscriber[]=[]){
  const pending=state.pendingAction; if(!pending||pending.kind!=='attack') throw new Error('There is no attack to respond to');
  if(pending.targetId!==responderId) throw new Error('Only the attack target may respond');
  const target=state.players.find(p=>p.id===responderId)!, attacker=state.players.find(p=>p.id===pending.actorId)!;
  if(cardId) return playDodge(state,responderId,cardId);
  const window=state.responseWindow; if(window)return declineResponse(state,responderId);
  const dodge=cardId?target.hand.find(c=>c.id===cardId&&c.effect==='dodge'):undefined;
  if(dodge){target.hand=target.hand.filter(c=>c.id!==dodge.id);state.lastPlayedCard=dodge;state.discard.push(dodge);state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'attack-dodged',actorId:attacker.id,targetId:target.id,cardId:dodge.id,message:`${target.username} ใช้หลบการโจมตีของ ${attacker.username}`});}
  else { if(target.hp===undefined) throw new Error('Target has no HP');const attackCard=state.discard.find(card=>card.id===pending.cardId);const event=dispatchGameEvent(state,{name:'before_damage',actorId:attacker.id,targetId:target.id,card:attackCard,amount:pending.damage},subscribers);if(!event.cancelled){target.hp-=event.amount||pending.damage;state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'damage',actorId:attacker.id,targetId:target.id,cardId:pending.cardId,message:`${target.username} ได้รับความเสียหาย ${event.amount||pending.damage} หน่วยจาก ${attacker.username}`});dispatchGameEvent(state,{name:'after_damage',actorId:attacker.id,targetId:target.id,card:attackCard,amount:event.amount},subscribers);if(target.hp<=0) state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'dying',targetId:target.id,message:`${target.username} อยู่ในสถานะใกล้ตาย กำลังรอการใช้เสบียงช่วยเหลือ`});} }
  state.pendingAction=undefined;
}
export function endTurn(state:GameState, playerId=state.turn.activePlayerId||''){
  if(state.turn.activePlayerId){
    if(state.responseWindow||state.currentAction)throw new Error('Resolve the current action first');
    if(state.turn.activePlayerId!==playerId)throw new Error('Only the active player can end this turn');
    const player=getPlayerById(state,playerId);if(!player)throw new Error('Unknown player');
    if(state.turn.phase==='draw')throw new Error('Draw cards before ending the turn');
    if(state.turn.phase==='play'){state.turn.phase='discard';logAction(state,'turn-discard-phase',`${characterName(player)} เข้าสู่ช่วงทิ้งไพ่`,player.id);}
    const required=getDiscardRequirement(state,playerId);if(required>0){logAction(state,'hand-limit-required',`${characterName(player)} ต้องทิ้งไพ่ ${required} ใบ`,player.id);synchronizeGameState(state);return;}
    state.turn.phase='end';logAction(state,'turn-end',`${characterName(player)} จบเทิร์น`,player.id);
    const next=getNextAlivePlayer(state,playerId);if(!next)throw new Error('No alive player can take the next turn');
    state.turn.turnNumber++;startTurn(state,next.id);return;
  }
  if(state.phase!=='playing'||state.currentPlayerId!==playerId||state.pendingAction) throw new Error('Cannot end this turn');
  if(!state.hasDrawnThisTurn) throw new Error('ต้องจั่วไพ่ก่อนจบเทิร์น');
  const player=state.players.find(p=>p.id===playerId); if(!player) throw new Error('Unknown player');
  if(player.hp!==undefined&&player.hand.length>player.hp) throw new Error('ต้องทิ้งไพ่บนมือให้ไม่เกินพลังชีวิตก่อนจบเทิร์น');
  const current=state.players.findIndex(p=>p.id===playerId); for(let step=1;step<=state.players.length;step++){const next=state.players[(current+step*state.direction+state.players.length*10)%state.players.length];if(next.alive){state.currentPlayerId=next.id;state.attacksThisTurn=0;state.hasDrawnThisTurn=false;state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'turn-start',actorId:next.id,message:`เริ่มเทิร์นของ ${next.username}`});return;}}
}
export function drawForTurn(state:GameState, playerId:string){
  if(state.turn.activePlayerId)return drawCards(state,playerId,2);
  if(state.phase!=='playing'||state.currentPlayerId!==playerId||state.pendingAction) throw new Error('ยังไม่ถึงเวลาจั่วไพ่');
  if(state.hasDrawnThisTurn) throw new Error('คุณจั่วไพ่ในเทิร์นนี้แล้ว');
  draw(state,playerId,2);state.hasDrawnThisTurn=true;
  const player=state.players.find(p=>p.id===playerId)!;state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'turn-draw',actorId:player.id,message:`${player.username} จั่วไพ่ 2 ใบ`});
}
export function discardForHandLimit(state:GameState, playerId:string, cardIds:string[]){
  if(state.phase!=='playing'||state.currentPlayerId!==playerId||state.pendingAction) throw new Error('You cannot discard now');
  if(!state.hasDrawnThisTurn) throw new Error('ต้องจั่วไพ่ก่อนทิ้งไพ่');
  const player=state.players.find(p=>p.id===playerId); if(!player||player.hp===undefined) throw new Error('Unknown player');
  const required=Math.max(0,player.hand.length-player.hp), unique=[...new Set(cardIds)];
  if(required===0) throw new Error('You do not need to discard cards');
  if(unique.length!==required) throw new Error(`You must discard exactly ${required} card(s)`);
  const selected=player.hand.filter(card=>unique.includes(card.id)); if(selected.length!==required) throw new Error('A selected card is not in your hand');
  player.hand=player.hand.filter(card=>!unique.includes(card.id));state.discard.push(...selected);state.lastPlayedCard=selected.at(-1);
  state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'hand-limit-discard',actorId:player.id,message:`${player.username} ทิ้งไพ่ ${selected.length} ใบเพื่อให้จำนวนไพ่บนมือไม่เกินพลังชีวิต`});
  synchronizeGameState(state);
}
export function createPublicGameState(state:GameState, viewerId:string):PublicGameState {
  synchronizeGameState(state);
  const allCharactersChosen=state.players.every(p=>p.confirmedCharacter);
  const { drawPile, deck, responseWindow, players, ...publicState }=state;
  const publicResponseWindow=responseWindow?{...responseWindow,responses:responseWindow.responses.map(({cardInstanceId:_cardInstanceId,...response})=>response)}:null;
  return {...publicState, deck:{length:deck.length}, drawPileCount:drawPile.length, responseWindow:publicResponseWindow, viewerId, isSpectator:state.spectators.some(s=>s.id===viewerId), players: players.map(p=>({...p,
    role:p.id===viewerId||p.roleRevealed?p.role:undefined,
    character:p.id===viewerId||p.role==='emperor'||allCharactersChosen?p.character:undefined,
    characterOptions:p.id===viewerId?p.characterOptions:[],
    hand:p.id===viewerId?p.hand.map(card=>({id:card.id,name:card.name,type:card.type,cardType:card.cardType,suit:card.suit,number:card.number,image:card.image,description:card.description,effect:card.effect,equipmentSlot:card.equipmentSlot})):[], handCount:p.hand.length
  }))};
}
/** @deprecated Use createPublicGameState for new server code. */
export const publicState=createPublicGameState;
