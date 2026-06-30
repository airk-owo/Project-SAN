# Feature: card description tooltip (hover/focus)

อ่านอันนี้ก่อนนะ 💛 — เพิ่ม tooltip บอก "การ์ดนี้ทำอะไร + ใช้เมื่อไหร่" ตอนเอาเมาส์ชี้การ์ดบนมือ
ในหน้า local test (`/game/local`).

## ทำไม (why)

ตอนนี้การ์ดบนมือโชว์แค่ "WTK" + ชื่อ + ประเภท แต่ไม่บอกว่า**การ์ดทำอะไร**.
คนเล่น (โดยเฉพาะคนใหม่) ไม่รู้ว่าการ์ดแต่ละใบใช้ยังไง เลยเพิ่มคำอธิบายแบบ hover.

## สิ่งที่เพิ่ม (what's added)

- เอาเมาส์ชี้ (หรือกด Tab โฟกัส) ที่การ์ดบนมือ → ขึ้น tooltip:
  - **ชื่อการ์ด** (ตัวอักษร Baozi สีแดง เหมือนธีมเดิม)
  - **ประเภท + เลข/ดอก** (เช่น "อุบาย · A♥")
  - **คำอธิบายกฎ** (ข้อความไทยจริงจาก `data/generated/cards.json`)
  - **"เมื่อไหร่:"** — คำแนะนำสั้น ๆ ว่าควรเล่นตอนไหน
- ใช้สีโทนไม้/ทองให้เข้ากับโต๊ะเกม + มีลูกศรชี้ลงการ์ด
- รองรับคีย์บอร์ด (Tab/Enter/Space) และ `prefers-reduced-motion`.

## หมายเหตุสำคัญ (important)

การ์ดในหน้า demo ถูกสร้างเองในไฟล์ (`description: null`) ไม่ได้อ่านจาก data จริง
เลยทำ lookup `CARD_INFO` (keyed by `effect`) ที่ก๊อปคำอธิบายไทยมาจาก `cards.json`.
**ถ้าแก้คำอธิบายใน source data ในอนาคต อย่าลืมอัปเดต `CARD_INFO` ด้วย** (มี comment เตือนไว้ในโค้ด).

> รูป/อาร์ตของการ์ด: ยังเป็น "WTK" placeholder อยู่ — เราจะดึงรูปจริงจาก PDF (`ไพ่.pdf`) เป็นสเต็ปถัดไป.

## ไฟล์ที่แก้ (files)

- `apps/web/app/game/local/page.tsx` — เพิ่ม `CARD_INFO` lookup + tooltip markup + keyboard support
- `apps/web/app/styles.css` — สไตล์ `.card-tip`

**ไม่ได้แตะ engine (`packages/game`) เลย.**

## ทดสอบ (verify)

```
npm run check -w @wtk/web    # tsc ผ่าน ไม่มี error ✅
npm run dev                  # http://localhost:3000/game/local
```

1. เอาเมาส์ชี้การ์ดบนมือ → tooltip ขึ้นพร้อมคำอธิบาย + "เมื่อไหร่"
2. กด Tab ไปที่การ์ด → tooltip ขึ้นเหมือนกัน (รองรับคีย์บอร์ด)
3. tooltip ไม่โดนตัด/บังขอบจอ
4. การเล่นการ์ด (คลิกเลือก) ยังทำงานเหมือนเดิม

— ทำโดย Protocol (ผ่าน Claude Code) · ใช้ความช่วยเหลือจาก skill "impeccable" เรื่องดีไซน์
