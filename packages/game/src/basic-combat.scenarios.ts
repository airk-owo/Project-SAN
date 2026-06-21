import { canTargetWithAttack, createGame, createPublicGameState, createSeatedPlayer, declineResponse, drawCards, endTurn, getBaseDistanceBetweenPlayers, playAttack, playDodge, playEquipment, playHeal, respondToAttack, startTurn, type Card, type Character, type GameState, type Spectator } from './index.js';

const now='2026-01-01T00:00:00.000Z';
const character=(id:string,name:string):Character=>({id,name,hp:4,faction:'test',skills:[]});
const card=(id:string,effect:'attack'|'dodge'|'heal'):Card=>({id,name:effect,type:'basic',cardType:'basic',suit:'♥',number:'7',image:null,description:null,effect,effectParams:{damage:1,heal_amount:1},triggerTiming:'on_play',equipmentSlot:null,createsResponseWindow:effect==='attack',conditions:null});
const equipmentCard=(id:string,cardType:'weapon'|'armor'|'offensive_mount'|'defensive_mount'):Card=>({id,name:id,type:'equipment',cardType,suit:'♠',number:'A',image:null,description:null,effect:null,effectParams:{},triggerTiming:'passive',equipmentSlot:cardType,createsResponseWindow:false,conditions:null});
const member=(id:string,username:string):Spectator=>({id,username,connectionStatus:'online',joinedAt:now,lastSeenAt:now});
const expect=(condition:unknown,message:string)=>{if(!condition)throw new Error(message)};
const expectThrows=(operation:()=>void,message:string)=>{try{operation()}catch{return}throw new Error(message)};

function combatState():GameState {
  const state=createGame('combat-test',member('a','attacker'),[]);
  const attacker=createSeatedPlayer(member('a','attacker'),1),target=createSeatedPlayer(member('b','target'),2);
  attacker.character=character('cao-cao','โจโฉ'); attacker.hp=attacker.maxHp=4; target.character=character('liu-bei','เล่าปี่'); target.hp=target.maxHp=4;
  state.players=[attacker,target]; state.phase='playing'; state.currentPlayerId=attacker.id; state.hasDrawnThisTurn=true; state.turn={activePlayerId:attacker.id,phase:'play',direction:'clockwise',turnNumber:1,attackUsedThisTurn:0};
  return state;
}

export function scenarioAttackDodge(){
  const state=combatState(),attacker=state.players[0],target=state.players[1]; attacker.hand=[card('attack-1','attack')];target.hand=[card('dodge-1','dodge')];
  playAttack(state,attacker.id,target.id,'attack-1'); expect(state.currentAction?.effectKey==='attack','attack should stay in CurrentAction'); expect(state.discard.length===0,'attack should not discard before response');
  playDodge(state,target.id,'dodge-1'); expect(target.hp===4,'dodge should prevent damage'); expect(state.currentAction===null,'action should resolve'); expect(state.discard.length===2,'attack and dodge should discard after resolution');
}

export function scenarioAttackNoDodge(){
  const state=combatState(),attacker=state.players[0],target=state.players[1]; attacker.hand=[card('attack-2','attack')];
  playAttack(state,attacker.id,target.id,'attack-2'); respondToAttack(state,target.id); expect(target.hp===3,'declining dodge should deal one damage'); expect(state.discard.length===1,'resolved attack should discard');
}

export function scenarioHeal(){
  const state=combatState(),attacker=state.players[0]; attacker.hp=3; attacker.hand=[card('heal-1','heal')];
  playHeal(state,attacker.id,'heal-1'); expect(attacker.hp===4,'heal should restore one HP without exceeding max HP'); expect(state.discard.length===1,'heal should discard after use');attacker.hand=[card('heal-2','heal')];expectThrows(()=>playHeal(state,attacker.id,'heal-2'),'full HP player should not use normal Heal');
}

export function scenarioTurnCycle(){
  const state=combatState(),attacker=state.players[0],target=state.players[1]; state.deck=[card('draw-1','attack'),card('draw-2','dodge')];
  startTurn(state,attacker.id); expect(state.turn.phase==='draw','turn should start in draw phase'); expect(drawCards(state,attacker.id,2)===2,'draw phase should draw two cards'); expect(state.turn.phase==='play','drawing should enter play phase');
  endTurn(state,attacker.id); expect(state.turn.activePlayerId===target.id,'ending turn should advance to next alive player'); expect(state.turn.phase==='draw','next player should begin in draw phase');
}

function drawState(){const state=combatState(),player=state.players[0];player.hand=[];state.turn={activePlayerId:player.id,phase:'draw',direction:'clockwise',turnNumber:1,attackUsedThisTurn:0};state.hasDrawnThisTurn=false;return {state,player};}
export function scenarioDrawPileReshuffle(){
  {const {state,player}=drawState();state.deck=[card('enough-1','attack'),card('enough-2','dodge')];expect(drawCards(state,player.id,2)===2,'draw pile with enough cards should draw requested amount');expect(player.hand.length===2,'drawn cards should enter hand');}
  {const {state,player}=drawState();const olderA=card('older-a','attack'),olderB=card('older-b','dodge'),top=card('top-discard','heal');state.deck=[card('last-draw','attack')];state.discard=[olderA,olderB,top];expect(drawCards(state,player.id,2)===2,'low draw pile should reshuffle and continue drawing');expect(state.discard.length===1&&state.discard[0]===top,'top discard should remain visible after reshuffle');expect(state.log.some(log=>log.type==='draw-pile-reshuffled'),'reshuffle should be logged');}
  {const {state,player}=drawState();const older=card('discard-only','attack'),top=card('discard-top','dodge');state.deck=[];state.discard=[older,top];expect(drawCards(state,player.id,2)===1,'empty draw pile should draw available recycled cards');expect(state.discard.length===1&&state.discard[0]===top,'discard top should remain when recycling');}
  {const {state,player}=drawState();state.deck=[];state.discard=[];expect(drawCards(state,player.id,2)===0,'empty piles should not crash');expect(state.log.some(log=>log.type==='draw-pile-empty'),'empty piles should be logged');}
}

function distanceState(){
  const state=createGame('distance-test',member('a','a'),[]); state.phase='playing';
  state.players=['a','b','c','d'].map((id,index)=>{const player=createSeatedPlayer(member(id,id),index+1);player.alive=true;player.hp=player.maxHp=4;return player;});
  state.currentPlayerId='a';state.turn={activePlayerId:'a',phase:'play',direction:'clockwise',turnNumber:1,attackUsedThisTurn:0};state.hasDrawnThisTurn=true;return state;
}

export function scenarioDistance(){
  const state=distanceState(); expect(getBaseDistanceBetweenPlayers(state,'a','b')===1,'adjacent players should be distance one'); expect(getBaseDistanceBetweenPlayers(state,'a','c')===2,'opposite players should be distance two'); expect(getBaseDistanceBetweenPlayers(state,'a','d')===1,'the shorter circular route should be used');
  expect(canTargetWithAttack(state,'a','b'),'attack should reach distance one'); expect(!canTargetWithAttack(state,'a','c'),'attack should not reach distance two'); state.players.find(player=>player.id==='b')!.alive=false; expect(getBaseDistanceBetweenPlayers(state,'a','c')===1,'dead players should not count for distance');
}

export function scenarioEquipmentSlots(){
  const state=combatState(),player=state.players[0],target=state.players[1],oldWeapon=equipmentCard('old-weapon','weapon'),newWeapon=equipmentCard('new-weapon','weapon'),armor=equipmentCard('armor','armor'),offensiveMount=equipmentCard('offensive-mount','offensive_mount'),defensiveMount=equipmentCard('defensive-mount','defensive_mount');
  player.hand=[oldWeapon];playEquipment(state,player.id,oldWeapon.id);expect(player.equipment.weapon?.id===oldWeapon.id,'weapon should equip from hand');
  player.hand=[newWeapon];playEquipment(state,player.id,newWeapon.id);expect(player.equipment.weapon?.id===newWeapon.id,'new weapon should replace old weapon');expect(state.discard.some(card=>card.id===oldWeapon.id),'replaced weapon should discard');
  player.hand=[armor,offensiveMount,defensiveMount];playEquipment(state,player.id,armor.id);playEquipment(state,player.id,offensiveMount.id);playEquipment(state,player.id,defensiveMount.id);expect(player.equipment.armor?.id===armor.id,'armor should equip');expect(player.equipment.offensiveMount?.id===offensiveMount.id,'offensive mount should equip');expect(player.equipment.defensiveMount?.id===defensiveMount.id,'defensive mount should equip');
  const phaseCard=equipmentCard('phase-weapon','weapon');player.hand=[phaseCard];state.turn.phase='draw';expectThrows(()=>playEquipment(state,player.id,phaseCard.id),'equipment should not play outside play phase');state.turn.phase='play';
  const attack=card('equipment-window-attack','attack'),windowCard=equipmentCard('window-armor','armor');player.hand=[attack,windowCard];playAttack(state,player.id,target.id,attack.id);expectThrows(()=>playEquipment(state,player.id,windowCard.id),'equipment should not play during a response window');
}

export function scenarioDyingRescue(){
  const state=combatState(),attacker=state.players[0],target=state.players[1],attack=card('dying-attack','attack'),heal=card('dying-heal','heal');target.hp=1;attacker.hand=[attack];target.hand=[heal];
  playAttack(state,attacker.id,target.id,attack.id);respondToAttack(state,target.id);expect(target.hp===0&&target.alive,'zero HP should enter dying while remaining alive');expect(state.responseWindow?.type==='dying_heal','damage at zero HP should open dying rescue');
  playHeal(state,target.id,heal.id);expect(target.hp===1&&target.alive,'Heal should rescue a dying player');expect(state.responseWindow===null,'rescue should close the response window');
}

export function scenarioDyingDeath(){
  const state=combatState(),attacker=state.players[0],target=state.players[1],attack=card('death-attack','attack');target.hp=1;attacker.hand=[attack];
  playAttack(state,attacker.id,target.id,attack.id);respondToAttack(state,target.id);expect(state.responseWindow?.currentResponderId===target.id,'dying player should respond first');declineResponse(state,target.id);expect(state.responseWindow?.currentResponderId===attacker.id,'next alive player should respond in seat order');declineResponse(state,attacker.id);expect(!target.alive,'all rescue declines should kill the dying player');expect(state.responseWindow===null,'failed rescue should close the response window');
}

export function scenarioPublicStatePrivacy(){
  const state=combatState(),owner=state.players[0],other=state.players[1],ownCard=card('private-own','attack'),otherCard=card('private-other','dodge'),discard=card('public-discard','heal');
  owner.hand=[ownCard];other.hand=[otherCard];owner.role='emperor';owner.roleRevealed=true;other.role='traitor';other.roleRevealed=false;state.deck=[card('private-draw','attack')];state.discard=[discard];state.spectators.push(member('spectator','watcher'));
  state.responseWindow={windowId:'privacy-window',type:'attack_dodge',sourceActionId:'privacy-action',requiredPlayerIds:[other.id],currentResponderId:other.id,allowedResponseEffectKeys:['dodge'],responses:[{playerId:other.id,response:'card',cardInstanceId:'private-response-card',createdAt:now}],status:'open',createdAt:now};
  const ownerView=createPublicGameState(state,owner.id),otherInOwnerView=ownerView.players.find(player=>player.id===other.id)!;expect(ownerView.players.find(player=>player.id===owner.id)!.hand[0]?.id===ownCard.id,'owner should see own hand');expect(otherInOwnerView.hand.length===0&&otherInOwnerView.handCount===1,'owner should not see another hand');expect(otherInOwnerView.role===undefined,'hidden role should not be visible');expect(!('drawPile' in ownerView)&&ownerView.drawPileCount===1,'draw pile identities should not be public');expect(ownerView.discardPile[0]?.definitionKey===discard.id,'discard pile should remain public');expect(!('cardInstanceId' in ownerView.responseWindow!.responses[0]!),'response records should not reveal cards');
  other.roleRevealed=true;const revealedView=createPublicGameState(state,owner.id);expect(revealedView.players.find(player=>player.id===other.id)!.role==='traitor','revealed role should be public');
  const spectatorView=createPublicGameState(state,'spectator');expect(spectatorView.isSpectator,'viewer should be marked spectator');expect(spectatorView.players.every(player=>player.hand.length===0),'spectator should not see any hands');
}

export function runBasicCombatScenarios(){scenarioAttackDodge();scenarioAttackNoDodge();scenarioHeal();scenarioTurnCycle();scenarioDrawPileReshuffle();scenarioDistance();scenarioEquipmentSlots();scenarioDyingRescue();scenarioDyingDeath();scenarioPublicStatePrivacy();}
