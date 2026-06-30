#!/usr/bin/env node
/* ============================================================================
 * build-cards.js  —  CSV → cards.json converter for Project-SAN (WTK)
 * ----------------------------------------------------------------------------
 * Pakitta keeps transcribing the deck in the friendly CSV files (number, suit,
 * name, [type]).  This script reads those CSVs and produces a single clean
 * cards.json that the game engine consumes.
 *
 *   Workflow:  edit the CSVs  →  run `node source/build-cards.js`  →  cards.json
 *
 * The CSVs stay the human-friendly source of truth. The JSON is generated —
 * never hand-edit cards.json; edit the CSV and re-run. Complex card *effects*
 * (what a tactic does in code) get layered on later in the game engine; this
 * file only carries the printed FACTS, which is everything the CSV holds.
 * ==========================================================================*/

const fs = require('fs');
const path = require('path');
const DIR = __dirname;

/* ---- Thai → data-model mappings (the dictionary) ---------------------------
 * Suits: the four French-deck suits, by their Thai names on the cards.        */
const SUIT = {
  'โพธิ์ดำ':     { id: 'spade',   color: 'black', glyph: '♠' },
  'หัวใจ':       { id: 'heart',   color: 'red',   glyph: '♥' },
  'ดอกจิก':      { id: 'club',    color: 'black', glyph: '♣' },
  'ข้าวหลามตัด': { id: 'diamond', color: 'red',   glyph: '♦' },
};

/* Basic card names → kind */
const BASIC = {
  'โจมตี':   { kind: 'strike', en: 'Strike', name_cn: '杀' },
  'หลบ':     { kind: 'dodge',  en: 'Dodge',  name_cn: '闪' },
  'เสบียง':  { kind: 'peach',  en: 'Peach',  name_cn: '桃' },  // "provisions" = the heal card
};

/* The "type" column in the tactics/equipment CSV → category + slot */
const TYPE = {
  'อุบาย':                 { category: 'tactic',    slot: null },
  'อุปกรณ์ / อาวุธ':       { category: 'equipment', slot: 'weapon' },
  'อุปกรณ์ / เกราะ':       { category: 'equipment', slot: 'armor'  },
  'อุปกรณ์ / พาหนะ':       { category: 'equipment', slot: 'horse'  },
};

/* Thai card name → short ASCII key, so ids/filenames are meaningful (not card37).
 * Add a line here as new named cards appear; unmapped names fall back to a
 * category-based slug, so the build never breaks on a missing entry. */
const NAME_KEY = {
  // tactics (อุบาย)
  'ถอนสะพาน': 'dismantle', 'เกาทัณฑ์พันดอก': 'arrow_barrage', 'ร่วมสาบาน': 'peach_garden',
  'ละโมบฉกฉวย': 'snatch', 'ยืมมือสังหาร': 'borrowed_knife', 'มีสุขลืมเมือง': 'indulgence',
  'ลอบขโมย': 'steal', 'คงกระพันชาตรี': 'nullification', 'ท้าสู้': 'duel',
  'คนเถื่อนบุกรุก': 'barbarians', 'เก็บเกี่ยวยุ้งฉาง': 'harvest', 'ฟ้าลงโทษ': 'lightning',
  // equipment — horses (พาหนะ)
  'เซ็กเธาว์': 'redhare', 'เจ่าหวงเฟยเตี้ยน': 'zhuahuang', 'ต้าหยวน': 'dayuan',
  'เต๊กเลา': 'dilu_teklao', 'เจ่าหยิง': 'zixing', 'ตี้หลู': 'dilu',
  // equipment — armor (เกราะ)
  'โล่จักรพรรดิ': 'renwang_shield', 'ค่ายกลแปดทิศ': 'bagua',
  // equipment — weapons (อาวุธ)
  'ทวนกรีดนภา': 'guding_spear', 'ทวนอสรพิษ': 'serpent_spear', 'หน้าไม้กล': 'crossbow',
  'ธนูกิเลน': 'qilin_bow', 'ขวานก้วนสื่อ': 'guanshi_axe', 'ง้าวมังกรเขียว': 'green_dragon',
  'กระบี่ชิงกัง': 'qinggang', 'กระบี่ชวงกู่': 'zhuge_crossbow', 'ดาบห่างปิง': 'fan',
};

/* Card number: keep A/J/Q/K as printed, store a numeric rank for logic. */
function rank(n) {
  const m = { A: 1, J: 11, Q: 12, K: 13 };
  return m[n] != null ? m[n] : parseInt(n, 10);
}

/* tiny CSV parser (no quoted-comma fields in this data, so split is safe) */
function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
  const header = lines.shift().split(',').map(s => s.trim());
  return lines.map(line => {
    const cells = line.split(',').map(s => s.trim());
    const row = {};
    header.forEach((h, i) => row[h] = cells[i]);
    return row;
  });
}

function slugify(s) {
  // ascii-safe id from english name + suit + number; fall back to a counter
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const warnings = [];
let auto = 0;
function makeCard(row, source) {
  const suitTh = row['สัญลักษณ์'];
  const suit = SUIT[suitTh];
  if (!suit) { warnings.push(`Unknown suit "${suitTh}" in ${source}: ${JSON.stringify(row)}`); return null; }
  const numTh = row['เลข'];
  const numRank = rank(numTh);

  const card = {
    name_th: row['ชื่อ'],
    suit: suit.id, color: suit.color, glyph: suit.glyph,
    number: numTh, rank: numRank,
    source,
  };

  let base;
  if (source === 'basic') {
    const b = BASIC[row['ชื่อ']];
    if (!b) { warnings.push(`Unknown basic name "${row['ชื่อ']}"`); return null; }
    card.category = 'basic'; card.kind = b.kind; card.name = b.en; card.name_cn = b.name_cn;
    base = slugify(b.en);
  } else {
    const t = TYPE[row['ประเภท']];
    if (!t) { warnings.push(`Unknown type "${row['ประเภท']}" for ${row['ชื่อ']}`); return null; }
    card.category = t.category;
    if (t.slot) card.slot = t.slot;
    card.name = row['ชื่อ']; // keep Thai name as the display name for tactics/equipment (no canonical en yet)
    base = NAME_KEY[row['ชื่อ']];
    if (!base) { warnings.push(`No ASCII key for "${row['ชื่อ']}" — add it to NAME_KEY (used a fallback id).`); base = card.category + (++auto); }
  }

  // id: meaningful slug + suit + number; uniqueness enforced after.
  card.id = `${base}_${suit.id}_${String(numRank).padStart(2, '0')}`;
  card.img = `${card.id}.png`;
  card.effect = { todo: 'encode in engine' }; // logic added later, not from CSV
  return card;
}

function loadAndConvert(filename, source) {
  const full = path.join(DIR, filename);
  if (!fs.existsSync(full)) { warnings.push(`Missing CSV: ${filename}`); return []; }
  const rows = parseCSV(fs.readFileSync(full, 'utf8'));
  return rows.map(r => makeCard(r, source)).filter(Boolean);
}

// --- the two source CSVs ---
const basicCards  = loadAndConvert('WTK card - หลบ,โจมตี,เสบียง.csv', 'basic');
const otherCards  = loadAndConvert('WTK card - อุบาย,อุปกรณ์.csv', 'tactic-equip');
let cards = [...basicCards, ...otherCards];

// de-dup identical ids by adding a #n suffix and tallying counts
const seen = {};
cards.forEach(c => {
  if (seen[c.id] == null) { seen[c.id] = 0; }
  else { seen[c.id]++; c.id = `${c.id}__${seen[c.id]}`; }
});

const out = {
  _meta: {
    game: 'War of the Three Kingdoms (Sanguosha / 三国杀) — Project-SAN',
    generatedBy: 'source/build-cards.js — DO NOT hand-edit. Edit the CSVs and re-run.',
    generatedAt: new Date().toISOString(),
    counts: {
      total: cards.length,
      basic: cards.filter(c => c.category === 'basic').length,
      tactic: cards.filter(c => c.category === 'tactic').length,
      equipment: cards.filter(c => c.category === 'equipment').length,
    },
  },
  roles: [
    { id: 'lord',     name: 'Lord',     name_cn: '主公', win: 'Survive and eliminate all Rebels and the Spy.' },
    { id: 'loyalist', name: 'Loyalist', name_cn: '忠臣', win: 'Keep the Lord alive.' },
    { id: 'rebel',    name: 'Rebel',    name_cn: '反贼', win: 'Kill the Lord.' },
    { id: 'spy',      name: 'Spy',      name_cn: '内奸', win: 'Be the last standing with the Lord, then defeat the Lord.' },
  ],
  cards,
};

fs.writeFileSync(path.join(DIR, 'cards.json'), JSON.stringify(out, null, 2), 'utf8');

console.log('✓ cards.json written');
console.log('  total:', out._meta.counts.total,
            '| basic:', out._meta.counts.basic,
            '| tactic:', out._meta.counts.tactic,
            '| equipment:', out._meta.counts.equipment);
if (warnings.length) {
  console.log('\n⚠ ' + warnings.length + ' warning(s):');
  warnings.forEach(w => console.log('  - ' + w));
} else {
  console.log('  no warnings — every row mapped cleanly.');
}
