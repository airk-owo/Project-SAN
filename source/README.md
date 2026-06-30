# Project-SAN · card data pipeline

How the card data flows from spreadsheets the game can't read into JSON the game can.

```
  WTK card - หลบ,โจมตี,เสบียง.csv   (basic: Strike / Dodge / Peach)
  WTK card - อุบาย,อุปกรณ์.csv      (tactics + equipment)
            │
            │   node source/build-cards.js
            ▼
        cards.json   ← generated. the game engine reads THIS.
```

## The workflow

1. **Edit the CSVs** as you transcribe the deck (number `เลข`, suit `สัญลักษณ์`,
   name `ชื่อ`, and for the second file a type `ประเภท`). These spreadsheets are
   the **human source of truth** — friendly to edit, no code needed.
2. **Run the build:** from the repo root,
   ```
   node source/build-cards.js
   ```
3. It writes **`cards.json`** and prints a summary + any warnings.

> **Never hand-edit `cards.json`.** It's generated. Edit the CSV and re-run, or your
> change gets overwritten next build.

## Why CSV *and* JSON (not just one)

- **CSV** is perfect for a human typing flat, repetitive rows fast. Right tool for transcribing.
- **JSON** is what the program needs — nested structure for suits, numbers, slots, and
  (later) card effects/logic. CSV can't hold that cleanly.
- The converter bridges them: **you keep the easy format, the game gets the strict one.**

## What the converter maps

| CSV (Thai) | → | JSON |
|---|---|---|
| โพธิ์ดำ / หัวใจ / ดอกจิก / ข้าวหลามตัด | → | spade / heart / club / diamond (+ color, glyph) |
| โจมตี / หลบ / เสบียง | → | strike / dodge / peach (basic kinds) |
| อุบาย | → | category `tactic` |
| อุปกรณ์ / อาวุธ·เกราะ·พาหนะ | → | category `equipment`, slot weapon·armor·horse |
| A / J / Q / K | → | kept as printed + a numeric `rank` for logic |

## Adding a new named card

If you add a tactic/equipment card whose Thai name isn't known yet, the build still
works but warns and uses a fallback id. To give it a clean id, add one line to the
`NAME_KEY` map in `build-cards.js` (`'ไทย': 'ascii_key'`). Basic cards need nothing.

## What's NOT in here yet

The **card effects** (what a tactic actually *does* in code) aren't derived from the
CSV — they get encoded in the game engine later. The CSV/JSON carries the printed
**facts** (suit, number, name, type), which is exactly the foundation the engine builds on.

_Current deck: 108 cards — 53 basic, 36 tactic, 19 equipment. 27 per suit (balanced ✓)._
