import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  playAttack,
  playDuel,
  respondToAttack,
  getEffectiveDistanceBetweenPlayers,
  getDiscardRequirement,
  forcedAttackTargets,
  hasCharacterSkill,
  playCard,
  playStealTargetCard,
  playDiscardTargetCard,
  playDelayedTrick,
  declineNegate,
  cardActsAs,
  playDodge,
  playMassDodgeOrDamage,
  playMassResponseCard,
  applyDamage,
  owedDraws,
  drawOneTurnCard,
  endTurn,
  playAttackResponse,
  declineResponse,
  useSelfDamageDraw,
  useDiscardThenDraw,
  useMiracleMedicine,
  useMarriage,
  useRaid,
  useUnarmedHunt,
  useFortune,
  useBenevolence,
  useArrogance,
  usePeek,
  resolvePeek,
  useDischord,
  pickDischordSuit,
  useIncite,
  playHeal,
  startTurn,
  drawJudgmentCard,
  resolveJudgmentCard,
  replaceJudgmentCard,
  createPublicGameState,
  takeCardFromDamager,
  declineFankui,
  retaliateDiscard,
  retaliateTakeDamage,
  revealRetaliateJudgment,
  assignLegacyCard,
  redirectAttack,
  requestUnityAttack,
  requestGuardianDodge,
  allyAssist,
  declineAllyAssist,
  surrenderPlayer,
  synchronizeGameState,
  type Card,
  type GameState,
} from "./index.js";
import {
  makeCard as baseCard,
  makeCharacter as character,
  makeStandardGame,
} from "./test-helpers.js";

const suited = (
  id: string,
  effect: string,
  cardType: string,
  suit: string,
  number: string,
): Card => baseCard(id, effect, cardType, { suit, number, effectParams: {} });

const duelCard = (id: string): Card =>
  baseCard(id, "duel_attack_response", "trick", {
    cardType: "instant_trick",
    suit: "♣",
    number: "3",
    effectParams: {},
    createsResponseWindow: true,
  });

const dodgeCard = (id: string): Card =>
  baseCard(id, "dodge", "basic", {
    suit: "♦",
    number: "2",
    effectParams: {},
    triggerTiming: "on_response",
  });
// ไฟล์นี้ default ♠ (ต่างจาก helper กลาง ♥)
const makeCard = (id: string, effect: string, cardType = "basic"): Card =>
  baseCard(id, effect, cardType, { suit: "♠" });
const attackCard = (id: string): Card => makeCard(id, "attack");

/** Characters get specific ids so the engine's skill registry (keyed by character id) applies. */
const makeGame = (charIds: Record<string, string> = {}): GameState =>
  makeStandardGame({
    maxHp: 8,
    characterFor: (id, i) => character(charIds[id] ?? `CHAR_generic_${i}`),
  });

describe("Character skill – เตียวหุย คำราม (unlimited_attack)", () => {
  it("lets เตียวหุย attack more than once per turn", () => {
    const game = makeGame({ p0: "CHAR011" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [attackCard("a1"), attackCard("a2")];
    assert.ok(hasCharacterSkill(game, "p0", "unlimited_attack"));
    playAttack(game, "p0", "p1", "a1");
    respondToAttack(game, "p1"); // resolve first attack
    assert.doesNotThrow(
      () => playAttack(game, "p0", "p1", "a2"),
      "second attack allowed",
    );
  });

  it("a normal character cannot attack twice", () => {
    const game = makeGame(); // p0 has no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [attackCard("a1"), attackCard("a2")];
    playAttack(game, "p0", "p1", "a1");
    respondToAttack(game, "p1");
    assert.throws(
      () => playAttack(game, "p0", "p1", "a2"),
      /one attack per turn/,
    );
  });
});

describe("Character skill – ม้าเฉียว ทหารม้า (outgoing_distance_minus_one)", () => {
  it("reduces the distance from ม้าเฉียว to other players by 1", () => {
    const skilled = makeGame({ p0: "CHAR014" });
    const plain = makeGame(); // p0 has no skill
    // p0 (seat 1) → p2 (seat 3): base distance 2
    assert.equal(
      getEffectiveDistanceBetweenPlayers(plain, "p0", "p2"),
      2,
      "normal effective distance",
    );
    assert.equal(
      getEffectiveDistanceBetweenPlayers(skilled, "p0", "p2"),
      1,
      "ทหารม้า shortens it by 1",
    );
  });

  it("never drops below 1", () => {
    const game = makeGame({ p0: "CHAR014" });
    // p0 → p1 are adjacent (base 1); minus 1 clamps to 1
    assert.equal(getEffectiveDistanceBetweenPlayers(game, "p0", "p1"), 1);
  });

  it("does not affect other players", () => {
    const game = makeGame({ p0: "CHAR014" });
    assert.ok(!hasCharacterSkill(game, "p1", "outgoing_distance_minus_one"));
    assert.equal(
      getEffectiveDistanceBetweenPlayers(game, "p1", "p3"),
      2,
      "p1 has no skill",
    );
  });
});

describe("Character skill – ลกซุน อ่อนน้อมถ่อมตน (immune indulgence + steal)", () => {
  it("cannot be targeted by มีสุขลืมเมือง", () => {
    const game = makeGame({ p1: "CHAR007" });
    game.players.find((p) => p.id === "p0")!.hand = [
      makeCard("ind", "delayed_skip_play_phase", "delayed_trick"),
    ];
    assert.throws(() => playCard(game, "p0", "ind", "p1"), /อ่อนน้อมถ่อมตน/);
  });

  it("cannot be the target of ลอบขโมย", () => {
    const game = makeGame({ p1: "CHAR007" });
    game.players.find((p) => p.id === "p0")!.hand = [
      makeCard("steal", "steal_target_card_in_range", "trick"),
    ];
    game.players.find((p) => p.id === "p1")!.hand = [attackCard("loot")];
    assert.throws(
      () =>
        playStealTargetCard(
          game,
          "p0",
          "p1",
          { zone: "hand", handIndex: 0 },
          "steal",
        ),
      /อ่อนน้อมถ่อมตน/,
    );
  });
});

describe("Character skill – จูกัดเหลียง กลยุทธ์เมืองว่าง (immune to attack when handless)", () => {
  it("a handless จูกัดเหลียง cannot be attacked", () => {
    const game = makeGame({ p1: "CHAR012" });
    game.players.find((p) => p.id === "p0")!.hand = [attackCard("a1")];
    game.players.find((p) => p.id === "p1")!.hand = []; // empty
    assert.throws(() => playAttack(game, "p0", "p1", "a1"), /เมืองว่าง/);
  });

  it("but can be attacked while holding cards", () => {
    const game = makeGame({ p1: "CHAR012" });
    game.players.find((p) => p.id === "p0")!.hand = [attackCard("a1")];
    game.players.find((p) => p.id === "p1")!.hand = [attackCard("x")]; // has a card
    assert.doesNotThrow(() => playAttack(game, "p0", "p1", "a1"));
  });
});

describe("Character skill – หวงเย่อิง ผู้วิเศษ (tricks ignore distance)", () => {
  it("lets หวงเย่อิง ลอบขโมย a player beyond range 1", () => {
    const game = makeGame({ p0: "CHAR015" });
    game.players.find((p) => p.id === "p0")!.hand = [
      makeCard("steal", "steal_target_card_in_range", "trick"),
    ];
    game.players.find((p) => p.id === "p2")!.hand = [attackCard("loot")]; // p2 is at distance 2
    playStealTargetCard(
      game,
      "p0",
      "p2",
      { zone: "hand", handIndex: 0 },
      "steal",
    );
    assert.equal(
      game.responseWindow?.type,
      "negate",
      "steal declared (range ignored)",
    );
  });

  it("a normal character cannot steal beyond range 1", () => {
    const game = makeGame(); // p0 has no skill
    game.players.find((p) => p.id === "p0")!.hand = [
      makeCard("steal", "steal_target_card_in_range", "trick"),
    ];
    game.players.find((p) => p.id === "p2")!.hand = [attackCard("loot")];
    assert.throws(
      () =>
        playStealTargetCard(
          game,
          "p0",
          "p2",
          { zone: "hand", handIndex: 0 },
          "steal",
        ),
      /range/,
    );
  });
});

describe("Character skill – จูล่ง กล้าหาญ (attack ⇄ dodge swap)", () => {
  it("lets จูล่ง dodge an Attack using an Attack card", () => {
    const game = makeGame({ p1: "CHAR013" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    game.players.find((p) => p.id === "p0")!.hand = [attackCard("a1")];
    p1.hand = [attackCard("as-dodge")]; // only an Attack, no dodge
    const hpBefore = p1.hp!;
    playAttack(game, "p0", "p1", "a1");
    playDodge(game, "p1", "as-dodge"); // attack used as dodge
    assert.equal(p1.hp, hpBefore, "attack was dodged — no damage");
    assert.equal(game.responseWindow, null);
  });

  it("a normal character cannot dodge with an Attack card", () => {
    const game = makeGame(); // p1 has no skill
    game.players.find((p) => p.id === "p0")!.hand = [attackCard("a1")];
    game.players.find((p) => p.id === "p1")!.hand = [attackCard("nope")];
    playAttack(game, "p0", "p1", "a1");
    assert.throws(() => playDodge(game, "p1", "nope"), /Dodge card/);
  });

  it("lets จูล่ง answer a mass-dodge trick with an Attack card", () => {
    const game = makeGame({ p1: "CHAR013" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    game.players.find((p) => p.id === "p0")!.hand = [
      makeCard("mass", "all_others_dodge_or_damage", "trick"),
    ];
    p1.hand = [attackCard("as-dodge")];
    const hpBefore = p1.hp!;
    playMassDodgeOrDamage(game, "p0", "mass");
    // p1 is first in the mass queue; respond with an attack card (swap)
    assert.equal(game.responseWindow?.currentResponderId, "p1");
    playMassResponseCard(game, "p1", "as-dodge");
    assert.equal(p1.hp, hpBefore, "no damage — attack counted as dodge");
  });

  it("proactive: จูล่ง plays a Dodge card AS an Attack on their turn", () => {
    const game = makeGame({ p0: "CHAR013" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    game.players.find((p) => p.id === "p0")!.hand = [
      dodgeCard("dodge-as-attack"),
    ];
    const hpBefore = p1.hp!;
    playCard(game, "p0", "dodge-as-attack", "p1"); // dodge routed to playAttack
    assert.equal(game.responseWindow?.type, "attack_dodge");
    assert.equal(game.responseWindow?.currentResponderId, "p1");
    respondToAttack(game, "p1"); // take the hit
    assert.equal(p1.hp, hpBefore - 1, "the dodge card dealt attack damage");
  });

  it("a normal character cannot play a Dodge card as an Attack", () => {
    const game = makeGame(); // p0 no skill
    game.players.find((p) => p.id === "p0")!.hand = [dodgeCard("d1")];
    assert.throws(() => playCard(game, "p0", "d1", "p1"), /response/);
  });
});

describe("Character skill – ลิโป้ ไร้เทียมทาน in a duel (needs two attacks)", () => {
  it("the opponent must play two attacks before the duel passes back", () => {
    const game = makeGame({ p0: "CHAR024" });
    game.players.find((p) => p.id === "p0")!.hand = [
      duelCard("duel"),
      attackCard("lb1"),
    ];
    game.players.find((p) => p.id === "p1")!.hand = [
      attackCard("a1"),
      attackCard("a2"),
    ];
    playCard(game, "p0", "duel", "p1");
    assert.equal(game.responseWindow?.type, "duel_attack");
    assert.equal(
      game.responseWindow?.currentResponderId,
      "p1",
      "target responds first",
    );
    playAttackResponse(game, "p1", "a1");
    assert.equal(
      game.responseWindow?.currentResponderId,
      "p1",
      "still p1 — needs a second attack vs ลิโป้",
    );
    playAttackResponse(game, "p1", "a2");
    assert.equal(
      game.responseWindow?.currentResponderId,
      "p0",
      "now it is ลิโป้ turn",
    );
  });

  it("one attack then giving up loses the duel", () => {
    const game = makeGame({ p0: "CHAR024" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    game.players.find((p) => p.id === "p0")!.hand = [duelCard("duel")];
    p1.hand = [attackCard("a1")];
    const hpBefore = p1.hp!;
    playCard(game, "p0", "duel", "p1");
    playAttackResponse(game, "p1", "a1");
    declineResponse(game, "p1"); // cannot provide the second attack
    assert.equal(p1.hp, hpBefore - 1, "p1 lost the duel and took damage");
  });
});

describe("Character skill – ลิโป้ ไร้เทียมทาน (attack needs two dodges)", () => {
  it("a single dodge is not enough — the window stays open", () => {
    const game = makeGame({ p0: "CHAR024" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    game.players.find((p) => p.id === "p0")!.hand = [attackCard("a1")];
    p1.hand = [dodgeCard("d1")];
    playAttack(game, "p0", "p1", "a1");
    assert.equal(
      game.pendingAction?.dodgesRequired,
      2,
      "ลิโป้ requires two dodges",
    );
    playDodge(game, "p1", "d1");
    assert.equal(
      game.responseWindow?.type,
      "attack_dodge",
      "still waiting for another dodge",
    );
    assert.equal(game.responseWindow?.currentResponderId, "p1");
  });

  it("one dodge then no more → the attack still hits", () => {
    const game = makeGame({ p0: "CHAR024" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    game.players.find((p) => p.id === "p0")!.hand = [attackCard("a1")];
    p1.hand = [dodgeCard("d1")];
    const hpBefore = p1.hp!;
    playAttack(game, "p0", "p1", "a1");
    playDodge(game, "p1", "d1");
    respondToAttack(game, "p1"); // cannot provide a second dodge → decline
    assert.equal(p1.hp, hpBefore - 1, "took damage — one dodge was not enough");
    assert.equal(game.responseWindow, null);
  });

  it("two dodges fully cancel the attack", () => {
    const game = makeGame({ p0: "CHAR024" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    game.players.find((p) => p.id === "p0")!.hand = [attackCard("a1")];
    p1.hand = [dodgeCard("d1"), dodgeCard("d2")];
    const hpBefore = p1.hp!;
    playAttack(game, "p0", "p1", "a1");
    playDodge(game, "p1", "d1");
    playDodge(game, "p1", "d2");
    assert.equal(p1.hp, hpBefore, "no damage — two dodges cancelled it");
    assert.equal(game.responseWindow, null);
  });

  it("a normal attacker is fully dodged by one dodge", () => {
    const game = makeGame(); // p0 has no skill
    const p1 = game.players.find((p) => p.id === "p1")!;
    game.players.find((p) => p.id === "p0")!.hand = [attackCard("a1")];
    p1.hand = [dodgeCard("d1")];
    const hpBefore = p1.hp!;
    playAttack(game, "p0", "p1", "a1");
    playDodge(game, "p1", "d1");
    assert.equal(p1.hp, hpBefore, "one dodge is enough vs a normal attacker");
    assert.equal(game.responseWindow, null);
  });
});

describe("Character skill – กุยแก คำสั่งเสีย (draw_on_damage, event)", () => {
  it("reveals 2 cards per point of damage to distribute", () => {
    const game = makeGame({ p1: "CHAR021" });
    game.deck = [
      attackCard("d1"),
      attackCard("d2"),
      attackCard("d3"),
      attackCard("d4"),
      attackCard("d5"),
      attackCard("d6"),
    ];
    applyDamage(game, "p1", 1);
    assert.equal(game.pendingLegacy?.ownerId, "p1");
    assert.equal(
      game.pendingLegacy?.cards.length,
      2,
      "1 damage → 2 cards to give",
    );
    // resolve the first window, then a 2-damage hit reveals 4 more
    assignLegacyCard(game, "p1", game.pendingLegacy!.cards[0]!.id, "p1");
    assignLegacyCard(game, "p1", game.pendingLegacy!.cards[0]!.id, "p1");
    applyDamage(game, "p1", 2);
    assert.equal(game.pendingLegacy?.cards.length, 4, "2 damage → 4 cards");
  });

  it("gives each revealed card to any chosen player", () => {
    const game = makeGame({ p1: "CHAR021" });
    game.deck = [attackCard("d1"), attackCard("d2")];
    applyDamage(game, "p1", 1);
    const ids = game.pendingLegacy!.cards.map((c) => c.id);
    assignLegacyCard(game, "p1", ids[0]!, "p0");
    assignLegacyCard(game, "p1", ids[1]!, "p1");
    assert.ok(
      game.players
        .find((p) => p.id === "p0")!
        .hand.some((c) => c.id === ids[0]),
      "first card handed to p0",
    );
    assert.ok(
      game.players
        .find((p) => p.id === "p1")!
        .hand.some((c) => c.id === ids[1]),
      "second kept by กุยแก",
    );
    assert.equal(
      game.pendingLegacy,
      undefined,
      "window closes once all are distributed",
    );
  });

  it("other players see the count but not the card faces", () => {
    const game = makeGame({ p1: "CHAR021" });
    game.deck = [attackCard("d1"), attackCard("d2")];
    applyDamage(game, "p1", 1);
    const ownerView = createPublicGameState(game, "p1");
    const otherView = createPublicGameState(game, "p0");
    assert.equal(
      ownerView.pendingLegacy?.cards.length,
      2,
      "กุยแก sees the revealed cards",
    );
    assert.equal(
      otherView.pendingLegacy?.cards.length,
      0,
      "others see no card faces",
    );
  });

  it("does not fire for a character without the skill", () => {
    const game = makeGame();
    applyDamage(game, "p1", 2);
    assert.equal(game.pendingLegacy, undefined);
  });
});

describe("Character skill – โจโฉ ไม่ยอมให้โลกทรยศ (gain_damage_card, event)", () => {
  it("takes the Attack card that damaged him into hand instead of the discard pile", () => {
    const game = makeGame({ p1: "CHAR016" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.hand = [];
    game.players.find((p) => p.id === "p0")!.hand = [attackCard("atk")];
    playAttack(game, "p0", "p1", "atk");
    respondToAttack(game, "p1"); // take the hit
    assert.ok(
      p1.hand.some((c) => c.id === "atk"),
      "โจโฉ gained the attack card",
    );
    assert.ok(
      !game.discard.some((c) => c.id === "atk"),
      "and it is NOT in the discard pile",
    );
  });

  it("gains nothing when the damage has no card source (e.g. a mass trick)", () => {
    const game = makeGame({ p1: "CHAR016" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.hand = [];
    applyDamage(game, "p1", 1); // no source card
    assert.equal(p1.hand.length, 0, "no card gained");
  });
});

describe("Character skill – จิวยี่ ยอดวีรชน (draw phase +1)", () => {
  it("draws 3 cards in the draw phase instead of 2", () => {
    const game = makeGame({ p0: "CHAR005" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [];
    game.deck = [
      attackCard("c1"),
      attackCard("c2"),
      attackCard("c3"),
      attackCard("c4"),
    ];
    game.turn.phase = "draw";
    game.hasDrawnThisTurn = false;
    game.turn.drawnThisTurn = 0;
    drawOneTurnCard(game, "p0");
    drawOneTurnCard(game, "p0");
    assert.equal(game.turn.phase, "draw", "still drawing after 2 (needs 3)");
    drawOneTurnCard(game, "p0");
    assert.equal(game.turn.phase, "play", "enters play after the 3rd draw");
    assert.equal(p0.hand.length, 3);
  });
});

describe("Character skill – เตียวเสี้ยน งามกลบแสงจันทร์ (draw at turn end)", () => {
  it("grants an owed draw when เตียวเสี้ยน ends their turn", () => {
    const game = makeGame({ p0: "CHAR025" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [];
    endTurn(game, "p0");
    assert.equal(owedDraws(game, "p0"), 1, "end-of-turn draw granted");
    assert.notEqual(game.turn.activePlayerId, "p0", "turn passed on");
  });

  it("a normal character gets no end-of-turn draw", () => {
    const game = makeGame();
    game.players.find((p) => p.id === "p0")!.hand = [];
    endTurn(game, "p0");
    assert.equal(owedDraws(game, "p0"), 0);
  });
});

describe("Character skill – อุยกาย พลีชีพ (active: lose 1 HP, draw 2)", () => {
  it("loses 1 HP and gains 2 owed draws", () => {
    const game = makeGame({ p0: "CHAR004" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hp = 5;
    useSelfDamageDraw(game, "p0");
    assert.equal(p0.hp, 4);
    assert.equal(owedDraws(game, "p0"), 2);
  });

  it("can drop the user to a dying state", () => {
    const game = makeGame({ p0: "CHAR004" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hp = 1;
    useSelfDamageDraw(game, "p0");
    assert.equal(p0.hp, 0);
    assert.equal(game.responseWindow?.type, "dying_heal");
  });

  it("a normal character cannot use it", () => {
    const game = makeGame();
    assert.throws(() => useSelfDamageDraw(game, "p0"));
  });
});

describe("Character skill – ซุนกวน ถ่วงดุล (active: discard N, draw N, once/turn)", () => {
  it("discards the chosen cards and grants an equal number of draws", () => {
    const game = makeGame({ p0: "CHAR001" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [attackCard("a"), attackCard("b"), attackCard("c")];
    useDiscardThenDraw(game, "p0", ["a", "b", "c"]);
    assert.equal(p0.hand.length, 0, "chosen cards discarded");
    assert.equal(owedDraws(game, "p0"), 3, "gained 3 draws");
    assert.ok(game.discard.some((c) => c.id === "a"));
  });

  it("can only be used once per turn", () => {
    const game = makeGame({ p0: "CHAR001" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [attackCard("a"), attackCard("b")];
    useDiscardThenDraw(game, "p0", ["a"]);
    assert.throws(() => useDiscardThenDraw(game, "p0", ["b"]), /1 ครั้ง/);
  });
});

describe("Card conversion – กวนอู เทพสงคราม (red as Attack)", () => {
  it("plays a red Dodge card as an Attack", () => {
    const game = makeGame({ p0: "CHAR010" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    game.players.find((p) => p.id === "p0")!.hand = [dodgeCard("rd")]; // ♦ red dodge
    const hpBefore = p1.hp!;
    playCard(game, "p0", "rd", "p1");
    assert.equal(game.responseWindow?.type, "attack_dodge");
    respondToAttack(game, "p1"); // decline
    assert.equal(p1.hp, hpBefore - 1, "red card dealt attack damage");
  });

  it("cannot use a black card as an attack", () => {
    const game = makeGame({ p0: "CHAR010" });
    game.players.find((p) => p.id === "p0")!.hand = [
      makeCard("bd", "dodge", "basic"),
    ]; // ♠ black
    assert.throws(() => playCard(game, "p0", "bd", "p1"), /response/);
  });
});

describe("Card conversion – เอียนสี สาวงามล่มเมือง (black as Dodge)", () => {
  it("uses a black card to dodge an attack", () => {
    const game = makeGame({ p1: "CHAR022" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    game.players.find((p) => p.id === "p0")!.hand = [attackCard("a1")];
    p1.hand = [attackCard("blk")]; // ♠ black attack card, used as dodge
    const hpBefore = p1.hp!;
    playAttack(game, "p0", "p1", "a1");
    playDodge(game, "p1", "blk");
    assert.equal(p1.hp, hpBefore, "dodged with a black card");
  });
});

describe("Character skill – สุมาอี้ กำหนดชะตา (replace judgment)", () => {
  it("replaces the revealed judgment card with a hand card", () => {
    const game = makeGame({ p0: "CHAR017" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.decisionArea = [
      suited("ind", "delayed_skip_play_phase", "delayed_trick", "♠", "K"),
    ];
    game.deck = [
      attackCard("x1"),
      attackCard("x2"),
      suited("judge", "attack", "basic", "♠", "K"),
    ];
    game.players.find((p) => p.id === "p0")!.hand = [
      suited("rep", "dodge", "basic", "♥", "5"),
    ];
    startTurn(game, "p1");
    drawJudgmentCard(game, "p1");
    assert.equal(game.pendingJudgment?.revealed?.id, "judge");
    replaceJudgmentCard(game, "p0", "rep");
    assert.equal(
      game.pendingJudgment?.revealed?.id,
      "rep",
      "judgment now shows สุมาอี้ card",
    );
    assert.ok(
      game.discard.some((c) => c.id === "judge"),
      "old judgment discarded",
    );
  });

  it("the replaced card decides the outcome (♥ → Indulgence passes, play not skipped)", () => {
    const game = makeGame({ p0: "CHAR017" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.decisionArea = [
      suited("ind", "delayed_skip_play_phase", "delayed_trick", "♠", "K"),
    ];
    game.deck = [
      attackCard("x1"),
      attackCard("x2"),
      suited("judge", "attack", "basic", "♠", "K"),
    ]; // ♠ = non-heart → would skip
    game.players.find((p) => p.id === "p0")!.hand = [
      suited("rep", "dodge", "basic", "♥", "5"),
    ]; // ♥ → pass
    startTurn(game, "p1");
    drawJudgmentCard(game, "p1");
    replaceJudgmentCard(game, "p0", "rep");
    resolveJudgmentCard(game, "p1");
    drawOneTurnCard(game, "p1");
    drawOneTurnCard(game, "p1");
    assert.equal(
      game.turn.phase,
      "play",
      "play NOT skipped thanks to the ♥ replacement",
    );
  });

  it("a non-สุมาอี้ cannot replace the judgment", () => {
    const game = makeGame(); // p0 no skill
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.decisionArea = [
      suited("ind", "delayed_skip_play_phase", "delayed_trick", "♠", "K"),
    ];
    game.deck = [
      attackCard("x1"),
      attackCard("x2"),
      suited("judge", "attack", "basic", "♠", "K"),
    ];
    game.players.find((p) => p.id === "p0")!.hand = [
      suited("rep", "dodge", "basic", "♥", "5"),
    ];
    startTurn(game, "p1");
    drawJudgmentCard(game, "p1");
    assert.throws(() => replaceJudgmentCard(game, "p0", "rep"), /กำหนดชะตา/);
  });
});

describe("Character skill – สุมาอี้ กลยุทธ์โต้กลับ (take card from damager)", () => {
  it("opens a pending decision when สุมาอี้ takes damage from someone with cards", () => {
    const game = makeGame({ p0: "CHAR017" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.hand = [
      suited("d1", "attack", "basic", "♠", "7"),
      suited("d2", "dodge", "basic", "♥", "3"),
    ];
    applyDamage(game, "p0", 1, "p1");
    assert.equal(game.pendingFankui?.playerId, "p0");
    assert.equal(game.pendingFankui?.damagerId, "p1");
  });

  it("takes one hand card from the damager into สุมาอี้ hand", () => {
    const game = makeGame({ p0: "CHAR017" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [];
    p1.hand = [
      suited("d1", "attack", "basic", "♠", "7"),
      suited("d2", "dodge", "basic", "♥", "3"),
    ];
    applyDamage(game, "p0", 1, "p1");
    takeCardFromDamager(game, "p0", { zone: "hand", handIndex: 0 });
    assert.equal(p0.hand.length, 1, "สุมาอี้ gained a card");
    assert.equal(p1.hand.length, 1, "damager lost a card");
    assert.equal(game.pendingFankui, undefined, "decision cleared");
  });

  it("can take a visible equipment card from the damager", () => {
    const game = makeGame({ p0: "CHAR017" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [];
    p1.hand = [];
    const wpn = suited("w1", "none", "weapon", "♠", "K");
    wpn.equipmentSlot = "weapon";
    p1.equipment.weapon = wpn;
    applyDamage(game, "p0", 1, "p1");
    takeCardFromDamager(game, "p0", {
      zone: "equipment",
      cardInstanceId: "w1",
    });
    assert.equal(p1.equipment.weapon, null, "weapon removed from damager");
    assert.ok(
      p0.hand.some((c) => c.id === "w1"),
      "สุมาอี้ took the weapon into hand",
    );
  });

  it("declining clears the pending decision without taking a card", () => {
    const game = makeGame({ p0: "CHAR017" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.hand = [suited("d1", "attack", "basic", "♠", "7")];
    applyDamage(game, "p0", 1, "p1");
    declineFankui(game, "p0");
    assert.equal(game.pendingFankui, undefined);
    assert.equal(p1.hand.length, 1, "damager keeps their card");
  });

  it("no window opens when the damager has no cards at all", () => {
    const game = makeGame({ p0: "CHAR017" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.hand = [];
    p1.equipment = {
      weapon: null,
      armor: null,
      offensiveMount: null,
      defensiveMount: null,
    };
    applyDamage(game, "p0", 1, "p1");
    assert.equal(game.pendingFankui, undefined);
  });

  it("a non-สุมาอี้ does not get the window on damage", () => {
    const game = makeGame(); // p0 has no skill
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.hand = [suited("d1", "attack", "basic", "♠", "7")];
    applyDamage(game, "p0", 1, "p1");
    assert.equal(game.pendingFankui, undefined);
  });

  it("no window opens for self-inflicted damage (no distinct damager)", () => {
    const game = makeGame({ p0: "CHAR017" });
    applyDamage(game, "p0", 1, "p0");
    assert.equal(game.pendingFankui, undefined);
  });
});

describe("Card conversion – ฮัวโต๋ ปฐมพยาบาล (red as เสบียง)", () => {
  it("uses a red card as Heal to rescue a dying player", () => {
    const game = makeGame({ p2: "CHAR023" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    const p2 = game.players.find((p) => p.id === "p2")!;
    p1.hp = 1;
    p2.hand = [dodgeCard("rh")]; // ♦ red card used as heal
    applyDamage(game, "p1", 1, "p0"); // p1 → 0, dying window
    assert.equal(game.responseWindow?.type, "dying_heal");
    declineResponse(game, "p1"); // dying player has no heal, passes to p2
    assert.equal(game.responseWindow?.currentResponderId, "p2");
    playHeal(game, "p2", "rh");
    assert.ok(p1.hp! > 0, "ฮัวโต๋ healed the dying player with a red card");
  });
});

describe("Character skill – ลิบอง ยับยั้งชั่งใจ (skip discard if no attack)", () => {
  it("needs no discard when over the hand limit but no attack was used", () => {
    const game = makeGame({ p0: "CHAR003" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hp = 1;
    p0.hand = [attackCard("c1"), attackCard("c2"), attackCard("c3")];
    game.attacksThisTurn = 0;
    assert.equal(
      getDiscardRequirement(game, "p0"),
      0,
      "ลิบอง may skip the discard step",
    );
  });

  it("must discard normally if an attack was used this turn", () => {
    const game = makeGame({ p0: "CHAR003" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hp = 1;
    p0.hand = [attackCard("c1"), attackCard("c2"), attackCard("c3")];
    game.attacksThisTurn = 1;
    assert.equal(
      getDiscardRequirement(game, "p0"),
      2,
      "attacking removes the discard exemption",
    );
  });

  it("a normal character always discards down to the hand limit", () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hp = 1;
    p0.hand = [attackCard("c1"), attackCard("c2"), attackCard("c3")];
    game.attacksThisTurn = 0;
    assert.equal(getDiscardRequirement(game, "p0"), 2);
  });
});

describe("Character skill – จูกัดเหลียง กลยุทธ์เมืองว่าง (empty city vs. duel)", () => {
  it("cannot be the target of ท้าสู้ while handless", () => {
    const game = makeGame({ p1: "CHAR012" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.hand = [];
    p0.hand = [duelCard("d1")];
    assert.throws(() => playDuel(game, "p0", "p1", "d1"), /เมืองว่าง/);
  });

  it("can be dueled once holding at least one card", () => {
    const game = makeGame({ p1: "CHAR012" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.hand = [attackCard("x")];
    p0.hand = [duelCard("d1")];
    assert.doesNotThrow(() => playDuel(game, "p0", "p1", "d1"));
  });
});

describe("Character skill – อ้วนสุด ศัตรูหมายหัว (forced taunt when loaded)", () => {
  it("forces the attacker to target อ้วนสุด when his hand exceeds his HP", () => {
    const game = makeGame({ p1: "CHAR027" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.hp = 1;
    p1.hand = [attackCard("h1"), attackCard("h2")]; // hand(2) > hp(1)
    p0.hand = [attackCard("a1")];
    assert.deepEqual(forcedAttackTargets(game, "p0"), ["p1"]);
    assert.throws(() => playAttack(game, "p0", "p3", "a1"), /ศัตรูหมายหัว/);
  });

  it("attacking อ้วนสุด himself is allowed", () => {
    const game = makeGame({ p1: "CHAR027" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.hp = 1;
    p1.hand = [attackCard("h1"), attackCard("h2")];
    p0.hand = [attackCard("a1")];
    assert.doesNotThrow(() => playAttack(game, "p0", "p1", "a1"));
  });

  it("imposes no constraint when อ้วนสุด is not over the hand limit", () => {
    const game = makeGame({ p1: "CHAR027" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.hp = 4;
    p1.hand = [attackCard("h1")]; // hand(1) <= hp(4)
    p0.hand = [attackCard("a1")];
    assert.deepEqual(forcedAttackTargets(game, "p0"), []);
    assert.doesNotThrow(() => playAttack(game, "p0", "p3", "a1"));
  });
});

describe("Character skill – หวงเย่อิง คลังปัญญา (draw on non-delayed trick)", () => {
  it("grants a draw right when an instant trick is played", () => {
    const game = makeGame({ p0: "CHAR015" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [suited("t1", "none", "instant_trick", "♠", "5")];
    playCard(game, "p0", "t1");
    assert.equal(owedDraws(game, "p0"), 1);
  });

  it("does not grant a draw for a basic card", () => {
    const game = makeGame({ p0: "CHAR015" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hp = 1;
    p0.maxHp = 4;
    p0.hand = [suited("h1", "heal", "basic", "♥", "5")];
    playCard(game, "p0", "h1");
    assert.equal(owedDraws(game, "p0"), 0);
  });

  it("does not grant a draw for a non-หวงเย่อิง character", () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [suited("t1", "none", "instant_trick", "♠", "5")];
    playCard(game, "p0", "t1");
    assert.equal(owedDraws(game, "p0"), 0);
  });
});

describe("Character skill – ฮัวโต๋ ยาสวรรค์ (discard 1 to heal any wounded general)", () => {
  it("discards a card and restores 1 HP to a wounded ally", () => {
    const game = makeGame({ p0: "CHAR023" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("c1")];
    p1.hp = 5;
    useMiracleMedicine(game, "p0", "c1", "p1");
    assert.equal(p1.hp, 6, "target healed 1 HP");
    assert.equal(p0.hand.length, 0, "discarded the paid card");
    assert.ok(
      game.discard.some((c) => c.id === "c1"),
      "paid card went to discard",
    );
  });

  it("can heal ฮัวโต๋ himself", () => {
    const game = makeGame({ p0: "CHAR023" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hp = 5;
    p0.hand = [attackCard("c1")];
    useMiracleMedicine(game, "p0", "c1", "p0");
    assert.equal(p0.hp, 6);
  });

  it("can only be used once per turn", () => {
    const game = makeGame({ p0: "CHAR023" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("c1"), attackCard("c2")];
    p1.hp = 5;
    useMiracleMedicine(game, "p0", "c1", "p1");
    assert.throws(
      () => useMiracleMedicine(game, "p0", "c2", "p1"),
      /1 ครั้งต่อรอบ/,
    );
  });

  it("cannot target a general already at full HP", () => {
    const game = makeGame({ p0: "CHAR023" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("c1")];
    p1.hp = p1.maxHp!; // full
    assert.throws(() => useMiracleMedicine(game, "p0", "c1", "p1"), /เต็ม/);
  });

  it("a non-ฮัวโต๋ cannot use ยาสวรรค์", () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("c1")];
    p1.hp = 5;
    assert.throws(() => useMiracleMedicine(game, "p0", "c1", "p1"), /ยาสวรรค์/);
  });
});

describe("Character skill – ซุนซ่างเซียง แผนแต่งงาน (discard 2 to heal a male ally and self)", () => {
  it("discards 2 cards and heals a wounded male general and ซุนซ่างเซียง 1 HP each", () => {
    const game = makeGame({ p0: "CHAR008" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hp = 5;
    p0.hand = [attackCard("c1"), attackCard("c2")];
    p1.hp = 5;
    p1.character!.gender = "ชาย";
    useMarriage(game, "p0", ["c1", "c2"], "p1");
    assert.equal(p1.hp, 6, "male ally healed");
    assert.equal(p0.hp, 6, "ซุนซ่างเซียง healed too");
    assert.equal(p0.hand.length, 0, "both cards discarded");
  });

  it("requires exactly 2 cards", () => {
    const game = makeGame({ p0: "CHAR008" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("c1")];
    p1.hp = 5;
    p1.character!.gender = "ชาย";
    assert.throws(() => useMarriage(game, "p0", ["c1"], "p1"), /2 ใบ/);
  });

  it("cannot target a female general", () => {
    const game = makeGame({ p0: "CHAR008" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("c1"), attackCard("c2")];
    p1.hp = 5;
    p1.character!.gender = "หญิง";
    assert.throws(() => useMarriage(game, "p0", ["c1", "c2"], "p1"), /ชาย/);
  });

  it("cannot target a male already at full HP", () => {
    const game = makeGame({ p0: "CHAR008" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("c1"), attackCard("c2")];
    p1.hp = p1.maxHp!;
    p1.character!.gender = "ชาย";
    assert.throws(() => useMarriage(game, "p0", ["c1", "c2"], "p1"), /เต็ม/);
  });

  it("can only be used once per turn", () => {
    const game = makeGame({ p0: "CHAR008" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [
      attackCard("c1"),
      attackCard("c2"),
      attackCard("c3"),
      attackCard("c4"),
    ];
    p1.hp = 4;
    p1.character!.gender = "ชาย";
    useMarriage(game, "p0", ["c1", "c2"], "p1");
    assert.throws(
      () => useMarriage(game, "p0", ["c3", "c4"], "p1"),
      /1 ครั้งต่อรอบ/,
    );
  });

  it("a non-ซุนซ่างเซียง cannot use แผนแต่งงาน", () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("c1"), attackCard("c2")];
    p1.hp = 5;
    p1.character!.gender = "ชาย";
    assert.throws(
      () => useMarriage(game, "p0", ["c1", "c2"], "p1"),
      /แผนแต่งงาน/,
    );
  });
});

describe("Character skill – เตียวเลี้ยว จู่โจมฉับพลัน (raid instead of drawing)", () => {
  const drawPhase = (game: GameState) => {
    game.turn.phase = "draw";
    game.turn.drawnThisTurn = 0;
    game.hasDrawnThisTurn = false;
  };

  it("takes one hand card from each of two chosen players, then enters play phase", () => {
    const game = makeGame({ p0: "CHAR019" });
    drawPhase(game);
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    const p2 = game.players.find((p) => p.id === "p2")!;
    p0.hand = [];
    p1.hand = [attackCard("a1")];
    p2.hand = [attackCard("b1")];
    useRaid(game, "p0", ["p1", "p2"]);
    assert.equal(p0.hand.length, 2, "เตียวเลี้ยว took a card from each");
    assert.equal(p1.hand.length, 0);
    assert.equal(p2.hand.length, 0);
    assert.equal(game.turn.phase, "play", "draw phase completed");
    assert.equal(game.hasDrawnThisTurn, true);
  });

  it("may target just one player", () => {
    const game = makeGame({ p0: "CHAR019" });
    drawPhase(game);
    const p0 = game.players.find((p) => p.id === "p0")!;
    game.players.find((p) => p.id === "p1")!.hand = [attackCard("a1")];
    useRaid(game, "p0", ["p1"]);
    assert.equal(p0.hand.length, 1);
  });

  it("cannot be used after already drawing", () => {
    const game = makeGame({ p0: "CHAR019" });
    drawPhase(game);
    game.turn.drawnThisTurn = 1;
    game.players.find((p) => p.id === "p1")!.hand = [attackCard("a1")];
    assert.throws(() => useRaid(game, "p0", ["p1"]), /ก่อนเริ่มจั่ว/);
  });

  it("rejects a target with no hand cards", () => {
    const game = makeGame({ p0: "CHAR019" });
    drawPhase(game);
    game.players.find((p) => p.id === "p1")!.hand = [];
    assert.throws(() => useRaid(game, "p0", ["p1"]), /มีไพ่บนมือ/);
  });

  it("cannot target more than two players", () => {
    const game = makeGame({ p0: "CHAR019" });
    drawPhase(game);
    for (const id of ["p1", "p2", "p3"])
      game.players.find((p) => p.id === id)!.hand = [attackCard(`${id}c`)];
    assert.throws(() => useRaid(game, "p0", ["p1", "p2", "p3"]), /1–2/);
  });

  it("a non-เตียวเลี้ยว cannot use จู่โจมฉับพลัน", () => {
    const game = makeGame(); // p0 no skill
    drawPhase(game);
    game.players.find((p) => p.id === "p1")!.hand = [attackCard("a1")];
    assert.throws(() => useRaid(game, "p0", ["p1"]), /จู่โจมฉับพลัน/);
  });
});

describe("Character skill – กุยแก คาดการณ์แม่นยำ (keep every judgment card)", () => {
  it("keeps the revealed judgment card into hand instead of discarding", () => {
    const game = makeGame({ p0: "CHAR021" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.decisionArea = [
      suited("ind", "delayed_skip_play_phase", "delayed_trick", "♠", "K"),
    ];
    p0.hand = [];
    game.deck = [
      attackCard("x1"),
      attackCard("x2"),
      suited("judge", "attack", "basic", "♠", "K"),
    ];
    startTurn(game, "p0");
    drawJudgmentCard(game, "p0");
    assert.equal(game.pendingJudgment?.revealed?.id, "judge");
    resolveJudgmentCard(game, "p0");
    assert.ok(
      p0.hand.some((c) => c.id === "judge"),
      "กุยแก kept the judgment card",
    );
    assert.ok(
      !game.discard.some((c) => c.id === "judge"),
      "judgment not discarded",
    );
  });

  it("a normal character discards the judgment card as usual", () => {
    const game = makeGame(); // p0 no keep skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.decisionArea = [
      suited("ind", "delayed_skip_play_phase", "delayed_trick", "♠", "K"),
    ];
    p0.hand = [];
    game.deck = [
      attackCard("x1"),
      attackCard("x2"),
      suited("judge", "attack", "basic", "♠", "K"),
    ];
    startTurn(game, "p0");
    drawJudgmentCard(game, "p0");
    resolveJudgmentCard(game, "p0");
    assert.ok(!p0.hand.some((c) => c.id === "judge"), "not kept");
    assert.ok(
      game.discard.some((c) => c.id === "judge"),
      "discarded",
    );
  });
});

describe("Character skill – เคาทู ฆ่าเสือมือเปล่า (draw one for +1 damage)", () => {
  const drawPhase = (game: GameState) => {
    game.turn.phase = "draw";
    game.turn.drawnThisTurn = 0;
    game.hasDrawnThisTurn = false;
  };

  it("drawing only one card adds +1 to Attack damage this turn", () => {
    const game = makeGame({ p0: "CHAR020" });
    drawPhase(game);
    game.deck = [attackCard("d1")];
    useUnarmedHunt(game, "p0");
    assert.equal(game.unarmedPowerActive, true);
    assert.equal(game.turn.phase, "play");
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("atk")];
    p1.hp = 5;
    playAttack(game, "p0", "p1", "atk");
    respondToAttack(game, "p1"); // no dodge → takes damage
    assert.equal(p1.hp, 3, "took 2 damage (1 base + 1 ฆ่าเสือมือเปล่า)");
  });

  it("a normal draw deals base damage only", () => {
    const game = makeGame({ p0: "CHAR020" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("atk")];
    p1.hp = 5;
    playAttack(game, "p0", "p1", "atk");
    respondToAttack(game, "p1");
    assert.equal(p1.hp, 4, "base 1 damage without the skill bonus");
  });

  it("the power bonus resets at the start of the next turn", () => {
    const game = makeGame({ p0: "CHAR020" });
    game.unarmedPowerActive = true;
    startTurn(game, "p1");
    assert.equal(game.unarmedPowerActive, false);
  });
});

describe("Character skill – เอียนสี พึ่งวาสนา (fortune judgment)", () => {
  const drawPhase = (game: GameState) => {
    game.turn.phase = "draw";
    game.turn.drawnThisTurn = 0;
    game.hasDrawnThisTurn = false;
  };

  it("keeps a black revealed card, then stops when a red one appears", () => {
    const game = makeGame({ p0: "CHAR022" });
    drawPhase(game);
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [];
    game.deck = [
      suited("r1", "none", "basic", "♥", "5"),
      suited("b1", "none", "basic", "♠", "7"),
    ]; // pops b1 first
    useFortune(game, "p0");
    assert.ok(
      p0.hand.some((c) => c.id === "b1"),
      "kept the black card",
    );
    assert.ok(
      !game.skillsUsedThisTurn?.includes("fortune_done"),
      "may continue after black",
    );
    useFortune(game, "p0");
    assert.ok(!p0.hand.some((c) => c.id === "r1"), "red card not kept");
    assert.ok(
      game.skillsUsedThisTurn?.includes("fortune_done"),
      "stops after a red reveal",
    );
  });

  it("can be used in the judgment phase, before revealing a delayed trick (e.g. Lightning)", () => {
    const game = makeGame({ p0: "CHAR022" });
    game.turn.phase = "judgment";
    game.turn.drawnThisTurn = 0;
    game.hasDrawnThisTurn = false;
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [];
    game.deck = [
      suited("r1", "none", "basic", "♥", "5"),
      suited("b1", "none", "basic", "♠", "7"),
    ];
    useFortune(game, "p0"); // ช่วงเตรียมการมาก่อนตัดสิน — ต้องใช้ได้แม้ยังอยู่ phase judgment
    assert.ok(
      p0.hand.some((c) => c.id === "b1"),
      "usable during the prep/judgment phase",
    );
  });

  it("cannot be used again after revealing a red card", () => {
    const game = makeGame({ p0: "CHAR022" });
    drawPhase(game);
    game.deck = [suited("r1", "none", "basic", "♥", "5")];
    useFortune(game, "p0");
    assert.throws(() => useFortune(game, "p0"), /จบลงแล้ว/);
  });

  it("a non-เอียนสี cannot use พึ่งวาสนา", () => {
    const game = makeGame(); // p0 no skill
    drawPhase(game);
    game.deck = [suited("b1", "none", "basic", "♠", "7")];
    assert.throws(() => useFortune(game, "p0"), /พึ่งวาสนา/);
  });
});

describe("Character skill – เล่าปี่ เมตตาธรรม (gift cards, heal when giving 2+)", () => {
  it("transfers cards to another general", () => {
    const game = makeGame({ p0: "CHAR009" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("g1")];
    p1.hand = [];
    useBenevolence(game, "p0", ["g1"], "p1");
    assert.ok(
      p1.hand.some((c) => c.id === "g1"),
      "recipient got the card",
    );
    assert.equal(p0.hand.length, 0);
  });

  it("heals 1 HP once total giving reaches 2 cards this turn", () => {
    const game = makeGame({ p0: "CHAR009" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hp = 3;
    p0.hand = [attackCard("g1"), attackCard("g2"), attackCard("g3")];
    useBenevolence(game, "p0", ["g1"], "p1"); // 1 given → no heal yet
    assert.equal(p0.hp, 3);
    useBenevolence(game, "p0", ["g2"], "p2"); // 2 total → heal
    assert.equal(p0.hp, 4, "healed after giving a 2nd card");
    useBenevolence(game, "p0", ["g3"], "p1"); // still capped at one heal/turn
    assert.equal(p0.hp, 4, "heal only once per turn");
  });

  it("cannot give to itself", () => {
    const game = makeGame({ p0: "CHAR009" });
    game.players.find((p) => p.id === "p0")!.hand = [attackCard("g1")];
    assert.throws(() => useBenevolence(game, "p0", ["g1"], "p0"), /ตัวเอง/);
  });

  it("a non-เล่าปี่ cannot use เมตตาธรรม", () => {
    const game = makeGame(); // p0 no skill
    game.players.find((p) => p.id === "p0")!.hand = [attackCard("g1")];
    assert.throws(() => useBenevolence(game, "p0", ["g1"], "p1"), /เมตตาธรรม/);
  });
});

describe("Character skill – ซุนกวน ค้ำจุน (emperor rescue heal +1)", () => {
  it("recovers +1 when rescued with a WU ally present", () => {
    const game = makeGame({ p1: "CHAR001" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    const p2 = game.players.find((p) => p.id === "p2")!;
    p1.role = "emperor";
    p0.character!.kingdom = "WU"; // living WU ally
    p1.hp = 1;
    p1.hand = [];
    p2.hand = [suited("rh", "heal", "basic", "♥", "5")];
    applyDamage(game, "p1", 1, "p3"); // p1 → 0, dying window
    assert.equal(game.responseWindow?.type, "dying_heal");
    declineResponse(game, "p1"); // dying emperor can't heal itself
    assert.equal(game.responseWindow?.currentResponderId, "p2");
    playHeal(game, "p2", "rh");
    assert.equal(p1.hp, 2, "base 1 + ค้ำจุน 1");
  });

  it("gives no bonus without a WU ally", () => {
    const game = makeGame({ p1: "CHAR001" });
    const p1 = game.players.find((p) => p.id === "p1")!;
    const p2 = game.players.find((p) => p.id === "p2")!;
    p1.role = "emperor"; // no WU allies set anywhere
    p1.hp = 1;
    p1.hand = [];
    p2.hand = [suited("rh", "heal", "basic", "♥", "5")];
    applyDamage(game, "p1", 1, "p3");
    declineResponse(game, "p1");
    playHeal(game, "p2", "rh");
    assert.equal(p1.hp, 1, "base heal only");
  });
});

describe("Character skill – อ้วนสุด จองหอง (emperor arrogance)", () => {
  const drawPhase = (game: GameState) => {
    game.turn.phase = "draw";
    game.turn.drawnThisTurn = 0;
    game.hasDrawnThisTurn = false;
  };

  it("lets the emperor draw one extra and lowers the hand limit by 1", () => {
    const game = makeGame({ p0: "CHAR027" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.role = "emperor";
    p0.hp = 4;
    p0.hand = [];
    drawPhase(game);
    game.deck = [attackCard("e1")];
    useArrogance(game, "p0");
    assert.equal(p0.hand.length, 1, "drew one extra");
    assert.equal(game.arrogancePenalty, true);
    p0.hand = [
      attackCard("a"),
      attackCard("b"),
      attackCard("c"),
      attackCard("d"),
    ];
    assert.equal(
      getDiscardRequirement(game, "p0"),
      1,
      "hand limit is hp-1 = 3",
    );
  });

  it("cannot be used by a non-emperor", () => {
    const game = makeGame({ p0: "CHAR027" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.role = "rebel";
    drawPhase(game);
    game.deck = [attackCard("e1")];
    assert.throws(() => useArrogance(game, "p0"), /จักรพรรดิ/);
  });

  it("can only be used once per turn", () => {
    const game = makeGame({ p0: "CHAR027" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.role = "emperor";
    drawPhase(game);
    game.deck = [attackCard("e1"), attackCard("e2")];
    useArrogance(game, "p0");
    assert.throws(() => useArrogance(game, "p0"), /1 ครั้งต่อรอบ/);
  });
});

describe("Character skill – ม้าเฉียว ม้าคะนองศึก (attack judgment blocks dodge)", () => {
  it("a red judgment stops the target from dodging", () => {
    const game = makeGame({ p0: "CHAR014" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("atk")];
    p1.hand = [dodgeCard("dg")];
    p1.hp = 5;
    game.deck = [suited("j1", "none", "basic", "♥", "5")]; // red judgment
    playAttack(game, "p0", "p1", "atk");
    assert.equal(game.pendingAction?.noDodge, true);
    assert.throws(() => respondToAttack(game, "p1", "dg"), /หลบไม่ได้/);
    respondToAttack(game, "p1"); // forced to take the hit
    assert.equal(p1.hp, 4);
  });

  it("a black judgment lets the target dodge normally", () => {
    const game = makeGame({ p0: "CHAR014" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("atk")];
    p1.hand = [dodgeCard("dg")];
    p1.hp = 5;
    game.deck = [suited("j2", "none", "basic", "♠", "5")]; // black judgment
    playAttack(game, "p0", "p1", "atk");
    assert.equal(game.pendingAction?.noDodge, false);
    assert.doesNotThrow(() => respondToAttack(game, "p1", "dg"));
    assert.equal(p1.hp, 5, "dodge succeeded, no damage");
  });

  it("a normal attacker performs no judgment and the target may dodge", () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("atk")];
    p1.hand = [dodgeCard("dg")];
    p1.hp = 5;
    game.deck = [suited("j3", "none", "basic", "♥", "5")];
    playAttack(game, "p0", "p1", "atk");
    assert.ok(!game.pendingAction?.noDodge);
    assert.equal(game.deck.length, 1, "no judgment card was drawn");
  });
});

describe("Character skill – แฮหัวตุ้น ย้อนรอยศัตรู (retaliate on damage)", () => {
  it("a non-♥ judgment makes the damager choose; discarding two resolves it", () => {
    const game = makeGame({ p0: "CHAR018" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hp = 5;
    p1.hand = [attackCard("c1"), attackCard("c2"), attackCard("c3")];
    game.deck = [suited("j", "none", "basic", "♠", "5")]; // black → not ♥
    applyDamage(game, "p0", 1, "p1");
    assert.equal(
      game.pendingRetaliateJudgment?.ownerId,
      "p0",
      "owner must reveal the judgment first",
    );
    revealRetaliateJudgment(game, "p0");
    assert.equal(game.pendingRetaliate?.damagerId, "p1");
    retaliateDiscard(game, "p1", ["c1", "c2"]);
    assert.equal(p1.hand.length, 1, "damager discarded two");
    assert.equal(game.pendingRetaliate, undefined);
  });

  it("the damager may instead take 1 damage", () => {
    const game = makeGame({ p0: "CHAR018" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hp = 5;
    p1.hp = 5;
    p1.hand = [attackCard("c1")];
    game.deck = [suited("j", "none", "basic", "♣", "5")];
    applyDamage(game, "p0", 1, "p1");
    revealRetaliateJudgment(game, "p0");
    retaliateTakeDamage(game, "p1");
    assert.equal(p1.hp, 4);
    assert.equal(game.pendingRetaliate, undefined);
  });

  it("a ♥ judgment triggers nothing", () => {
    const game = makeGame({ p0: "CHAR018" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hp = 5;
    p1.hand = [attackCard("c1"), attackCard("c2")];
    game.deck = [suited("j", "none", "basic", "♥", "5")];
    applyDamage(game, "p0", 1, "p1");
    revealRetaliateJudgment(game, "p0"); // ♥ → no penalty
    assert.equal(game.pendingRetaliate, undefined);
  });

  it("does not trigger if แฮหัวตุ้น is left dying (0 HP)", () => {
    const game = makeGame({ p0: "CHAR018" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hp = 1;
    p1.hand = [attackCard("c1")];
    game.deck = [suited("j", "none", "basic", "♠", "5")];
    applyDamage(game, "p0", 1, "p1"); // p0 → 0
    assert.equal(game.pendingRetaliate, undefined);
  });

  it("a non-แฮหัวตุ้น does not retaliate", () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hp = 5;
    p1.hand = [attackCard("c1")];
    game.deck = [suited("j", "none", "basic", "♠", "5")];
    applyDamage(game, "p0", 1, "p1");
    assert.equal(game.pendingRetaliate, undefined);
  });
});

describe("Judgment – ฟ้าลงโทษเลื่อนข้ามคนที่มีอยู่แล้ว (lightning skips occupied seats)", () => {
  it("moves to the next player without a lightning instead of being discarded", () => {
    const game = makeGame();
    const byId = (id: string) => game.players.find((p) => p.id === id)!;
    byId("p0").decisionArea = [
      suited("L1", "delayed_lightning_judgment", "delayed_trick", "♥", "5"),
    ]; // ♥ → safe, must move
    byId("p1").decisionArea = [
      suited("Lb", "delayed_lightning_judgment", "delayed_trick", "♠", "3"),
    ];
    byId("p3").decisionArea = [
      suited("Ld", "delayed_lightning_judgment", "delayed_trick", "♠", "4"),
    ];
    game.deck = [suited("judge", "attack", "basic", "♥", "6")];
    startTurn(game, "p0");
    drawJudgmentCard(game, "p0");
    resolveJudgmentCard(game, "p0");
    assert.ok(
      !game.discard.some((c) => c.id === "L1"),
      "lightning must not be discarded when the next seat already holds one",
    );
    assert.ok(
      byId("p2").decisionArea.some((c) => c.id === "L1"),
      "lightning skipped the occupied seats and landed on the only free player",
    );
  });
});

describe("Character skill – ไต้เกี้ยว ระเหเร่ร่อน (redirect attack)", () => {
  it("redirects the attack to another general in range for the cost of a card", () => {
    const game = makeGame({ p1: "CHAR006" }); // p1 = ไต้เกี้ยว
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    const p2 = game.players.find((p) => p.id === "p2")!;
    p0.hand = [attackCard("atk")];
    p1.hand = [attackCard("pay")];
    p2.hp = 5;
    playAttack(game, "p0", "p1", "atk");
    assert.equal(game.pendingAction?.targetId, "p1");
    redirectAttack(game, "p1", "pay", "p2");
    assert.equal(game.pendingAction?.targetId, "p2", "attack redirected to p2");
    assert.equal(p1.hand.length, 0, "paid a card");
    respondToAttack(game, "p2"); // p2 takes the hit from the original attacker
    assert.equal(p2.hp, 4);
  });

  it("cannot redirect onto the attacker", () => {
    const game = makeGame({ p1: "CHAR006" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("atk")];
    p1.hand = [attackCard("pay")];
    playAttack(game, "p0", "p1", "atk");
    assert.throws(() => redirectAttack(game, "p1", "pay", "p0"), /ผู้โจมตี/);
  });

  it("cannot redirect to a target outside ไต้เกี้ยว range", () => {
    const game = makeGame({ p1: "CHAR006" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("atk")];
    p1.hand = [attackCard("pay")];
    playAttack(game, "p0", "p1", "atk");
    assert.throws(() => redirectAttack(game, "p1", "pay", "p3"), /ระยะ/); // p3 is distance 2
  });

  it("a non-ไต้เกี้ยว target cannot redirect", () => {
    const game = makeGame(); // p1 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("atk")];
    p1.hand = [attackCard("pay")];
    playAttack(game, "p0", "p1", "atk");
    assert.throws(() => redirectAttack(game, "p1", "pay", "p2"), /ระเหเร่ร่อน/);
  });
});

const clearNegateWindow = (game: GameState) => {
  let guard = 0;
  while (
    game.responseWindow?.type === "negate" &&
    game.responseWindow.currentResponderId &&
    guard++ < 10
  )
    declineNegate(game, game.responseWindow.currentResponderId);
};

describe("Card conversion – กำเหลง บ้าบิ่น (♠/♣ as ถอนสะพาน)", () => {
  it("lets กำเหลง use a black card to dismantle a target card", () => {
    const game = makeGame({ p0: "CHAR002" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [suited("bd", "attack", "basic", "♠", "7")];
    p1.hand = [attackCard("t1"), attackCard("t2")];
    assert.ok(cardActsAs(game, "p0", p0.hand[0], "discard_target_card"));
    playDiscardTargetCard(game, "p0", "p1", "bd", {
      zone: "hand",
      handIndex: 0,
    });
    clearNegateWindow(game);
    assert.equal(p1.hand.length, 1, "target lost a card to ถอนสะพาน");
  });

  it("a non-กำเหลง cannot dismantle with a plain black card", () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [suited("bd", "attack", "basic", "♠", "7")];
    p1.hand = [attackCard("t1")];
    assert.throws(
      () =>
        playDiscardTargetCard(game, "p0", "p1", "bd", {
          zone: "hand",
          handIndex: 0,
        }),
      /Discard-target/,
    );
  });
});

describe("Card conversion – ไต้เกี้ยว โปรยเสน่ห์ (♦ as มีสุขลืมเมือง)", () => {
  it("lets ไต้เกี้ยว place an Indulgence using a ♦ card", () => {
    const game = makeGame({ p0: "CHAR006" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [suited("sd", "attack", "basic", "♦", "7")];
    playDelayedTrick(game, "p0", "sd", "p1");
    clearNegateWindow(game);
    assert.ok(
      p1.decisionArea.some((c) => c.effect === "delayed_skip_play_phase"),
      "มีสุขลืมเมือง placed on the target",
    );
  });

  it("a non-ไต้เกี้ยว cannot seduce with a ♦ card", () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [suited("sd", "attack", "basic", "♦", "7")];
    assert.throws(() => playDelayedTrick(game, "p0", "sd", "p1"), /หน่วงเวลา/);
  });
});

describe("Character skill – ลกซุน เชื่อมค่ายทดแทน (draw when the last hand card is lost)", () => {
  it("grants one draw when the hand drops from 1 to 0", () => {
    const game = makeGame({ p0: "CHAR007" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [attackCard("c1")];
    synchronizeGameState(game); // seed snapshot at hand=1
    p0.hand = [];
    synchronizeGameState(game); // 1 → 0
    assert.equal(owedDraws(game, "p0"), 1);
  });

  it("does not grant while cards remain", () => {
    const game = makeGame({ p0: "CHAR007" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [attackCard("c1"), attackCard("c2")];
    synchronizeGameState(game);
    p0.hand = [attackCard("c2")]; // still holding one
    synchronizeGameState(game);
    assert.equal(owedDraws(game, "p0"), 0);
  });

  it("does not grant for a non-ลกซุน", () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [attackCard("c1")];
    synchronizeGameState(game);
    p0.hand = [];
    synchronizeGameState(game);
    assert.equal(owedDraws(game, "p0"), 0);
  });
});

describe("Character skill – ซุนซ่างเซียง องค์หญิงน้อย (draw 2 per equipment lost)", () => {
  it("grants two draws when an equipment card is lost", () => {
    const game = makeGame({ p0: "CHAR008" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.equipment.weapon = suited("w1", "none", "weapon", "♠", "K");
    synchronizeGameState(game);
    p0.equipment.weapon = null;
    synchronizeGameState(game);
    assert.equal(owedDraws(game, "p0"), 2);
  });

  it("also triggers when equipment is replaced (old card lost)", () => {
    const game = makeGame({ p0: "CHAR008" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.equipment.weapon = suited("wA", "none", "weapon", "♠", "K");
    synchronizeGameState(game);
    p0.equipment.weapon = suited("wB", "none", "weapon", "♥", "2"); // swap
    synchronizeGameState(game);
    assert.equal(owedDraws(game, "p0"), 2);
  });

  it("does not grant for a non-ซุนซ่างเซียง", () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.equipment.weapon = suited("w1", "none", "weapon", "♠", "K");
    synchronizeGameState(game);
    p0.equipment.weapon = null;
    synchronizeGameState(game);
    assert.equal(owedDraws(game, "p0"), 0);
  });
});

describe("Character skill – จูกัดเหลียง หยั่งรู้ฟ้าดิน (peek and reorder the draw pile)", () => {
  const drawPhase = (game: GameState) => {
    game.turn.phase = "draw";
    game.turn.drawnThisTurn = 0;
    game.hasDrawnThisTurn = false;
  };
  const deck5 = () =>
    ["a", "b", "c", "d", "e"].map((id, i) =>
      suited(id, "none", "basic", "♠", String(i + 2)),
    );

  it("peeks the top X cards and reorders a chosen card to the top", () => {
    const game = makeGame({ p0: "CHAR012" });
    drawPhase(game);
    game.deck = deck5();
    usePeek(game, "p0");
    assert.equal(game.pendingPeek?.cards.length, 4, "X = 4 living generals");
    const peeked = game.pendingPeek!.cards.map((c) => c.id);
    resolvePeek(game, "p0", [peeked[3]], [peeked[0], peeked[1], peeked[2]]); // one on top, rest to bottom
    assert.equal(game.pendingPeek, undefined);
    assert.equal(game.deck.length, 5, "all cards returned");
    assert.equal(
      game.deck[game.deck.length - 1].id,
      peeked[3],
      "chosen card is now on top",
    );
  });

  it("can only be used once per turn", () => {
    const game = makeGame({ p0: "CHAR012" });
    drawPhase(game);
    game.deck = deck5();
    usePeek(game, "p0");
    const peeked = game.pendingPeek!.cards.map((c) => c.id);
    resolvePeek(game, "p0", peeked, []);
    assert.throws(() => usePeek(game, "p0"), /1 ครั้งต่อรอบ/);
  });

  it("resolvePeek must account for every peeked card", () => {
    const game = makeGame({ p0: "CHAR012" });
    drawPhase(game);
    game.deck = deck5();
    usePeek(game, "p0");
    const peeked = game.pendingPeek!.cards.map((c) => c.id);
    assert.throws(() => resolvePeek(game, "p0", [peeked[0]], []), /ครบทุกใบ/);
  });

  it("a non-จูกัดเหลียง cannot use หยั่งรู้ฟ้าดิน", () => {
    const game = makeGame(); // p0 no skill
    drawPhase(game);
    game.deck = deck5();
    assert.throws(() => usePeek(game, "p0"), /หยั่งรู้ฟ้าดิน/);
  });
});

describe("Character skill – จิวยี่ บาดหมาง (suit guess)", () => {
  it("a wrong suit guess costs the target 1 HP but they still get the card", () => {
    const game = makeGame({ p0: "CHAR005" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [suited("c1", "none", "basic", "♠", "5")]; // the only card is ♠
    p1.hp = 4;
    p1.hand = [];
    useDischord(game, "p0", "p1");
    assert.equal(game.pendingDischord?.targetId, "p1");
    pickDischordSuit(game, "p1", "♥"); // wrong (card is ♠)
    assert.equal(p1.hp, 3, "lost 1 HP");
    assert.ok(
      p1.hand.some((c) => c.id === "c1"),
      "took the card anyway",
    );
    assert.equal(p0.hand.length, 0);
  });

  it("a correct suit guess deals no damage", () => {
    const game = makeGame({ p0: "CHAR005" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [suited("c1", "none", "basic", "♠", "5")];
    p1.hp = 4;
    useDischord(game, "p0", "p1");
    pickDischordSuit(game, "p1", "♠"); // correct
    assert.equal(p1.hp, 4, "no HP loss");
    assert.ok(p1.hand.some((c) => c.id === "c1"));
  });

  it("requires จิวยี่ to hold at least one card", () => {
    const game = makeGame({ p0: "CHAR005" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [];
    assert.throws(() => useDischord(game, "p0", "p1"), /อย่างน้อย 1 ใบ/);
  });

  it("can only be used once per turn", () => {
    const game = makeGame({ p0: "CHAR005" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [
      suited("c1", "none", "basic", "♠", "5"),
      suited("c2", "none", "basic", "♥", "5"),
    ];
    useDischord(game, "p0", "p1");
    pickDischordSuit(game, "p1", "♠");
    assert.throws(() => useDischord(game, "p0", "p2"), /1 ครั้งต่อรอบ/);
  });

  it("a non-จิวยี่ cannot use บาดหมาง", () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [suited("c1", "none", "basic", "♠", "5")];
    assert.throws(() => useDischord(game, "p0", "p1"), /บาดหมาง/);
  });
});

describe("Character skill – เตียวเสี้ยน สาวงามยุยง (force two males to duel)", () => {
  const makeMale = (game: GameState, id: string) => {
    game.players.find((p) => p.id === id)!.character!.gender = "ชาย";
  };

  it("forces two male generals to duel; the loser (no Attack) takes 1 damage", () => {
    const game = makeGame({ p0: "CHAR025" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    const p2 = game.players.find((p) => p.id === "p2")!;
    p0.hand = [attackCard("pay")];
    makeMale(game, "p1");
    p1.hand = [attackCard("a1")];
    p1.hp = 4;
    makeMale(game, "p2");
    p2.hand = [];
    p2.hp = 4; // p2 cannot answer
    useIncite(game, "p0", "pay", "p1", "p2"); // p1 attacks first
    assert.equal(game.responseWindow?.type, "duel_attack");
    assert.equal(game.responseWindow?.currentResponderId, "p1");
    playAttackResponse(game, "p1", "a1");
    assert.equal(game.responseWindow?.currentResponderId, "p2");
    declineResponse(game, "p2"); // p2 loses
    assert.equal(p2.hp, 3, "the loser took 1 damage");
    assert.equal(p0.hand.length, 0, "เตียวเสี้ยน paid a card");
  });

  it("rejects a non-male participant", () => {
    const game = makeGame({ p0: "CHAR025" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [attackCard("pay")];
    makeMale(game, "p1");
    game.players.find((p) => p.id === "p2")!.character!.gender = "หญิง";
    assert.throws(() => useIncite(game, "p0", "pay", "p1", "p2"), /ชาย/);
  });

  it("can only be used once per turn", () => {
    const game = makeGame({ p0: "CHAR025" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    p0.hand = [attackCard("pay"), attackCard("pay2")];
    makeMale(game, "p1");
    p1.hand = [attackCard("a1")];
    p1.hp = 4;
    makeMale(game, "p2");
    game.players.find((p) => p.id === "p2")!.hand = [];
    game.players.find((p) => p.id === "p2")!.hp = 4;
    useIncite(game, "p0", "pay", "p1", "p2");
    playAttackResponse(game, "p1", "a1");
    declineResponse(game, "p2"); // resolve the duel
    assert.throws(
      () => useIncite(game, "p0", "pay2", "p1", "p2"),
      /1 ครั้งต่อรอบ/,
    );
  });

  it("a non-เตียวเสี้ยน cannot use สาวงามยุยง", () => {
    const game = makeGame(); // p0 no skill
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.hand = [attackCard("pay")];
    makeMale(game, "p1");
    makeMale(game, "p2");
    assert.throws(() => useIncite(game, "p0", "pay", "p1", "p2"), /สาวงามยุยง/);
  });
});

describe("Emperor skill – เล่าปี่ คุณธรรมสามัคคี (SHU ally attacks for you)", () => {
  it("a SHU ally plays an Attack counted as เล่าปี่ against the chosen target", () => {
    const game = makeGame({ p0: "CHAR009" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    const p3 = game.players.find((p) => p.id === "p3")!;
    p0.role = "emperor";
    p1.hp = 4;
    p1.hand = [];
    p3.character!.kingdom = "SHU";
    p3.hand = [attackCard("a1")];
    requestUnityAttack(game, "p0", "p1", "p3");
    assert.equal(game.pendingAllyAssist?.allyId, "p3");
    allyAssist(game, "p3", "a1");
    assert.equal(
      game.pendingAction?.actorId,
      "p0",
      "attack counted as เล่าปี่",
    );
    assert.equal(game.pendingAction?.targetId, "p1");
    respondToAttack(game, "p1");
    assert.equal(p1.hp, 3);
    assert.equal(p3.hand.length, 0, "ally paid the attack card");
  });

  it("rejects a non-SHU ally", () => {
    const game = makeGame({ p0: "CHAR009" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.role = "emperor";
    const p3 = game.players.find((p) => p.id === "p3")!;
    p3.character!.kingdom = "WEI";
    p3.hand = [attackCard("a1")];
    assert.throws(() => requestUnityAttack(game, "p0", "p1", "p3"), /จ๊กก๊ก/);
  });

  it("the ally can decline, leaving the emperor to act", () => {
    const game = makeGame({ p0: "CHAR009" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    p0.role = "emperor";
    const p3 = game.players.find((p) => p.id === "p3")!;
    p3.character!.kingdom = "SHU";
    p3.hand = [attackCard("a1")];
    requestUnityAttack(game, "p0", "p1", "p3");
    declineAllyAssist(game, "p3");
    assert.equal(game.pendingAllyAssist, undefined);
    assert.equal(p3.hand.length, 1, "ally kept their card");
  });
});

describe("Emperor skill – โจโฉ ปกป้องราชันย์ (WEI ally dodges for you)", () => {
  it("a WEI ally plays a Dodge that saves โจโฉ from the attack", () => {
    const game = makeGame({ p1: "CHAR016" }); // p1 = โจโฉ
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    const p3 = game.players.find((p) => p.id === "p3")!;
    p1.role = "emperor";
    p1.hp = 4;
    p1.hand = [];
    p0.hand = [attackCard("atk")];
    p3.character!.kingdom = "WEI";
    p3.hand = [dodgeCard("dg")];
    playAttack(game, "p0", "p1", "atk");
    assert.equal(game.responseWindow?.currentResponderId, "p1");
    requestGuardianDodge(game, "p1", "p3");
    assert.equal(game.pendingAllyAssist?.allyId, "p3");
    allyAssist(game, "p3", "dg");
    assert.equal(p1.hp, 4, "โจโฉ took no damage (dodged by ally)");
    assert.equal(p3.hand.length, 0, "ally paid the dodge card");
  });

  it("rejects a non-WEI ally", () => {
    const game = makeGame({ p1: "CHAR016" });
    const p0 = game.players.find((p) => p.id === "p0")!;
    const p1 = game.players.find((p) => p.id === "p1")!;
    const p3 = game.players.find((p) => p.id === "p3")!;
    p1.role = "emperor";
    p0.hand = [attackCard("atk")];
    p3.character!.kingdom = "SHU";
    p3.hand = [dodgeCard("dg")];
    playAttack(game, "p0", "p1", "atk");
    assert.throws(() => requestGuardianDodge(game, "p1", "p3"), /วุยก๊ก/);
  });
});

describe("Surrender", () => {
  it("forces the player to die and reveals their role", () => {
    const game = makeGame();
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.role = "rebel"; // avoid ending the game via a win condition
    surrenderPlayer(game, "p1");
    assert.equal(p1.alive, false, "surrendered player is dead");
    assert.equal(p1.roleRevealed, true, "role revealed");
  });

  it("cannot surrender a player who is already dead", () => {
    const game = makeGame();
    game.players.find((p) => p.id === "p1")!.alive = false;
    assert.throws(() => surrenderPlayer(game, "p1"), /ถูกกำจัด|ไม่อยู่/);
  });
});
