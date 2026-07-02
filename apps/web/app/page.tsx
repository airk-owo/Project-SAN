'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {io} from 'socket.io-client';
const socket=io(process.env.NEXT_PUBLIC_SOCKET_URL||'http://localhost:3001',{autoConnect:false});

type Role='emperor'|'loyalist'|'rebel'|'traitor';
type RoleDefinition={role_key:Role;role_th:string;visibility:string;win_condition_th:string;team:string};
type Character={id:string;name:string;hp:number;kingdomTh?:string;skills:{name:string;description:string;condition?:string|null}[]};
type Card={id:string;name:string;type:string;cardType:string;suit:string;number:string;description:string|null;effect:string|null;equipmentSlot:string|null};
type EquipmentSlots={weapon:Card|null;armor:Card|null;offensiveMount:Card|null;defensiveMount:Card|null};
type Player={id:string;username:string;seatIndex:number;connectionStatus:'online'|'disconnected';joinedAt:string;lastSeenAt:string;role?:Role;roleRevealed:boolean;character?:Character;characterOptions:Character[];hand:Card[];handCount:number;equipment:EquipmentSlots;decisionArea:Card[];alive:boolean;hp?:number;maxHp?:number;ready:boolean;confirmedCharacter:boolean};
type Member={id:string;username:string;connectionStatus:'online'|'disconnected';joinedAt:string;lastSeenAt:string};
type ResponseWindow={type:string;currentResponderId:string|null;status:'open'|'resolved';responses:{playerId:string;response:'card'|'decline'|'timeout'}[];requiredPlayerIds?:string[];dyingPlayerId?:string};
type Turn={activePlayerId:string|null;phase:string;attackUsedThisTurn:number;drawnThisTurn?:number};
type RoleAliveCounts={emperor:number;loyalist:number;rebel:number;traitor:number};
type RoleSet={emperor:number;loyalist:number;rebel:number;traitor:number};
type Room={id:string;playerCount:number;spectatorCount:number;host:string;status:string;hasPassword:boolean};
type Game={viewerId:string;hostId:string;isSpectator:boolean;phase:string;currentPlayerId?:string;hasDrawnThisTurn:boolean;lastPlayedCard?:Card;pendingAction?:{kind:'attack';actorId:string;targetId:string;dodgesRequired?:number}|null;players:Player[];spectators:Member[];roleDefinitions?:RoleDefinition[];deck:{length:number};discard:{length:number};log:{id:string;message:string;at:string}[];turn:Turn|null;responseWindow:ResponseWindow|null;winner?:string;pendingRepeatAttack?:{attackerId:string;weaponName:string}|null;pendingDestroyMount?:{attackerId:string;targetId:string}|null;pendingForceAttackDamage?:{attackerId:string}|null;pendingReplaceDamage?:{attackerId:string;targetId:string;damage:number;weaponName:string}|null;pendingTwinSwords?:{attackerId:string;targetId:string;weaponName:string}|null;pendingCoerce?:{actorId:string;weaponHolderId:string;victimId:string;trickName:string}|null;pendingHarvest?:{revealed:Card[]}|null;pendingJudgment?:{playerId:string;trickEffect:string;trickName:string;stage:'awaiting_draw'|'revealed';revealed?:Card}|null;pendingFankui?:{playerId:string;damagerId:string}|null;pendingDraws?:Record<string,number>;lastJudgment?:{playerId:string;trickName:string;cardName:string;cardNumber:string;cardSuit:string;result:string;at:string};roleAliveCounts?:RoleAliveCounts;distances?:Record<string,number|null>;responseDeadline?:number|null;characterSkillKeys?:Record<string,string[]>;skillsUsedThisTurn?:string[]};
type IceSelection={zone:'hand';handIndex:number}|{zone:'equipment';cardInstanceId:string};

const ROLE_LABEL:Record<string,string>={emperor:'จักรพรรดิ',rebel:'กบฏ',loyalist:'ผู้ภักดี',traitor:'ทรยศ'};
const roleText=(role:RoleSet)=>`จักรพรรดิ ${role.emperor} · ผู้ภักดี ${role.loyalist} · กบฏ ${role.rebel} · ทรยศ ${role.traitor}`;
const hearts=(hp?:number,maxHp?:number)=>hp===undefined||maxHp===undefined?null:<span className="mock-hearts">{'♥'.repeat(Math.max(0,hp))}<i>{'♥'.repeat(Math.max(0,maxHp-hp))}</i></span>;
const charName=(p:{character?:{name:string};username:string}|undefined)=>p?.character?.name??p?.username??'ผู้เล่น';
const CARD_INFO:Record<string,{desc:string;use:string}>={attack:{desc:'ทำให้เป้าหมายต้องใช้ "หลบ" ไม่เช่นนั้นเสียพลังชีวิต 1',use:'ใช้โจมตีศัตรูในระยะ (1 ครั้ง/เทิร์น)'},dodge:{desc:'ยกเลิกผลจากการ์ด "โจมตี"',use:'การ์ดตอบโต้ — เล่นได้เมื่อถูกโจมตี'},heal:{desc:'ฟื้นฟูพลังชีวิต 1 หน่วย',use:'ใช้ตอนเลือดไม่เต็ม หรือช่วยคนใกล้ตาย'},all_others_attack_or_damage:{desc:'ขุนพลอื่นทุกคนต้องใช้ "โจมตี" ตามลำดับ ไม่เช่นนั้นเสียพลังชีวิต 1',use:'กดดันทั้งโต๊ะ'},all_others_dodge_or_damage:{desc:'ขุนพลอื่นทุกคนต้องใช้ "หลบ" ตามลำดับ ไม่เช่นนั้นเสียพลังชีวิต 1',use:'รัวใส่ทั้งโต๊ะ'},duel_attack_response:{desc:'เลือกขุนพล 1 คน ผลัดกันใช้ "โจมตี" ฝ่ายที่หยุดก่อนเสียพลังชีวิต 1',use:'ท้าดวล'},draw_cards:{desc:'จั่วการ์ด 2 ใบจากกองจั่ว',use:'เติมการ์ดบนมือ'},heal_all_living:{desc:'ฟื้นฟูพลังชีวิตให้ขุนพลที่ยังมีชีวิตทุกคน คนละ 1 หน่วย',use:'ฟื้นทั้งทีม'},discard_target_card:{desc:'ทิ้งการ์ดบนมือ/อุปกรณ์ 1 ใบ ของขุนพลอื่น 1 คน',use:'ทำลายอุปกรณ์หรือไพ่สำคัญของศัตรู'},steal_target_card_in_range:{desc:'หยิบการ์ด 1 ใบ จากขุนพลอื่นที่อยู่ในระยะ 1 หน่วย',use:'ขโมยไพ่ศัตรูที่อยู่ติดกัน'},negate_trick_effect:{desc:'ยกเลิกผลของไพ่อุบายที่ประกาศใช้',use:'ใช้ในช่วง Negate Window'},delayed_skip_play_phase:{desc:'วางบนขุนพลอื่น เมื่อถึงเทิร์นเขา ตัดสิน: ถ้าไม่ใช่ ♥ จะถูกข้ามช่วงเล่นไพ่',use:'กันไม่ให้ศัตรูออกการ์ดในเทิร์นถัดไป'},delayed_lightning_judgment:{desc:'วางบนตัวเอง เมื่อถึงเทิร์น ตัดสิน: ♠ 2–9 เสีย 3 พลังชีวิต ไม่งั้นเลื่อนไปคนถัดไป',use:'ระเบิดเวลาที่วนรอบโต๊ะ'},coerce_attack_or_take_weapon:{desc:'บังคับขุนพลที่มีอาวุธให้โจมตีเป้าหมายที่เลือก ถ้าไม่โจมตี คุณยึดอาวุธของเขา',use:'ยืมมือศัตรูฆ่ากันเอง หรือปล้นอาวุธ'},reveal_and_draft_cards:{desc:'เปิดไพ่ 1 ใบต่อผู้เล่นมีชีวิต แล้วเริ่มจากคุณ ผลัดกันหยิบคนละใบ',use:'เติมไพ่ให้ทั้งโต๊ะ แต่คุณเลือกก่อน'},};
const cardInfo=(c:Card)=>CARD_INFO[c.effect||'']||(c.description?{desc:c.description,use:''}:null);

function EquipmentDisplay({eq}:{eq:EquipmentSlots}){const r=(key:keyof EquipmentSlots,icon:string,label:string)=>{const s=eq[key];return <span className={`mock-equipment-slot ${s?'equipped':''}`} title={s?.name??`${label}: ว่าง`}><i>{icon}</i><em>{label}</em><b>{s?.name??'—'}</b></span>;};return <div className="mock-equipment">{r('weapon','🗡','อาวุธ')}{r('armor','🛡','เกราะ')}{r('offensiveMount','🐎−','ม้ารุก')}{r('defensiveMount','🐎+','ม้ารับ')}</div>;}
function DecisionArea({cards}:{cards:Card[]}){if(!cards?.length)return null;return <div className="local-decision-area">{cards.map(c=><span key={c.id} className="local-decision-card" title={c.description||c.name}>{c.effect==='delayed_lightning_judgment'?'⚡':c.effect==='delayed_skip_play_phase'?'🕒':'🎴'} {c.name}</span>)}</div>;}

// Arc across the top of the table. index 0 = viewer's immediate left neighbor,
// last index = viewer's immediate right neighbor (viewer sits at the bottom).
function edgePosition(index:number,total:number){
 if(total<=0)return {left:'50%',top:'1%'};
 if(total===1)return {left:'50%',top:'4%'};
 const t=index/(total-1);            // 0 → left, 1 → right
 const angle=Math.PI*(1-t);          // π (left) → 0 (right)
 const left=50+46*Math.cos(angle);   // 4% … 96%
 const top=48-46*Math.sin(angle);    // ends low (48), middle high (2)
 return {left:`${left.toFixed(1)}%`,top:`${top.toFixed(1)}%`};
}

// Circular position for all 10 lobby seats (seat 1 at top, clockwise)
function lobbyPosition(seatIndex:number):{left:string;top:string}{
 const angle=((seatIndex-1)/10)*2*Math.PI-Math.PI/2;
 return {left:`${(50+42*Math.cos(angle)).toFixed(1)}%`,top:`${(50+38*Math.sin(angle)).toFixed(1)}%`};
}

function OpponentPanel({player,targetable,distance,onClick,onSkills}:{player:Player;targetable?:boolean;distance?:number|null;onClick?:()=>void;onSkills?:()=>void}){
 return <article onClick={onClick} className={`mock-player local-opponent ${targetable?'local-targetable':''} ${!player.alive?'local-dead':''}`}>
  <div className="mock-portrait">{charName(player).slice(0,1)}</div>
  <div className="mock-player-content">
   <div className="local-name-row">
    <b>{charName(player)}</b>
    {player.character&&<button className="local-skills-btn" onClick={e=>{e.stopPropagation();onSkills?.()}} title="ดูทักษะ">!</button>}
   </div>
   <small className="mock-username">@{player.username}</small>
   {hearts(player.hp,player.maxHp)}
   <span className="mock-hand-count">🂠 × {player.handCount??player.hand.length}</span>
   <small className="mock-seat-info">ที่นั่ง {player.seatIndex}{distance!=null?` · ระยะ ${distance}`:''}</small>
   <small className={`mock-role${player.role==='emperor'?' local-role-emperor-tag':''}`}>บทบาท: {player.role?ROLE_LABEL[player.role]??player.role:'???'}</small>
   <EquipmentDisplay eq={player.equipment}/>
   <DecisionArea cards={player.decisionArea}/>
  </div>
 </article>;
}

export default function Home(){
 const [game,setGame]=useState<Game|undefined>();
 const [room,setRoom]=useState('demo');
 const [name,setName]=useState('');
 const [userId,setUserId]=useState('');
 const [joinedRoom,setJoinedRoom]=useState('');
 const [chatText,setChatText]=useState('');
 const [chat,setChat]=useState<{id:string;username:string;text:string;at:string}[]>([]);
 const [roleOptions,setRoleOptions]=useState<RoleSet[]>([]);
 const [error,setError]=useState<string>();
 const [showRole,setShowRole]=useState(false);
 const [detailCard,setDetailCard]=useState<Card>();
 const [skillsCharacter,setSkillsCharacter]=useState<Character>();
 const [logChatTab,setLogChatTab]=useState<'log'|'chat'>('log');
 const [soundOn,setSoundOn]=useState(true);
 const [rooms,setRooms]=useState<Room[]>([]);
 const [selectedAttackId,setSelectedAttackId]=useState<string>();
 const [selectedDiscardId,setSelectedDiscardId]=useState<string>();
 const [selectedDiscardTargetId,setSelectedDiscardTargetId]=useState<string>();
 const [selectedDiscardZone,setSelectedDiscardZone]=useState<'hand'|'equipment'>();
 const [selectedStealId,setSelectedStealId]=useState<string>();
 const [selectedStealTargetId,setSelectedStealTargetId]=useState<string>();
 const [selectedStealZone,setSelectedStealZone]=useState<'hand'|'equipment'>();
 const [discardLimitMode,setDiscardLimitMode]=useState(false);
 const [discardLimitSelected,setDiscardLimitSelected]=useState<string[]>([]);
 const [discardLimitConfirming,setDiscardLimitConfirming]=useState(false);
 const [forceDiscardRefs,setForceDiscardRefs]=useState<string[]>([]);
 const [iceSelections,setIceSelections]=useState<IceSelection[]>([]);
 const [snakeMode,setSnakeMode]=useState(false);
 const [snakeCards,setSnakeCards]=useState<string[]>([]);
 const [multiAttackId,setMultiAttackId]=useState<string>();
 const [multiTargets,setMultiTargets]=useState<string[]>([]);
 const [coerceCardId,setCoerceCardId]=useState<string>();
 const [coerceHolderId,setCoerceHolderId]=useState<string>();
 const [balanceMode,setBalanceMode]=useState(false);
 const [balanceCards,setBalanceCards]=useState<string[]>([]);
 const [guicaiPicking,setGuicaiPicking]=useState(false);
 const [chatHidden,setChatHidden]=useState(false);
 const [roleVisible,setRoleVisible]=useState(true);
 const [nowTs,setNowTs]=useState(()=>Date.now());
 const [drawNotice,setDrawNotice]=useState<string>();
 const [equipConfirmCard,setEquipConfirmCard]=useState<Card>();
 const [judgmentBanner,setJudgmentBanner]=useState<Game['lastJudgment']>();
 const prevJudgmentAt=useRef<string|undefined>(undefined);
 const judgmentTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const prevHandIds=useRef<string|undefined>(undefined);
 const drawNoticeTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const lastTurn=useRef<string|undefined>(undefined);
 const revealedRole=useRef<Role|undefined>(undefined);
 const chatEndRef=useRef<HTMLDivElement>(null);
 const logEndRef=useRef<HTMLDivElement>(null);
 const handRef=useRef<HTMLDivElement>(null);

 useEffect(()=>{let id=localStorage.getItem('wtk-member-id');if(!id){id=crypto.randomUUID();localStorage.setItem('wtk-member-id',id)}setUserId(id)},[]);
 useEffect(()=>{
  const onState=(v:Game)=>{setGame(v);setError(undefined);};
  const onMsg=(v:{id:string;username:string;text:string;at:string})=>setChat(c=>[...c,v]);
  const onOptions=(v:RoleSet[])=>setRoleOptions(v);
  const onError=(v:string)=>setError(v);
  socket.on('game:state',onState);socket.on('chat:message',onMsg);socket.on('game:role-options',onOptions);socket.on('game:error',onError);
  return()=>{socket.off('game:state',onState);socket.off('chat:message',onMsg);socket.off('game:role-options',onOptions);socket.off('game:error',onError);}
 },[]);
 useEffect(()=>{const reconnect=()=>{if(joinedRoom&&userId)socket.emit('room:join',{gameId:joinedRoom,username:name,userId})};socket.on('connect',reconnect);return()=>{socket.off('connect',reconnect)}},[joinedRoom,userId,name]);
 useEffect(()=>{const turn=game?.currentPlayerId;if(soundOn&&turn&&turn===game?.viewerId&&lastTurn.current!==turn){try{const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(660,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(880,ctx.currentTime+.16);gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+.02);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.24);osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.25)}catch{}}lastTurn.current=turn},[game?.currentPlayerId,game?.viewerId,soundOn]);
 useEffect(()=>{const role=game?.players.find(p=>p.id===game.viewerId)?.role;if(role&&revealedRole.current!==role){revealedRole.current=role;setShowRole(true)}},[game?.players,game?.viewerId]);
 useEffect(()=>{if(logChatTab==='chat')chatEndRef.current?.scrollIntoView({behavior:'smooth'});},[chat,logChatTab]);
 useEffect(()=>{if(logChatTab==='log')logEndRef.current?.scrollIntoView({behavior:'smooth'});},[game?.log?.length,logChatTab]);
 // Re-runs when phase changes to 'playing' so handRef.current is populated by then
 useEffect(()=>{
  const el=handRef.current;if(!el)return;
  const handler=(e:WheelEvent)=>{e.preventDefault();el.scrollLeft+=e.deltaY;};
  el.addEventListener('wheel',handler,{passive:false});
  return()=>el.removeEventListener('wheel',handler);
 },[game?.phase]);
 // Tick once per second while a response/decision countdown is active (display only; server enforces the skip)
 useEffect(()=>{if(!game?.responseDeadline)return;setNowTs(Date.now());const id=setInterval(()=>setNowTs(Date.now()),500);return()=>clearInterval(id);},[game?.responseDeadline]);
 // Close the hand-limit discard menu once the debt is cleared or it's not the viewer's turn; close play-phase selection modes outside the play phase
 useEffect(()=>{
  if(!game)return;
  const me=game.players.find(p=>p.id===game.viewerId);
  const myTurn=game.currentPlayerId===game.viewerId;
  const myPlay=myTurn&&game.turn?.phase==='play';
  const req=Math.max(0,(me?.hand.length||0)-(me?.hp||0));
  if(!myTurn||req===0){setDiscardLimitMode(false);setDiscardLimitSelected([]);setDiscardLimitConfirming(false);}
  if(!myPlay){setSnakeMode(false);setSnakeCards([]);setMultiAttackId(undefined);setMultiTargets([]);setCoerceCardId(undefined);setCoerceHolderId(undefined);setSelectedAttackId(undefined);setSelectedDiscardId(undefined);setSelectedStealId(undefined);setBalanceMode(false);setBalanceCards([]);}
 },[game]);
 // Show the judgment reveal to everyone for a few seconds whenever a new one occurs
 useEffect(()=>{
  const j=game?.lastJudgment;if(!j)return;
  if(prevJudgmentAt.current===undefined){prevJudgmentAt.current=j.at;return;} // skip the one already present on first load
  if(prevJudgmentAt.current===j.at)return;
  prevJudgmentAt.current=j.at;setJudgmentBanner(j);
  if(judgmentTimer.current)clearTimeout(judgmentTimer.current);
  judgmentTimer.current=setTimeout(()=>setJudgmentBanner(undefined),5000);
 },[game?.lastJudgment?.at]);
 // Notify the viewer which card(s) just entered their hand (draw, or any gain). Skips the initial deal.
 useEffect(()=>{
  const hand=game?.players.find(p=>p.id===game.viewerId)?.hand;
  if(!hand){prevHandIds.current=undefined;return;}
  const prev=prevHandIds.current;
  prevHandIds.current=hand.map(c=>c.id).join(',');
  if(prev===undefined)return; // first population (initial hand) — no toast
  const prevSet=new Set(prev?prev.split(','):[]);
  const added=hand.filter(c=>!prevSet.has(c.id));
  if(!added.length)return;
  setDrawNotice(added.map(c=>`${c.name} (${c.number}${c.suit})`).join(', '));
  if(drawNoticeTimer.current)clearTimeout(drawNoticeTimer.current);
  drawNoticeTimer.current=setTimeout(()=>setDrawNotice(undefined),3200);
 },[game]);

 const loadRooms=()=>fetch(process.env.NEXT_PUBLIC_SERVER_URL||'http://localhost:3001/rooms').then(r=>r.json()).then(setRooms).catch(()=>setRooms([]));
 useEffect(()=>{loadRooms()},[]);
 const join=(roomId=room)=>{if(!userId)return;socket.connect();setJoinedRoom(roomId);socket.emit('room:join',{gameId:roomId,username:name,userId})};
 const emit=(event:string,data?:Record<string,unknown>)=>socket.emit(event,{gameId:joinedRoom,...data});

 if(!game)return <main className="lobby"><h1 className="game-title">ยุทธพิชัยสามก๊ก</h1><p>เข้าสู่สมรภูมิและรวมพลสหายของคุณ</p><input value={name} onChange={e=>setName(e.target.value)} placeholder="Username"/><section className="room-browser"><div><h2>ห้องที่เปิดอยู่</h2><button onClick={loadRooms}>รีเฟรช</button></div>{rooms.length?rooms.map(r=><article key={r.id}><b>{r.id}</b><span>{r.status==='waiting'?'กำลังรอผู้เล่น':'กำลังเล่น — Spectator'}</span><small>หัวหน้า: {r.host} · ผู้เล่น {r.playerCount} · ผู้ชม {r.spectatorCount}</small><button disabled={!name||!userId} onClick={()=>join(r.id)}>{r.status==='waiting'?'เข้าห้อง':'เข้าชม'}</button></article>):<p>ยังไม่มีห้องที่เปิดอยู่</p>}</section><section className="create-room"><h2>สร้างห้องใหม่</h2><input value={room} onChange={e=>setRoom(e.target.value)} placeholder="ชื่อห้อง"/><button disabled={!name||!userId} onClick={()=>join()}>สร้าง/เข้าห้อง</button></section></main>;

 const myPlayer=game.players.find(p=>p.id===game.viewerId);
 const myRoleInfo=game.roleDefinitions?.find(r=>r.role_key===myPlayer?.role);
 const isMyTurn=game.currentPlayerId===game.viewerId;
 const isPlaying=game.phase==='playing';
 const rw=game.responseWindow;
 const canRespond=rw?.currentResponderId===game.viewerId&&rw.status==='open';
 const responder=rw?.currentResponderId?game.players.find(p=>p.id===rw.currentResponderId):undefined;
 const dyingPlayer=rw?.type==='dying_heal'&&rw.dyingPlayerId?game.players.find(p=>p.id===rw.dyingPlayerId):undefined;
 const canAct=isMyTurn&&game.hasDrawnThisTurn&&!rw&&game.turn?.phase==='play';
 const isDrawPhase=isMyTurn&&game.turn?.phase==='draw';
 const myOwedDraws=game.pendingDraws?.[game.viewerId]??0;
 const myKeys=(myPlayer?.character&&game.characterSkillKeys?.[myPlayer.character.id])||[];
 const mySwap=myKeys.includes('attack_dodge_swap'); // จูล่ง กล้าหาญ
 const hasMySkill=(key:string)=>myKeys.includes(key);
 const myGuicai=myKeys.includes('replace_judgment'); // สุมาอี้ กำหนดชะตา
 // Does one of my cards count as `asEffect`? (own effect, จูล่ง swap, or a suit conversion: กวนอู/เอียนสี/ฮัวโต๋)
 const myConv=(asEffect:string,card:Card):boolean=>card.effect===asEffect
  ||(mySwap&&((asEffect==='dodge'&&card.effect==='attack')||(asEffect==='attack'&&card.effect==='dodge')))
  ||(myKeys.includes('red_as_attack')&&asEffect==='attack'&&['♥','♦'].includes(card.suit))
  ||(myKeys.includes('black_as_dodge')&&asEffect==='dodge'&&['♠','♣'].includes(card.suit))
  ||(myKeys.includes('red_as_heal')&&asEffect==='heal'&&['♥','♦'].includes(card.suit));
 const skillUsed=(key:string)=>Boolean(game.skillsUsedThisTurn?.includes(key));
 const toggleBalance=(id:string)=>setBalanceCards(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
 const pj=game.pendingJudgment;
 const myJudgmentDraw=Boolean(pj&&pj.playerId===game.viewerId&&pj.stage==='awaiting_draw');
 const myJudgmentAct=Boolean(pj&&pj.playerId===game.viewerId&&pj.stage==='revealed');
 const requiredDiscard=Math.max(0,(myPlayer?.hand.length||0)-(myPlayer?.hp||0));
 const toggleDiscardLimit=(id:string)=>setDiscardLimitSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
 const cancelDiscardLimit=()=>{setDiscardLimitMode(false);setDiscardLimitSelected([]);setDiscardLimitConfirming(false);};
 const hasSnakeSpear=myPlayer?.equipment.weapon?.effect==='discard_two_as_attack';
 const canSnakeAttack=canAct&&hasSnakeSpear&&(game.turn?.attackUsedThisTurn??0)<1;
 const toggleSnake=(id:string)=>setSnakeCards(prev=>prev.includes(id)?prev.filter(x=>x!==id):prev.length<2?[...prev,id]:prev);
 const cancelSnake=()=>{setSnakeMode(false);setSnakeCards([]);};
 const canPlayCard=(card:Card)=>{
  if(canRespond){if(rw?.type==='attack_dodge')return myConv('dodge',card)||card.effect==='negate_trick_effect';if(rw?.type==='dying_heal')return myConv('heal',card);if(rw?.type==='negate')return card.effect==='negate_trick_effect';if(rw?.type==='mass_dodge')return myConv('dodge',card)||card.effect==='negate_trick_effect';if(rw?.type==='multi_attack')return myConv('dodge',card);if(rw?.type==='mass_attack')return myConv('attack',card)||card.effect==='negate_trick_effect';if(rw?.type==='duel_attack')return myConv('attack',card);return false;}
  if(!canAct)return false;
  if(card.effect==='attack')return(game.turn?.attackUsedThisTurn??0)<1;
  if(card.effect==='dodge')return myConv('attack',card)&&(game.turn?.attackUsedThisTurn??0)<1; // จูล่ง/กวนอู: ใช้ "หลบ"/ไพ่แดง เป็น "โจมตี"
  return true;
 };
 const selectCard=(card:Card)=>{
  if(!canPlayCard(card))return;
  if(canRespond){
   if(rw?.type==='negate'&&card.effect==='negate_trick_effect')return emit('negate:play',{cardId:card.id});
   if((rw?.type==='mass_dodge'||rw?.type==='mass_attack')&&card.effect==='negate_trick_effect')return emit('mass:respond',{cardId:card.id});
   if((rw?.type==='mass_dodge'||rw?.type==='mass_attack'||rw?.type==='multi_attack'))return emit('mass:respond',{cardId:card.id});
   if(rw?.type==='attack_dodge'&&myConv('dodge',card))return emit('attack:respond',{cardId:card.id});
   if(rw?.type==='duel_attack'&&myConv('attack',card))return emit('duel:respond',{cardId:card.id});
   if(rw?.type==='dying_heal'&&myConv('heal',card))return emit('response:heal',{cardId:card.id});
   return;
  }
  if(card.effect==='attack'){if(myPlayer?.equipment.weapon?.effect==='last_hand_multi_target_attack'&&myPlayer.hand.length===1){setMultiAttackId(card.id);setMultiTargets([]);setSelectedAttackId(undefined);setSelectedDiscardId(undefined);setSelectedStealId(undefined);}else{setSelectedAttackId(card.id);setSelectedDiscardId(undefined);setSelectedStealId(undefined);}}
  else if(card.effect==='dodge'&&myConv('attack',card)){setSelectedAttackId(card.id);setSelectedDiscardId(undefined);setSelectedStealId(undefined);} // จูล่ง/กวนอู: เล่น "หลบ"/ไพ่แดง เป็น "โจมตี" — เลือกเป้าหมาย
  else if(card.effect==='duel_attack_response'){setSelectedAttackId(card.id);setSelectedDiscardId(undefined);setSelectedStealId(undefined);}
  else if(card.effect==='discard_target_card'){setSelectedDiscardId(card.id);setSelectedAttackId(undefined);setSelectedStealId(undefined);}
  else if(card.effect==='steal_target_card_in_range'){setSelectedStealId(card.id);setSelectedAttackId(undefined);setSelectedDiscardId(undefined);}
  else if(card.effect==='coerce_attack_or_take_weapon'){setCoerceCardId(card.id);setCoerceHolderId(undefined);setSelectedAttackId(undefined);setSelectedDiscardId(undefined);setSelectedStealId(undefined);}
  else if(card.effect==='delayed_skip_play_phase'){setSelectedAttackId(card.id);setSelectedDiscardId(undefined);setSelectedStealId(undefined);}
  else if(card.effect==='delayed_lightning_judgment')emit('card:play',{cardId:card.id});
  else if(card.effect==='all_others_dodge_or_damage'||card.effect==='all_others_attack_or_damage'||card.effect==='draw_cards'||card.effect==='heal_all_living'||card.effect==='heal'||card.effect==='reveal_and_draft_cards')emit('card:play',{cardId:card.id});
  else if(card.equipmentSlot)setEquipConfirmCard(card);
 };
 const cancelSelection=()=>{setSelectedAttackId(undefined);setSelectedDiscardId(undefined);setSelectedDiscardTargetId(undefined);setSelectedStealId(undefined);setSelectedStealTargetId(undefined);setSelectedStealZone(undefined);setSelectedDiscardZone(undefined);setMultiAttackId(undefined);setMultiTargets([]);setCoerceCardId(undefined);setCoerceHolderId(undefined);};
 // Opponents in circular seat order starting just after the viewer, wrapping around,
 // so the table mirrors real seat geometry (immediate neighbors sit beside the viewer).
 const seatOrdered=[...game.players].sort((a,b)=>a.seatIndex-b.seatIndex);
 const viewerSeatIdx=seatOrdered.findIndex(p=>p.id===game.viewerId);
 const opponents=viewerSeatIdx<0?seatOrdered.filter(p=>p.id!==game.viewerId):[...seatOrdered.slice(viewerSeatIdx+1),...seatOrdered.slice(0,viewerSeatIdx)];
 const discardTarget=selectedDiscardTargetId?game.players.find(p=>p.id===selectedDiscardTargetId):undefined;
 const stealTarget=selectedStealTargetId?game.players.find(p=>p.id===selectedStealTargetId):undefined;
 const topDiscard=game.lastPlayedCard;
 const renderLog=(msg:string)=>{const names=game.players.map(p=>p.username).sort((a,b)=>b.length-a.length);if(!names.length)return msg;return msg.split(new RegExp(`(${names.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})`,'g')).map((part,i)=>names.includes(part)?<b key={i}>{part}</b>:part);};
 const isHost=game.hostId===game.viewerId,waiting=game.phase==='waiting';
 const chooser=game.players.find(p=>!p.confirmedCharacter&&p.characterOptions.length>0);
 const anchorSeat=myPlayer?.seatIndex||1;
 const waitingForCharacter=game.players.filter(p=>!p.confirmedCharacter);
 const emperor=game.players.find(p=>p.role==='emperor');
 const roleCounts=game.roleAliveCounts;
 const readyCount=game.players.filter(p=>p.ready).length;

 // Plain JSX element (not a component) so it is not remounted on every keystroke —
 // a nested component definition would lose input focus after each character.
 const chatPanel=chatHidden
  ?<button className="local-chat-toggle" onClick={()=>setChatHidden(false)}>💬 แสดงบันทึก/แชท</button>
  :<section className="mock-log">
   <h2 className="local-tab-bar"><button className={`local-tab${logChatTab==='log'?' local-tab-active':''}`} onClick={()=>setLogChatTab('log')}>บันทึก</button><button className={`local-tab${logChatTab==='chat'?' local-tab-active':''}`} onClick={()=>setLogChatTab('chat')}>แชท</button><button className="local-chat-collapse" onClick={()=>setChatHidden(true)} title="ซ่อน">✕</button></h2>
   {logChatTab==='log'?<div className="local-log-scroll">{game.log.map(l=><p key={l.id}><time>{l.at.slice(11,16)||l.at}</time>{renderLog(l.message)}</p>)}<div ref={logEndRef}/></div>:<div className="local-chat-scroll">{chat.map(m=><p key={m.id}><time>{m.at?.slice(11,16)||''}</time><b>{m.username}:</b> {m.text}</p>)}<div ref={chatEndRef}/></div>}
   {logChatTab==='chat'&&<form className="local-chat-form" onSubmit={e=>{e.preventDefault();if(chatText.trim()){emit('chat:send',{text:chatText});setChatText('');}}}><input className="local-chat-input" value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="พิมพ์ข้อความ…" maxLength={200}/><button type="submit" disabled={!chatText.trim()}>ส่ง</button></form>}
  </section>;
 const secondsLeft=game.responseDeadline?Math.max(0,Math.ceil((game.responseDeadline-nowTs)/1000)):null;
 const countdownBadge=secondsLeft!=null?<span className={`local-countdown${secondsLeft<=5?' local-countdown-urgent':''}`}>⏳ {secondsLeft} วิ</span>:null;

 return <main className={isPlaying?`mock-game-page local-game-page mock-count-${game.players.length}`:'game-page'}>
  {isPlaying?
   <header className="mock-game-header">
    <div><h1>ยุทธพิชัยสามก๊ก</h1><div className="local-turn-status"><b>ตา: {charName(game.players.find(p=>p.id===game.turn?.activePlayerId))}</b><span>{game.turn?.phase}{isDrawPhase&&(game.turn?.drawnThisTurn??0)>0?` (จั่ว ${game.turn?.drawnThisTurn??0}/2)`:''}</span></div></div>
    <div className="local-header-right">
     <div className="local-role-counts">{(['emperor','rebel','loyalist','traitor'] as const).map(role=>{const alive=roleCounts?roleCounts[role]:game.players.filter(p=>p.role===role&&p.alive).length;return <span key={role} className={`local-role-count local-role-${role}${alive===0?' local-role-dead':''}`}>{ROLE_LABEL[role]} {alive}</span>;})}</div>
     <button onClick={()=>{emit('room:leave');setGame(undefined);setJoinedRoom('');}}>ออก</button>
    </div>
   </header>:
   <header><h1 className="game-title">ยุทธพิชัยสามก๊ก</h1><span className="phase">{game.isSpectator?'Spectator · ':''}{game.phase}</span></header>}
  {error&&<p className="local-error" onClick={()=>setError(undefined)}>{error} ✕</p>}
  {drawNotice&&<div className="local-draw-notice" role="status">🎴 จั่วได้: <b>{drawNotice}</b></div>}
  {game.isSpectator&&<p className="spectator-banner">คุณกำลังรับชมเกมนี้ในฐานะ Spectator</p>}
  {game.phase==='character-select'&&<p className="selection-banner">{!emperor?.confirmedCharacter?'จักรพรรดิกำลังเลือกขุนพล':waitingForCharacter.length?`กำลังรอ ${waitingForCharacter.map(p=>p.username).join(', ')} เลือกขุนพล`:'ผู้เล่นทุกคนเลือกขุนพลแล้ว'}</p>}

  {/* Pre-game: same table layout as playing but no piles */}
  {!isPlaying&&<section className={`mock-match-layout mock-count-${game.players.length}`}>
   <aside className="mock-side-panels">
    <section className="mock-log">
     <h3 style={{marginTop:0,color:'var(--primary)',fontSize:'1rem'}}>ห้อง: {joinedRoom}</h3>
     <div className="local-lobby-players">ผู้เล่น {game.players.length} คน{game.spectators.length>0?` · ผู้ชม ${game.spectators.length} คน`:''}</div>
     <div className="local-lobby-controls">
      {waiting&&myPlayer&&<button className={myPlayer.ready?'secondary':''} onClick={()=>emit('player:ready',{ready:!myPlayer.ready})}>{myPlayer.ready?'✓ ยกเลิกพร้อม':'พร้อมแล้ว'}</button>}
      {waiting&&!myPlayer&&!game.isSpectator&&<button onClick={()=>emit('seat:random')}>นั่งที่นั่งสุ่ม</button>}
      {waiting&&myPlayer&&<button className="secondary" onClick={()=>emit('seat:spectate')}>ดูเฉยๆ</button>}
      {isHost&&waiting&&<button onClick={()=>emit('game:start')} disabled={readyCount<game.players.length}>เริ่มเกม ({readyCount}/{game.players.length})</button>}
      <button className="danger" onClick={()=>{emit('room:leave');setGame(undefined);setJoinedRoom('');loadRooms();}}>ออกจากห้อง</button>
     </div>
     {myPlayer?.role&&<button className="role-button" style={{margin:'0 0 8px',width:'100%'}} onClick={()=>setShowRole(true)}>บทบาทของฉัน</button>}
    </section>
    {chatPanel}
   </aside>
   <section className="mock-table-stage" data-density="large">
    <div className="mock-table-surface">
     <div className="mock-table-pattern">三國</div>
     <div className="local-lobby-status">
      {waiting&&<p style={{margin:'4px 0',color:'#c8b58a',fontSize:'.82rem'}}>พร้อม {readyCount}/{game.players.length} คน</p>}
      {game.phase==='character-select'&&<p style={{margin:'4px 0',color:'#c8b58a',fontSize:'.82rem'}}>กำลังเลือกขุนพล</p>}
     </div>
    </div>
    {/* All 10 seats */}
    {Array.from({length:10},(_,i)=>{
     const seatNum=i+1;
     const player=game.players.find(p=>p.seatIndex===seatNum);
     const pos=lobbyPosition(seatNum);
     const style={'--seat-x':pos.left,'--seat-y':pos.top} as CSSProperties;
     if(!player){
      return waiting?<div key={seatNum} className="mock-opponent local-lobby-seat" style={style}><button onClick={()=>emit('seat:select',{seatIndex:seatNum})}>+ {seatNum}</button></div>:null;
     }
     const isMe=player.id===game.viewerId;
     return <div key={seatNum} className="mock-opponent" style={style}>
      <article className={`mock-player local-opponent ${isMe?'mock-self':''}`}>
       <div className="mock-portrait">{charName(player).slice(0,1)}</div>
       <div className="mock-player-content">
        <div className="local-name-row">
         <b>{player.username}{player.id===game.hostId&&<span className="local-host-badge"> ♛</span>}</b>
        </div>
        {player.character&&<small style={{color:'var(--danger)',fontWeight:700}}>{player.character.name}</small>}
        {waiting&&<small className={`local-ready-text ${player.ready?'ready':'not-ready'}`}>{player.ready?'✓ พร้อม':'ยังไม่พร้อม'}</small>}
        {!waiting&&hearts(player.hp,player.maxHp)}
        <small>ที่นั่ง {player.seatIndex}</small>
       </div>
      </article>
     </div>;
    })}
   </section>
  </section>}

  {roleOptions.length>0&&isHost&&<section className="choice"><h2>เลือกชุดบทบาท</h2>{roleOptions.map((r,i)=><button key={i} onClick={()=>{emit('game:start',{composition:r});setRoleOptions([])}}>{roleText(r)}</button>)}</section>}
  {game.phase==='character-select'&&chooser&&<section className="choice"><h2>เลือกขุนพลของคุณ</h2><div className="character-grid">{chooser.characterOptions.map(c=><article key={c.id}><h3 className="general-name">{c.name}</h3><p>{c.kingdomTh||'—'} · HP {c.hp}</p>{c.skills.map(s=><p key={s.name}><b>{s.name}</b> — {s.description}</p>)}<button onClick={()=>emit('character:select',{characterId:c.id})}>เลือก {c.name}</button></article>)}</div></section>}

  {isPlaying&&<section className="mock-match-layout">
   <aside className="mock-side-panels">{chatPanel}</aside>
   <section className="mock-table-stage" data-density="large"><div className="mock-table-surface"><div className="mock-table-pattern">三國</div>
    <section className="mock-piles">
     <button className={`mock-pile${isDrawPhase||myOwedDraws>0||myJudgmentDraw?' local-draw-pile-active':''}`} onClick={isDrawPhase?()=>emit('turn:draw-one'):myOwedDraws>0?()=>emit('pending:draw'):myJudgmentDraw?()=>emit('judgment:draw'):undefined} title={isDrawPhase?'คลิกเพื่อจั่วไพ่ทีละใบ':myOwedDraws>0?'คลิกเพื่อจั่วไพ่ที่ได้รับ':myJudgmentDraw?'คลิกเพื่อเปิดไพ่ตัดสิน':undefined}><div className="mock-deck">{isDrawPhase?`จั่ว ${game.turn?.drawnThisTurn??0}/2`:myOwedDraws>0?`รับ +${myOwedDraws}`:myJudgmentDraw?'⚖':'🂠'}</div><b>กองจั่ว</b><small>{game.deck.length} ใบ</small></button>
     <article className="mock-pile"><div className="mock-discard">{topDiscard?<>{topDiscard.name}<br/><span>{topDiscard.number} {topDiscard.suit}</span></>:'—'}</div><b>กองทิ้ง</b><small>{game.discard.length} ใบ</small></article>
    </section>
    <p className="local-action-empty">{isDrawPhase?'⬆ กดกองจั่วเพื่อจั่วไพ่':myOwedDraws>0?`⬆ กดกองจั่วเพื่อรับไพ่ที่ได้รับ (${myOwedDraws} ใบ)`:rw?`กำลังรอ ${charName(responder)} ตอบสนอง`:'—'}</p>
   </div>
   {opponents.map((player,index)=>{const pos=edgePosition(index,opponents.length);const style={'--seat-x':pos.left,'--seat-y':pos.top} as CSSProperties;const attackTarget=Boolean(selectedAttackId&&player.alive);const discardTargetable=Boolean(selectedDiscardId&&player.alive&&player.id!==game.viewerId);const stealTargetable=Boolean(selectedStealId&&player.alive&&player.id!==game.viewerId);const snakeTargetable=Boolean(snakeMode&&snakeCards.length===2&&player.alive&&player.id!==game.viewerId);const multiTargetable=Boolean(multiAttackId&&player.alive&&player.id!==game.viewerId);const coerceHolderPick=Boolean(coerceCardId&&!coerceHolderId&&player.alive&&player.id!==game.viewerId&&player.equipment.weapon);const coerceVictimPick=Boolean(coerceCardId&&coerceHolderId&&player.alive&&player.id!==coerceHolderId);const targetable=attackTarget||discardTargetable||stealTargetable||snakeTargetable||multiTargetable||coerceHolderPick||coerceVictimPick;const onTarget=attackTarget?()=>{emit('card:play',{cardId:selectedAttackId,targetId:player.id});cancelSelection();}:coerceHolderPick?()=>{setCoerceHolderId(player.id);}:coerceVictimPick?()=>{emit('coerce:play',{cardId:coerceCardId,weaponHolderId:coerceHolderId,victimId:player.id});cancelSelection();}:multiTargetable?()=>{setMultiTargets(prev=>prev.includes(player.id)?prev.filter(x=>x!==player.id):prev.length<3?[...prev,player.id]:prev);}:snakeTargetable?()=>{emit('weapon:snake-attack',{cardIds:snakeCards,targetId:player.id});cancelSnake();}:discardTargetable?()=>{setSelectedDiscardTargetId(player.id);setSelectedDiscardZone(undefined);}:stealTargetable?()=>{setSelectedStealTargetId(player.id);setSelectedStealZone(undefined);}:undefined;const dist=game.distances?.[player.id];return <div key={player.id} className={`mock-opponent${multiTargets.includes(player.id)?' local-multi-selected':''}`} style={style}><OpponentPanel player={player} targetable={targetable} distance={dist} onClick={onTarget} onSkills={player.character?()=>setSkillsCharacter(player.character):undefined}/></div>;})}
   </section>
  </section>}

  {isPlaying&&<section className="mock-current-player">
   <article className="mock-player mock-self">
    <div className="mock-portrait">{charName(myPlayer).slice(0,1)}</div>
    <div className="mock-player-content">
     <div className="local-name-row"><b>{charName(myPlayer)}</b>{myPlayer?.character&&<button className="local-skills-btn" onClick={()=>myPlayer.character&&setSkillsCharacter(myPlayer.character)} title="ดูทักษะ">!</button>}</div>
     <small className="mock-username">@{myPlayer?.username}</small>
     {hearts(myPlayer?.hp,myPlayer?.maxHp)}
     <span className="mock-hand-count">🂠 × {myPlayer?.hand.length}</span>
     <small className="mock-seat-info">ที่นั่ง {myPlayer?.seatIndex}</small>
     {myPlayer?.role&&<small className="mock-role">{myPlayer.role!=='emperor'&&<button className="local-role-toggle" onClick={()=>setRoleVisible(v=>!v)} title={roleVisible?'ซ่อนบทบาท':'แสดงบทบาท'}>{roleVisible?'👁':'🙈'}</button>}บทบาท: {myPlayer.role==='emperor'||roleVisible?ROLE_LABEL[myPlayer.role]??myPlayer.role:'???'}</small>}
     <EquipmentDisplay eq={myPlayer?.equipment??{weapon:null,armor:null,offensiveMount:null,defensiveMount:null}}/>
     <DecisionArea cards={myPlayer?.decisionArea??[]}/>
    </div>
   </article>
   <div className="mock-your-turn">{myOwedDraws>0?<strong>⬆ คุณได้รับไพ่ {myOwedDraws} ใบ — กดกองจั่วเพื่อรับ</strong>:selectedAttackId||selectedDiscardId||selectedStealId?<strong>เลือกผู้เล่นเป้าหมายบนโต๊ะ</strong>:isDrawPhase?<strong>⬆ กดกองจั่วบนโต๊ะเพื่อจั่วไพ่</strong>:<span>ไพ่ของคุณ</span>}</div>
   <div className="local-turn-controls">
    <button disabled={!isMyTurn||Boolean(rw)||Boolean(pj)||game.turn?.phase==='draw'||requiredDiscard>0||myOwedDraws>0} onClick={()=>emit('turn:end')}>จบเทิร์น</button>
    {requiredDiscard>0&&isMyTurn&&!discardLimitMode&&<button className="mock-muted-button" onClick={()=>{setDiscardLimitMode(true);setDiscardLimitSelected([])}}>ทิ้งไพ่เกินมือ ({requiredDiscard})</button>}
    {canSnakeAttack&&!snakeMode&&!discardLimitMode&&<button className="mock-muted-button" onClick={()=>{cancelSelection();setSnakeMode(true);setSnakeCards([])}}>⚔ {myPlayer?.equipment.weapon?.name||'ทวนอสรพิษ'} (ทิ้ง 2 ใบ)</button>}
    {canAct&&hasMySkill('self_damage_draw')&&(myPlayer?.hp??0)>0&&<button className="local-skill-btn" onClick={()=>emit('skill:self-damage-draw')}>✦ พลีชีพ (จ่าย 1 HP จั่ว 2)</button>}
    {canAct&&hasMySkill('discard_then_draw_equal')&&!skillUsed('discard_then_draw_equal')&&!balanceMode&&!discardLimitMode&&!snakeMode&&<button className="local-skill-btn" onClick={()=>{cancelSelection();setBalanceMode(true);setBalanceCards([])}}>✦ ถ่วงดุล (ทิ้ง→จั่ว)</button>}
   </div>
   {(selectedAttackId||selectedDiscardId||selectedStealId)&&<button className="local-cancel" onClick={cancelSelection}>ยกเลิกเลือกเป้าหมาย</button>}
   {discardLimitMode&&<div className="local-discard-limit-bar"><span>เลือก <b>{discardLimitSelected.length}</b> ใบ (ต้องทิ้งอีก {requiredDiscard} ใบ)</span><button disabled={discardLimitSelected.length===0} onClick={()=>setDiscardLimitConfirming(true)}>ทิ้งที่เลือก</button><button className="mock-muted-button" onClick={cancelDiscardLimit}>ยกเลิก</button></div>}
   {snakeMode&&<div className="local-discard-limit-bar"><span>เลือกไพ่ <b>{snakeCards.length}</b>/2 ใบ {snakeCards.length===2?'→ เลือกเป้าหมายบนโต๊ะ':'เพื่อใช้เป็นการโจมตี'}</span><button className="mock-muted-button" onClick={cancelSnake}>ยกเลิก</button></div>}
   {multiAttackId&&<div className="local-discard-limit-bar"><span>โจมตีหลายเป้า: เลือก <b>{multiTargets.length}</b>/3 คนบนโต๊ะ</span><button disabled={multiTargets.length<1} onClick={()=>{emit('attack:multi',{cardId:multiAttackId,targetIds:multiTargets});cancelSelection();}}>โจมตี ({multiTargets.length})</button><button className="mock-muted-button" onClick={cancelSelection}>ยกเลิก</button></div>}
   {coerceCardId&&<div className="local-discard-limit-bar"><span>ยืมมือสังหาร: {!coerceHolderId?'เลือกขุนพลที่มีอาวุธ':`เลือกเหยื่อให้ ${charName(game.players.find(p=>p.id===coerceHolderId))}`}</span><button className="mock-muted-button" onClick={cancelSelection}>ยกเลิก</button></div>}
   {balanceMode&&<div className="local-discard-limit-bar"><span>ถ่วงดุล: เลือกไพ่ทิ้ง <b>{balanceCards.length}</b> ใบ (จะได้จั่ว {balanceCards.length} ใบ)</span><button disabled={balanceCards.length===0} onClick={()=>{emit('skill:balance',{cardIds:balanceCards});setBalanceMode(false);setBalanceCards([]);}}>ทิ้งแล้วจั่ว</button><button className="mock-muted-button" onClick={()=>{setBalanceMode(false);setBalanceCards([]);}}>ยกเลิก</button></div>}
   <div className="mock-hand" ref={handRef}>{myPlayer?.hand.map(card=>{const info=cardInfo(card);const isDiscardSelected=discardLimitSelected.includes(card.id);const isSnakeSelected=snakeCards.includes(card.id);const isBalanceSelected=balanceCards.includes(card.id);const pickMode=discardLimitMode||snakeMode||balanceMode;const handleClick=discardLimitMode?()=>toggleDiscardLimit(card.id):snakeMode?()=>toggleSnake(card.id):balanceMode?()=>toggleBalance(card.id):()=>selectCard(card);const accent=card.effect==='attack'?'red':card.effect==='dodge'?'blue':'gold';const playable=canPlayCard(card);return <article key={card.id} tabIndex={0} onClick={handleClick} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();handleClick();}}} className={`mock-card mock-card-${accent} ${pickMode?'local-hand-card':playable?'local-hand-card':'local-card-disabled'} ${!pickMode&&(selectedAttackId===card.id||selectedDiscardId===card.id||selectedStealId===card.id)?'selected-card':''} ${(discardLimitMode&&!isDiscardSelected)||(snakeMode&&!isSnakeSelected)||(balanceMode&&!isBalanceSelected)?'local-discard-unselected':''} ${isDiscardSelected||isSnakeSelected||isBalanceSelected?'local-discard-selected':''}`}><header><span>{card.number}</span><span>{card.suit}</span></header><button className="local-card-info" onClick={e=>{e.stopPropagation();setDetailCard(card);}} title="ดูรายละเอียดการ์ด">ℹ</button><div className="mock-card-art">WTK</div><b>{card.name}</b><small>{card.type}</small>{(isDiscardSelected||isSnakeSelected||isBalanceSelected)&&<span className="local-discard-badge">ทิ้ง</span>}{!pickMode&&info&&<div className="card-tip" role="tooltip"><b className="card-tip-name">{card.name}</b><span className="card-tip-type">{card.type} · {card.number}{card.suit}</span><p className="card-tip-desc">{info.desc}</p>{info.use&&<p className="card-tip-use"><i>เมื่อไหร่:</i> {info.use}</p>}</div>}</article>;})}
   </div>
  </section>}

  {isPlaying&&rw&&rw.type!=='coerce_attack'&&rw.type!=='harvest_pick'&&<section className="mock-response" role="dialog"><span className="mock-response-icon">{rw.type==='negate'?'🛡':rw.type==='dying_heal'?'✚':'⚔'}</span>{countdownBadge}
   {rw.type==='negate'?<>{canRespond?<><div><h2>ใช้คงกระพันชาตรีหรือไม่?</h2></div><div className="mock-response-actions"><button disabled={!myPlayer?.hand.some(c=>c.effect==='negate_trick_effect')} onClick={()=>{const c=myPlayer?.hand.find(c=>c.effect==='negate_trick_effect');if(c)emit('negate:play',{cardId:c.id})}}>🛡 ใช้คงกระพันชาตรี</button><button className="mock-muted-button" onClick={()=>emit('negate:decline')}>ไม่ใช้</button></div></>:<><div><h2>กำลังรอ {charName(responder)}</h2><p>ว่าจะยกเลิกไพ่อุบายหรือไม่</p></div></>}</>
   :rw.type==='dying_heal'?<>{canRespond?<><div><small>{charName(dyingPlayer)} อยู่ในสถานะใกล้ตาย</small><h2>ใช้ เสบียง ช่วยหรือไม่?</h2></div><div className="mock-response-actions"><button disabled={!myPlayer?.hand.some(c=>myConv('heal',c))} onClick={()=>{const c=myPlayer?.hand.find(c=>myConv('heal',c));if(c)emit('response:heal',{cardId:c.id})}}>✚ ใช้ เสบียง</button><button className="mock-muted-button" onClick={()=>emit('response:decline')}>ไม่ทำอะไร</button></div></>:<><div><h2>กำลังรอ {charName(responder)}</h2><p>ว่าจะช่วย {charName(dyingPlayer)} หรือไม่</p></div></>}</>
   :<>{canRespond?<><div><h2>{rw.type==='mass_dodge'||rw.type==='multi_attack'?'ต้องใช้ หลบ':rw.type==='mass_attack'?'ต้องใช้ โจมตี':rw.type==='duel_attack'?'ท้าสู้ — ตอบโต้ด้วย โจมตี':(game.pendingAction?.dodgesRequired??1)>1?`ถูกโจมตี — ต้องใช้ หลบ อีก ${Math.max(1,(game.pendingAction?.dodgesRequired??1)-(rw.responses?.filter(r=>r.playerId===game.viewerId&&r.response==='card').length??0))} ใบ`:'ถูกโจมตี — ตอบสนอง'}</h2></div><div className="mock-response-actions">{rw.type==='attack_dodge'?<><button disabled={!myPlayer?.hand.some(c=>myConv('dodge',c))} onClick={()=>{const c=myPlayer?.hand.find(c=>c.effect==='dodge')||myPlayer?.hand.find(c=>myConv('dodge',c));if(c)emit('attack:respond',{cardId:c.id})}}>🛡 ใช้ หลบ</button><button className="mock-muted-button" onClick={()=>emit('attack:respond')}>รับความเสียหาย</button></>:rw.type==='mass_dodge'||rw.type==='multi_attack'?<><button disabled={!myPlayer?.hand.some(c=>myConv('dodge',c))} onClick={()=>{const c=myPlayer?.hand.find(c=>c.effect==='dodge')||myPlayer?.hand.find(c=>myConv('dodge',c));if(c)emit('mass:respond',{cardId:c.id})}}>🛡 ใช้ หลบ</button><button className="mock-muted-button" onClick={()=>emit('mass:decline')}>รับความเสียหาย</button></>:rw.type==='duel_attack'?<><button disabled={!myPlayer?.hand.some(c=>myConv('attack',c))} onClick={()=>{const c=myPlayer?.hand.find(c=>c.effect==='attack')||myPlayer?.hand.find(c=>myConv('attack',c));if(c)emit('duel:respond',{cardId:c.id})}}>⚔ ตอบโต้ด้วย โจมตี</button><button className="mock-muted-button" onClick={()=>emit('response:decline')}>ยอมแพ้ (เสีย 1 HP)</button></>:<><button disabled={!myPlayer?.hand.some(c=>myConv('attack',c))} onClick={()=>{const c=myPlayer?.hand.find(c=>c.effect==='attack')||myPlayer?.hand.find(c=>myConv('attack',c));if(c)emit('mass:respond',{cardId:c.id})}}>⚔ ใช้ โจมตี</button><button className="mock-muted-button" onClick={()=>emit('mass:decline')}>ไม่ใช้ (เสีย 1 HP)</button></>}</div></>:<><div><h2>กำลังรอ {charName(responder)} ตอบสนอง</h2></div></>}</>}
  </section>}

  {isPlaying&&game.pendingCoerce&&(()=>{const pc=game.pendingCoerce!;const holder=game.players.find(p=>p.id===pc.weaponHolderId);const victim=game.players.find(p=>p.id===pc.victimId);const actor=game.players.find(p=>p.id===pc.actorId);const isHolder=pc.weaponHolderId===game.viewerId;const atk=myPlayer?.hand.find(c=>c.effect==='attack');return <section className="mock-response" role="dialog"><span className="mock-response-icon">🗡</span>{countdownBadge}{isHolder?<><div><small>{charName(actor)} ใช้ {pc.trickName}</small><h2>ถูกบังคับให้โจมตี {charName(victim)}</h2></div><div className="mock-response-actions"><button disabled={!atk} onClick={()=>atk&&emit('coerce:attack',{cardId:atk.id})}>{atk?`⚔ โจมตี ${charName(victim)}`:'ไม่มีไพ่โจมตี'}</button><button className="mock-muted-button" onClick={()=>emit('coerce:decline')}>ไม่โจมตี (ให้ {charName(actor)} ยึดอาวุธ)</button></div></>:<><div><h2>กำลังรอ {charName(holder)} ตัดสินใจ</h2><p>ยืมมือสังหาร: โจมตี {charName(victim)} หรือเสียอาวุธ</p></div></>}</section>;})()}
  {isPlaying&&game.pendingHarvest&&rw?.type==='harvest_pick'&&(()=>{const picker=game.players.find(p=>p.id===rw.currentResponderId);const isPicker=rw.currentResponderId===game.viewerId;return <section className="mock-response local-harvest" role="dialog"><span className="mock-response-icon">🌾</span>{countdownBadge}<div><h2>{isPicker?'เลือกไพ่ 1 ใบจากยุ้งฉาง':`กำลังรอ ${charName(picker)} เลือกไพ่`}</h2></div><div className="local-harvest-pool">{game.pendingHarvest!.revealed.map(c=><button key={c.id} disabled={!isPicker} className={`mock-card mock-card-${c.effect==='attack'?'red':c.effect==='dodge'?'blue':'gold'}`} onClick={()=>isPicker&&emit('harvest:pick',{cardId:c.id})}><header><span>{c.number}</span><span>{c.suit}</span></header><b>{c.name}</b><small>{c.type}</small></button>)}</div></section>;})()}
  {isPlaying&&pj&&(()=>{const jp=game.players.find(p=>p.id===pj.playerId);const r=pj.revealed;return <section className="mock-response local-judgment-panel" role="dialog"><span className="mock-response-icon">⚖</span>{countdownBadge}{pj.stage==='awaiting_draw'?<div><h2>การตัดสิน: {pj.trickName}</h2>{myJudgmentDraw?<p>⬆ กดกองจั่ว (หรือปุ่มด้านล่าง) เพื่อเปิดไพ่ตัดสิน</p>:<p>กำลังรอ {charName(jp)} เปิดไพ่ตัดสิน…</p>}{myJudgmentDraw&&<div className="mock-response-actions"><button onClick={()=>emit('judgment:draw')}>⚖ เปิดไพ่ตัดสิน</button></div>}</div>:<><div className="local-judgment-reveal"><small>ไพ่ตัดสินของ {charName(jp)} — {pj.trickName}</small>{r?<div className="local-judgment-card"><span>{r.number} {r.suit}</span><b>{r.name}</b></div>:<p>ไม่มีไพ่ตัดสิน</p>}</div>{myJudgmentAct?<div className="mock-response-actions"><button onClick={()=>emit('judgment:keep')}>เก็บการ์ดตัดสินเข้ามือ</button><button className="mock-muted-button" onClick={()=>emit('judgment:resolve')}>ดำเนินการต่อ (ทิ้ง)</button></div>:<p>กำลังรอ {charName(jp)} ตัดสินใจ…</p>}{myGuicai&&(myPlayer?.hand.length??0)>0&&(guicaiPicking?<div className="local-force-cards">{myPlayer?.hand.map(c=><button key={c.id} onClick={()=>{emit('judgment:replace',{cardId:c.id});setGuicaiPicking(false);}}>{c.name} ({c.number}{c.suit})</button>)}<button className="mock-muted-button" onClick={()=>setGuicaiPicking(false)}>ยกเลิก</button></div>:<button className="local-skill-btn" onClick={()=>setGuicaiPicking(true)}>🃏 กำหนดชะตา (เปลี่ยนไพ่ตัดสิน)</button>)}</>}</section>;})()}
  {isPlaying&&game.pendingRepeatAttack&&game.pendingRepeatAttack.attackerId===game.viewerId&&(()=>{const attack=myPlayer?.hand.find(c=>c.effect==='attack');return <section className="local-repeat-attack" role="dialog"><b>เป้าหมายหลบสำเร็จ ต้องการโจมตีซ้ำด้วย {game.pendingRepeatAttack!.weaponName} หรือไม่?</b>{countdownBadge}<div><button disabled={!attack} onClick={()=>attack&&emit('attack:repeat',{cardId:attack.id})}>{attack?'โจมตีซ้ำ':'ไม่มีไพ่โจมตี'}</button><button className="mock-muted-button" onClick={()=>emit('attack:repeat-decline')}>ไม่โจมตีซ้ำ</button></div></section>;})()}
  {isPlaying&&game.pendingDestroyMount&&game.pendingDestroyMount.attackerId===game.viewerId&&(()=>{const target=game.players.find(p=>p.id===game.pendingDestroyMount!.targetId);return target&&<section className="local-repeat-attack" role="dialog"><b>โจมตีสำเร็จ ต้องการทำลายพาหนะของเป้าหมายหรือไม่?</b>{countdownBadge}<div>{target.equipment.offensiveMount&&<button onClick={()=>emit('mount:destroy',{targetId:target.id,slot:'offensiveMount'})}>ทำลาย {target.equipment.offensiveMount.name}</button>}{target.equipment.defensiveMount&&<button onClick={()=>emit('mount:destroy',{targetId:target.id,slot:'defensiveMount'})}>ทำลาย {target.equipment.defensiveMount.name}</button>}</div><button className="mock-muted-button" onClick={()=>emit('mount:destroy-decline')}>ไม่ทำลาย</button></section>;})()}
  {isPlaying&&game.pendingForceAttackDamage&&game.pendingForceAttackDamage.attackerId===game.viewerId&&(()=>{const choices=[...(myPlayer?.hand||[]),...Object.values(myPlayer?.equipment||{}).filter((c):c is Card=>Boolean(c))];const toggle=(id:string)=>setForceDiscardRefs(cur=>cur.includes(id)?cur.filter(r=>r!==id):cur.length<2?[...cur,id]:cur);return <section className="local-repeat-attack" role="dialog"><b>ต้องการทิ้งไพ่ 2 ใบเพื่อบังคับให้โจมตีโดนหรือไม่?</b>{countdownBadge}<div className="local-force-cards">{choices.map(c=><button key={c.id} className={forceDiscardRefs.includes(c.id)?'selected-card':''} onClick={()=>toggle(c.id)}>{c.name}</button>)}</div><div><button disabled={forceDiscardRefs.length!==2} onClick={()=>{emit('attack:force',{cardIds:forceDiscardRefs});setForceDiscardRefs([])}}>ยืนยัน ({forceDiscardRefs.length}/2)</button><button className="mock-muted-button" onClick={()=>{emit('attack:force-decline');setForceDiscardRefs([])}}>ยกเลิก</button></div></section>;})()}
  {isPlaying&&game.pendingReplaceDamage&&game.pendingReplaceDamage.attackerId===game.viewerId&&(()=>{
   const target=game.players.find(p=>p.id===game.pendingReplaceDamage!.targetId);if(!target)return null;
   const has=(s:IceSelection)=>iceSelections.some(x=>x.zone===s.zone&&(x.zone==='hand'?x.handIndex===(s as {handIndex:number}).handIndex:x.cardInstanceId===(s as {cardInstanceId:string}).cardInstanceId));
   const toggle=(s:IceSelection)=>setIceSelections(cur=>has(s)?cur.filter(x=>!(x.zone===s.zone&&(x.zone==='hand'?x.handIndex===(s as {handIndex:number}).handIndex:x.cardInstanceId===(s as {cardInstanceId:string}).cardInstanceId))):cur.length<2?[...cur,s]:cur);
   const equipEntries=([{key:'weapon',label:'อาวุธ'},{key:'armor',label:'เกราะ'},{key:'offensiveMount',label:'ม้ารุก'},{key:'defensiveMount',label:'ม้ารับ'}] as const).map(({key,label})=>({card:target.equipment[key],label})).filter(e=>e.card);
   return <section className="local-repeat-attack" role="dialog"><b>{game.pendingReplaceDamage!.weaponName}: ทิ้งไพ่ของ {charName(target)} 1–2 ใบ แทนที่จะสร้างความเสียหายหรือไม่?</b>{countdownBadge}
    <div className="local-force-cards">{Array.from({length:target.handCount},(_,i)=>{const s:IceSelection={zone:'hand',handIndex:i};return <button key={`h${i}`} className={has(s)?'selected-card':''} onClick={()=>toggle(s)}>🂠 {i+1}</button>;})}{equipEntries.map(({card,label})=>{const s:IceSelection={zone:'equipment',cardInstanceId:card!.id};return <button key={card!.id} className={has(s)?'selected-card':''} onClick={()=>toggle(s)}>{label}: {card!.name}</button>;})}</div>
    <div><button disabled={iceSelections.length<1} onClick={()=>{emit('ice:replace',{selections:iceSelections});setIceSelections([])}}>ทิ้งไพ่ ({iceSelections.length}/2)</button><button className="mock-muted-button" onClick={()=>{emit('ice:decline');setIceSelections([])}}>ให้เสียเลือดตามปกติ</button></div></section>;})()}
  {isPlaying&&game.pendingTwinSwords&&game.pendingTwinSwords.targetId===game.viewerId&&(()=>{const attacker=game.players.find(p=>p.id===game.pendingTwinSwords!.attackerId);return <section className="local-repeat-attack" role="dialog"><b>{charName(attacker)} ใช้ {game.pendingTwinSwords!.weaponName} — เลือกทิ้งไพ่บนมือ 1 ใบ หรือให้ผู้โจมตีจั่ว 1 ใบ</b>{countdownBadge}<div className="local-force-cards">{myPlayer?.hand.map(c=><button key={c.id} onClick={()=>emit('twin:discard',{cardId:c.id})}>ทิ้ง {c.name} ({c.number}{c.suit})</button>)}</div><button className="mock-muted-button" onClick={()=>emit('twin:draw')}>ให้ผู้โจมตีจั่ว 1 ใบ</button></section>;})()}
  {isPlaying&&game.pendingFankui&&game.pendingFankui.playerId===game.viewerId&&(()=>{const damager=game.players.find(p=>p.id===game.pendingFankui!.damagerId);if(!damager)return null;const equipEntries=([{key:'weapon',label:'อาวุธ'},{key:'armor',label:'เกราะ'},{key:'offensiveMount',label:'ม้ารุก'},{key:'defensiveMount',label:'ม้ารับ'}] as const).map(({key,label})=>({card:damager.equipment[key],label})).filter(e=>e.card);return <section className="local-repeat-attack" role="dialog"><b>🎯 กลยุทธ์โต้กลับ: หยิบไพ่ 1 ใบจาก {charName(damager)}</b>{countdownBadge}<div className="local-force-cards">{Array.from({length:damager.handCount},(_,i)=><button key={`h${i}`} onClick={()=>emit('fankui:take',{selection:{zone:'hand',handIndex:i}})}>🂠 {i+1}</button>)}{equipEntries.map(({card,label})=><button key={card!.id} onClick={()=>emit('fankui:take',{selection:{zone:'equipment',cardInstanceId:card!.id}})}>{label}: {card!.name}</button>)}</div><button className="mock-muted-button" onClick={()=>emit('fankui:decline')}>ไม่ใช้</button></section>;})()}

  {isPlaying&&discardTarget&&selectedDiscardId&&<div className="modal-backdrop"><section className="card-detail local-target-picker"><h2>เลือกไพ่ของ {charName(discardTarget)}</h2>{!selectedDiscardZone?<><p>เลือกโซน</p><div className="local-equipment-picker"><button disabled={!discardTarget.handCount} onClick={()=>setSelectedDiscardZone('hand')}>🂠 มือ ({discardTarget.handCount})</button><button disabled={!Object.values(discardTarget.equipment).some(Boolean)} onClick={()=>setSelectedDiscardZone('equipment')}>อุปกรณ์</button></div></>:selectedDiscardZone==='hand'?<><p>เลือกตำแหน่งไพ่บนมือ</p><div className="local-equipment-picker">{Array.from({length:discardTarget.handCount},(_,i)=><button key={i} onClick={()=>{emit('card:discard-target',{cardId:selectedDiscardId,targetId:discardTarget.id,selection:{zone:'hand',handIndex:i}});cancelSelection();}}>🂠 {i+1}</button>)}</div></>:<><p>เลือกอุปกรณ์</p><div className="local-equipment-picker">{([{key:'weapon',label:'อาวุธ'},{key:'armor',label:'เกราะ'},{key:'offensiveMount',label:'ม้ารุก'},{key:'defensiveMount',label:'ม้ารับ'}] as const).map(({key,label})=>{const eq=discardTarget.equipment[key];return eq?<button key={key} onClick={()=>{emit('card:discard-target',{cardId:selectedDiscardId,targetId:discardTarget.id,selection:{zone:'equipment',cardInstanceId:eq.id}});cancelSelection();}}><small>{label}</small>{eq.name}</button>:<span key={key} className="local-empty-slot">{label}: ว่าง</span>})}</div></>}<button className="mock-muted-button" onClick={cancelSelection}>ยกเลิก</button></section></div>}
  {isPlaying&&stealTarget&&selectedStealId&&<div className="modal-backdrop"><section className="card-detail local-target-picker"><h2>เลือกไพ่ของ {charName(stealTarget)}</h2>{!selectedStealZone?<><p>เลือกโซน</p><div className="local-equipment-picker"><button disabled={!stealTarget.handCount} onClick={()=>setSelectedStealZone('hand')}>🂠 มือ ({stealTarget.handCount})</button><button disabled={!Object.values(stealTarget.equipment).some(Boolean)} onClick={()=>setSelectedStealZone('equipment')}>อุปกรณ์</button></div></>:selectedStealZone==='hand'?<><p>เลือกตำแหน่งไพ่บนมือ</p><div className="local-equipment-picker">{Array.from({length:stealTarget.handCount},(_,i)=><button key={i} onClick={()=>{emit('card:steal-target',{cardId:selectedStealId,targetId:stealTarget.id,selection:{zone:'hand',handIndex:i}});cancelSelection();}}>🂠 {i+1}</button>)}</div></>:<><p>เลือกอุปกรณ์</p><div className="local-equipment-picker">{([{key:'weapon',label:'อาวุธ'},{key:'armor',label:'เกราะ'},{key:'offensiveMount',label:'ม้ารุก'},{key:'defensiveMount',label:'ม้ารับ'}] as const).map(({key,label})=>{const eq=stealTarget.equipment[key];return eq?<button key={key} onClick={()=>{emit('card:steal-target',{cardId:selectedStealId,targetId:stealTarget.id,selection:{zone:'equipment',cardInstanceId:eq.id}});cancelSelection();}}><small>{label}</small>{eq.name}</button>:<span key={key} className="local-empty-slot">{label}: ว่าง</span>})}</div></>}<button className="mock-muted-button" onClick={cancelSelection}>ยกเลิก</button></section></div>}
  {discardLimitConfirming&&<div className="modal-backdrop"><section className="card-detail local-target-picker"><h2>ยืนยันการทิ้งไพ่</h2><ul className="local-discard-confirm-list">{discardLimitSelected.map(id=>{const c=myPlayer?.hand.find(x=>x.id===id);return c?<li key={id}><b>{c.name}</b> <small>{c.number}{c.suit}</small></li>:null;})}</ul><div className="mock-response-actions"><button onClick={()=>{emit('hand:discard',{cardIds:discardLimitSelected});setDiscardLimitSelected([]);setDiscardLimitConfirming(false);}}>ยืนยัน ทิ้งไพ่</button><button className="mock-muted-button" onClick={()=>setDiscardLimitConfirming(false)}>กลับไปเลือกใหม่</button></div></section></div>}

  {showRole&&myPlayer?.role&&<div className="modal-backdrop" onClick={()=>setShowRole(false)}><section className="role-reveal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowRole(false)}>×</button><small>บทบาทของคุณ</small><h2>{myRoleInfo?.role_th||ROLE_LABEL[myPlayer.role]||myPlayer.role}</h2><p>{myRoleInfo?.win_condition_th||''}</p></section></div>}
  {skillsCharacter&&<div className="modal-backdrop" onClick={()=>setSkillsCharacter(undefined)}><section className="local-skills-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSkillsCharacter(undefined)}>×</button><h2>{skillsCharacter.name}</h2><p className="local-skills-faction">{skillsCharacter.kingdomTh||'—'} · HP {skillsCharacter.hp}</p>{game.characterSkillKeys?.[skillsCharacter.id]?.length&&<p className="local-skill-live">⚙ ทักษะทำงานในระบบแล้ว</p>}{skillsCharacter.skills.length?<ul className="local-skills-list">{skillsCharacter.skills.map(s=><li key={s.name}><b>{s.name}</b><p>{s.description}</p>{s.condition&&<small className="local-skill-condition">{s.condition}</small>}</li>)}</ul>:<p className="local-skills-empty">ไม่มีทักษะพิเศษ</p>}</section></div>}
  {detailCard&&(()=>{const info=cardInfo(detailCard);return <div className="modal-backdrop" onClick={()=>setDetailCard(undefined)}><section className="card-detail" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setDetailCard(undefined)}>×</button><span className="card-rank">{detailCard.number} {detailCard.suit}</span><h2>{detailCard.name}</h2><p><b>ประเภท:</b> {detailCard.type}</p><p>{info?.desc||detailCard.description||'ยังไม่มีคำอธิบาย'}</p>{info?.use&&<p className="card-detail-use"><b>เมื่อไหร่:</b> {info.use}</p>}</section></div>;})()}
  {equipConfirmCard&&<div className="modal-backdrop" onClick={()=>setEquipConfirmCard(undefined)}><section className="card-detail local-target-picker" onClick={e=>e.stopPropagation()}><h2>ติดตั้งอุปกรณ์?</h2><p><b>{equipConfirmCard.name}</b> <small>({equipConfirmCard.number}{equipConfirmCard.suit})</small></p><p>{cardInfo(equipConfirmCard)?.desc||equipConfirmCard.description||equipConfirmCard.type}</p>{(()=>{const slot=equipConfirmCard.equipmentSlot;const slotKey=slot==='weapon'?'weapon':slot==='armor'?'armor':slot?.includes('offensive')?'offensiveMount':slot?.includes('defensive')?'defensiveMount':undefined;const current=slotKey?myPlayer?.equipment[slotKey as keyof EquipmentSlots]:undefined;return current?<p className="local-equip-replace">จะแทนที่ <b>{current.name}</b> ที่ติดตั้งอยู่ (ทิ้งลงกองทิ้ง)</p>:null;})()}<div className="mock-response-actions"><button onClick={()=>{emit('card:play',{cardId:equipConfirmCard.id});setEquipConfirmCard(undefined);}}>ยืนยันติดตั้ง</button><button className="mock-muted-button" onClick={()=>setEquipConfirmCard(undefined)}>ยกเลิก</button></div></section></div>}
  {judgmentBanner&&(()=>{const jp=game.players.find(p=>p.id===judgmentBanner.playerId);return <div className="local-judgment-banner" role="status"><span className="local-judgment-title">⚖ การตัดสิน — {judgmentBanner.trickName}</span><div className="local-judgment-card"><span>{judgmentBanner.cardNumber} {judgmentBanner.cardSuit}</span><b>{judgmentBanner.cardName}</b></div><span className="local-judgment-result">{charName(jp)}: {judgmentBanner.result}</span></div>;})()}
  <button className="sound-toggle" title="เปิด/ปิดเสียง" onClick={()=>setSoundOn(v=>!v)}>{soundOn?'🔔':'🔕'}</button>
 </main>;
}
