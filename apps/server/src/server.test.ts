// เทสต์ gateway จริง: บูต createServer บนพอร์ต 0 แล้วยิงผ่าน socket.io-client
// ครอบคลุม lobby flow, identity/session token, rate limit, payload แปลกๆ/ใหญ่เกิน,
// ความยาว username และ DEV_SANDBOX opt-in ของ QA sandbox
// (logic ในเกมลึกๆ มีเทสต์ engine ครอบอยู่แล้วใน packages/game)
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { createServer } from './server.js';

type TestServer = Awaited<ReturnType<typeof createServer>>;
let server: TestServer;
let baseUrl = '';
const clients: ClientSocket[] = [];
let roomSeq = 0;
const newRoom = () => `test-room-${++roomSeq}`;

before(async () => {
 server = await createServer();
 await new Promise<void>(resolve => server.httpServer.listen(0, resolve));
 const { port } = server.httpServer.address() as AddressInfo;
 baseUrl = `http://127.0.0.1:${port}`;
});
after(async () => {
 for (const client of clients) client.disconnect();
 await server.close();
});

const connect = () => new Promise<ClientSocket>((resolve, reject) => {
 const client = ioc(baseUrl, { transports: ['websocket'], forceNew: true });
 clients.push(client);
 client.once('connect', () => resolve(client));
 client.once('connect_error', reject);
});

const waitFor = <T,>(client: ClientSocket, event: string, ms = 2000) => new Promise<T>((resolve, reject) => {
 const timer = setTimeout(() => reject(new Error(`หมดเวลารอ event "${event}"`)), ms);
 timer.unref();
 client.once(event, (payload: T) => { clearTimeout(timer); resolve(payload); });
});

type JoinArgs = { gameId: string; username: string; userId: string; sessionToken?: string };
type SessionToken = { userId: string; token: string };
// join สำเร็จ: ต้องได้ทั้ง session:token และ game:state
const join = async (client: ClientSocket, args: JoinArgs) => {
 const statePromise = waitFor<Record<string, unknown>>(client, 'game:state');
 const tokenPromise = waitFor<SessionToken>(client, 'session:token');
 client.emit('room:join', args);
 return { state: await statePromise, session: await tokenPromise };
};

describe('HTTP routes', () => {
 it('GET /health ตอบ ok', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.deepEqual(await res.json(), { ok: true });
 });
 it('GET /rooms เห็นห้องที่เปิด แต่ไม่มีข้อมูลลับ (มือ/บทบาท)', async () => {
  const room = newRoom();
  const client = await connect();
  await join(client, { gameId: room, username: 'โฮสต์', userId: 'user-rooms' });
  const rooms = (await (await fetch(`${baseUrl}/rooms`)).json()) as Record<string, unknown>[];
  const found = rooms.find(r => r.id === room);
  assert.ok(found, 'ต้องเห็นห้องใน /rooms');
  assert.deepEqual(Object.keys(found).sort(), ['hasPassword', 'host', 'id', 'playerCount', 'spectatorCount', 'status']);
 });
});

describe('room:join / seat flow', () => {
 it('join ห้องใหม่ → ได้ game:state (waiting) + session token และ state ไม่มีกองจั่วดิบ', async () => {
  const client = await connect();
  const { state, session } = await join(client, { gameId: newRoom(), username: 'ผู้เล่นหนึ่ง', userId: 'user-join-1' });
  assert.equal(state.phase, 'waiting');
  assert.equal(session.userId, 'user-join-1');
  assert.ok(session.token.length > 10);
  // createPublicGameState แทนสำรับจริงด้วย summary: deck เหลือแค่ {length} และ drawPile เป็นตัวเลขนับ
  assert.ok(!('drawPile' in state), 'viewer state ต้องไม่มี drawPile ดิบ');
  assert.equal(typeof state.drawPileCount, 'number');
  assert.deepEqual(Object.keys(state.deck as object), ['length'], 'deck ต้องเหลือแค่ summary');
 });
 it('seat:select ที่นั่งถูกต้อง → กลายเป็นผู้เล่นที่นั่งนั้น', async () => {
  const room = newRoom();
  const client = await connect();
  await join(client, { gameId: room, username: 'คนนั่ง', userId: 'user-seat-1' });
  const statePromise = waitFor<{ players: { id: string; seatIndex: number }[] }>(client, 'game:state');
  client.emit('seat:select', { gameId: room, seatIndex: 3 });
  const state = await statePromise;
  assert.deepEqual(state.players.map(p => [p.id, p.seatIndex]), [['user-seat-1', 3]]);
 });
 it('seat:select เลขนอกช่วง → ถูกปฏิเสธ', async () => {
  const room = newRoom();
  const client = await connect();
  await join(client, { gameId: room, username: 'คนซน', userId: 'user-seat-2' });
  const errorPromise = waitFor<string>(client, 'game:error');
  client.emit('seat:select', { gameId: room, seatIndex: 99 });
  assert.match(await errorPromise, /เลือกที่นั่ง 1–10/);
 });
 it('seat:select ที่นั่งที่มีคนแล้ว → ถูกปฏิเสธ', async () => {
  const room = newRoom();
  const first = await connect(), second = await connect();
  await join(first, { gameId: room, username: 'มาก่อน', userId: 'user-seat-3' });
  const seated = waitFor(first, 'game:state');
  first.emit('seat:select', { gameId: room, seatIndex: 5 });
  await seated;
  await join(second, { gameId: room, username: 'มาทีหลัง', userId: 'user-seat-4' });
  const errorPromise = waitFor<string>(second, 'game:error');
  second.emit('seat:select', { gameId: room, seatIndex: 5 });
  assert.match(await errorPromise, /ถูกใช้งานแล้ว/);
 });
 it('game:start โดยคนที่ไม่ใช่ host → ถูกปฏิเสธ', async () => {
  const room = newRoom();
  const host = await connect(), guest = await connect();
  await join(host, { gameId: room, username: 'เจ้าของห้อง', userId: 'user-host-1' });
  await join(guest, { gameId: room, username: 'แขก', userId: 'user-guest-1' });
  const errorPromise = waitFor<string>(guest, 'game:error');
  guest.emit('game:start', { gameId: room });
  assert.match(await errorPromise, /เฉพาะหัวหน้าห้อง/);
 });
 it('ยิง action ก่อน join (ไม่มี session) → ถูกปฏิเสธ', async () => {
  const client = await connect();
  const errorPromise = waitFor<string>(client, 'game:error');
  client.emit('turn:end', { gameId: 'whatever' });
  assert.match(await errorPromise, /Session not found/);
 });
});

describe('session token (กันสวมรอย userId)', () => {
 it('userId ที่มีเจ้าของแล้ว + token ผิด → ถูกปฏิเสธ; token ถูก → เข้าได้', async () => {
  const room = newRoom();
  const owner = await connect();
  const { session } = await join(owner, { gameId: room, username: 'ตัวจริง', userId: 'user-token-1' });
  const impostor = await connect();
  const errorPromise = waitFor<string>(impostor, 'game:error');
  impostor.emit('room:join', { gameId: room, username: 'ตัวปลอม', userId: 'user-token-1', sessionToken: 'wrong-token' });
  assert.match(await errorPromise, /ถูกใช้งานจากอุปกรณ์อื่น/);
  // อุปกรณ์เดิม (มี token จริง) reconnect ได้ตามปกติ
  const comeback = await connect();
  const { state } = await join(comeback, { gameId: room, username: 'ตัวจริง', userId: 'user-token-1', sessionToken: session.token });
  assert.equal(state.phase, 'waiting');
 });
 it('reconnect ด้วย userId + token เดิมหลังหลุด → ได้ตัวตนเดิมคืน (สถานะ online)', async () => {
  const room = newRoom();
  const original = await connect();
  const { session } = await join(original, { gameId: room, username: 'จะหลุด', userId: 'user-token-2' });
  original.disconnect();
  const revived = await connect();
  const { state } = await join(revived, { gameId: room, username: 'จะหลุด', userId: 'user-token-2', sessionToken: session.token });
  const spectators = state.spectators as { id: string; connectionStatus: string }[];
  assert.equal(spectators.find(s => s.id === 'user-token-2')?.connectionStatus, 'online');
 });
});

describe('gateway hardening', () => {
 it('chat ถูกตัดที่ 500 ตัวอักษร', async () => {
  const room = newRoom();
  const client = await connect();
  await join(client, { gameId: room, username: 'คนคุย', userId: 'user-chat-1' });
  const messagePromise = waitFor<{ text: string; username: string }>(client, 'chat:message');
  client.emit('chat:send', { gameId: room, text: 'ก'.repeat(600) });
  const message = await messagePromise;
  assert.equal(message.text.length, 500);
  assert.equal(message.username, 'คนคุย');
 });
 it('payload ที่ไม่ใช่ object (undefined/string) ไม่ทำให้ server ล้ม', async () => {
  const client = await connect();
  const errorPromise = waitFor<string>(client, 'game:error');
  client.emit('room:join'); // ไม่มี payload — เดิม destructure undefined จะโยนหลุดถึง process
  assert.match(await errorPromise, /กรุณาระบุ/);
  const errorPromise2 = waitFor<string>(client, 'game:error');
  client.emit('seat:select', 'ไม่ใช่ object');
  assert.match(await errorPromise2, /Session not found|Game not found/);
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200); // server ยังมีชีวิตอยู่
 });
 it('ยิง event รัวเกิน burst → โดน drop และได้คำเตือนครั้งเดียว', async () => {
  const client = await connect();
  const errors: string[] = [];
  client.on('game:error', (message: string) => errors.push(message));
  for (let i = 0; i < 40; i++) client.emit('turn:end', { gameId: 'nowhere' });
  await new Promise(resolve => setTimeout(resolve, 500).unref());
  const throttled = errors.filter(message => message.includes('ส่งคำสั่งถี่เกินไป'));
  assert.equal(throttled.length, 1, 'ต้องมีคำเตือน rate limit ครั้งเดียว');
  assert.ok(errors.length < 40, `บาง packet ต้องถูก drop (ได้ ${errors.length}/40)`);
 });
 it('username ยาวเกินถูกตัดเหลือ 32 ตัวอักษรตอน join', async () => {
  const room = newRoom();
  const client = await connect();
  const { state } = await join(client, { gameId: room, username: 'ย'.repeat(200), userId: 'user-longname' });
  const players = state.players as { id: string; username: string }[];
  const spectators = state.spectators as { id: string; username: string }[];
  const me = [...players, ...spectators].find(member => member.id === 'user-longname');
  assert.equal(me?.username.length, 32);
 });
 it('payload ใหญ่เกิน 100KB → socket โดนตัด แต่ server ไม่ล้ม', async () => {
  const client = await connect();
  const disconnected = waitFor<string>(client, 'disconnect');
  client.emit('chat:send', { gameId: 'nowhere', text: 'x'.repeat(150_000) });
  await disconnected; // เกิน maxHttpBufferSize → server ตัดการเชื่อมต่อทันที
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200); // server ยังมีชีวิตอยู่
 });
 // QA sandbox ต้อง opt-in ด้วย DEV_SANDBOX=1 — probe ผ่าน ack ของ dev:export-snapshot
 // (ไม่มี handler = ack ไม่ถูกเรียกเลย ต่างจากตอบ error)
 it('dev:* ปิดโดย default เมื่อไม่ตั้ง DEV_SANDBOX', async () => {
  const room = newRoom();
  const client = await connect();
  await join(client, { gameId: room, username: 'คิวเอ', userId: 'user-sandbox-off' });
  const ackResult = await new Promise<unknown>(resolve => {
   const timer = setTimeout(() => resolve('เงียบ'), 700);
   timer.unref();
   client.emit('dev:export-snapshot', { gameId: room }, (snapshot: unknown) => { clearTimeout(timer); resolve(snapshot); });
  });
  assert.equal(ackResult, 'เงียบ', 'sandbox ต้องไม่ตอบอะไรเลยเมื่อไม่ได้ opt-in');
 });
 it('ตั้ง DEV_SANDBOX=1 → dev handlers ทำงาน (opt-in)', async () => {
  process.env.DEV_SANDBOX = '1';
  const devServer = await createServer();
  try {
   await new Promise<void>(resolve => devServer.httpServer.listen(0, resolve));
   const { port } = devServer.httpServer.address() as AddressInfo;
   const client = ioc(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true });
   clients.push(client);
   await new Promise<void>((resolve, reject) => { client.once('connect', () => resolve()); client.once('connect_error', reject); });
   const room = newRoom();
   await join(client, { gameId: room, username: 'คิวเอ', userId: 'user-sandbox-on' });
   const snapshot = await new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('sandbox เปิดอยู่แต่ dev:export-snapshot ไม่ตอบ ack')), 2000);
    timer.unref();
    client.emit('dev:export-snapshot', { gameId: room }, (payload: unknown) => { clearTimeout(timer); resolve(payload); });
   });
   assert.ok(snapshot && typeof snapshot === 'object', 'ต้องได้ snapshot กลับมา');
   client.disconnect();
  } finally {
   delete process.env.DEV_SANDBOX;
   await devServer.close();
  }
 });
});
