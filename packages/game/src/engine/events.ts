// Game-event dispatch + character-skill event subscribers (L4 ของ layering:
// พึ่ง state + skills + sync) — ย้าย verbatim จาก handlers/character-skills.ts
// เพื่อให้ combat/tricks dispatch event ได้โดยไม่ต้อง import handlers ชั้นบน
import type {
  EventSubscriber,
  GameEvent,
  GameEventName,
  GameState,
} from "./types.js";
import { characterName, getPlayerById, logAction } from "./state.js";
import { CHARACTER_SKILLS } from "./skills.js";
import { reshuffleDiscardIntoDrawPile } from "./sync.js";
export function dispatchGameEvent(
  state: GameState,
  event: GameEvent,
  subscribers: EventSubscriber[] = [],
): GameEvent {
  [...subscribers]
    .filter((subscriber) => subscriber.event === event.name)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .forEach((subscriber) => subscriber.handle(state, event));
  runSkillEventHandlers(state, event); // character-skill subscribers, built from the current players
  return event;
}
// ── Character-skill event handlers ────────────────────────────────────────
// Keyed by the skill key in CHARACTER_SKILLS. dispatchGameEvent runs the matching handler for every alive holder.
type SkillEventHandler = {
  event: GameEventName;
  handle: (state: GameState, event: GameEvent, ownerId: string) => void;
};
const SKILL_EVENT_HANDLERS: Record<string, SkillEventHandler> = {
  // กุยแก คำสั่งเสีย: on taking damage, gain 2 draws per point of damage (drawn manually).
  draw_on_damage: {
    event: "after_damage",
    handle: (state, event, ownerId) => {
      if (event.targetId !== ownerId) return;
      const owner = getPlayerById(state, ownerId);
      if (!owner || !owner.alive) return;
      const n = 2 * Math.max(1, event.amount || 1);
      if (state.deck.length < n) reshuffleDiscardIntoDrawPile(state);
      const take = Math.min(n, state.deck.length);
      if (take <= 0) return;
      const revealed = state.deck
        .splice(state.deck.length - take, take)
        .reverse();
      const existing =
        state.pendingLegacy && state.pendingLegacy.ownerId === ownerId
          ? state.pendingLegacy.cards
          : [];
      state.pendingLegacy = { ownerId, cards: [...existing, ...revealed] };
      logAction(
        state,
        "skill-legacy",
        `${characterName(owner)} ใช้ คำสั่งเสีย เปิดไพ่ ${take} ใบ เพื่อมอบให้ผู้เล่น`,
        ownerId,
      );
    },
  },
  // โจโฉ ไม่ยอมให้โลกทรยศ: on taking damage from a card, take that card into hand (instead of it being discarded).
  gain_damage_card: {
    event: "after_damage",
    handle: (state, event, ownerId) => {
      if (event.targetId !== ownerId || !event.card) return;
      const owner = getPlayerById(state, ownerId);
      if (!owner) return;
      const card = event.card;
      owner.hand.push(card);
      // ดึงการ์ดที่ทำร้ายออกจากกองทิ้ง (กรณีท้าสู้/สาวงามยุยง การ์ดถูกทิ้งไปแล้ว) ไม่ให้ซ้ำในมือและกองทิ้ง
      const di = state.discard.lastIndexOf(card);
      if (di >= 0) {
        state.discard.splice(di, 1);
        state.discardPile.splice(di, 1);
      }
      // อย่าให้กองทิ้งกลางโต๊ะว่างเปล่า — ให้โชว์ไพ่ใบที่ทิ้งก่อนหน้าแทน (ไม่ใช่ undefined)
      if (state.lastPlayedCard === card)
        state.lastPlayedCard = state.discard.at(-1);
      logAction(
        state,
        "skill-gain-damage-card",
        `${characterName(owner)} ใช้ ไม่ยอมให้โลกทรยศ เก็บ ${card.name} เข้ามือ`,
        ownerId,
        undefined,
        card.id,
      );
    },
  },
  // สุมาอี้ กลยุทธ์โต้กลับ: on taking damage from someone, may take one of their cards (opens a pending decision).
  take_card_from_damager: {
    event: "after_damage",
    handle: (state, event, ownerId) => {
      if (
        event.targetId !== ownerId ||
        !event.actorId ||
        event.actorId === ownerId
      )
        return;
      const damager = getPlayerById(state, event.actorId);
      if (!damager || !damager.alive) return;
      if (
        damager.hand.length === 0 &&
        !Object.values(damager.equipment).some(Boolean)
      )
        return;
      state.pendingFankui = { playerId: ownerId, damagerId: event.actorId };
      logAction(
        state,
        "fankui-window",
        `${characterName(getPlayerById(state, ownerId)!)} อาจใช้ กลยุทธ์โต้กลับ หยิบไพ่จาก ${characterName(damager)}`,
        ownerId,
        event.actorId,
      );
    },
  },
  // แฮหัวตุ้น ย้อนรอยศัตรู: on taking damage (and surviving), reveal a judgment; if it is not ♥, the damager must discard 2 or take 1 damage.
  retaliate_judgment: {
    event: "after_damage",
    handle: (state, event, ownerId) => {
      if (
        event.targetId !== ownerId ||
        !event.actorId ||
        event.actorId === ownerId
      )
        return;
      const owner = getPlayerById(state, ownerId);
      if (!owner || !owner.alive || owner.hp === undefined || owner.hp <= 0)
        return;
      const damager = getPlayerById(state, event.actorId);
      if (!damager || !damager.alive) return;
      state.pendingRetaliateJudgment = { ownerId, damagerId: damager.id };
      logAction(
        state,
        "skill-retaliate",
        `${characterName(owner)} จะใช้ ย้อนรอยศัตรู — รอเปิดไพ่ตัดสิน`,
        ownerId,
        damager.id,
      );
    },
  },
};
function runSkillEventHandlers(state: GameState, event: GameEvent) {
  for (const player of state.players) {
    if (!player.alive || !player.character) continue;
    for (const key of CHARACTER_SKILLS[player.character.id] ?? []) {
      const handler = SKILL_EVENT_HANDLERS[key];
      if (handler && handler.event === event.name)
        handler.handle(state, event, player.id);
    }
  }
}
