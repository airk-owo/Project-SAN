# เปิดใช้ระบบล็อกอิน Google + สถิติผู้เล่น

โค้ดระบบบัญชี/สถิติถูกสร้างไว้ครบแล้วแต่ **ปิดอยู่โดยค่าเริ่มต้น** — เมื่อ flag ปิด
แอปทำงานเหมือนไม่มีระบบนี้เลย (ไม่มีปุ่มล็อกอิน, `/login` และ `/profile` เป็น 404,
server ไม่แตะ Supabase) เอกสารนี้คือขั้นตอน "วันที่จะเปิดใช้จริง"

## ภาพรวมสถาปัตยกรรม

- **ล็อกอินเป็นทางเลือก** — guest เล่นได้เหมือนเดิมทุกอย่าง เฉพาะคนที่ล็อกอิน Google เท่านั้นที่มีโปรไฟล์และสถิติ
- **identity ในเกมยังเป็น `wtk-member-id`** (UUID ใน localStorage) เหมือนเดิม — ตอน join ห้อง
  client จะแนบ Supabase access token ไปด้วย, server ตรวจ token เอง (`auth.getUser`)
  แล้วผูก guest id ↔ auth id ในหน่วยความจำ ไม่เชื่อ id ที่ client อ้างมาเด็ดขาด
- **สถิติเขียนจาก server เท่านั้น** ผ่าน RPC `record_game_result` ด้วย service role key —
  browser มีสิทธิ์แค่ SELECT (และแก้ `username`/`avatar` ของตัวเอง) จะปั๊มสถิติเองไม่ได้
- **บันทึกเกมละ 1 ครั้งเป๊ะ** — กันซ้ำ 2 ชั้น: flag ในหน่วยความจำของ server +
  `on conflict do nothing` บน `game_sessions.id` ใน DB (ยิงซ้ำ = ไม่มีผล)
- ไฟล์หลัก: `apps/server/src/auth-stats.ts` (server), `apps/web/lib/useAuth.ts` +
  `apps/web/lib/flags.ts` (web), `supabase/migrations/000{1,2}_*.sql` (DB)

## ขั้นตอนเปิดใช้

### 1. สร้าง Supabase project (ฟรี)

1. สมัคร/ล็อกอินที่ <https://supabase.com> → **New project** (เลือก region ใกล้ผู้เล่น เช่น Singapore)
2. จด 3 ค่านี้จาก **Project Settings → API**:
   - Project URL (ใช้เป็นทั้ง `NEXT_PUBLIC_SUPABASE_URL` และ `SUPABASE_URL`)
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**ลับสุดยอด** — อยู่ได้เฉพาะฝั่ง server ห้ามหลุดไป browser/git)

### 2. Apply migrations

เปิด **SQL Editor** ใน Supabase dashboard แล้วรันตามลำดับ:

1. เนื้อหา `supabase/migrations/0001_initial.sql`
2. เนื้อหา `supabase/migrations/0002_auth_stats.sql`

(หรือใช้ supabase CLI: `supabase link` แล้ว `supabase db push`)

### 3. ตั้ง Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com) → สร้าง project → **APIs & Services → Credentials → Create OAuth client ID** (Web application)
2. Authorized redirect URI ใส่ค่าจาก Supabase: **Authentication → Providers → Google** จะโชว์ callback URL รูปแบบ
   `https://<project-ref>.supabase.co/auth/v1/callback`
3. เอา Client ID + Client Secret ไปกรอกใน Supabase **Authentication → Providers → Google** แล้ว Enable
4. ใน Supabase **Authentication → URL Configuration**: ตั้ง Site URL เป็นโดเมนเว็บจริง
   และเพิ่ม `http://localhost:3000` ใน Redirect URLs สำหรับทดสอบ local

### 4. ใส่ env + เปิด flag

| ที่ | ตัวแปร | ค่า |
|---|---|---|
| Web (Vercel / `.env.local`) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | จากข้อ 1 |
| Web | `NEXT_PUBLIC_FEATURE_AUTH` | `1` — **build-time**: ตั้งแล้วต้อง redeploy ถึงมีผล (นี่คือสวิตช์เปิด/ปิดฝั่งเว็บ) |
| Server (Koyeb / `.env`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | จากข้อ 1 |
| Server | `FEATURE_AUTH_STATS` | `1` — runtime: restart server แล้วมีผลเลย |

ปิดระบบกลับ: ลบ/ล้าง flag ทั้งสอง (web ต้อง redeploy) — ข้อมูลใน DB อยู่ครบ ไม่หาย

### 5. Checklist ทดสอบหลังเปิด

- [ ] server log ขึ้น `[stats] auth + stats recording enabled`
- [ ] ล็อกอิน Google ครั้งแรก → มีแถวใน `profiles` อัตโนมัติ (username จากชื่อ Google, มี `google_id`, `created_at`)
- [ ] ชื่อซ้ำ: บัญชีที่สองที่ชื่อ Google เหมือนกัน → ได้ username ต่อท้าย `-1`
- [ ] chip มุมขวาบนโชว์รูป Google + ลิงก์ โปรไฟล์/ออกจากระบบ; guest ยังเล่นได้ปกติ
- [ ] เล่นจนจบ 1 เกม (คนล็อกอิน 1 + guest ที่เหลือ) → `game_sessions` 1 แถว,
      `game_participants` เฉพาะคนล็อกอิน, counters ใน `profiles` ขยับถูก (role/ชนะ/สตรีค/รอดชีวิต)
- [ ] reconnect เข้าห้องเดิมหลังเกมจบ → ยังมี session แถวเดียว (ไม่บันทึกซ้ำ)
- [ ] เล่นซ้ำห้องเดิมอีกเกม → ได้ session แถวใหม่แยกกัน
- [ ] เกมที่มีแต่ guest ล้วน → ไม่มีแถวอะไรเพิ่มเลย
- [ ] `/profile` โชว์สถิติถูกต้อง
- [ ] **Spoof test** จาก browser console (ใช้ anon client):
  - `supabase.from('profiles').update({ total_wins: 999 }).eq('id', myId)` → ต้องถูกปฏิเสธ (column grant)
  - `supabase.rpc('record_game_result', {...})` → ต้อง permission denied
  - `supabase.from('game_sessions').insert({...})` → ต้องถูกปฏิเสธ (RLS)
  - `supabase.from('profiles').update({ username: 'ใหม่' }).eq('id', myId)` → ต้องสำเร็จ (แก้ได้เฉพาะของตัวเอง)

## ขอบเขต/พฤติกรรมที่ตั้งใจ

- Server restart กลางเกม → เกมนั้นหายทั้งเกม (เหมือนเดิม) จึงไม่มีสถิติของเกมนั้น
- Token หมดอายุกลางเกม → ไม่กระทบสถิติ (ผูกตัวตนตั้งแต่ join; ตอน reconnect client ขอ token ใหม่ให้เอง)
- ผู้เล่นหลุดก่อนจบเกม → ยังโดนบันทึกแพ้/ชนะตามผลจริง (server จำ binding ไว้ตั้งแต่เกมเริ่ม)
- RPC ล้มเหลว (เน็ต/DB ล่ม) → retry 3 ครั้ง แล้ว log `[stats] giving up …` — สถิติเกมนั้นหายแต่เกมไม่สะดุด
