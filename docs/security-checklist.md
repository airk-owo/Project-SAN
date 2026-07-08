# Security Checklist (รากฐานความปลอดภัยของ repo)

อัปเดตล่าสุด: 2026-07-08 — คู่กันกับ [`SECURITY.md`](../SECURITY.md) (นโยบายรับแจ้งช่องโหว่) และผลรีวิวใน `REVIEWS/`

## 1. Checklist ก่อน deploy ทุกครั้ง

- [ ] `NODE_ENV=production` (Dockerfile ตั้งให้แล้ว — ถ้า deploy นอก Docker ต้องตั้งเอง)
- [ ] **ไม่ตั้ง** `DEV_SANDBOX` — QA God Mode เป็น opt-in (`DEV_SANDBOX=1` มีเฉพาะใน dev script) ลืมตั้ง = ปิด ซึ่งคือพฤติกรรมที่ต้องการบน production
- [ ] `WEB_ORIGIN` ตั้งเป็น origin จริงของเว็บ (คุมทั้ง HTTP CORS และ socket.io) — default คือ `http://localhost:3000` ซึ่งใช้บน production ไม่ได้
- [ ] `NEXT_PUBLIC_SOCKET_URL` ตั้งตอน build เว็บ — ถ้าลืม เว็บจะ fallback ไป `http://localhost:3001` เงียบๆ
- [ ] `SUPABASE_SERVICE_ROLE_KEY` อยู่ฝั่ง server เท่านั้น (ห้ามมี prefix `NEXT_PUBLIC_`, ห้ามลง git — `.gitignore` และ `.dockerignore` กัน `.env*` ไว้แล้ว)
- [ ] ถ้าเปิด auth/stats: รัน spoof-test ตาม `docs/auth-setup.md` (พยายาม update `total_wins` ด้วย anon, เรียก RPC ตรง, insert session — ต้องโดนปฏิเสธทั้งหมด)
- [ ] Container ต้องรันเป็น user `node` ไม่ใช่ root (`docker run --rm <image> whoami` → `node`)

## 2. กติกาเขียน socket handler ใหม่ (`apps/server/src/server.ts`)

ทุก handler ใหม่ต้อง:

1. **Coerce payload ทุก field** — middleware บังคับให้ payload เป็น object แล้ว แต่ field ข้างในยังเป็นอะไรก็ได้: ใช้ `String(x||'')`, `Number(x)`, `Array.isArray(x)` ก่อนใช้เสมอ
2. **จำกัดความยาว string ที่มาจากผู้ใช้** — pattern ที่ใช้แล้ว: username `.slice(0,32)`, room id `.slice(0,64)`, chat `.slice(0,500)`; อย่าปล่อย string เข้า state โดยไม่มี cap
3. **เช็คตัวตนและสิทธิ์** — `requireUser(socket.id, socket.data.userId)` สำหรับทุก action; เช็ค `game.hostId` สำหรับ action ของ host (เช่น `game:start`)
4. **ห้ามส่ง state ดิบ** — broadcast ผ่าน `emitGame`/`createPublicGameState` เท่านั้น (ซ่อนมือ/บทบาท/กองจั่วของคนอื่น) ห้าม `io.emit(..., game)` ตรงๆ
5. **wrap ด้วย try/catch → `game:error`** ตาม pattern เดิม (มี safety net ใน `index.ts` แต่ไม่ใช่ข้ออ้างให้ปล่อย error หลุด)
6. **เขียนเทสต์ใน `server.test.ts`** — อย่างน้อย happy path + ปฏิเสธคนไม่มีสิทธิ์

ขีดจำกัดระดับ transport ที่ตั้งไว้แล้ว (อย่าลบ): `maxHttpBufferSize: 1e5` (100KB/ข้อความ), rate limit token bucket ต่อ socket (`RATE_BURST=20`, `RATE_PER_SECOND=10`)

## 3. เครื่องมืออัตโนมัติที่ทำงานอยู่

| เครื่องมือ | ทำงานเมื่อ | ทำอะไร |
|---|---|---|
| gitleaks (job `security` ใน CI) | ทุก push/PR | สแกน secret ทั้ง git history |
| `npm audit --audit-level=high` (CI) | ทุก push/PR | fail เมื่อ dependency มีช่องโหว่ high/critical |
| Dependabot (`.github/dependabot.yml`) | รายสัปดาห์ | เปิด PR อัปเดต npm (รวม minor/patch เป็นกลุ่ม) + GitHub Actions |

ตรวจเองบนเครื่อง (Windows): `npm audit --audit-level=high`

⚠️ **ห้ามรัน `npm audit fix --force`** — ณ 2026-07-08 มี moderate 2 ตัวจาก postcss ที่ฝังมากับ next; `--force` จะ downgrade next เป็น v9 (พังทั้งแอป) ปล่อยให้ Dependabot พาไป next เวอร์ชันที่แก้แล้วแทน

## 4. Backlog ความปลอดภัย (ยังไม่ทำ — เรียงตามความคุ้ม)

1. **Room password / room code สุ่มจาก server** — ตอนนี้ห้องสร้างจากชื่อที่ client พิมพ์ ห้องชื่อง่ายโดนคนแปลกหน้า join ได้ (อยู่ใน `docs/next-tasks.md` ข้อ 3)
2. **Content-Security-Policy** — ตอนนี้เว็บมี security headers พื้นฐานแล้ว (`apps/web/next.config.mjs`) แต่ยังไม่มี CSP เพราะแอปใช้ inline `<style>` ทั่วทั้งแอป draft เริ่มต้นเมื่อพร้อม:
   `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss: <SOCKET_URL> https://*.supabase.co; font-src 'self'; frame-ancestors 'none'`
   (dev ของ Next ต้องเพิ่ม `'unsafe-eval'` ใน script-src — ควรแยก policy ตาม NODE_ENV แล้วเทสต์ทุกหน้า)
3. **zod ที่ socket ingress** — แทน hand-rolled coercion ต่อ handler ถ้า handler โตขึ้นเรื่อยๆ (ตอนนี้ pattern ข้อ 2 + เทสต์คุมพออยู่)
4. **แยก rate-limit bucket ของ `chat:send`** — 10 msg/s ยังพอ spam chat ให้รำคาญได้ (บันทึกไว้ใน `REVIEWS/security-gateway.md` ข้อ 3)
5. **CodeQL** — ถ้า repo เป็น public เปิดฟรีได้เลย (Settings → Security → Code scanning); private ต้องใช้ Advanced Security
