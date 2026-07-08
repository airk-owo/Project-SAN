// Turn/phase flow, draw phase, judgments, and end-of-turn handling. Extracted verbatim from index.ts.
import type { GameState, PendingJudgment, Player } from "./types.js";
import {
  characterName,
  draw,
  findHandCard,
  getPlayerById,
  getPlayersInSeatOrder,
  grantDraws,
  logAction,
  moveToDiscard,
  owedDraws,
  recordJudgment,
} from "./state.js";
import {
  reshuffleDiscardIntoDrawPile,
  synchronizeGameState,
} from "./sync.js";
import { hasCharacterSkill } from "./skills.js";
import { applyDamage } from "./handlers/combat.js";
export const getDiscardRequirement = (state: GameState, playerId: string) => {
  const player = getPlayerById(state, playerId);
  if (!player || player.hp === undefined) return 0;
  if (
    state.currentPlayerId === playerId &&
    state.attacksThisTurn === 0 &&
    hasCharacterSkill(state, playerId, "skip_discard_if_no_attack")
  )
    return 0; // ลิบอง ยับยั้งชั่งใจ
  const limit =
    player.hp -
    (state.currentPlayerId === playerId && state.arrogancePenalty ? 1 : 0); // อ้วนสุด จองหอง: ขีดจำกัดมือ -1
  return Math.max(0, player.hand.length - limit);
};
export function getNextAlivePlayer(state: GameState, currentPlayerId: string) {
  const players = getPlayersInSeatOrder(state),
    currentIndex = players.findIndex((player) => player.id === currentPlayerId);
  if (currentIndex < 0) return undefined;
  for (let step = 1; step <= players.length; step++) {
    const index =
      (currentIndex + step * state.direction + players.length) % players.length;
    if (players[index].alive) return players[index];
  }
  return undefined;
}
/** Sets up the next unresolved delayed trick as a pending (manual) judgment. Returns false if none remain. */
function beginNextJudgment(state: GameState, player: Player): boolean {
  const tricks = player.decisionArea.filter(
    (card) =>
      card.effect === "delayed_skip_play_phase" ||
      card.effect === "delayed_lightning_judgment",
  );
  const trick = tricks[tricks.length - 1]; // กฎ: ตัดสินใบที่วางล่าสุดก่อน (LIFO) — วางทีหลังผลก่อน
  if (!trick) return false;
  state.pendingJudgment = {
    playerId: player.id,
    trickEffect: trick.effect as PendingJudgment["trickEffect"],
    trickName: trick.name,
    trickCardId: trick.id,
    stage: "awaiting_draw",
  };
  logAction(
    state,
    "judgment-pending",
    `${characterName(player)} ต้องเปิดไพ่ตัดสิน ${trick.name}`,
    player.id,
  );
  return true;
}
/** Applies the revealed judgment's outcome (skip play / lightning), retires the delayed trick, then queues the next judgment or moves to the draw phase. */
function applyJudgmentOutcome(
  state: GameState,
  player: Player,
  pending: PendingJudgment,
) {
  const judged = pending.revealed ?? null,
    trick = player.decisionArea.find((card) => card.id === pending.trickCardId);
  if (trick)
    player.decisionArea = player.decisionArea.filter((card) => card !== trick);
  if (pending.trickEffect === "delayed_skip_play_phase") {
    if (trick) moveToDiscard(state, trick, false);
    const skipped = judged?.suit !== "♥";
    if (skipped) {
      state.skipPlayPhase = true;
      logAction(
        state,
        "indulgence-skip",
        `${characterName(player)} ถูกข้ามช่วงเล่นไพ่ (มีสุขลืมเมือง)`,
        player.id,
      );
    } else
      logAction(
        state,
        "indulgence-passed",
        `${characterName(player)} ผ่านการตัดสินมีสุขลืมเมือง`,
        player.id,
      );
    recordJudgment(
      state,
      player.id,
      pending.trickName,
      judged,
      skipped ? "ถูกข้ามช่วงเล่นไพ่" : "ผ่าน (♥) เล่นได้ตามปกติ",
    );
  } else {
    const rank = judged ? parseInt(judged.number, 10) : NaN,
      struck = judged?.suit === "♠" && rank >= 2 && rank <= 9;
    if (struck) {
      if (trick) moveToDiscard(state, trick, false);
      logAction(
        state,
        "lightning-strike",
        `${characterName(player)} ถูกฟ้าผ่า เสีย 3 หน่วยพลังชีวิต`,
        player.id,
      );
      recordJudgment(
        state,
        player.id,
        pending.trickName,
        judged,
        "ฟ้าผ่า! เสีย 3 พลังชีวิต",
      );
      applyDamage(state, player.id, 3);
    } else {
      const order = getPlayersInSeatOrder(state),
        ci = order.findIndex((p) => p.id === player.id);
      let next: Player | undefined;
      for (let step = 1; ci >= 0 && step < order.length; step++) {
        const cand =
          order[(ci + step * state.direction + order.length) % order.length];
        if (
          cand.alive &&
          !cand.decisionArea.some(
            (c) => c.effect === "delayed_lightning_judgment",
          )
        ) {
          next = cand;
          break;
        }
      }
      /* กฎ: ฟ้าลงโทษเลื่อนไปคนถัดไปที่ "ยังไม่มี" ฟ้าลงโทษ — ข้ามคนที่มีอยู่แล้ว ไม่ใช่ทิ้ง */ if (
        trick &&
        next
      ) {
        next.decisionArea.push(trick);
        logAction(
          state,
          "lightning-move",
          `ฟ้าลงโทษเคลื่อนไปยัง ${characterName(next)}`,
          player.id,
          next.id,
        );
        recordJudgment(
          state,
          player.id,
          pending.trickName,
          judged,
          `ปลอดภัย → ฟ้าลงโทษเลื่อนไปยัง ${characterName(next)}`,
        );
      } else {
        if (trick) moveToDiscard(state, trick, false);
        recordJudgment(state, player.id, pending.trickName, judged, "ปลอดภัย");
      }
    }
  }
  state.pendingJudgment = undefined;
  if (
    player.alive &&
    !state.responseWindow &&
    beginNextJudgment(state, player)
  ) {
    synchronizeGameState(state);
    return;
  }
  if (player.alive) state.turn.phase = "draw"; // a dying window (if any) still blocks the draw until it resolves
  synchronizeGameState(state);
}
/** Player manually reveals the top draw-pile card as their judgment. Everyone then sees it. */
export function drawJudgmentCard(state: GameState, playerId: string) {
  const pending = state.pendingJudgment;
  if (
    !pending ||
    pending.playerId !== playerId ||
    pending.stage !== "awaiting_draw"
  )
    throw new Error("ยังไม่ถึงเวลาเปิดไพ่ตัดสิน");
  if (!state.deck.length) reshuffleDiscardIntoDrawPile(state);
  const card = state.deck.pop() ?? undefined;
  pending.revealed = card;
  pending.stage = "revealed";
  if (card)
    logAction(
      state,
      "judgment-reveal",
      `ไพ่ตัดสินของ ${characterName(getPlayerById(state, playerId)!)}: ${card.name} (${card.number}${card.suit})`,
      playerId,
      undefined,
      card.id,
    );
  else
    logAction(state, "judgment-no-card", "ไม่มีไพ่สำหรับการตัดสิน", playerId);
  synchronizeGameState(state);
}
/** Keep the revealed judgment card into the player's hand (character ability), then apply the judgment. */
export function keepJudgmentCard(state: GameState, playerId: string) {
  const pending = state.pendingJudgment;
  if (!pending || pending.playerId !== playerId || pending.stage !== "revealed")
    throw new Error("ยังไม่มีไพ่ตัดสินให้เก็บ");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  if (pending.revealed) {
    player.hand.push(pending.revealed);
    logAction(
      state,
      "judgment-kept",
      `${characterName(player)} เก็บไพ่ตัดสิน ${pending.revealed.name} เข้ามือ`,
      playerId,
      undefined,
      pending.revealed.id,
    );
  }
  applyJudgmentOutcome(state, player, pending);
}
/** Let the revealed judgment card resolve normally (goes to discard), then apply the judgment. กุยแก คาดการณ์แม่นยำ keeps it into hand instead. */
export function resolveJudgmentCard(state: GameState, playerId: string) {
  const pending = state.pendingJudgment;
  if (!pending || pending.playerId !== playerId || pending.stage !== "revealed")
    throw new Error("ยังไม่มีไพ่ตัดสินให้ดำเนินการ");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  if (pending.revealed) {
    if (hasCharacterSkill(state, playerId, "keep_judgment")) {
      player.hand.push(pending.revealed);
      logAction(
        state,
        "skill-keep-judgment",
        `${characterName(player)} ใช้ คาดการณ์แม่นยำ เก็บไพ่ตัดสิน ${pending.revealed.name} เข้ามือ`,
        playerId,
        undefined,
        pending.revealed.id,
      );
    } // กุยแก
    else moveToDiscard(state, pending.revealed, true);
  }
  applyJudgmentOutcome(state, player, pending);
}
export function startTurn(state: GameState, playerId: string) {
  const player = getPlayerById(state, playerId);
  if (!player || !player.alive)
    throw new Error("Cannot start a turn for this player");
  state.currentPlayerId = playerId;
  state.hasDrawnThisTurn = false;
  state.attacksThisTurn = 0;
  state.skipPlayPhase = false;
  state.skillsUsedThisTurn = [];
  state.unarmedPowerActive = false;
  state.benevolenceGivenThisTurn = 0;
  state.arrogancePenalty = false;
  state.turn = {
    activePlayerId: playerId,
    phase: "judgment",
    direction: state.direction === 1 ? "clockwise" : "counterclockwise",
    turnNumber: Math.max(1, state.turn.turnNumber),
    attackUsedThisTurn: 0,
    drawnThisTurn: 0,
  };
  logAction(
    state,
    "turn-start",
    `${characterName(player)} เริ่มเทิร์น`,
    player.id,
  );
  if (!beginNextJudgment(state, player)) state.turn.phase = "draw"; // no delayed tricks → straight to draw
  synchronizeGameState(state);
}
export function drawCards(state: GameState, playerId: string, amount: number) {
  if (state.responseWindow)
    throw new Error("ต้องแก้ไขสถานะที่ค้างอยู่ก่อนจั่วไพ่");
  if (state.turn.activePlayerId !== playerId || state.turn.phase !== "draw")
    throw new Error("It is not the draw phase for this player");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  let drawn = 0;
  for (let index = 0; index < amount; index++) {
    if (!state.deck.length) reshuffleDiscardIntoDrawPile(state);
    const card = state.deck.pop();
    if (!card) {
      if (index === 0 || drawn < amount)
        logAction(
          state,
          "draw-pile-empty",
          "กองจั่วและกองทิ้งมีไพ่ไม่พอสำหรับการจั่ว",
        );
      break;
    }
    player.hand.push(card);
    drawn++;
  }
  state.hasDrawnThisTurn = true;
  state.turn.drawnThisTurn = drawn;
  logAction(
    state,
    "turn-draw",
    `${characterName(player)} จั่วการ์ด ${drawn} ใบ`,
    player.id,
  );
  if (state.skipPlayPhase) {
    state.turn.phase = "discard";
    state.skipPlayPhase = false;
    logAction(
      state,
      "play-phase-skipped",
      `${characterName(player)} ถูกข้ามช่วงเล่นไพ่`,
      player.id,
    );
  } else {
    state.turn.phase = "play";
    logAction(
      state,
      "turn-play",
      `${characterName(player)} เข้าสู่ช่วงเล่นไพ่`,
      player.id,
    );
  }
  synchronizeGameState(state);
  return drawn;
}
/** Draw exactly one card from the deck. Advances to play phase only after `allowance` cards have been drawn this turn (default 2). */
export function drawOneTurnCard(
  state: GameState,
  playerId: string,
  allowance = 2,
): void {
  if (state.responseWindow)
    throw new Error("ต้องแก้ไขสถานะที่ค้างอยู่ก่อนจั่วไพ่");
  if (state.pendingPeek)
    throw new Error("ต้องจัดเรียงกองจั่ว (หยั่งรู้ฟ้าดิน) ให้เสร็จก่อน");
  if (state.turn.activePlayerId !== playerId || state.turn.phase !== "draw")
    throw new Error("ยังไม่ถึงเวลาจั่วไพ่");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  const need =
    allowance +
    (hasCharacterSkill(state, playerId, "draw_phase_plus_one") ? 1 : 0); // จิวยี่ ยอดวีรชน: +1 ใบในเฟสจั่ว
  if (!state.deck.length) reshuffleDiscardIntoDrawPile(state);
  const card = state.deck.pop();
  if (card) {
    player.hand.push(card);
    state.turn.drawnThisTurn = (state.turn.drawnThisTurn || 0) + 1;
    logAction(
      state,
      "turn-draw-one",
      `${characterName(player)} จั่วการ์ด 1 ใบ (${state.turn.drawnThisTurn}/${need})`,
      player.id,
    );
  } else {
    logAction(state, "draw-pile-empty", "กองจั่วและกองทิ้งมีไพ่ไม่พอ");
    state.turn.drawnThisTurn = need;
  }
  if (state.turn.drawnThisTurn >= need) {
    state.hasDrawnThisTurn = true;
    if (state.skipPlayPhase) {
      state.turn.phase = "discard";
      state.skipPlayPhase = false;
      logAction(
        state,
        "play-phase-skipped",
        `${characterName(player)} ถูกข้ามช่วงเล่นไพ่`,
        player.id,
      );
    } else {
      state.turn.phase = "play";
      logAction(
        state,
        "turn-play",
        `${characterName(player)} เข้าสู่ช่วงเล่นไพ่`,
        player.id,
      );
    }
  }
  synchronizeGameState(state);
}
export function advancePhase(state: GameState) {
  if (state.responseWindow || state.currentAction)
    throw new Error("Resolve the current action first");
  const playerId = state.turn.activePlayerId,
    player = playerId ? getPlayerById(state, playerId) : undefined;
  if (!player) throw new Error("There is no active player");
  if (state.turn.phase === "start") {
    state.turn.phase = "draw";
    logAction(
      state,
      "turn-draw-phase",
      `${characterName(player)} เข้าสู่ช่วงจั่ว`,
      player.id,
    );
  } else if (state.turn.phase === "play") {
    state.turn.phase = "discard";
    logAction(
      state,
      "turn-discard-phase",
      `${characterName(player)} เข้าสู่ช่วงทิ้งไพ่`,
      player.id,
    );
  } else if (state.turn.phase === "discard") {
    if (getDiscardRequirement(state, player.id) > 0)
      throw new Error("Discard cards until your hand is at or below HP");
    state.turn.phase = "end";
  } else throw new Error("Use Draw or End Turn for the current phase");
  synchronizeGameState(state);
}
/** ฟ้าลงโทษ: while the lightning judgment is pending on you, use คงกระพันชาตรี to cancel it (skip the judgment; the card is discarded, not moved on). */
export function negateLightningJudgment(
  state: GameState,
  playerId: string,
  negateCardId: string,
) {
  const pending = state.pendingJudgment;
  if (
    !pending ||
    pending.playerId !== playerId ||
    pending.trickEffect !== "delayed_lightning_judgment"
  )
    throw new Error("ไม่มีการตัดสินฟ้าลงโทษให้ยกเลิก");
  const player = getPlayerById(state, playerId);
  if (!player) throw new Error("Unknown player");
  const negate = findHandCard(player, negateCardId);
  if (!negate || negate.effect !== "negate_trick_effect")
    throw new Error("ต้องใช้ คงกระพันชาตรี");
  player.hand = player.hand.filter((c) => c !== negate);
  moveToDiscard(state, negate, false);
  const trick = player.decisionArea.find((c) => c.id === pending.trickCardId);
  if (trick) {
    player.decisionArea = player.decisionArea.filter((c) => c !== trick);
    moveToDiscard(state, trick, false);
  }
  if (pending.revealed) moveToDiscard(state, pending.revealed, true);
  logAction(
    state,
    "lightning-negated",
    `${characterName(player)} ใช้ คงกระพันชาตรี ยกเลิกฟ้าลงโทษ`,
    playerId,
    undefined,
    negate.id,
  );
  recordJudgment(
    state,
    playerId,
    pending.trickName,
    pending.revealed ?? null,
    "ยกเลิกด้วยคงกระพันชาตรี",
  );
  state.pendingJudgment = undefined;
  if (
    player.alive &&
    !state.responseWindow &&
    beginNextJudgment(state, player)
  ) {
    synchronizeGameState(state);
    return;
  }
  if (player.alive) state.turn.phase = "draw";
  synchronizeGameState(state);
}
export function endTurn(
  state: GameState,
  playerId = state.turn.activePlayerId || "",
) {
  if (state.turn.activePlayerId) {
    if (state.responseWindow || state.currentAction)
      throw new Error("Resolve the current action first");
    if (state.pendingJudgment)
      throw new Error("ต้องเปิดไพ่ตัดสินให้เสร็จก่อนจบเทิร์น");
    if (state.pendingLegacy)
      throw new Error("ต้องมอบไพ่ คำสั่งเสีย ให้เสร็จก่อนจบเทิร์น");
    if (state.pendingRetaliateJudgment)
      throw new Error("ต้องเปิดไพ่ตัดสิน ย้อนรอยศัตรู ให้เสร็จก่อนจบเทิร์น");
    if (state.pendingRetaliate)
      throw new Error("ต้องจัดการ ย้อนรอยศัตรู ให้เสร็จก่อนจบเทิร์น");
    if (state.pendingPeek)
      throw new Error(
        "ต้องจัดเรียงกองจั่ว (หยั่งรู้ฟ้าดิน) ให้เสร็จก่อนจบเทิร์น",
      );
    if (state.pendingDischord)
      throw new Error("ต้องจัดการ บาดหมาง ให้เสร็จก่อนจบเทิร์น");
    if (state.pendingAllyAssist)
      throw new Error("ต้องรอพันธมิตรตอบคำขอช่วยเหลือก่อนจบเทิร์น");
    if (state.turn.activePlayerId !== playerId)
      throw new Error("Only the active player can end this turn");
    const player = getPlayerById(state, playerId);
    if (!player) throw new Error("Unknown player");
    if (state.turn.phase === "draw")
      throw new Error("Draw cards before ending the turn");
    if (owedDraws(state, playerId) > 0)
      throw new Error("ต้องจั่วไพ่ที่ได้รับก่อนจบเทิร์น");
    if (state.turn.phase === "play") {
      state.turn.phase = "discard";
      logAction(
        state,
        "turn-discard-phase",
        `${characterName(player)} เข้าสู่ช่วงทิ้งไพ่`,
        player.id,
      );
    }
    const required = getDiscardRequirement(state, playerId);
    if (required > 0) {
      logAction(
        state,
        "hand-limit-required",
        `${characterName(player)} ต้องทิ้งไพ่ ${required} ใบ`,
        player.id,
      );
      synchronizeGameState(state);
      return;
    }
    state.turn.phase = "end";
    logAction(
      state,
      "turn-end",
      `${characterName(player)} จบเทิร์น`,
      player.id,
    );
    if (hasCharacterSkill(state, playerId, "draw_on_turn_end")) {
      grantDraws(state, playerId, 1);
      logAction(
        state,
        "skill-turn-end-draw",
        `${characterName(player)} ใช้ งามกลบแสงจันทร์ ได้สิทธิ์จั่ว 1 ใบ`,
        player.id,
      );
    } // เตียวเสี้ยน
    const next = getNextAlivePlayer(state, playerId);
    if (!next) throw new Error("No alive player can take the next turn");
    state.turn.turnNumber++;
    startTurn(state, next.id);
    return;
  }
  if (
    state.phase !== "playing" ||
    state.currentPlayerId !== playerId ||
    state.pendingAction
  )
    throw new Error("Cannot end this turn");
  if (!state.hasDrawnThisTurn) throw new Error("ต้องจั่วไพ่ก่อนจบเทิร์น");
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error("Unknown player");
  if (getDiscardRequirement(state, playerId) > 0)
    throw new Error("ต้องทิ้งไพ่บนมือให้ไม่เกินพลังชีวิตก่อนจบเทิร์น"); // เคารพ ลิบอง ยับยั้งชั่งใจ / อ้วนสุด จองหอง
  const current = state.players.findIndex((p) => p.id === playerId);
  for (let step = 1; step <= state.players.length; step++) {
    const next =
      state.players[
        (current + step * state.direction + state.players.length * 10) %
          state.players.length
      ];
    if (next.alive) {
      state.currentPlayerId = next.id;
      state.attacksThisTurn = 0;
      state.hasDrawnThisTurn = false;
      state.log.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        type: "turn-start",
        actorId: next.id,
        message: `เริ่มเทิร์นของ ${next.username}`,
      });
      return;
    }
  }
}
export function drawForTurn(state: GameState, playerId: string) {
  if (state.turn.activePlayerId) return drawCards(state, playerId, 2);
  if (
    state.phase !== "playing" ||
    state.currentPlayerId !== playerId ||
    state.pendingAction
  )
    throw new Error("ยังไม่ถึงเวลาจั่วไพ่");
  if (state.hasDrawnThisTurn) throw new Error("คุณจั่วไพ่ในเทิร์นนี้แล้ว");
  draw(state, playerId, 2);
  state.hasDrawnThisTurn = true;
  const player = state.players.find((p) => p.id === playerId)!;
  state.log.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    type: "turn-draw",
    actorId: player.id,
    message: `${player.username} จั่วไพ่ 2 ใบ`,
  });
}
export function discardForHandLimit(
  state: GameState,
  playerId: string,
  cardIds: string[],
) {
  if (
    state.phase !== "playing" ||
    state.currentPlayerId !== playerId ||
    state.pendingAction
  )
    throw new Error("You cannot discard now");
  if (!state.hasDrawnThisTurn) throw new Error("ต้องจั่วไพ่ก่อนทิ้งไพ่");
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.hp === undefined) throw new Error("Unknown player");
  const required = getDiscardRequirement(state, playerId),
    unique = [...new Set(cardIds)];
  if (required === 0) throw new Error("You do not need to discard cards");
  if (unique.length < required)
    throw new Error(`ต้องทิ้งอย่างน้อย ${required} ใบ`); // ทิ้งได้ตั้งแต่ขั้นต่ำจนถึงทั้งมือ (ตามที่ผู้เล่นต้องการ)
  const selected = player.hand.filter((card) => unique.includes(card.id));
  if (selected.length !== unique.length)
    throw new Error("A selected card is not in your hand");
  player.hand = player.hand.filter((card) => !unique.includes(card.id));
  state.discard.push(...selected);
  state.lastPlayedCard = selected.at(-1);
  state.log.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    type: "hand-limit-discard",
    actorId: player.id,
    message: `${player.username} ทิ้งไพ่ ${selected.length} ใบเพื่อให้จำนวนไพ่บนมือไม่เกินพลังชีวิต`,
  });
  synchronizeGameState(state);
}
