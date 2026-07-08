// Skill registry + suit conversions + passive skill predicates (L2 ของ layering:
// พึ่งแค่ types + state) — ย้าย verbatim จาก handlers/character-skills.ts
// เพื่อตัด import cycle ระหว่าง handlers ทุกตัวที่ต้องเช็คสกิล
import type { Card, GameState } from "./types.js";
import {
  characterName,
  getPlayerById,
  grantDraws,
  logAction,
} from "./state.js";

// ── Character skills ──────────────────────────────────────────────────────
// Machine-readable keys for the character skills the engine implements, mapped by character id.
// The Thai skill names/descriptions live in the character data; this maps them to engine behavior.
export const CHARACTER_SKILLS: Record<string, string[]> = {
  CHAR001: ["discard_then_draw_equal", "emperor_rescue_double"], // ซุนกวน — ถ่วงดุล + ค้ำจุน (จักรพรรดิ: ถ้ามีพันธมิตรง่อก๊ก ถูกช่วยตอนใกล้ตายฟื้น +1)
  CHAR002: ["black_as_dismantle"], // กำเหลง — บ้าบิ่น: ใช้การ์ด ♠/♣ แทน "ถอนสะพาน" ได้
  CHAR003: ["skip_discard_if_no_attack"], // ลิบอง — ยับยั้งชั่งใจ: ถ้าไม่ได้ใช้ "โจมตี" ในรอบนี้ ข้ามช่วงทิ้งไพ่ได้
  CHAR004: ["self_damage_draw"], // อุยกาย — พลีชีพ: จ่าย 1 พลังชีวิต จั่ว 2 ใบ
  CHAR005: ["draw_phase_plus_one", "dischord"], // จิวยี่ — ยอดวีรชน + บาดหมาง (เป้าเลือกดอก สุ่มหยิบไพ่จิวยี่ ผิดดอกเสีย 1 HP)
  CHAR008: ["marriage_heal", "draw_on_equipment_lost"], // ซุนซ่างเซียง — แผนแต่งงาน + องค์หญิงน้อย (เสียอุปกรณ์ 1 ชิ้น จั่ว 2)
  CHAR009: ["benevolence_give", "ask_shu_attack"], // เล่าปี่ — เมตตาธรรม + คุณธรรมสามัคคี (จักรพรรดิ: ให้พันธมิตรจ๊กก๊กโจมตีแทน)
  CHAR019: ["raid_draw_phase"], // เตียวเลี้ยว — จู่โจมฉับพลัน: แทนการจั่ว หยิบไพ่คนละ 1 ใบจากขุนพลอื่นไม่เกิน 2 คน
  CHAR020: ["unarmed_tiger"], // เคาทู — ฆ่าเสือมือเปล่า: จั่วเฟสจั่วเพียง 1 ใบ เพื่อ +1 ดาเมจ "โจมตี"/"ท้าสู้" ในรอบนั้น
  CHAR006: ["redirect_attack", "diamond_as_indulgence"], // ไต้เกี้ยว — ระเหเร่ร่อน + โปรยเสน่ห์ (ใช้ ♦ แทน "มีสุขลืมเมือง")
  CHAR007: ["immune_indulgence", "immune_steal", "draw_on_last_card_lost"], // ลกซุน — อ่อนน้อมถ่อมตน + เชื่อมค่ายทดแทน (เสียไพ่ใบสุดท้าย จั่ว 1)
  CHAR010: ["red_as_attack"], // กวนอู — เทพสงคราม: ใช้การ์ด ♥/♦ เป็น "โจมตี" ได้
  CHAR022: ["black_as_dodge", "fortune_judgment"], // เอียนสี — สาวงามล่มเมือง (♣/♠ เป็น "หลบ") + พึ่งวาสนา (เปิดดวง เก็บดอกดำ วนจนเจอแดง)
  CHAR023: ["red_as_heal", "miracle_medicine"], // ฮัวโต๋ — ปฐมพยาบาล (♥/♦ เป็น "เสบียง" นอกตาตัวเอง) + ยาสวรรค์ (1/รอบ ทิ้ง 1 ใบ ฟื้น 1 HP ให้ใครก็ได้)
  CHAR011: ["unlimited_attack"], // เตียวหุย — คำราม: ใช้ "โจมตี" ได้ไม่จำกัดจำนวนครั้ง
  CHAR012: ["immune_attack_when_handless", "peek_reorder_deck"], // จูกัดเหลียง — กลยุทธ์เมืองว่าง + หยั่งรู้ฟ้าดิน (เปิดดูไพ่บนสุด X จัดเรียงใหม่)
  CHAR013: ["attack_dodge_swap"], // จูล่ง — กล้าหาญ: ใช้ "โจมตี" แทน "หลบ" และ "หลบ" แทน "โจมตี" ได้
  CHAR014: ["outgoing_distance_minus_one", "attack_judgment_no_dodge"], // ม้าเฉียว — ทหารม้า + ม้าคะนองศึก (โจมตีแล้วเปิดตัดสิน ♥/♦ = เป้าหมายหลบไม่ได้)
  CHAR015: ["draw_on_instant_trick", "trick_ignore_distance"], // หวงเย่อิง — คลังปัญญา (ใช้อุบายไม่รอเวลา จั่ว 1) + ผู้วิเศษ (อุบายไม่จำกัดระยะ)
  CHAR016: ["gain_damage_card", "ask_wei_dodge"], // โจโฉ — ไม่ยอมให้โลกทรยศ + ปกป้องราชันย์ (จักรพรรดิ: ให้พันธมิตรวุยก๊กหลบแทน)
  CHAR017: ["replace_judgment", "take_card_from_damager"], // สุมาอี้ — กำหนดชะตา + กลยุทธ์โต้กลับ (หยิบไพ่คนที่ทำดาเมจ)
  CHAR018: ["retaliate_judgment"], // แฮหัวตุ้น — ย้อนรอยศัตรู: โดนดาเมจแล้วเปิดตัดสิน ไม่ใช่ ♥ → คนทำดาเมจ ทิ้ง 2 ใบ หรือ รับ 1 ดาเมจ
  CHAR021: ["keep_judgment", "draw_on_damage"], // กุยแก — คาดการณ์แม่นยำ (เก็บไพ่ตัดสินทุกใบ) + คำสั่งเสีย (โดนดาเมจ ได้สิทธิ์จั่ว 2/ดาเมจ)
  CHAR024: ["attack_needs_two_dodges"], // ลิโป้ — ไร้เทียมทาน: เป้าหมายต้องใช้ "หลบ" 2 ใบจึงจะหลบได้
  CHAR025: ["draw_on_turn_end", "incite_duel"], // เตียวเสี้ยน — งามกลบแสงจันทร์ + สาวงามยุยง (ทิ้ง 1 ใบ บังคับขุนพลชาย 2 คนท้าสู้กัน)
  CHAR027: ["must_be_targeted_when_loaded", "emperor_arrogance"], // อ้วนสุด — ศัตรูหมายหัว + จองหอง (จักรพรรดิ: จั่วเพิ่ม 1 แลกกับขีดจำกัดมือ -1)
};
export const hasCharacterSkill = (
  state: GameState,
  playerId: string,
  key: string,
) => {
  const player = getPlayerById(state, playerId);
  return Boolean(
    player?.character && CHARACTER_SKILLS[player.character.id]?.includes(key),
  );
};
// Suit-based card conversions (กวนอู/เอียนสี/ฮัวโต๋): a card of a given suit may act as another card type.
const CARD_CONVERSIONS: Record<string, { suits: string[]; as: string }> = {
  red_as_attack: { suits: ["♥", "♦"], as: "attack" },
  black_as_dodge: { suits: ["♠", "♣"], as: "dodge" },
  red_as_heal: { suits: ["♥", "♦"], as: "heal" },
  black_as_dismantle: { suits: ["♠", "♣"], as: "discard_target_card" }, // กำเหลง บ้าบิ่น: ♠/♣ เป็น ถอนสะพาน
  diamond_as_indulgence: { suits: ["♦"], as: "delayed_skip_play_phase" }, // ไต้เกี้ยว โปรยเสน่ห์: ♦ เป็น มีสุขลืมเมือง
};
/** True if `card` counts as `asEffect` for this player (its own effect, จูล่ง's attack⇄dodge swap, or a suit conversion). */
export const cardActsAs = (
  state: GameState,
  playerId: string,
  card: Card,
  asEffect: string,
): boolean => {
  if (card.effect === asEffect) return true;
  if (
    hasCharacterSkill(state, playerId, "attack_dodge_swap") &&
    ((asEffect === "dodge" && card.effect === "attack") ||
      (asEffect === "attack" && card.effect === "dodge"))
  )
    return true;
  const keys =
    CHARACTER_SKILLS[getPlayerById(state, playerId)?.character?.id ?? ""] ?? [];
  return keys.some((key) => {
    const conv = CARD_CONVERSIONS[key];
    return Boolean(
      conv && conv.as === asEffect && conv.suits.includes(card.suit),
    );
  });
};
/** จูกัดเหลียง กลยุทธ์เมืองว่าง: a handless holder of this skill cannot be targeted by Attack. */
export const isImmuneToAttack = (state: GameState, targetId: string) => {
  const t = getPlayerById(state, targetId);
  return Boolean(
    t &&
    t.hand.length === 0 &&
    hasCharacterSkill(state, targetId, "immune_attack_when_handless"),
  );
};
/** ลิโป้ ไร้เทียมทาน: how many หลบ the target must play to fully dodge this attacker's Attack. */
export const attackDodgesRequired = (state: GameState, attackerId: string) =>
  hasCharacterSkill(state, attackerId, "attack_needs_two_dodges") ? 2 : 1;
/** เคาทู ฆ่าเสือมือเปล่า: +1 damage on Attack/Duel for the rest of the turn after drawing only one card. */
export const attackDamageBonus = (state: GameState, attackerId: string) =>
  hasCharacterSkill(state, attackerId, "unarmed_tiger") &&
  state.unarmedPowerActive
    ? 1
    : 0;
/** ลกซุน เชื่อมค่ายทดแทน (draw on losing last hand card) + ซุนซ่างเซียง องค์หญิงน้อย (draw 2 per equipment lost). Detected by diffing a per-player snapshot each sync — so every card/equipment removal path is covered centrally. Idempotent. */
export function reconcileLossSkills(state: GameState) {
  if (state.phase !== "playing") return;
  const track = state.lossTracking ?? (state.lossTracking = {});
  for (const player of state.players) {
    const equipIds = Object.values(player.equipment)
      .filter((c): c is Card => Boolean(c))
      .map((c) => c.id);
    const prev = track[player.id];
    if (!prev) {
      track[player.id] = { hand: player.hand.length, equip: equipIds };
      continue;
    } // first sight: seed only
    if (player.alive) {
      if (
        hasCharacterSkill(state, player.id, "draw_on_last_card_lost") &&
        prev.hand > 0 &&
        player.hand.length === 0
      ) {
        grantDraws(state, player.id, 1);
        logAction(
          state,
          "skill-lianying",
          `${characterName(player)} ใช้ เชื่อมค่ายทดแทน (มือว่าง) ได้สิทธิ์จั่ว 1 ใบ`,
          player.id,
        );
      }
      if (hasCharacterSkill(state, player.id, "draw_on_equipment_lost")) {
        const lost = prev.equip.filter((id) => !equipIds.includes(id)).length;
        if (lost > 0) {
          grantDraws(state, player.id, 2 * lost);
          logAction(
            state,
            "skill-princess",
            `${characterName(player)} ใช้ องค์หญิงน้อย เสียอุปกรณ์ ${lost} ชิ้น ได้สิทธิ์จั่ว ${2 * lost} ใบ`,
            player.id,
          );
        }
      }
    }
    track[player.id] = { hand: player.hand.length, equip: equipIds };
  }
}
