// Mass-response queue advancement (L7 ของ layering: พึ่ง state/sync/actions)
// ย้าย verbatim จาก tricks.ts เพื่อตัดวงสุดท้าย combat↔tricks:
// combat ต้องเดินคิว mass window ตอนผู้ตอบตาย โดยไม่ดึง tricks.ts ทั้งไฟล์
import type { GameState } from "../types.js";
import { getPlayerById, logAction } from "../state.js";
import { synchronizeGameState } from "../sync.js";
import { resolveTargetedCardAction } from "../actions.js";
export const isQueuedResponseWindow = (type: string) =>
  type === "mass_dodge" || type === "mass_attack" || type === "multi_attack";
export function advanceMassResponseQueue(state: GameState) {
  const window = state.responseWindow,
    action = state.currentAction;
  if (!window || !action || !isQueuedResponseWindow(window.type)) return;
  if (state.status === "finished") return;
  const queue = window.responderQueue || [],
    next = queue.find((id) => {
      const player = getPlayerById(state, id);
      return (
        player?.alive &&
        !window.responses.some((response) => response.playerId === id)
      );
    });
  if (next) {
    window.currentResponderId = next;
    synchronizeGameState(state);
    return;
  }
  window.status = "resolved";
  state.responseWindow = null;
  resolveTargetedCardAction(state, action.actionId);
  logAction(
    state,
    "mass-trick-finished",
    `การ์ด ${action.card?.name || ""} จบการทำงาน`,
  );
  synchronizeGameState(state);
}
