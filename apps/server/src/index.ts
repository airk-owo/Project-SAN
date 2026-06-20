import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import cors from 'cors';
import { Server } from 'socket.io';
import { readFile } from 'node:fs/promises';
import { beginPlayAfterCharacters, createGame, dealEmperorOptions, dealRoles, endTurn, playCard, publicState, respondToAttack, selectCharacter, type Card, type Character, type GameState, type RoleComposition } from '@wtk/game';

const app=express(),http=createServer(app),io=new Server(http,{cors:{origin:process.env.WEB_ORIGIN||'http://localhost:3000'}});
app.use(cors());app.get('/health',(_,res)=>res.json({ok:true}));
const cards:Card[]=JSON.parse(await readFile(new URL('../../../data/generated/cards.json',import.meta.url),'utf8'));
const characters:Character[]=JSON.parse(await readFile(new URL('../../../data/generated/characters.json',import.meta.url),'utf8'));
const rules=JSON.parse(await readFile(new URL('../../../data/generated/rules.json',import.meta.url),'utf8')) as {authoritativeSetup:{initialHandSize:number};roleCompositions:Record<string,RoleComposition[]>};
const games=new Map<string,GameState>();
const emitGame=(game:GameState)=>game.players.forEach(player=>io.to(player.id).emit('game:state',publicState(game,player.id)));

io.on('connection',socket=>{
  socket.on('room:join',({gameId,username})=>{
    const roomId=String(gameId||'').trim(),name=String(username||'').trim();
    if(!roomId||!name)return socket.emit('game:error','กรุณาระบุชื่อและชื่อห้อง');
    let game=games.get(roomId);
    if(game?.players.some(player=>player.username.localeCompare(name,undefined,{sensitivity:'accent'})===0))return socket.emit('game:error','ชื่อนี้ถูกใช้ในห้องแล้ว กรุณาใช้ชื่ออื่น');
    if(game&&game.phase!=='waiting')return socket.emit('game:error','เกมนี้เริ่มไปแล้ว');
    socket.join(socket.id);
    if(!game){game=createGame(roomId,[{id:socket.id,username:name}],cards);games.set(roomId,game)}
    else game.players.push({id:socket.id,username:name,characterOptions:[],hand:[],equipment:[],ready:false,confirmedCharacter:false,alive:true});
    emitGame(game);
  });
  socket.on('player:ready',({gameId,ready})=>{const game=games.get(gameId),player=game?.players.find(x=>x.id===socket.id);if(game?.phase==='waiting'&&player){player.ready=Boolean(ready);emitGame(game)}});
  socket.on('game:start',({gameId,composition})=>{try{const game=games.get(gameId);if(!game)return;if(game.hostId!==socket.id)throw Error('เฉพาะหัวหน้าห้องเท่านั้นที่เริ่มเกมได้');if(game.players.length<4||game.players.length>10)throw Error('เกมรองรับ 4–10 คน');if(!game.players.every(player=>player.ready))throw Error('ผู้เล่นต้อง Ready ทุกคน');const options=rules.roleCompositions[String(game.players.length)]||[];const selected=composition||(options.length===1?options[0]:null);if(!selected)return socket.emit('game:role-options',options);if(!options.some(option=>JSON.stringify(option)===JSON.stringify(selected)))throw Error('ชุดบทบาทไม่ถูกต้อง');dealRoles(game,selected);dealEmperorOptions(game,characters);emitGame(game)}catch(error){socket.emit('game:error',(error as Error).message)}});
  socket.on('character:select',({gameId,characterId})=>{try{const game=games.get(gameId);if(!game)throw Error('Game not found');selectCharacter(game,socket.id,characterId,characters);if(game.players.every(player=>player.confirmedCharacter))beginPlayAfterCharacters(game,rules.authoritativeSetup.initialHandSize);emitGame(game)}catch(error){socket.emit('game:error',(error as Error).message)}});
  socket.on('card:play',({gameId,cardId,targetId})=>{try{const game=games.get(gameId);if(!game)throw Error('Game not found');playCard(game,socket.id,cardId,targetId);emitGame(game)}catch(error){socket.emit('game:error',(error as Error).message)}});
  socket.on('attack:respond',({gameId,cardId})=>{try{const game=games.get(gameId);if(!game)throw Error('Game not found');respondToAttack(game,socket.id,cardId);emitGame(game)}catch(error){socket.emit('game:error',(error as Error).message)}});
  socket.on('turn:end',({gameId})=>{try{const game=games.get(gameId);if(!game)throw Error('Game not found');endTurn(game,socket.id);emitGame(game)}catch(error){socket.emit('game:error',(error as Error).message)}});
  socket.on('chat:send',({gameId,text})=>{const game=games.get(gameId),player=game?.players.find(x=>x.id===socket.id);if(game&&player)io.to([...game.players.map(x=>x.id)]).emit('chat:message',{id:crypto.randomUUID(),username:player.username,text:String(text).slice(0,500),at:new Date().toISOString()})});
  socket.on('disconnect',()=>{for(const [roomId,game] of games){const index=game.players.findIndex(player=>player.id===socket.id);if(index<0||game.phase!=='waiting')continue;game.players.splice(index,1);if(!game.players.length){games.delete(roomId);continue}if(game.hostId===socket.id){game.hostId=game.players[0].id;game.log.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'host-changed',message:`${game.players[0].username} is now the room host.`})}emitGame(game)}});
});
http.listen(Number(process.env.SOCKET_PORT||3001),()=>console.log('WTK socket server ready'));
