import { canTargetWithAttack, createGame, createPublicGameState, createSeatedPlayer, declineResponse, drawCards, endTurn, getAttackRange, getBaseDistanceBetweenPlayers, getEffectiveDistanceBetweenPlayers, playAttack, playDiscardTargetCard, playDodge, playDrawCardsTrick, playEquipment, playHeal, playHealAllLiving, playStealTargetCard, resolveHiddenHandCard, resolvePlayerDeath, respondToAttack, startTurn, type Card, type Character, type GameState, type Spectator } from './index.js';

const now='2026-01-01T00:00:00.000Z';
const character=(id:string,name:string):Character=>({id,name,hp:4,faction:'test',skills:[]});
const card=(id:string,effect:'attack'|'dodge'|'heal'):Card=>({id,name:effect,type:'basic',cardType:'basic',suit:'♥',number:'7',image:null,description:null,effect,effectParams:{damage:1,heal_amount:1},triggerTiming:'on_play',equipmentSlot:null,createsResponseWindow:effect==='attack',conditions:null});
const equipmentCard=(id:string,cardType:'weapon'|'armor'|'offensive_mount'|'defensive_mount',effectParams:Record<string,unknown>={}):Card=>({id,name:id,type:'equipment',cardType,suit:'♠',number:'A',image:null,description:null,effect:null,effectParams,triggerTiming:'passive',equipmentSlot:cardType,createsResponseWindow:false,conditions:null});
const discardTargetCard=(id:string):Card=>({id,name:'discard target',type:'trick',cardType:'instant_trick',suit:'♣',number:'3',image:null,description:null,effect:'discard_target_card',effectParams:{amount:1},triggerTiming:'on_play',equipmentSlot:null,createsResponseWindow:false,conditions:null});
const stealTargetCard=(id:string):Card=>({id,name:'steal target',type:'trick',cardType:'instant_trick',suit:'♠',number:'4',image:null,description:null,effect:'steal_target_card_in_range',effectParams:{range:1},triggerTiming:'on_play',equipmentSlot:null,createsResponseWindow:false,conditions:null});
const immediateTrick=(id:string,effect:'draw_cards'|'heal_all_living',effectParams:Record<string,unknown>={}):Card=>({id,name:effect,type:'trick',cardType:'instant_trick',suit:'♥',number:'A',image:null,description:null,effect,effectParams,triggerTiming:'on_play',equipmentSlot:null,createsResponseWindow:false,conditions:null});
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

export function scenarioImmediateTricks(){
  {const state=combatState(),actor=state.players[0]!,trick=immediateTrick('draw-three','draw_cards',{amount:3});actor.hand=[trick];state.deck=[card('draw-1','attack'),card('draw-2','dodge'),card('draw-3','heal')];expect(playDrawCardsTrick(state,actor.id,trick.id)===3,'draw_cards should use configured amount');expect(actor.hand.length===3,'drawn cards should enter the actor hand');expect(state.discard.some(card=>card.id===trick.id),'draw trick should discard after resolving');}
  {const state=combatState(),actor=state.players[0]!,trick=immediateTrick('draw-default','draw_cards');actor.hand=[trick];state.deck=[card('default-1','attack'),card('default-2','dodge')];expect(playDrawCardsTrick(state,actor.id,trick.id)===2,'draw_cards should default to two');}
  {const state=distanceState(),actor=state.players[0]!,target=state.players[1]!,dead=state.players[2]!,trick=immediateTrick('heal-all','heal_all_living');actor.hp=3;target.hp=target.maxHp=4;dead.hp=1;dead.alive=false;actor.hand=[trick];expect(playHealAllLiving(state,actor.id,trick.id)===1,'heal_all_living should count only injured living players');expect(actor.hp===4,'heal_all_living should restore living players');expect(target.hp===4,'heal_all_living should not exceed maximum HP');expect(dead.hp===1,'heal_all_living should not heal dead players');expect(state.discard.some(card=>card.id===trick.id),'heal-all trick should discard after resolving');}
  {const state=combatState(),actor=state.players[0]!,trick=immediateTrick('wrong-phase','draw_cards');actor.hand=[trick];state.turn.phase='draw';expectThrows(()=>playDrawCardsTrick(state,actor.id,trick.id),'immediate tricks should fail outside play phase');state.turn.phase='play';state.responseWindow={windowId:'test-window',type:'attack_dodge',sourceActionId:'test-action',requiredPlayerIds:[actor.id],currentResponderId:actor.id,allowedResponseEffectKeys:['dodge'],responses:[],status:'open',createdAt:now};expectThrows(()=>playDrawCardsTrick(state,actor.id,trick.id),'immediate tricks should fail during a response window');}
}

export function scenarioHiddenHandSelection(){
  const hiddenHand=()=>[card('hidden-first','attack'),card('hidden-middle','dodge'),card('hidden-last','heal')];
  {const state=combatState(),target=state.players[1]!;target.hand=hiddenHand();expect(resolveHiddenHandCard(state,{targetPlayerId:target.id,handIndex:0}).id==='hidden-first','hidden selection should resolve the first hand position');}
  {const state=combatState(),target=state.players[1]!;target.hand=hiddenHand();expect(resolveHiddenHandCard(state,{targetPlayerId:target.id,handIndex:1}).id==='hidden-middle','hidden selection should resolve the middle hand position');}
  {const state=combatState(),target=state.players[1]!;target.hand=hiddenHand();expect(resolveHiddenHandCard(state,{targetPlayerId:target.id,handIndex:2}).id==='hidden-last','hidden selection should resolve the last hand position');expectThrows(()=>resolveHiddenHandCard(state,{targetPlayerId:target.id,handIndex:9}),'invalid hidden-hand index should be rejected');}
  {const state=combatState(),actor=state.players[0]!,target=state.players[1]!,trick=stealTargetCard('hidden-steal'),hidden=card('stolen-hidden','heal');actor.hand=[trick];target.hand=[card('other-hidden','attack'),hidden];playStealTargetCard(state,actor.id,target.id,{zone:'hand',handIndex:1},trick.id);expect(actor.hand.some(card=>card.id===hidden.id),'steal should transfer the selected hidden card');expect(!target.hand.some(card=>card.id===hidden.id),'steal should remove the selected hidden card from its owner');expect(state.log.at(-1)?.message.includes(hidden.name)===false,'hidden steal log should not reveal card name');}
  {const state=combatState(),actor=state.players[0]!,target=state.players[1]!,trick=discardTargetCard('hidden-discard'),hidden=card('discarded-hidden','dodge');actor.hand=[trick];target.hand=[hidden];playDiscardTargetCard(state,actor.id,target.id,trick.id,{zone:'hand',handIndex:0});expect(state.discard.some(card=>card.id===hidden.id),'dismantle should discard the selected hidden card');expect(state.log.at(-1)?.message.includes(hidden.name)===false,'hidden dismantle log should not reveal card name');const view=createPublicGameState(state,actor.id);expect(view.players.find(player=>player.id===target.id)!.hand.length===0,'public state should continue hiding target hand identities');}
}

export function scenarioDeathConsequences(){
  {const state=distanceState(),killer=state.players[0]!,dead=state.players[1]!;killer.role='loyalist';dead.role='rebel';dead.hand=[card('dead-hand','attack')];dead.equipment.weapon=equipmentCard('dead-weapon','weapon');dead.decisionArea=[card('dead-decision','dodge')];state.deck=[card('reward-1','attack'),card('reward-2','dodge'),card('reward-3','heal')];resolvePlayerDeath(state,dead.id,killer.id);expect(!dead.alive&&dead.roleRevealed,'death should mark player dead and reveal role');expect(dead.hand.length===0&&!dead.equipment.weapon&&dead.decisionArea.length===0,'death should clear hand equipment and decision area');expect(killer.hand.length===3,'killing a rebel should draw three cards');expect(state.discard.some(card=>card.id==='dead-hand')&&state.discard.some(card=>card.id==='dead-weapon')&&state.discard.some(card=>card.id==='dead-decision'),'death cleanup should discard every zone');}
  {const state=distanceState(),emperor=state.players[0]!,loyalist=state.players[1]!;emperor.role='emperor';loyalist.role='loyalist';state.players[2]!.role='rebel';emperor.hand=[card('emperor-hand','attack')];emperor.equipment.weapon=equipmentCard('emperor-weapon','weapon');resolvePlayerDeath(state,loyalist.id,emperor.id);expect(emperor.hand.length===0&&!emperor.equipment.weapon,'emperor killing loyalist should discard hand and equipment');}
  {const state=distanceState(),dead=state.players[1]!,other=state.players[0]!;dead.role='rebel';other.hand=[card('no-killer-hand','attack')];state.deck=[card('unused-reward','heal')];resolvePlayerDeath(state,dead.id);expect(other.hand.length===1,'death without a killer should grant no reward');}
  {const state=distanceState(),emperor=state.players[0]!;emperor.role='emperor';state.players[1]!.role='traitor';state.players[2]!.alive=false;state.players[3]!.alive=false;resolvePlayerDeath(state,emperor.id,'b');expect(state.winner==='traitor'&&state.status==='finished','emperor death with only traitor alive should give traitor win');}
  {const state=distanceState(),emperor=state.players[0]!;emperor.role='emperor';state.players[1]!.role='rebel';state.players[2]!.role='loyalist';resolvePlayerDeath(state,emperor.id,'b');expect(state.winner==='rebels','emperor death with non-traitor survivors should give rebels win');}
  {const state=distanceState(),emperor=state.players[0]!,rebel=state.players[1]!,loyalist=state.players[2]!;emperor.role='emperor';rebel.role='rebel';loyalist.role='loyalist';resolvePlayerDeath(state,rebel.id,emperor.id);expect(state.winner==='emperor_loyalists'&&state.status==='finished','eliminating all rebels and traitors should give emperor side win');}
  {const state=distanceState(),active=state.players[0]!,next=state.players[1]!;active.role='rebel';next.role='emperor';state.players[2]!.role='traitor';resolvePlayerDeath(state,active.id,next.id);expect(state.turn.activePlayerId===next.id,'active player death should safely advance to the next alive player');}
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

export function scenarioDistanceModifiers(){
  const rangeState=createGame('range-test',member('a','a'),[]);rangeState.phase='playing';rangeState.players=['a','b','c','d','e','f'].map((id,index)=>{const player=createSeatedPlayer(member(id,id),index+1);player.alive=true;player.hp=player.maxHp=4;return player;});rangeState.currentPlayerId='a';rangeState.turn={activePlayerId:'a',phase:'play',direction:'clockwise',turnNumber:1,attackUsedThisTurn:0};rangeState.hasDrawnThisTurn=true;
  const rangeActor=rangeState.players[0]!,rangeThreeTarget=rangeState.players[3]!;
  expect(getAttackRange(rangeState,rangeActor.id)===1,'attack range should default to one');
  rangeActor.equipment.weapon=equipmentCard('range-three','weapon',{range:3});
  expect(getAttackRange(rangeState,rangeActor.id)===3,'weapon range should come from effect params');
  expect(getEffectiveDistanceBetweenPlayers(rangeState,rangeActor.id,rangeThreeTarget.id)===3,'six seats should provide an effective distance of three');
  expect(canTargetWithAttack(rangeState,rangeActor.id,rangeThreeTarget.id),'weapon range three should reach effective distance three');
  const state=distanceState(),actor=state.players[0]!,adjacent=state.players[1]!,opposite=state.players[2]!;
  actor.equipment.weapon=equipmentCard('range-three-short','weapon',{range:3});
  actor.equipment.offensiveMount=equipmentCard('offensive-mount','offensive_mount');
  expect(getEffectiveDistanceBetweenPlayers(state,actor.id,opposite.id)===1,'offensive mount should reduce outgoing distance by one');
  opposite.equipment.defensiveMount=equipmentCard('defensive-mount','defensive_mount');
  expect(getEffectiveDistanceBetweenPlayers(state,actor.id,opposite.id)===2,'defensive mount should increase incoming distance by one');
  expect(getEffectiveDistanceBetweenPlayers(state,actor.id,adjacent.id)===1,'effective distance should never go below one');
  const steal=stealTargetCard('range-steal');actor.hand=[steal];opposite.equipment.weapon=equipmentCard('steal-target-weapon','weapon');
  expectThrows(()=>playStealTargetCard(state,actor.id,opposite.id,opposite.equipment.weapon!.id,steal.id),'steal should still require effective distance one, not weapon range');
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

export function scenarioTargetedCardFramework(){
  const state=combatState(),actor=state.players[0],target=state.players[1],trick=discardTargetCard('discard-target'),equipped=equipmentCard('target-weapon','weapon');actor.hand=[trick];target.equipment.weapon=equipped;
  playDiscardTargetCard(state,actor.id,target.id,trick.id,equipped.id);expect(target.equipment.weapon===null,'targeted trick should remove the selected equipment');expect(state.discard.some(card=>card.id===equipped.id),'selected target card should discard');expect(state.discard.some(card=>card.id===trick.id),'resolved targeted trick should discard');expect(state.currentAction===null,'targeted action should resolve and clear');
}

export function scenarioStealTargetCard(){
  const state=combatState(),actor=state.players[0],target=state.players[1],trick=stealTargetCard('steal-target'),equipment=equipmentCard('steal-weapon','weapon');actor.hand=[trick];target.equipment.weapon=equipment;
  playStealTargetCard(state,actor.id,target.id,equipment.id,trick.id);expect(target.equipment.weapon===null,'steal should clear target equipment slot');expect(actor.hand.some(card=>card.id===equipment.id),'stolen equipment should move to actor hand');expect(state.discard.some(card=>card.id===trick.id),'steal trick should discard');
  const outOfRange=distanceState(),outActor=outOfRange.players[0]!,outTarget=outOfRange.players[2]!,outTrick=stealTargetCard('out-steal'),outEquipment=equipmentCard('out-weapon','weapon');outActor.hand=[outTrick];outTarget.equipment.weapon=outEquipment;expectThrows(()=>playStealTargetCard(outOfRange,outActor.id,outTarget.id,outEquipment.id,outTrick.id),'steal should fail outside range one');
  const selfState=combatState(),selfActor=selfState.players[0]!,selfTrick=stealTargetCard('self-steal'),selfEquipment=equipmentCard('self-weapon','weapon');selfActor.hand=[selfTrick];selfActor.equipment.weapon=selfEquipment;expectThrows(()=>playStealTargetCard(selfState,selfActor.id,selfActor.id,selfEquipment.id,selfTrick.id),'steal should not target self');
  const phaseState=combatState(),phaseActor=phaseState.players[0]!,phaseTarget=phaseState.players[1]!,phaseTrick=stealTargetCard('phase-steal'),phaseEquipment=equipmentCard('phase-weapon','weapon');phaseActor.hand=[phaseTrick];phaseTarget.equipment.weapon=phaseEquipment;phaseState.turn.phase='draw';expectThrows(()=>playStealTargetCard(phaseState,phaseActor.id,phaseTarget.id,phaseEquipment.id,phaseTrick.id),'steal should fail outside play phase');
  const responseState=combatState(),responseActor=responseState.players[0]!,responseTarget=responseState.players[1]!,attack=card('response-attack','attack'),responseTrick=stealTargetCard('response-steal'),responseEquipment=equipmentCard('response-weapon','weapon');responseActor.hand=[attack,responseTrick];responseTarget.equipment.weapon=responseEquipment;playAttack(responseState,responseActor.id,responseTarget.id,attack.id);expectThrows(()=>playStealTargetCard(responseState,responseActor.id,responseTarget.id,responseEquipment.id,responseTrick.id),'steal should fail during response window');
}

export function runBasicCombatScenarios(){scenarioAttackDodge();scenarioAttackNoDodge();scenarioHeal();scenarioTurnCycle();scenarioDrawPileReshuffle();scenarioImmediateTricks();scenarioHiddenHandSelection();scenarioDistance();scenarioDistanceModifiers();scenarioEquipmentSlots();scenarioDyingRescue();scenarioDyingDeath();scenarioDeathConsequences();scenarioPublicStatePrivacy();scenarioTargetedCardFramework();scenarioStealTargetCard();}
