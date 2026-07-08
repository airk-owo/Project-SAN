// Weapon/armor passive predicates (L4 ของ layering: พึ่งแค่ state + skills)
// ย้าย verbatim จาก equipment.ts เพื่อตัดวง equipment ↔ combat / character-skills:
// ทุก handler เช็ค passive พวกนี้ได้โดยไม่ดึง equipment.ts (ที่พึ่ง combat) มาทั้งไฟล์
import type { GameState, Player } from "../types.js";
import { getPlayerById } from "../state.js";
import { hasCharacterSkill } from "../skills.js";
/** TODO: import each weapon's source range into effectParams.range during card-data ingestion. */
export function getAttackRange(state: GameState, playerId: string) {
  const range = getPlayerById(state, playerId)?.equipment.weapon?.effectParams
    .range;
  return typeof range === "number" && Number.isFinite(range) && range > 0
    ? range
    : 1;
}
export const hasUnlimitedAttackPerTurn = (state: GameState, playerId: string) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "unlimited_attack_per_turn";
/** True if the player ignores the one-attack-per-turn limit (Crossbow weapon or เตียวหุย's คำราม skill). */
export const hasUnlimitedAttack = (state: GameState, playerId: string) =>
  hasUnlimitedAttackPerTurn(state, playerId) ||
  hasCharacterSkill(state, playerId, "unlimited_attack");
export const hasRepeatAttackAfterDodge = (state: GameState, playerId: string) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "repeat_attack_after_dodge";
export const attackIgnoresTargetArmor = (state: GameState, playerId: string) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "ignore_target_armor";
export const hasDamageDestroyTargetMount = (
  state: GameState,
  playerId: string,
) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "damage_destroy_target_mount";
export const hasDiscardTwoForceAttackDamage = (
  state: GameState,
  playerId: string,
) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "discard_two_force_attack_damage";
export const hasReplaceDamageWithDiscardTwo = (
  state: GameState,
  playerId: string,
) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "replace_damage_with_discard_two";
export const hasDiscardTwoAsAttack = (state: GameState, playerId: string) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "discard_two_as_attack";
export const hasOppositeGenderAttackChoice = (
  state: GameState,
  playerId: string,
) =>
  getPlayerById(state, playerId)?.equipment.weapon?.effect ===
  "opposite_gender_attack_choice";
export const areOppositeGenders = (a: Player, b: Player) =>
  Boolean(
    a.character?.gender &&
    b.character?.gender &&
    a.character.gender !== b.character.gender,
  );
