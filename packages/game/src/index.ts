export type Role = 'emperor' | 'rebel' | 'loyalist' | 'traitor';
export type Card = { id:string; name:string; type:string; suit:string; number:string; image:string|null; description:string|null; effect:string|null; conditions:unknown };
export type Character = { id:string; name:string; hp:number; faction:string; skills: { name:string; description:string }[]; image?:string };
export type Player = { id:string; username:string; role?:Role; character?:Character; characterOptions:Character[]; hand:Card[]; equipment:Card[]; ready:boolean; confirmedCharacter:boolean; alive:boolean; hp?:number; maxHp?:number };
export type GamePhase = 'waiting'|'role-vote'|'character-select'|'direction-select'|'playing'|'ended';
export type PendingAction = { id:string; kind:'attack'; actorId:string; targetId:string; cardId:string };
export type GameState = { id:string; phase:GamePhase; players:Player[]; deck:Card[]; discard:Card[]; direction:1|-1; currentPlayerId?:string; log:GameLog[]; pendingRoleComposition?: Record<Role,number>; pendingAction?:PendingAction; attacksThisTurn:number };
export type GameLog = { id:string; at:string; type:string; actorId?:string; targetId?:string; cardId?:string; message:string };
export const shuffled = <T>(items:T[]) => [...items].sort(() => Math.random() - .5);
export function createGame(id:string, players:Pick<Player,'id'|'username'>[], cards:Card[]):GameState {
  return { id, phase:'waiting', players:players.map(p=>({...p, characterOptions:[],hand:[],equipment:[],ready:false,confirmedCharacter:false,alive:true})), deck:shuffled(cards), discard:[], direction:1, log:[], attacksThisTurn:0 };
}
export type RoleComposition=Record<Role,number>;
export function dealRoles(state:GameState, composition:RoleComposition){
  if(state.phase!=='waiting') throw new Error('Roles can only be dealt from the waiting room');
  const roles=shuffled((Object.entries(composition) as [Role,number][]).flatMap(([role,count])=>Array.from({length:count},()=>role)));
  if(roles.length!==state.players.length||composition.emperor!==1) throw new Error('Invalid role composition');
  state.players.forEach((player,index)=>{player.role=roles[index]}); state.phase='character-select';
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
  state.direction=-1; state.currentPlayerId=state.players.find(p=>p.role==='emperor')?.id; state.phase='playing';
  state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'game-started',message:'Characters revealed; emperor takes the first turn counterclockwise.'});
}
export function draw(state:GameState, playerId:string, count=1) {
  const player = state.players.find(p=>p.id===playerId); if (!player) throw new Error('Unknown player');
  for(let i=0;i<count;i++) { if(!state.deck.length && state.discard.length) state.deck=shuffled(state.discard.splice(0)); const card=state.deck.pop(); if(card) player.hand.push(card); }
}
export function playCard(state:GameState, actorId:string, cardId:string, targetId?:string) {
  if(state.phase!=='playing' || state.currentPlayerId!==actorId) throw new Error('It is not your turn');
  if(state.pendingAction) throw new Error('Resolve the pending response first');
  const actor=state.players.find(p=>p.id===actorId); if(!actor) throw new Error('Unknown player');
  const card=actor.hand.find(c=>c.id===cardId); if(!card) throw new Error('Card is not in your hand');
  actor.hand=actor.hand.filter(c=>c.id!==cardId);
  const target=targetId?state.players.find(p=>p.id===targetId):actor;
  if(card.effect==='attack'){
    if(!targetId||!target||targetId===actorId||!target.alive) throw new Error('Choose a living opponent to attack');
    if(state.attacksThisTurn>=1) throw new Error('You may only use one attack per turn');
    state.attacksThisTurn++; state.discard.push(card);
    state.pendingAction={id:crypto.randomUUID(),kind:'attack',actorId,targetId,cardId};
    state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'attack-pending',actorId,targetId,cardId,message:`${actor.username} attacks ${target.username}; waiting for dodge.`}); return;
  }
  if(card.effect==='heal'){
    if(!target||!target.alive||target.hp===undefined||target.maxHp===undefined||target.hp>=target.maxHp) throw new Error('Choose a living wounded player');
    target.hp=Math.min(target.maxHp,target.hp+1); state.discard.push(card);
    state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'healed',actorId,targetId:target.id,cardId,message:`${actor.username} heals ${target.username}.`}); return;
  }
  if(card.effect==='dodge') throw new Error('Dodge can only be used in response to an attack');
  if(card.type.includes('อุปกรณ์')) actor.equipment.push(card); else state.discard.push(card);
  state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'card-played',actorId,targetId,cardId,message:`${actor.username} played ${card.name}`});
}
export function respondToAttack(state:GameState, responderId:string, cardId?:string){
  const pending=state.pendingAction; if(!pending||pending.kind!=='attack') throw new Error('There is no attack to respond to');
  if(pending.targetId!==responderId) throw new Error('Only the attack target may respond');
  const target=state.players.find(p=>p.id===responderId)!, attacker=state.players.find(p=>p.id===pending.actorId)!;
  const dodge=cardId?target.hand.find(c=>c.id===cardId&&c.effect==='dodge'):undefined;
  if(dodge){target.hand=target.hand.filter(c=>c.id!==dodge.id);state.discard.push(dodge);state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'attack-dodged',actorId:attacker.id,targetId:target.id,cardId:dodge.id,message:`${target.username} dodges ${attacker.username}'s attack.`});}
  else { if(target.hp===undefined) throw new Error('Target has no HP'); target.hp--; state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'damage',actorId:attacker.id,targetId:target.id,cardId:pending.cardId,message:`${target.username} takes 1 damage.`}); if(target.hp<=0) state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'dying',targetId:target.id,message:`${target.username} is dying; healing response is pending manual confirmation.`}); }
  state.pendingAction=undefined;
}
export function endTurn(state:GameState, playerId:string){
  if(state.phase!=='playing'||state.currentPlayerId!==playerId||state.pendingAction) throw new Error('Cannot end this turn');
  const current=state.players.findIndex(p=>p.id===playerId); for(let step=1;step<=state.players.length;step++){const next=state.players[(current+step*state.direction+state.players.length*10)%state.players.length];if(next.alive){state.currentPlayerId=next.id;state.attacksThisTurn=0;draw(state,next.id,2);return;}}
}
export function publicState(state:GameState, viewerId:string) {
  const allCharactersChosen=state.players.every(p=>p.confirmedCharacter);
  return {...state, viewerId, players: state.players.map(p=>({...p,
    role:p.id===viewerId||p.role==='emperor'?p.role:undefined,
    character:p.id===viewerId||p.role==='emperor'||allCharactersChosen?p.character:undefined,
    characterOptions:p.id===viewerId?p.characterOptions:[],
    hand:p.id===viewerId?p.hand:[], handCount:p.hand.length
  }))};
}
