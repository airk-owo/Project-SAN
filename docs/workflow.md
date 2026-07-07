# Workflow การทำงานกับ Project-SAN (คู่มือส่งต่องาน)

เอกสารนี้คือจุดเริ่มต้นสำหรับ AI assistant หรือนักพัฒนาที่มารับงานต่อ — สรุปวิธีทำงานกับ repo นี้และกับดักที่เคยเจอจริง อัปเดตล่าสุด: 2026-07-08 (สถานะ ณ วันนั้น: engine tests ผ่าน 308 ตัว, typecheck เขียวทั้ง 3 workspace)

---

## 1. เริ่ม session

อ่านตามลำดับนี้ก่อนแก้โค้ด:

1. [ai-working-rules.md](ai-working-rules.md) — กติกาบังคับ (server-authoritative, ห้ามเปลี่ยนกติกาเกมเอง, ขอบเขตของแต่ละโฟลเดอร์)
2. [current-status.md](current-status.md) — สถานะปัจจุบันว่าอะไรเสร็จ/ไม่เสร็จ
3. `ARCHITECTURE.md` (root) — เอกสาร onboarding ที่ละเอียดที่สุด (tech stack, โครงสร้าง, data flow, QA sandbox)

การค้นโค้ด: ใช้ `graphify query "<คำถาม>"` ก่อน grep/อ่านไฟล์ดิบ (กติกาอยู่ใน `CLAUDE.md` root และมี hook ใน `.claude/settings.json` คอยเตือน) — ได้ subgraph ที่แคบกว่าและเห็น cross-file relationships

---

## 2. Dev loop

```
npm run dev          # ที่ root — รัน web (:3000) + socket server (:3001) พร้อมกัน
npm run check        # typecheck ทุก workspace (tsc --noEmit)
npm test -w @wtk/game  # เทสต์ engine (Node test runner ผ่าน tsx --test)
```

**ห้ามรัน `npm run build` ขณะ dev server ยังรันอยู่** — `next build` กับ `next dev` ใช้โฟลเดอร์ `.next` ร่วมกัน จะทำให้ dev พังทั้ง UI (unstyled/CSS 404) หรือ error `denormalizePagePath is not a function` อาการและวิธีแก้อยู่ใน [troubleshooting.md](troubleshooting.md) ข้อ 0–1 (สรุป: ปิด process พอร์ต 3000 → ลบ `apps\web\.next` → `npm run dev` ใหม่)

อยากเช็คว่าโค้ดคอมไพล์ผ่าน ให้ใช้ `npm run check` หรือ `npx tsc --noEmit` เท่านั้น (ไม่แตะ `.next`)

เทสต์มีเฉพาะ `packages/game` (engine) — web/server ยังไม่มีเทสต์อัตโนมัติ ต้องเทสต์มือผ่าน QA sandbox (ข้อ 8)

---

## 3. กติกา styling (สำคัญ — ไม่ obvious)

**Tailwind ติดตั้งไว้แต่ inert**: มี `tailwind.config.ts` + `postcss.config.mjs` แต่ไม่มี `@tailwind` directives ใน CSS ที่ import → เขียน utility class ใน JSX (`bg-white/60`, `flex`, ฯลฯ) จะ**ไม่มีสไตล์ออกมาเลยแบบเงียบๆ**

วิธีที่ถูก:
- ใช้ semantic classes ใน `apps/web/app/styles.css` — มี CSS vars กลาง: `--bg` (ครีม), `--text`, `--primary` (ทอง), `--danger` (แดงเข้ม), `--card`, `--border`; ฟอนต์ Baozi (หัวเรื่อง) / BaiJamjuree (เนื้อความ)
- หรือ scoped `<style>{`...`}</style>` ในคอมโพเนนต์ (ดูตัวอย่างใน `apps/web/app/page.tsx`)
- ถ้าจำเป็นต้องใช้ Tailwind จริง ให้เพิ่มเฉพาะ `@tailwind utilities` (ห้าม `@tailwind base` — preflight จะ reset สไตล์ทั้งแอป)

---

## 4. ตรวจ UI จริง

ไม่มี Playwright/Puppeteer ในเครื่อง — ใช้ Chrome headless:

```
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --dump-dom http://localhost:3000
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --screenshot=out.png --window-size=1280,800 http://localhost:3000
```

---

## 5. Commit workflow

- **Commit บ่อยๆ ระหว่างทำงาน** — งานที่ยังไม่ commit หายได้ทั้ง session จากการกด Ctrl+Z ใน editor หรือ save buffer เก่าทับ (เคยเกิดจริง 2026-07-03)
- **ข้อความ commit ภาษาไทย/หลายบรรทัด**: เขียนข้อความลงไฟล์ชั่วคราวแล้ว `git commit -F <ไฟล์>` — PowerShell 5.1 ตัด argument ของ `git commit -m` พังเมื่อมีเครื่องหมายคำพูดในข้อความไทย
- **หลังแก้โค้ด**: รัน `graphify update .` เพื่อให้ knowledge graph ตรงกับโค้ด (AST-only, ไม่มีค่า API)
- ตรวจข้อความไทยในไฟล์ด้วย grep แบบ UTF-8 — PowerShell `.Contains()` ให้ผลลบปลอมกับข้อความไทย

---

## 6. Engine patterns ที่ใช้ซ้ำ (สกิล/การ์ดใหม่)

สกิลตัวละครครบทั้ง 27 ตัวแล้ว (CHAR001–027) — โค้ดอยู่ที่ `packages/game/src/engine/handlers/character-skills.ts` ถ้าต้องเพิ่มสกิล/การ์ดใหม่ ให้ทำตาม pattern ที่มีอยู่ ไม่ต้องคิดกลไกใหม่:

| Pattern | ใช้เมื่อ | ตัวอย่างที่ดูได้ |
|---|---|---|
| Pending-decision (field ใน state + `pendingTimeoutFor` auto-skip + endTurn guard + panel ฝั่ง client) | สกิลที่ต้องรอผู้เล่นตัดสินใจ | สุมาอี้ (Fankui), แฮหัวตุ้น (retaliate) |
| `SKILL_EVENT_HANDLERS` + `dispatchGameEvent` | trigger อัตโนมัติหลังเหตุการณ์ (after_damage, after_judgment ฯลฯ) | แฮหัวตุ้น |
| `CARD_CONVERSIONS` + `cardActsAs` | สกิลแปลงดอก/ใช้การ์ดแทนกัน (play-fn ต้องเช็ค `cardActsAs` ไม่ใช่ `effect` ตรงๆ) | กำเหลง, ไต้เกี้ยว |
| `reconcileLossSkills` (ปลาย `synchronizeGameState`) | trigger ตอนผู้เล่นเสียการ์ด/อุปกรณ์ ครอบคลุมทุกทางที่การ์ดหาย | ลกซุน, ซุนซ่างเซียง |

ฝั่ง client: active skill ใช้ pattern `xMode` boolean + ปุ่ม `local-skill-btn` + mode bar + branch ใน hand-card click + `xTargetable` ใน opponents map (ดู ฮัวโต๋/ซุนซ่างเซียง ใน `apps/web/app/game/local/page.tsx` และ `page.tsx`)

---

## 7. Feature ที่สร้างเผื่อไว้แต่ปิด flag: Google login + สถิติผู้เล่น

สร้างเสร็จแล้ว (commit `844e240`) แต่**ปิดโดย default ทั้ง 2 สวิตช์**:

- ฝั่ง web (build-time): `NEXT_PUBLIC_FEATURE_AUTH=1` → `apps/web/lib/flags.ts` (ปิดอยู่ `/login` และ `/profile` เป็น 404)
- ฝั่ง server (runtime): `FEATURE_AUTH_STATS=1` + Supabase env ครบ → `apps/server/src/auth-stats.ts`

ขั้นตอนเปิดใช้ทั้งหมดอยู่ใน [auth-setup.md](auth-setup.md) (มี migration `supabase/migrations/0002_auth_stats.sql`)

---

## 8. QA God Mode (dev sandbox)

เครื่องมือเทสต์เกมด้วยมือ — hot-seat ควบคุมทุกที่นั่ง, เสกการ์ด, เปลี่ยนตัวละคร, freeze timer, rig สำรับ/judgment, snapshot/load state ถูก guard สองชั้นไม่ให้หลุดไป production รายละเอียดใน `ARCHITECTURE.md` §5

---

## 9. สรุปกับดักที่เคยเจอ (อ่านก่อนจะเจอเอง)

| อาการ | สาเหตุ | ทางแก้ |
|---|---|---|
| UI หาย/ไม่มีสไตล์ใน dev, CSS 404, `denormalizePagePath` error | `.next` พัง (มักเพราะ build ทับ dev) | [troubleshooting.md](troubleshooting.md) |
| เขียน Tailwind class แล้วไม่มีอะไรเกิดขึ้น | Tailwind inert | ข้อ 3 |
| `git commit -m` ข้อความไทย → "pathspec did not match" | PowerShell 5.1 ตัด argument | เขียนไฟล์ + `git commit -F` |
| งานทั้ง session หายกลับไปเป็น HEAD | editor Undo/stale save ทับไฟล์บนดิสก์ | commit บ่อยๆ; กู้ได้จาก session transcript `.jsonl` |
| เช็คข้อความไทยด้วย PowerShell `.Contains()` แล้วไม่เจอทั้งที่มี | encoding | ใช้ grep แบบ UTF-8 |
