# Security Review — Socket Gateway (apps/server)

รีวิวเมื่อ: 2026-07-08 · ขอบเขต: `apps/server` (socket.io gateway + HTTP routes) ก่อนเปิดให้ผู้เล่นจริง
สถานะ: ช่องโหว่ระดับ HIGH/MED ถูกแก้แล้วในคอมมิตชุดเดียวกับรายงานนี้ และมีเทสต์คุม (`apps/server/src/server.test.ts`)

## สรุปผล

| # | ระดับ | ประเด็น | สถานะ |
|---|---|---|---|
| 1 | HIGH | สวมรอย userId ได้ (client-asserted identity) | ✅ แก้แล้ว — session token |
| 2 | HIGH | payload ที่ไม่ใช่ object ทำ process ล้มได้ (DoS ด้วย packet เดียว) | ✅ แก้แล้ว — normalize ใน middleware |
| 3 | MED | ไม่มี rate limit (77 events รวม chat) | ✅ แก้แล้ว — token bucket ต่อ socket |
| 4 | MED-LOW | HTTP CORS เปิดทุก origin (ไม่ตรงกับ socket.io ที่จำกัด WEB_ORIGIN) | ✅ แก้แล้ว |
| 5 | LOW | room code มาจาก client — เดา/ไล่ชื่อห้องได้, ไม่มีรหัสผ่านห้อง | 📋 บันทึกไว้ (backlog เดิม) |
| 6 | LOW | `/rooms` เผย room id + ชื่อ host สาธารณะ | 📋 ยอมรับ (จำเป็นสำหรับ room browser) |
| 7 | LOW | dev sandbox (QA God Mode) พึ่ง `NODE_ENV` อย่างเดียว | 📋 บันทึกไว้ — Docker ครอบแล้ว |
| 8 | INFO | chat XSS | ✅ ปลอดภัยอยู่แล้ว (React escape, ไม่มี dangerouslySetInnerHTML) |

## รายละเอียด

### 1. สวมรอยผู้เล่น (HIGH) — แก้แล้ว
เดิม `room:join` เชื่อ `userId` ที่ client ส่งมาตรงๆ และ `requireUser` เช็คแค่ว่า socket ปัจจุบันคือ socket ล่าสุดที่ประกาศ userId นั้น → ใครก็ตามที่รู้/เดา userId ของผู้เล่นที่หลุดการเชื่อมต่อ สามารถ join ทับ ยึดที่นั่ง เห็นมือ และเล่นแทนได้ทันที

**การแก้:** server แจก session token (`crypto.randomUUID()`) ให้ userId ที่ join ครั้งแรก ผ่าน event `session:token`; การ join ครั้งถัดไปด้วย userId เดิมต้องแนบ token ให้ตรง ไม่ตรง → ปฏิเสธ ฝั่ง web เก็บใน `localStorage` (`wtk-session-token`) และแนบอัตโนมัติใน `emitRoomJoin` (`apps/web/app/page.tsx`)

ข้อจำกัดที่รู้: token map อยู่ในหน่วยความจำ — restart server แล้วเริ่มนับใหม่ (สอดคล้องกับ game state ที่หายตอน restart อยู่แล้ว); ผู้เล่นที่ล้าง localStorage จะใช้ userId เดิมไม่ได้จนกว่า server restart (สร้าง wtk-member-id ใหม่ได้เสมอ); token map โตตามจำนวน userId ที่เคย join ต่อการรัน 1 ครั้ง — เล็กมาก ไม่เป็นปัญหาจริง

### 2. Payload แปลกๆ ทำ server ล้ม (HIGH) — แก้แล้ว
Handler ทุกตัว destructure payload ในตำแหน่งพารามิเตอร์ (`({gameId,...}) =>`) — ถ้า client ยิง event โดยไม่ส่ง payload หรือส่ง string, การ destructure `undefined` โยน TypeError หลุดออกนอก try/catch (มันเกิดก่อนเข้า body) → uncaught exception / unhandled rejection = process ตาย ทั้งเซิร์ฟเวอร์ล่มด้วย packet เดียว

**การแก้:** `socket.use` middleware บังคับ `packet[1]` เป็น object เสมอก่อนถึง handler (เทสต์: ยิง `room:join` เปล่าๆ และ `seat:select` ด้วย string แล้ว `/health` ยังตอบ)

### 3. Rate limiting (MED) — แก้แล้ว
Token bucket ต่อ socket ใน middleware เดียวกัน: burst 20, เติม 10/วินาที (ค่าคงที่ `RATE_BURST`/`RATE_PER_SECOND` ใน `server.ts`) เกินโควตา → drop เงียบ + เตือน `game:error` ครั้งแรกครั้งเดียว หมายเหตุ: 10/วินาทีต่อ socket ยังพอ spam chat ให้รำคาญได้ ถ้าจะคุมเข้มค่อยแยก bucket ของ `chat:send` ทีหลัง

### 4. HTTP CORS (MED-LOW) — แก้แล้ว
เดิม `app.use(cors())` เปิดทุก origin ขณะที่ socket.io จำกัด `WEB_ORIGIN` — ตอนนี้ทั้งคู่ใช้ `WEB_ORIGIN` เดียวกัน (default `http://localhost:3000`) ผลข้างเคียง: เว็บอื่นเรียก `/cards`, `/characters`, `/rooms` จาก browser ไม่ได้แล้ว (curl/server-to-server ยังได้ — CORS คุมเฉพาะ browser)

### 5–7. บันทึกไว้ ไม่แก้รอบนี้
- **Room code จาก client**: ห้องถูกสร้างจากชื่อที่ client พิมพ์ → ห้องชื่อง่ายๆ ("test", "1234") โดนคนแปลกหน้า join ได้ ทางแก้จริงคือรหัสผ่านห้อง/room code ที่ server สุ่ม — อยู่ใน `docs/next-tasks.md` แล้ว
- **`/rooms` เผยชื่อ host + สถานะห้อง**: จำเป็นสำหรับ room browser ในหน้า lobby ยอมรับได้ ระวังอย่าเพิ่มข้อมูลลับใน endpoint นี้ (`rooms()` ใน server.ts เลือก field ชัดเจนอยู่แล้ว — ไม่มี roles/hands)
- **Dev sandbox**: guard 2 ชั้นแต่ทั้งคู่คือ `NODE_ENV !== 'production'` — Dockerfile ตั้ง `ENV NODE_ENV=production` แล้ว ✅ แต่ถ้า deploy นอก Docker ต้องไม่ลืมตั้งเอง มิฉะนั้น dev:* handlers (เสกการ์ด/แก้ HP/สลับตัว) เปิดสู่สาธารณะ

### 8. Chat / XSS (INFO)
ข้อความ chat ถูกตัดที่ 500 ตัวอักษรฝั่ง server และ render เป็น React text node ล้วน — grep ทั้ง `apps/web` ไม่พบ `dangerouslySetInnerHTML` → escape อัตโนมัติ ปลอดภัย

## สิ่งที่ viewer-safe อยู่แล้ว (ยืนยันจากโค้ด + เทสต์)
- `createPublicGameState` (packages/game/src/engine/view.ts) ตัด `drawPile` → `drawPileCount`, `deck` → `{length}`, ซ่อนมือ/บทบาท/ตัวเลือกตัวละครของคนอื่น — มีเทสต์ engine (`viewer-safe-state.test.ts`) และเทสต์ gateway คุม
- การกระทำ host-only (`game:start`, `game:cancel-start`, `room:card-name-version`) เช็ค `game.hostId` — มีเทสต์คุม
