import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  playDrawCardsTrick,
  drawPendingCard,
  owedDraws,
  endTurn,
  type Card,
  type GameState,
} from "./index.js";
import {
  makeCard as baseCard,
  makeStandardGame,
  passNegate,
} from "./test-helpers.js";

// ไฟล์นี้ effectParams ตาม effect (ต่างจาก helper กลางที่ default {damage:1})
const makeCard = (id: string, effect: string, cardType: string = "basic"): Card =>
  baseCard(id, effect, cardType, {
    effectParams: effect === "draw_cards" ? { amount: 2 } : {},
  });

const makeGame = (): GameState => makeStandardGame();

describe("Manual draws – pendingDraws", () => {
  it("draw_cards grants owed draws that the player takes one at a time", () => {
    const game = makeGame();
    const actor = game.players.find((p) => p.id === "p0")!;
    game.deck = [
      makeCard("a", "attack"),
      makeCard("b", "attack"),
      makeCard("c", "attack"),
    ];
    actor.hand = [makeCard("trick", "draw_cards", "trick")];
    playDrawCardsTrick(game, "p0", "trick");
    passNegate(game);
    assert.equal(owedDraws(game, "p0"), 2, "owed 2 (not auto-drawn)");
    assert.equal(actor.hand.length, 0, "no cards drawn automatically");
    drawPendingCard(game, "p0");
    assert.equal(owedDraws(game, "p0"), 1);
    assert.equal(actor.hand.length, 1);
    drawPendingCard(game, "p0");
    assert.equal(owedDraws(game, "p0"), 0, "debt cleared");
    assert.equal(actor.hand.length, 2);
  });

  it("cannot end the turn while owed draws remain", () => {
    const game = makeGame();
    const actor = game.players.find((p) => p.id === "p0")!;
    game.deck = [makeCard("a", "attack"), makeCard("b", "attack")];
    actor.hand = [makeCard("trick", "draw_cards", "trick")];
    playDrawCardsTrick(game, "p0", "trick");
    passNegate(game);
    assert.throws(
      () => endTurn(game, "p0"),
      /ได้รับ/,
      "blocked until owed draws are taken",
    );
    drawPendingCard(game, "p0");
    drawPendingCard(game, "p0");
    endTurn(game, "p0"); // now allowed
    assert.notEqual(game.turn.activePlayerId, "p0", "turn advanced");
  });

  it("drawPendingCard throws when nothing is owed", () => {
    const game = makeGame();
    assert.equal(owedDraws(game, "p0"), 0);
    assert.throws(() => drawPendingCard(game, "p0"));
  });
});
