# Troubleshooting (dev)

บันทึกปัญหาที่เคยเจอ + วิธีแก้ที่ยืนยันแล้ว เพื่อให้แก้ครั้งหน้าได้ไวขึ้น

---

## 0. ⚠️ อย่ารัน `npm run build` ตอน dev server เปิดอยู่ (สาเหตุหลักของ .next พัง)

`next dev` กับ `next build` **ใช้โฟลเดอร์ `.next` ตัวเดียวกัน** ถ้ารัน `npm run build` (production)
ขณะที่ `npm run dev` กำลังรัน → build เขียนทับ `.next` ด้วยไฟล์ production → dev server อ่าน chunk ไม่ตรงกัน → พัง

**อาการ:** Runtime TypeError เช่น `(0 , d.denormalizePagePath) is not a function` ที่ `.next/server/chunks/*.js`
(หรือ CSS 404 / UI หาย — ดูข้อ 1)

**กฎ:** เช็กว่าโค้ดคอมไพล์ผ่านให้ใช้ `npx tsc --noEmit` (ไม่แตะ `.next`). จะรัน `next build` จริงๆ ให้**หยุด dev server ก่อน**
ถ้าเผลอ build ทับไปแล้ว → หยุด dev, ล้าง `.next`, `npm run dev` ใหม่ (วิธีเดียวกับข้อ 1)

**Verified fix:**
```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
if ($p) { Stop-Process -Id $p -Force }
Remove-Item -Recurse -Force "apps\web\.next"
npm run dev
```

---

## 1. หน้าเว็บไม่มีสไตล์ / "UI หาย" (CSS โหลดไม่ได้ 404 ในโหมด dev)

### อาการ
- เนื้อหาหน้าอยู่ครบ (title, ปุ่ม, ข้อความ) แต่ **ไม่มี CSS เลย** — ตัวหนังสือดำล้วนบนพื้นขาว ฟอนต์ default เหมือน HTML ดิบ ไม่มีการ์ด/สี/พื้นหลัง
- ดูเผินๆ เหมือน "หน้าตา UI หายไป"
- เกิดกับทุกหน้า (เพราะ CSS เป็น global ใน `app/layout.tsx` → `import './styles.css'`)

### สาเหตุ
- แคช dev ของ Next.js (`apps/web/.next`) เพี้ยน → HTML ยังลิงก์ไปที่ไฟล์ CSS chunk แต่ dev server ตอบ **404 "Not Found"** ที่ URL นั้น
- มักเกิดหลังแก้โค้ด/CSS รัวๆ หลายรอบติดกัน (HMR สะสมจน state เพี้ยน)
- **ไม่ใช่บั๊กในโค้ด** — ยืนยันได้เพราะ `npm run build` (production) คอมไพล์ CSS ผ่านปกติ

### วิธีเช็ก (diagnosis) — ทำเร็วๆ
```bash
# 1. ดึง DOM ที่ client เรนเดอร์จริง หา <link> ของ CSS
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu \
  --virtual-time-budget=8000 --dump-dom "http://localhost:3000/" > /tmp/dom.html
grep -o '/_next/static/css/[^"?]*' /tmp/dom.html | head -1

# 2. curl ไฟล์ CSS นั้น — ถ้าได้ ~9 ไบต์ = "Not Found" แปลว่าแคชเพี้ยน (ปกติควรเป็นหลายหมื่นไบต์)
curl -s "http://localhost:3000/_next/static/css/app/layout.css" -o /tmp/x.css
wc -c /tmp/x.css ; cat /tmp/x.css
```
- CSS ~9 ไบต์ + เนื้อหา "Not Found" → ยืนยันปัญหานี้
- CSS หลายหมื่นไบต์ + มี `.lobby{` / `--primary` → CSS ปกติ ปัญหาอยู่ที่อื่น

### วิธีแก้ (ยืนยันแล้วว่าหาย)
```powershell
# หยุด process บนพอร์ต 3000
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
     Select-Object -First 1 -ExpandProperty OwningProcess
if ($p) { Stop-Process -Id $p -Force }

# ลบแคช dev แล้วรีสตาร์ท
Remove-Item -Recurse -Force "apps\web\.next"
npm run dev
```
เสร็จแล้ว **รีเฟรชเบราว์เซอร์** → CSS กลับมา (ไฟล์ ~44 KB) หน้าตาปกติ

### ยืนยันว่าแก้สำเร็จ
```bash
curl -s "http://localhost:3000/_next/static/css/app/layout.css?v=..." -o /tmp/css.css
wc -c /tmp/css.css   # ควรเป็นหลายหมื่นไบต์
grep -o "\.lobby{\|--primary:#B88A3B\|BaiJamjuree" /tmp/css.css | sort -u
# ถ่ายสกรีนช็อตดูจริง:
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu \
  --window-size=1280,900 --virtual-time-budget=5000 \
  --screenshot="<scratchpad>/entry.png" "http://localhost:3000/"
```

### กันไว้
- เจอ CSS/หน้าตาเพี้ยนใน dev หลังแก้โค้ดเยอะๆ → เคลียร์ `.next` + รีสตาร์ทก่อนเสมอ (อย่าเพิ่งไล่แก้โค้ด)
- production build (`npm run build`) ไม่เจอปัญหานี้ (ใช้ static CSS `<link>` ไม่ใช่ chunk แบบ dev)

---

## เครื่องมือที่มีในเครื่องนี้ (สำหรับ debug UI)
- **ไม่มี** playwright/puppeteer ติดตั้ง
- **มี** Chrome ที่ `C:\Program Files\Google\Chrome\Application\chrome.exe` และ Edge — ใช้ `--headless --dump-dom` (ดู DOM หลัง JS รัน) และ `--screenshot` (ดูภาพจริง) ได้
- ดู SSR HTML เฉยๆ ใช้ `curl` ได้ แต่โหมด dev ฉีด CSS ผ่าน JS — ต้องใช้ browser จริงถึงจะเห็นสไตล์
