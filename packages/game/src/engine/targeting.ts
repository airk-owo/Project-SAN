// Distance + attack-targeting rules (L5 ของ layering: พึ่ง state/skills/equipment-passives)
// ย้าย verbatim จาก handlers/combat.ts (distance/canTarget) และ
// handlers/character-skills.ts (forced target ของอ้วนสุด) เพื่อให้
// actions/tricks/equipment เช็คเป้าหมายได้โดยไม่ import combat.ts
import type { GameState } from "./types.js";
import { getBaseDistanceBetweenPlayers, getPlayerById } from "./state.js";
import { hasCharacterSkill, isImmuneToAttack } from "./skills.js";
import { getAttackRange } from "./handlers/equipment-passives.js";
/**
 * Distance used by effects. It deliberately remains separate from the base
 * seat distance so the UI can show both values for debugging.
 */
export function getEffectiveDistanceBetweenPlayers(
  state: GameState,
  fromPlayerId: string,
  toPlayerId: string,
) {
  const baseDistance = getBaseDistanceBetweenPlayers(
    state,
    fromPlayerId,
    toPlayerId,
  );
  if (baseDistance === null) return null;
  if (fromPlayerId === toPlayerId) return 0;
  const from = getPlayerById(state, fromPlayerId),
    to = getPlayerById(state, toPlayerId);
  if (!from || !to) return null;
  const outgoingModifier =
    (from.equipment.offensiveMount ? 1 : 0) +
    (hasCharacterSkill(state, from.id, "outgoing_distance_minus_one") ? 1 : 0);
  const incomingModifier = to.equipment.defensiveMount ? 1 : 0;
  return Math.max(1, baseDistance - outgoingModifier + incomingModifier);
}
export function canTargetWithAttack(
  state: GameState,
  attackerId: string,
  targetId: string,
) {
  const attacker = getPlayerById(state, attackerId),
    target = getPlayerById(state, targetId),
    distance = getEffectiveDistanceBetweenPlayers(state, attackerId, targetId);
  return Boolean(
    attacker &&
    target &&
    attacker.alive &&
    target.alive &&
    attackerId !== targetId &&
    !isImmuneToAttack(state, targetId) &&
    distance !== null &&
    distance <= getAttackRange(state, attackerId),
  );
}
/** อ้วนสุด ศัตรูหมายหัว: any reachable อ้วนสุด whose hand size exceeds their HP must be chosen as the attack target. */
export const forcedAttackTargets = (
  state: GameState,
  attackerId: string,
): string[] =>
  state.players
    .filter(
      (p) =>
        p.alive &&
        p.id !== attackerId &&
        hasCharacterSkill(state, p.id, "must_be_targeted_when_loaded") &&
        p.hp !== undefined &&
        p.hand.length > p.hp &&
        canTargetWithAttack(state, attackerId, p.id),
    )
    .map((p) => p.id);
export const assertForcedAttackTarget = (
  state: GameState,
  attackerId: string,
  targetIds: string[],
) => {
  const forced = forcedAttackTargets(state, attackerId);
  if (forced.length && !forced.some((id) => targetIds.includes(id)))
    throw new Error("ต้องเลือกโจมตี อ้วนสุด ก่อน (ศัตรูหมายหัว)");
};
