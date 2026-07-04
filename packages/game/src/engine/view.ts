// Viewer-safe public state projection. Extracted verbatim from index.ts.
import type { Card, Character, GameState, Player, ResponseRecord, ResponseWindow } from './types.js';
import { synchronizeGameState } from './state.js';
export type PublicCardView = Pick<Card,'id'|'name'|'type'|'cardType'|'suit'|'number'|'image'|'description'|'effect'|'equipmentSlot'>;
export const publicCardView=(card:Card):PublicCardView=>({id:card.id,name:card.name,type:card.type,cardType:card.cardType,suit:card.suit,number:card.number,image:card.image,description:card.description,effect:card.effect,equipmentSlot:card.equipmentSlot});
export type PublicPlayerState = Omit<Player,'hand'|'characterOptions'> & { hand:PublicCardView[]; handCount:number; characterOptions:Character[] };
export type PublicResponseRecord = Omit<ResponseRecord,'cardInstanceId'>;
export type PublicResponseWindow = Omit<ResponseWindow,'responses'> & { responses:PublicResponseRecord[] };
export type PublicGameState = Omit<GameState,'players'|'deck'|'drawPile'|'responseWindow'> & { viewerId:string; isSpectator:boolean; deck:{length:number}; drawPileCount:number; responseWindow:PublicResponseWindow|null; players:PublicPlayerState[] };
export function createPublicGameState(state:GameState, viewerId:string):PublicGameState {
  synchronizeGameState(state);
  const allCharactersChosen=state.players.every(p=>p.confirmedCharacter);
  const { drawPile, deck, responseWindow, players, pendingPeek, pendingHarvest, pendingLegacy, ...publicState }=state;
  const publicPendingLegacy=pendingLegacy?(pendingLegacy.ownerId===viewerId?pendingLegacy:{ownerId:pendingLegacy.ownerId,cards:[]}):undefined; // คำสั่งเสีย: only กุยแก sees the revealed cards
  const publicResponseWindow=responseWindow?{...responseWindow,responses:responseWindow.responses.map(({cardInstanceId:_cardInstanceId,...response})=>response)}:null;
  const publicPendingPeek=pendingPeek?(pendingPeek.playerId===viewerId?pendingPeek:{playerId:pendingPeek.playerId,cards:[]}):undefined; // peeked cards only visible to จูกัดเหลียง
  // เก็บเกี่ยวยุ้งฉาง: only the current picker sees the remaining cards; others see face-down placeholders.
  const publicPendingHarvest=pendingHarvest?(responseWindow?.currentResponderId===viewerId?pendingHarvest:{...pendingHarvest,revealed:pendingHarvest.revealed.map(c=>({id:c.id,name:'ไพ่ปิด',type:c.type,cardType:c.cardType,suit:'?',number:'',image:null,description:null,effect:'hidden_harvest',equipmentSlot:null} as unknown as Card))}):undefined;
  const pub={...publicState, pendingPeek:publicPendingPeek, pendingHarvest:publicPendingHarvest, pendingLegacy:publicPendingLegacy, deck:{length:deck.length}, drawPileCount:drawPile.length, responseWindow:publicResponseWindow, viewerId, isSpectator:state.spectators.some(s=>s.id===viewerId), players: players.map(p=>({...p,
    role:p.id===viewerId||p.roleRevealed||p.role==='emperor'?p.role:undefined,
    character:p.id===viewerId||p.role==='emperor'||allCharactersChosen?p.character:undefined,
    characterOptions:p.id===viewerId?p.characterOptions:[],
    hand:p.id===viewerId?p.hand.map(card=>({id:card.id,name:card.name,oldName:card.oldName??null,type:card.type,cardType:card.cardType,suit:card.suit,number:card.number,image:card.image,description:card.description,effect:card.effect,equipmentSlot:card.equipmentSlot,...(card.cardType==='weapon'&&card.effectParams?.range?{effectParams:{range:card.effectParams.range}}:{})})):[], handCount:p.hand.length
  }))};
  return state.cardNameVersion==='classic'?applyClassicCardNames(pub):pub;
}
/** Classic view: deep-swap every card's display name to its old name. Any object
 *  carrying both `name` and `oldName` is treated as a card; a truthy oldName
 *  replaces name (empty/null oldName falls back to the modern name). Clones first
 *  so the engine's canonical (modern) state is never mutated. */
function applyClassicCardNames<T>(view:T):T {
  const clone=JSON.parse(JSON.stringify(view));
  const walk=(v:unknown):void=>{
    if(Array.isArray(v)){for(const item of v)walk(item);return;}
    if(v&&typeof v==='object'){
      const o=v as Record<string,unknown>;
      if(typeof o.name==='string'&&'oldName'in o&&o.oldName)o.name=o.oldName as string;
      for(const k in o)if(k!=='oldName')walk(o[k]);
    }
  };
  walk(clone);
  return clone as T;
}
/** @deprecated Use createPublicGameState for new server code. */
export const publicState=createPublicGameState;
