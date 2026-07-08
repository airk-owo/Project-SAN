# Security Policy / นโยบายความปลอดภัย

## Reporting a Vulnerability / แจ้งช่องโหว่

พบช่องโหว่ความปลอดภัย → ส่งอีเมลมาที่ **acareinter@gmail.com** (อย่าเปิด public issue)
กรุณาแนบ: ขั้นตอนทำซ้ำ, ผลกระทบที่เป็นไปได้, และเวอร์ชัน/commit ที่ทดสอบ

If you find a security vulnerability, please email **acareinter@gmail.com** instead of
opening a public issue. Include reproduction steps, impact, and the commit tested.

โปรเจกต์นี้เป็นงานส่วนบุคคล ไม่มี bug bounty แต่จะตอบกลับและแก้ไขโดยเร็วที่สุด
This is a personal project — no bounty program, but reports are appreciated and will be
acknowledged and fixed as quickly as possible.

## Scope / ขอบเขต

- `apps/server` — socket.io gateway + HTTP routes (server-authoritative game state)
- `apps/web` — Next.js client
- `packages/game` — game engine (trust boundary: server-side only)
- `supabase/` — database schema, RLS policies, RPC functions

## Existing Reviews & Practices / เอกสารที่เกี่ยวข้อง

- ผลรีวิวความปลอดภัยเก็บใน [`REVIEWS/`](REVIEWS/) (เช่น `security-gateway.md`)
- Checklist ก่อน deploy + กติกาเขียนโค้ดให้ปลอดภัย: [`docs/security-checklist.md`](docs/security-checklist.md)
- CI สแกน secret (gitleaks) และ dependency audit ทุก push/PR (`.github/workflows/ci.yml`)
