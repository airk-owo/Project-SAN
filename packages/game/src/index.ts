// Game Router and State Dispatcher. All engine logic lives in ./engine/*;
// this module re-exports the public API and routes card plays / attack responses to handlers.
export * from './engine/types.js';
export * from './engine/state.js';
export * from './engine/actions.js';
export * from './engine/setup.js';
export * from './engine/turns.js';
export * from './engine/view.js';
export * from './engine/handlers/character-skills.js';
export * from './engine/handlers/combat.js';
export * from './engine/handlers/equipment.js';
export * from './engine/handlers/tricks.js';
import type { EffectResolver, EventSubscriber, GameState } from './engine/types.js';
import { characterName, grantDraws, isEquipmentCard, logAction, numberParam } from './engine/state.js';
import { cardActsAs, dispatchGameEvent, hasCharacterSkill } from './engine/handlers/character-skills.js';
import { declineResponse, playAttack, playDodge, playDuel, playHeal } from './engine/handlers/combat.js';
import { playEquipment } from './engine/handlers/equipment.js';
import { playDelayedTrick, playDrawCardsTrick, playHarvest, playHealAllLiving, playMassAttackOrDamage, playMassDodgeOrDamage } from './engine/handlers/tricks.js';
const effectResolvers:Record<string,EffectResolver>={
  attack:({state,actor,card,target,targetId,subscribers=[]})=>{if(!targetId||!target||target.id===actor.id||!target.alive)throw new Error('Choose a living opponent to attack');if(state.attacksThisTurn>=1)throw new Error('You may only use one attack per turn');const event=dispatchGameEvent(state,{name:'before_attack',actorId:actor.id,targetId:target.id,card,amount:numberParam(card,'damage',1)},subscribers);if(event.cancelled)return true;state.attacksThisTurn++;state.discard.push(card);state.pendingAction={id:crypto.randomUUID(),kind:'attack',actorId:actor.id,targetId:target.id,cardId:card.id,responseKey:'dodge',damage:event.amount||1};state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'attack-pending',actorId:actor.id,targetId:target.id,cardId:card.id,message:`${actor.username} ใช้โจมตีใส่ ${target.username} กำลังรอการตอบโต้`});dispatchGameEvent(state,{name:'after_attack',actorId:actor.id,targetId:target.id,card,amount:event.amount},subscribers);return true},
  heal:({state,actor,card,target,subscribers=[]})=>{const recipient=target||actor;if(!recipient.alive||recipient.hp===undefined||recipient.maxHp===undefined)throw new Error('Choose a living player');if(recipient.id===actor.id&&recipient.hp>=recipient.maxHp)throw new Error('You can only heal yourself while wounded');if(recipient.id!==actor.id&&recipient.hp>0)throw new Error('You can only heal another player during a dying window');const amount=numberParam(card,'heal_amount',1),event=dispatchGameEvent(state,{name:'before_heal',actorId:actor.id,targetId:recipient.id,card,amount},subscribers);if(event.cancelled)return true;recipient.hp=Math.min(recipient.maxHp,recipient.hp+(event.amount||amount));state.discard.push(card);state.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'healed',actorId:actor.id,targetId:recipient.id,cardId:card.id,message:`${actor.username} ใช้เสบียงฟื้นฟูพลังชีวิตให้ ${recipient.username}`});dispatchGameEvent(state,{name:'after_heal',actorId:actor.id,targetId:recipient.id,card,amount:event.amount},subscribers);return true}
};
export function playCard(state:GameState, actorId:string, cardId:string, targetId?:string, subscribers:EventSubscriber[]=[]){
  if(state.phase!=='playing'||state.currentPlayerId!==actorId)throw new Error('It is not your turn');if(!state.hasDrawnThisTurn)throw new Error('ต้องจั่วไพ่ก่อนเล่นการ์ด');if(state.pendingAction)throw new Error('Resolve the pending response first');
  const actor=state.players.find(player=>player.id===actorId);if(!actor)throw new Error('Unknown player');const card=actor.hand.find(item=>item.id===cardId);if(!card)throw new Error('Card is not in your hand');const target=targetId?state.players.find(player=>player.id===targetId):undefined;
  if(card.cardType==='instant_trick'&&hasCharacterSkill(state,actorId,'draw_on_instant_trick')){grantDraws(state,actorId,1);logAction(state,'skill-genius',`${characterName(actor)} ใช้ คลังปัญญา ได้สิทธิ์จั่ว 1 ใบ`,actorId);} // หวงเย่อิง คลังปัญญา (ก่อนถูกยกเลิกผล)
  if(card.effect==='attack'||(card.effect==='dodge'&&cardActsAs(state,actorId,card,'attack'))){if(!targetId)throw new Error('Choose a target');return playAttack(state,actorId,targetId,cardId);} // จูล่ง/กวนอู: ใช้ "หลบ"/ไพ่แดง เป็น "โจมตี"
  if(card.effect==='duel_attack_response'){if(!targetId)throw new Error('Choose a target');return playDuel(state,actorId,targetId,cardId);}
  if(card.effect==='all_others_dodge_or_damage')return playMassDodgeOrDamage(state,actorId,cardId);
  if(card.effect==='all_others_attack_or_damage')return playMassAttackOrDamage(state,actorId,cardId);
  if(card.effect==='heal') return playHeal(state,actorId,cardId);
  if(card.effect==='draw_cards') return playDrawCardsTrick(state,actorId,cardId);
  if(card.effect==='heal_all_living') return playHealAllLiving(state,actorId,cardId);
  if(card.effect==='reveal_and_draft_cards') return playHarvest(state,actorId,cardId);
  if(card.effect==='delayed_skip_play_phase'){if(!targetId)throw new Error('Choose a target');return playDelayedTrick(state,actorId,cardId,targetId);}
  if(card.effect==='delayed_lightning_judgment') return playDelayedTrick(state,actorId,cardId,actorId);
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
