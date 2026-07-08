"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  Role,
  Character,
  Card,
  EquipmentSlots,
  Player,
  RoleSet,
  Room,
  Game,
  IceSelection,
} from "./lib/gameTypes";
import {
  ROLE_LABEL,
  PHASE_LABEL,
  roleText,
  hearts,
  charName,
  cardInfo,
  suitColor,
  suitTx,
  cardTypeLabel,
  KINGDOM_FACTION,
  edgePosition,
  lobbyPosition,
  isViewerDecisionActive,
  canAutoEndTurn,
} from "./lib/gameConstants";
import { CardFace } from "../components/CardFace";
import { Icon } from "../components/Icon";
import { EquipmentDisplay } from "../components/EquipmentDisplay";
import { DecisionArea } from "../components/DecisionArea";
import { OpponentPanel } from "../components/OpponentPanel";
import { LogChatPanel } from "../components/LogChatPanel";
import { SettingsPopover } from "../components/SettingsPopover";
import { EncyclopediaDrawer } from "../components/EncyclopediaDrawer";
import { CardDetailModal } from "../components/CardDetailModal";
import { DropZoneModal } from "../components/DropZoneModal";
import { DebugSandboxPanel } from "../components/DebugSandboxPanel";
import { AUTH_ENABLED } from "../lib/flags";
import { useAuth } from "../lib/useAuth";
import { socket, emitRoomJoin, PLAY_CONFIRM_EVENTS } from "./lib/socket";
import {
  playAutoEndChime,
  playCountdownTick,
  playDecisionAlert,
  playThunder,
} from "./lib/audio";
import { RepeatAttackPrompt } from "../components/game/RepeatAttackPrompt";
import { DestroyMountPrompt } from "../components/game/DestroyMountPrompt";
import { ForceAttackDamagePrompt } from "../components/game/ForceAttackDamagePrompt";

export default function Home() {
  const [game, setGame] = useState<Game | undefined>();
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const prevPhaseRef = useRef<string | undefined>(undefined);
  const [room, setRoom] = useState("demo");
  const [name, setName] = useState("");
  // Lobby identity chip (top-right): true while the name input is open for editing.
  const [editingName, setEditingName] = useState(false);
  const [userId, setUserId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [chatText, setChatText] = useState("");
  const [chat, setChat] = useState<
    { id: string; username: string; text: string; at: string }[]
  >([]);
  const [roleOptions, setRoleOptions] = useState<RoleSet[]>([]);
  const [error, setError] = useState<string>();
  const [showRole, setShowRole] = useState(false);
  const [detailCard, setDetailCard] = useState<Card>();
  const [showDropZone, setShowDropZone] = useState(false);
  // Drop-zone inspection: the card whose large name tooltip is showing (hover on PC,
  // first-tap on mobile). `key` is the unique grid key so a second tap opens details.
  const [nameTip, setNameTip] = useState<{ key: string; name: string } | null>(
    null,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [catalog, setCatalog] = useState<Card[] | null>(null);
  const [charCatalog, setCharCatalog] = useState<Character[] | null>(null);
  const [encSearch, setEncSearch] = useState("");
  const [encCategory, setEncCategory] = useState<
    "generals" | "basic" | "trick" | "equip"
  >("generals");
  const [encDetail, setEncDetail] = useState<Card | null>(null);
  const [encCharDetail, setEncCharDetail] = useState<Character | null>(null);
  const [confirmBeforePlay, setConfirmBeforePlay] = useState(true); // default ON — opt out via settings
  const [pendingPlay, setPendingPlay] = useState<{
    event: string;
    data?: Record<string, unknown>;
  } | null>(null);
  const [skillsCharacter, setSkillsCharacter] = useState<Character>();
  const [logChatTab, setLogChatTab] = useState<"log" | "chat">("log");
  const [soundOn, setSoundOn] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedAttackId, setSelectedAttackId] = useState<string>();
  const [selectedDiscardId, setSelectedDiscardId] = useState<string>();
  const [selectedDiscardTargetId, setSelectedDiscardTargetId] =
    useState<string>();
  const [selectedDiscardZone, setSelectedDiscardZone] = useState<
    "hand" | "equipment"
  >();
  const [selectedStealId, setSelectedStealId] = useState<string>();
  const [selectedStealTargetId, setSelectedStealTargetId] = useState<string>();
  const [selectedStealZone, setSelectedStealZone] = useState<
    "hand" | "equipment"
  >();
  const [discardLimitMode, setDiscardLimitMode] = useState(false);
  const [discardLimitSelected, setDiscardLimitSelected] = useState<string[]>(
    [],
  );
  const [discardLimitConfirming, setDiscardLimitConfirming] = useState(false);
  const [forceDiscardRefs, setForceDiscardRefs] = useState<string[]>([]);
  const [iceSelections, setIceSelections] = useState<IceSelection[]>([]);
  const [snakeMode, setSnakeMode] = useState(false);
  const [snakeCards, setSnakeCards] = useState<string[]>([]);
  const [multiAttackId, setMultiAttackId] = useState<string>();
  const [multiTargets, setMultiTargets] = useState<string[]>([]);
  const [coerceCardId, setCoerceCardId] = useState<string>();
  const [coerceHolderId, setCoerceHolderId] = useState<string>();
  const [balanceMode, setBalanceMode] = useState(false);
  const [balanceCards, setBalanceCards] = useState<string[]>([]);
  const [miracleMode, setMiracleMode] = useState(false);
  const [miracleCard, setMiracleCard] = useState<string>();
  const [marriageMode, setMarriageMode] = useState(false);
  const [marriageCards, setMarriageCards] = useState<string[]>([]);
  const [raidMode, setRaidMode] = useState(false);
  const [raidTargets, setRaidTargets] = useState<string[]>([]);
  const [benevolenceMode, setBenevolenceMode] = useState(false);
  const [benevolenceCards, setBenevolenceCards] = useState<string[]>([]);
  const [retaliateCards, setRetaliateCards] = useState<string[]>([]);
  const [redirectMode, setRedirectMode] = useState(false);
  const [redirectCard, setRedirectCard] = useState<string>();
  const [bandinMode, setBandinMode] = useState(false);
  const [seduceMode, setSeduceMode] = useState(false);
  const [seduceCard, setSeduceCard] = useState<string>();
  const [peekOrder, setPeekOrder] = useState<string[]>([]);
  const [dischordMode, setDischordMode] = useState(false);
  const [confirmSelfDamage, setConfirmSelfDamage] = useState(false);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [confirmCharacter, setConfirmCharacter] = useState<
    Character | undefined
  >();
  const [inciteMode, setInciteMode] = useState(false);
  const [inciteCard, setInciteCard] = useState<string>();
  const [inciteFirst, setInciteFirst] = useState<string>();
  const [unityMode, setUnityMode] = useState(false);
  const [unityTarget, setUnityTarget] = useState<string>();
  const [guardianMode, setGuardianMode] = useState(false);
  const [guicaiPicking, setGuicaiPicking] = useState(false);
  const [openPanel, setOpenPanel] = useState<"room" | "logchat" | null>(null);
  const [roleVisible, setRoleVisible] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [confirmStart, setConfirmStart] = useState(false);
  const [drawPreview, setDrawPreview] = useState<Card[] | null>(null);
  const [equipConfirmCard, setEquipConfirmCard] = useState<Card>();
  const [judgmentBanner, setJudgmentBanner] = useState<Game["lastJudgment"]>();
  const [lightningStrike, setLightningStrike] = useState(false); // ฟ้าลงโทษ: เอฟเฟคฟ้าผ่าเต็มจอ
  const lightningTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const prevJudgmentAt = useRef<string | undefined>(undefined);
  const judgmentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [tableBanner, setTableBanner] = useState<Game["tableFlash"]>();
  const prevFlashAt = useRef<string | undefined>(undefined);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const prevHandIds = useRef<string | undefined>(undefined);
  const countingRef = useRef(false); // true ระหว่างนับ 1-2-3 เปิดเกม — กัน draw-preview เด้งซ้อน
  const drawNoticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lastTurn = useRef<string | undefined>(undefined);
  const [turnBanner, setTurnBanner] = useState(false);
  const turnBannerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [autoEndBanner, setAutoEndBanner] = useState(false);
  const autoEndBannerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const autoEndedTurnRef = useRef<string | undefined>(undefined);
  const revealedRole = useRef<Role | undefined>(undefined);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);

  const myDecision = isViewerDecisionActive(game);
  const prevDecisionRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);
  // Initial alert: sound the moment a decision falls to the viewer.
  useEffect(() => {
    if (myDecision && !prevDecisionRef.current && soundOn) playDecisionAlert();
    prevDecisionRef.current = myDecision;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myDecision, soundOn]);
  // Urgent per-second ticking during the final 7 seconds of the viewer's decision.
  useEffect(() => {
    if (!myDecision || !game?.responseDeadline) {
      lastTickRef.current = null;
      return;
    }
    const secs = Math.max(0, Math.ceil((game.responseDeadline - nowTs) / 1000));
    if (secs >= 1 && secs <= 7 && lastTickRef.current !== secs) {
      lastTickRef.current = secs;
      if (soundOn) playCountdownTick(secs <= 3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTs, myDecision, soundOn, game?.responseDeadline]);
  // Auto-end the turn when the viewer has nothing left to do. Requires the
  // condition to hold stable for a beat, then ends and shows a chime + banner.
  useEffect(() => {
    if (!canAutoEndTurn(game)) return;
    const sig = `${game!.currentPlayerId}:${game!.turn?.turnNumber}`;
    if (autoEndedTurnRef.current === sig) return;
    const t = setTimeout(() => {
      if (!canAutoEndTurn(game)) return; // re-check after the delay
      autoEndedTurnRef.current = sig;
      socket.emit("turn:end", { gameId: joinedRoom });
      if (soundOn) playAutoEndChime();
      setAutoEndBanner(true);
      if (autoEndBannerTimer.current) clearTimeout(autoEndBannerTimer.current);
      autoEndBannerTimer.current = setTimeout(
        () => setAutoEndBanner(false),
        2600,
      );
    }, 750);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, soundOn, joinedRoom]);

  // Optional Google account (inert when NEXT_PUBLIC_FEATURE_AUTH is off). The guest
  // wtk-member-id below stays the socket identity for everyone — logged in or not.
  const { session, profile, signIn, signOut } = useAuth();
  useEffect(() => {
    let id = localStorage.getItem("wtk-member-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("wtk-member-id", id);
    }
    setUserId(id);
    const savedName = localStorage.getItem("wtk-name");
    if (savedName) setName(savedName);
  }, []);
  // Logged-in players who never named themselves default to their profile name.
  useEffect(() => {
    if (!AUTH_ENABLED || !profile) return;
    if (!localStorage.getItem("wtk-name")) {
      setName(profile.username);
      try {
        localStorage.setItem("wtk-name", profile.username);
      } catch {}
    }
  }, [profile]);
  // Per-player Card Play Confirmation preference — defaults ON; players opt out in settings.
  // Persists across reloads/matches on this device (only an explicit "0" turns it off).
  useEffect(() => {
    const stored = localStorage.getItem("wtk-confirm-play");
    setConfirmBeforePlay(stored === null ? true : stored === "1");
  }, []);
  // Encyclopedia: lazy-load the full card + general catalogues on first open.
  useEffect(() => {
    if (!showEncyclopedia) return;
    const base = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    if (!catalog)
      fetch(`${base}/cards`)
        .then((r) => r.json())
        .then((c: Card[]) => setCatalog(Array.isArray(c) ? c : []))
        .catch(() => setCatalog([]));
    if (!charCatalog)
      fetch(`${base}/characters`)
        .then((r) => r.json())
        .then((c: Character[]) => setCharCatalog(Array.isArray(c) ? c : []))
        .catch(() => setCharCatalog([]));
  }, [showEncyclopedia, catalog, charCatalog]);
  // Encyclopedia: "swipe from the left edge" opens the drawer on touch devices
  // (mobile has no visible edge tab so it doesn't cover the left-side seats).
  useEffect(() => {
    if (showEncyclopedia || game?.phase !== "playing") return;
    let startX = 0,
      startY = 0,
      tracking = false;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t && t.clientX <= 26) {
        tracking = true;
        startX = t.clientX;
        startY = t.clientY;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      if (t.clientX - startX > 55 && Math.abs(t.clientY - startY) < 45) {
        tracking = false;
        setShowEncyclopedia(true);
      }
    };
    const onEnd = () => {
      tracking = false;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [showEncyclopedia, game?.phase]);
  useEffect(() => {
    const onState = (v: Game) => {
      setGame(v);
      setError(undefined);
    };
    const onMsg = (v: {
      id: string;
      username: string;
      text: string;
      at: string;
    }) => setChat((c) => [...c, v]);
    const onOptions = (v: RoleSet[]) => setRoleOptions(v);
    const onError = (v: string) => setError(v);
    socket.on("game:state", onState);
    socket.on("chat:message", onMsg);
    socket.on("game:role-options", onOptions);
    socket.on("game:error", onError);
    return () => {
      socket.off("game:state", onState);
      socket.off("chat:message", onMsg);
      socket.off("game:role-options", onOptions);
      socket.off("game:error", onError);
    };
  }, []);
  useEffect(() => {
    const reconnect = () => {
      if (joinedRoom && userId)
        emitRoomJoin(joinedRoom, name, userId, AUTH_ENABLED && !!session);
    };
    socket.on("connect", reconnect);
    return () => {
      socket.off("connect", reconnect);
    };
  }, [joinedRoom, userId, name, session]);
  // When it becomes the viewer's turn: flash a visual banner (always) and play a chime (if sound is on).
  useEffect(() => {
    const turn = game?.currentPlayerId;
    const newlyMyTurn =
      !!turn && turn === game?.viewerId && lastTurn.current !== turn;
    if (newlyMyTurn) {
      setTurnBanner(true);
      if (turnBannerTimer.current) clearTimeout(turnBannerTimer.current);
      turnBannerTimer.current = setTimeout(() => setTurnBanner(false), 2800);
      if (soundOn) {
        try {
          const ctx = new AudioContext();
          // Two-tone rising "ding-ding" so the turn cue is unmistakable.
          const chime = (freq: number, start: number, end: number) => {
            const osc = ctx.createOscillator(),
              gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(
              0.16,
              ctx.currentTime + start + 0.02,
            );
            gain.gain.exponentialRampToValueAtTime(
              0.0001,
              ctx.currentTime + end,
            );
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + end + 0.02);
          };
          chime(660, 0, 0.22);
          chime(988, 0.16, 0.5);
        } catch {}
      }
    }
    lastTurn.current = turn;
  }, [game?.currentPlayerId, game?.viewerId, soundOn]);
  useEffect(() => {
    const role = game?.players.find((p) => p.id === game.viewerId)?.role;
    if (role && revealedRole.current !== role) {
      revealedRole.current = role;
      setShowRole(true);
    }
  }, [game?.players, game?.viewerId]);
  useEffect(() => {
    const ph = game?.phase;
    if (
      ph === "playing" &&
      prevPhaseRef.current &&
      prevPhaseRef.current !== "playing"
    ) {
      setStartCountdown(3);
      countingRef.current = true;
    }
    if (ph && ph !== prevPhaseRef.current)
      setOpenPanel(ph === "waiting" ? "room" : null);
    if (game) prevPhaseRef.current = ph;
  }, [game?.phase]);
  useEffect(() => {
    if (startCountdown === null) {
      countingRef.current = false;
      return;
    }
    if (startCountdown <= 0) {
      const t = setTimeout(() => {
        setStartCountdown(null);
        const hand = game?.players.find((p) => p.id === game.viewerId)?.hand;
        if (hand?.length) {
          setDrawPreview(hand);
          if (drawNoticeTimer.current) clearTimeout(drawNoticeTimer.current);
          drawNoticeTimer.current = setTimeout(
            () => setDrawPreview(null),
            3000,
          );
        }
      }, 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStartCountdown((c) => (c ?? 1) - 1), 850);
    return () => clearTimeout(t);
  }, [startCountdown]);
  useEffect(() => {
    if (logChatTab === "chat")
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, logChatTab]);
  useEffect(() => {
    if (logChatTab === "log")
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [game?.log?.length, logChatTab]);
  // Re-runs when phase changes to 'playing' so handRef.current is populated by then
  useEffect(() => {
    const el = handRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [game?.phase]);
  // Tick once per second while a response/decision countdown is active (display only; server enforces the skip)
  useEffect(() => {
    if (!game?.responseDeadline && !game?.startDeadline) return;
    setNowTs(Date.now());
    const id = setInterval(() => setNowTs(Date.now()), 300);
    return () => clearInterval(id);
  }, [game?.responseDeadline, game?.startDeadline]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(undefined), 10000);
    return () => clearTimeout(t);
  }, [error]);
  // Close the hand-limit discard menu once the debt is cleared or it's not the viewer's turn; close play-phase selection modes outside the play phase
  useEffect(() => {
    if (!game) return;
    const me = game.players.find((p) => p.id === game.viewerId);
    const myTurn = game.currentPlayerId === game.viewerId;
    const myPlay = myTurn && game.turn?.phase === "play";
    const req = Math.max(0, (me?.hand.length || 0) - (me?.hp || 0));
    if (!myTurn || req === 0) {
      setDiscardLimitMode(false);
      setDiscardLimitSelected([]);
      setDiscardLimitConfirming(false);
    }
    if (!myPlay) {
      setSnakeMode(false);
      setSnakeCards([]);
      setMultiAttackId(undefined);
      setMultiTargets([]);
      setCoerceCardId(undefined);
      setCoerceHolderId(undefined);
      setSelectedAttackId(undefined);
      setSelectedDiscardId(undefined);
      setSelectedStealId(undefined);
      setBalanceMode(false);
      setBalanceCards([]);
    }
    // โจโฉ ปกป้องราชันย์ / ระเหเร่ร่อน: โหมดเลือกเป้าเหล่านี้ใช้ได้เฉพาะตอนที่เราเป็น
    // ผู้ตอบโต้การโจมตีอยู่เท่านั้น หากไม่ใช่ (หน้าต่างปิด/เปลี่ยนคน) ต้องล้างทิ้ง
    // มิฉะนั้นปุ่มสกิลจะค้างจากการโจมตีครั้งก่อน (โดยเฉพาะสกิลโจโฉ)
    const rw = game.responseWindow;
    const iAmAttackResponder =
      rw?.type === "attack_dodge" &&
      rw.currentResponderId === game.viewerId &&
      rw.status === "open";
    if (!iAmAttackResponder) {
      setGuardianMode(false);
      setRedirectMode(false);
      setRedirectCard(undefined);
    }
  }, [game]);
  // Show the judgment reveal to everyone for a few seconds whenever a new one occurs
  useEffect(() => {
    const j = game?.lastJudgment;
    if (!j) return;
    if (prevJudgmentAt.current === undefined) {
      prevJudgmentAt.current = j.at;
      return;
    } // skip the one already present on first load
    if (prevJudgmentAt.current === j.at) return;
    prevJudgmentAt.current = j.at;
    setJudgmentBanner(j);
    if (judgmentTimer.current) clearTimeout(judgmentTimer.current);
    judgmentTimer.current = setTimeout(
      () => setJudgmentBanner(undefined),
      5000,
    );
    // ฟ้าลงโทษ ผ่า! → เอฟเฟคฟ้าผ่าเต็มจอ + เสียงฟ้าร้อง ให้สมชื่อ
    if (j.result?.includes("ฟ้าผ่า")) {
      setLightningStrike(true);
      if (soundOn) playThunder();
      if (lightningTimer.current) clearTimeout(lightningTimer.current);
      lightningTimer.current = setTimeout(
        () => setLightningStrike(false),
        1600,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.lastJudgment?.at, soundOn]);
  useEffect(() => {
    const f = game?.tableFlash;
    if (!f) return;
    if (prevFlashAt.current === undefined) {
      prevFlashAt.current = f.at;
      return;
    }
    if (prevFlashAt.current === f.at) return;
    prevFlashAt.current = f.at;
    setTableBanner(f);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setTableBanner(undefined), 4000);
  }, [game?.tableFlash?.at]);
  // Notify the viewer which card(s) just entered their hand (draw, or any gain). Skips the initial deal.
  useEffect(() => {
    const hand = game?.players.find((p) => p.id === game.viewerId)?.hand;
    if (!hand) {
      prevHandIds.current = undefined;
      return;
    }
    const prev = prevHandIds.current;
    prevHandIds.current = hand.map((c) => c.id).join(",");
    if (countingRef.current) return; // ระหว่างนับ 1-2-3 ไพ่เปิดเกมถูกโชว์โดย countdown effect — ไม่ต้อง preview ซ้ำ
    const prevSet = new Set(prev ? prev.split(",") : []);
    // The opening hand is revealed after the 3-2-1 countdown (see the countdown effect); here we only preview later draws.
    const added =
      prev === undefined ? [] : hand.filter((c) => !prevSet.has(c.id));
    if (!added.length) return;
    setDrawPreview(added);
    if (drawNoticeTimer.current) clearTimeout(drawNoticeTimer.current);
    drawNoticeTimer.current = setTimeout(() => setDrawPreview(null), 3000);
  }, [game]);

  const loadRooms = () =>
    fetch(
      `${process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"}/rooms`,
    )
      .then((r) => r.json())
      .then(setRooms)
      .catch(() => setRooms([]));
  useEffect(() => {
    if (game) return;
    loadRooms();
    const id = setInterval(loadRooms, 5000);
    return () => clearInterval(id);
  }, [game]);
  const join = (roomId = room) => {
    if (!userId) return;
    socket.connect();
    setJoinedRoom(roomId);
    emitRoomJoin(roomId, name, userId, AUTH_ENABLED && !!session);
  };
  const emitNow = (event: string, data?: Record<string, unknown>) =>
    socket.emit(event, { gameId: joinedRoom, ...data });
  // Card Play Confirmation: when the per-player setting is ON, defer proactive card
  // plays behind a confirm/cancel overlay instead of sending them to the server.
  const emit = (event: string, data?: Record<string, unknown>) => {
    if (confirmBeforePlay && PLAY_CONFIRM_EVENTS.has(event)) {
      setPendingPlay({ event, data });
      return;
    }
    emitNow(event, data);
  };
  const toggleConfirmBeforePlay = () =>
    setConfirmBeforePlay((v) => {
      const next = !v;
      try {
        localStorage.setItem("wtk-confirm-play", next ? "1" : "0");
      } catch {}
      return next;
    });

  const commitName = () => {
    const trimmed = name.trim();
    setName(trimmed);
    setEditingName(false);
    try {
      localStorage.setItem("wtk-name", trimmed);
    } catch {}
  };

  if (!game)
    return (
      <>
        <div className="lobby-topbar">
          {/* Scroll chip: closed = seal medallion + rods; hover/edit unrolls the paper.
              The seal doubles as the avatar slot — Google profile picture when the
              account feature is on and the player is logged in, sword seal otherwise. */}
          <div
            className={`scroll-chip${editingName || !name ? " open" : ""}`}
            onClick={() => {
              if (!editingName && name) setEditingName(true);
            }}
          >
            <span className="scroll-seal" aria-hidden>
              {AUTH_ENABLED && profile?.avatar ? (
                <img
                  className="auth-avatar"
                  src={profile.avatar}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Icon name="sword" size="1.1em" />
              )}
            </span>
            <span className="scroll-rod" aria-hidden />
            <div className="scroll-paper">
              {editingName || !name ? (
                <input
                  className="scroll-name-input"
                  value={name}
                  autoFocus
                  placeholder="โปรดตั้งชื่อผู้เล่น…"
                  onChange={(e) => setName(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => e.key === "Enter" && commitName()}
                />
              ) : (
                <button className="scroll-name" title="คลิกเพื่อแก้ชื่อ">
                  <span className="scroll-name-text">@{name}</span>
                  <span className="scroll-name-edit">
                    <Icon name="pencil" size="0.95em" />
                  </span>
                </button>
              )}
            </div>
            <span className="scroll-rod" aria-hidden />
          </div>
          {AUTH_ENABLED && (
            <div className="auth-chip-row">
              {session ? (
                <>
                  <a href="/profile">โปรไฟล์</a>
                  <button onClick={signOut}>ออกจากระบบ</button>
                </>
              ) : (
                <button onClick={signIn}>เข้าสู่ระบบด้วย Google</button>
              )}
            </div>
          )}
        </div>
      <main className="lobby">
        <h1 className="game-title">ยุทธพิชัยสามก๊ก</h1>
        <p>
          ยินดีต้อนรับท่านแม่ทัพ{" "}
          {name ? (
            <b className="lobby-greet-name">{name}</b>
          ) : (
            <i className="lobby-greet-noname">ไร้นาม</i>
          )}
        </p>
        <section className="room-browser">
          <div>
            <h2>ห้องที่เปิดอยู่</h2>
            <button onClick={loadRooms}>รีเฟรช</button>
          </div>
          <div className="room-list">
            {rooms.length ? (
              rooms.map((r) => (
                <article key={r.id}>
                  <b>{r.id}</b>
                  <span>
                    {r.status === "waiting"
                      ? "กำลังรอผู้เล่น"
                      : "กำลังเล่น — Spectator"}
                  </span>
                  <small>
                    หัวหน้า: {r.host} · ผู้เล่น {r.playerCount} · ผู้ชม{" "}
                    {r.spectatorCount}
                  </small>
                  <button
                    disabled={!name || !userId}
                    title={!name ? "ตั้งชื่อผู้เล่นที่มุมบนขวาก่อน" : undefined}
                    onClick={() => join(r.id)}
                  >
                    {r.status === "waiting" ? "เข้าห้อง" : "เข้าชม"}
                  </button>
                </article>
              ))
            ) : (
              <p>ยังไม่มีห้องที่เปิดอยู่</p>
            )}
          </div>
        </section>
        <section className="create-room">
          <h2>สร้างห้องใหม่</h2>
          <div className="create-row">
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="ชื่อห้อง"
            />
            <button
              disabled={!name || !userId}
              title={!name ? "ตั้งชื่อผู้เล่นที่มุมบนขวาก่อน" : undefined}
              onClick={() => join()}
            >
              สร้าง/เข้าห้อง
            </button>
          </div>
        </section>
      </main>
      </>
    );

  const myPlayer = game.players.find((p) => p.id === game.viewerId);
  const myRoleInfo = game.roleDefinitions?.find(
    (r) => r.role_key === myPlayer?.role,
  );
  const isMyTurn = game.currentPlayerId === game.viewerId;
  const isPlaying = game.phase === "playing";
  const rw = game.responseWindow;
  const canRespond =
    rw?.currentResponderId === game.viewerId && rw.status === "open";
  const responder = rw?.currentResponderId
    ? game.players.find((p) => p.id === rw.currentResponderId)
    : undefined;
  const dyingPlayer =
    rw?.type === "dying_heal" && rw.dyingPlayerId
      ? game.players.find((p) => p.id === rw.dyingPlayerId)
      : undefined;
  const canAct =
    isMyTurn && game.hasDrawnThisTurn && !rw && game.turn?.phase === "play";
  const isDrawPhase = isMyTurn && game.turn?.phase === "draw";
  const myOwedDraws = game.pendingDraws?.[game.viewerId] ?? 0;
  const myKeys =
    (myPlayer?.character && game.characterSkillKeys?.[myPlayer.character.id]) ||
    [];
  const mySwap = myKeys.includes("attack_dodge_swap"); // จูล่ง กล้าหาญ
  const hasMySkill = (key: string) => myKeys.includes(key);
  const myGuicai = myKeys.includes("replace_judgment"); // สุมาอี้ กำหนดชะตา
  // Does one of my cards count as `asEffect`? (own effect, จูล่ง swap, or a suit conversion: กวนอู/เอียนสี/ฮัวโต๋)
  const myConv = (asEffect: string, card: Card): boolean =>
    card.effect === asEffect ||
    (mySwap &&
      ((asEffect === "dodge" && card.effect === "attack") ||
        (asEffect === "attack" && card.effect === "dodge"))) ||
    (myKeys.includes("red_as_attack") &&
      asEffect === "attack" &&
      ["♥", "♦"].includes(card.suit)) ||
    (myKeys.includes("black_as_dodge") &&
      asEffect === "dodge" &&
      ["♠", "♣"].includes(card.suit)) ||
    (myKeys.includes("red_as_heal") &&
      asEffect === "heal" &&
      ["♥", "♦"].includes(card.suit));
  const skillUsed = (key: string) =>
    Boolean(game.skillsUsedThisTurn?.includes(key));
  const toggleBalance = (id: string) =>
    setBalanceCards((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const pj = game.pendingJudgment;
  const myJudgmentDraw = Boolean(
    pj && pj.playerId === game.viewerId && pj.stage === "awaiting_draw",
  );
  const myJudgmentAct = Boolean(
    pj && pj.playerId === game.viewerId && pj.stage === "revealed",
  );
  const requiredDiscard =
    myKeys.includes("skip_discard_if_no_attack") &&
    (game.turn?.attackUsedThisTurn ?? 0) === 0
      ? 0
      : Math.max(0, (myPlayer?.hand.length || 0) - (myPlayer?.hp || 0)); // ลิบอง ยับยั้งชั่งใจ: ถ้าไม่ได้โจมตีในรอบนี้ ไม่ต้องทิ้งไพ่ (characterSkillKeys คีย์ด้วย character.id ไม่ใช่ viewerId)
  const toggleDiscardLimit = (id: string) =>
    setDiscardLimitSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const cancelDiscardLimit = () => {
    setDiscardLimitMode(false);
    setDiscardLimitSelected([]);
    setDiscardLimitConfirming(false);
  };
  const hasSnakeSpear =
    myPlayer?.equipment.weapon?.effect === "discard_two_as_attack";
  const hasUnlimitedAttack =
    myPlayer?.equipment.weapon?.effect === "unlimited_attack_per_turn" ||
    myKeys.includes("unlimited_attack"); // หน้าไม้กล หรือ เตียวหุย คำราม → โจมตีได้ไม่จำกัด
  const canSnakeAttack =
    canAct &&
    hasSnakeSpear &&
    (hasUnlimitedAttack || (game.turn?.attackUsedThisTurn ?? 0) < 1);
  const toggleSnake = (id: string) =>
    setSnakeCards((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 2
          ? [...prev, id]
          : prev,
    );
  const cancelSnake = () => {
    setSnakeMode(false);
    setSnakeCards([]);
  };
  const canPlayCard = (card: Card) => {
    if (canRespond) {
      if (rw?.type === "attack_dodge")
        return myConv("dodge", card) || card.effect === "negate_trick_effect";
      if (rw?.type === "dying_heal") return myConv("heal", card);
      if (rw?.type === "negate") return card.effect === "negate_trick_effect";
      if (rw?.type === "mass_dodge")
        return myConv("dodge", card) || card.effect === "negate_trick_effect";
      if (rw?.type === "multi_attack") return myConv("dodge", card);
      if (rw?.type === "mass_attack")
        return myConv("attack", card) || card.effect === "negate_trick_effect";
      if (rw?.type === "duel_attack") return myConv("attack", card);
      return false;
    }
    if (!canAct) return false;
    if (card.effect === "attack")
      return hasUnlimitedAttack || (game.turn?.attackUsedThisTurn ?? 0) < 1;
    if (card.effect === "dodge")
      return (
        myConv("attack", card) &&
        (hasUnlimitedAttack || (game.turn?.attackUsedThisTurn ?? 0) < 1)
      ); // จูล่ง/กวนอู: ใช้ "หลบ"/ไพ่แดง เป็น "โจมตี"
    return true;
  };
  const selectCard = (card: Card) => {
    if (!canPlayCard(card)) return;
    if (canRespond) {
      if (rw?.type === "negate" && card.effect === "negate_trick_effect")
        return emit("negate:play", { cardId: card.id });
      if (
        (rw?.type === "mass_dodge" || rw?.type === "mass_attack") &&
        card.effect === "negate_trick_effect"
      )
        return emit("mass:respond", { cardId: card.id });
      if (
        rw?.type === "mass_dodge" ||
        rw?.type === "mass_attack" ||
        rw?.type === "multi_attack"
      )
        return emit("mass:respond", { cardId: card.id });
      if (rw?.type === "attack_dodge" && myConv("dodge", card))
        return emit("attack:respond", { cardId: card.id });
      if (rw?.type === "duel_attack" && myConv("attack", card))
        return emit("duel:respond", { cardId: card.id });
      if (rw?.type === "dying_heal" && myConv("heal", card))
        return emit("response:heal", { cardId: card.id });
      return;
    }
    if (card.effect === "attack") {
      if (
        myPlayer?.equipment.weapon?.effect ===
          "last_hand_multi_target_attack" &&
        myPlayer.hand.length === 1
      ) {
        setMultiAttackId(card.id);
        setMultiTargets([]);
        setSelectedAttackId(undefined);
        setSelectedDiscardId(undefined);
        setSelectedStealId(undefined);
      } else {
        setSelectedAttackId(card.id);
        setSelectedDiscardId(undefined);
        setSelectedStealId(undefined);
      }
    } else if (card.effect === "dodge" && myConv("attack", card)) {
      setSelectedAttackId(card.id);
      setSelectedDiscardId(undefined);
      setSelectedStealId(undefined);
    } // จูล่ง/กวนอู: เล่น "หลบ"/ไพ่แดง เป็น "โจมตี" — เลือกเป้าหมาย
    else if (card.effect === "duel_attack_response") {
      setSelectedAttackId(card.id);
      setSelectedDiscardId(undefined);
      setSelectedStealId(undefined);
    } else if (card.effect === "discard_target_card") {
      setSelectedDiscardId(card.id);
      setSelectedAttackId(undefined);
      setSelectedStealId(undefined);
    } else if (card.effect === "steal_target_card_in_range") {
      setSelectedStealId(card.id);
      setSelectedAttackId(undefined);
      setSelectedDiscardId(undefined);
    } else if (card.effect === "coerce_attack_or_take_weapon") {
      setCoerceCardId(card.id);
      setCoerceHolderId(undefined);
      setSelectedAttackId(undefined);
      setSelectedDiscardId(undefined);
      setSelectedStealId(undefined);
    } else if (card.effect === "delayed_skip_play_phase") {
      setSelectedAttackId(card.id);
      setSelectedDiscardId(undefined);
      setSelectedStealId(undefined);
    } else if (card.effect === "delayed_lightning_judgment")
      emit("card:play", { cardId: card.id });
    else if (
      card.effect === "all_others_dodge_or_damage" ||
      card.effect === "all_others_attack_or_damage" ||
      card.effect === "draw_cards" ||
      card.effect === "heal_all_living" ||
      card.effect === "heal" ||
      card.effect === "reveal_and_draft_cards"
    )
      emit("card:play", { cardId: card.id });
    else if (card.equipmentSlot) setEquipConfirmCard(card);
  };
  const cancelSelection = () => {
    setSelectedAttackId(undefined);
    setSelectedDiscardId(undefined);
    setSelectedDiscardTargetId(undefined);
    setSelectedStealId(undefined);
    setSelectedStealTargetId(undefined);
    setSelectedStealZone(undefined);
    setSelectedDiscardZone(undefined);
    setMultiAttackId(undefined);
    setMultiTargets([]);
    setCoerceCardId(undefined);
    setCoerceHolderId(undefined);
  };
  // Card Play Confirmation overlay actions.
  const confirmPendingPlay = () => {
    if (pendingPlay) emitNow(pendingPlay.event, pendingPlay.data);
    setPendingPlay(null);
  };
  const cancelPendingPlay = () => {
    setPendingPlay(null);
    cancelSelection(); // return the card safely to hand / clear any target selection
  };
  // Opponents in circular seat order starting just after the viewer, wrapping around,
  // so the table mirrors real seat geometry (immediate neighbors sit beside the viewer).
  const seatOrdered = [...game.players].sort(
    (a, b) => a.seatIndex - b.seatIndex,
  );
  const viewerSeatIdx = seatOrdered.findIndex((p) => p.id === game.viewerId);
  const opponents =
    viewerSeatIdx < 0
      ? seatOrdered.filter((p) => p.id !== game.viewerId)
      : [
          ...seatOrdered.slice(viewerSeatIdx + 1),
          ...seatOrdered.slice(0, viewerSeatIdx),
        ];
  const discardTarget = selectedDiscardTargetId
    ? game.players.find((p) => p.id === selectedDiscardTargetId)
    : undefined;
  const stealTarget = selectedStealTargetId
    ? game.players.find((p) => p.id === selectedStealTargetId)
    : undefined;
  const topDiscard = game.lastPlayedCard;
  const renderLog = (msg: string) => {
    const names = game.players
      .map((p) => p.username)
      .sort((a, b) => b.length - a.length);
    if (!names.length) return msg;
    return msg
      .split(
        new RegExp(
          `(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
          "g",
        ),
      )
      .map((part, i) => (names.includes(part) ? <b key={i}>{part}</b> : part));
  };
  const isHost = game.hostId === game.viewerId,
    waiting = game.phase === "waiting";
  const chooser = game.players.find(
    (p) => !p.confirmedCharacter && p.characterOptions.length > 0,
  );
  const anchorSeat = myPlayer?.seatIndex || 1;
  const waitingForCharacter = game.players.filter((p) => !p.confirmedCharacter);
  const emperor = game.players.find((p) => p.role === "emperor");
  const roleCounts = game.roleAliveCounts;
  const readyCount = game.players.filter((p) => p.ready).length;
  const startSecondsLeft = game.startDeadline
    ? Math.max(0, Math.ceil((game.startDeadline - nowTs) / 1000))
    : null;

  // Log/chat panel content — opened from the navbar (top-right overlay so it never covers the hand).
  const logChatContent = (
    <LogChatPanel
      tab={logChatTab}
      onTabChange={setLogChatTab}
      onClose={() => setOpenPanel(null)}
      log={game.log}
      renderLog={renderLog}
      logEndRef={logEndRef}
      chat={chat}
      chatEndRef={chatEndRef}
      chatText={chatText}
      onChatTextChange={setChatText}
      onSendChat={(text) => emit("chat:send", { text })}
    />
  );
  // Room panel content — opened from the navbar.
  const roomContent = (
    <section className="mock-log local-navpanel">
      <h2 className="local-tab-bar">
        <span className="local-navpanel-title">ห้อง: {joinedRoom}</span>
        <button
          className="local-chat-collapse"
          onClick={() => setOpenPanel(null)}
          title="ปิด"
        >
          ✕
        </button>
      </h2>
      <div className="local-lobby-players">
        ผู้เล่น {game.players.length} คน
        {game.spectators.length > 0
          ? ` · ผู้ชม ${game.spectators.length} คน`
          : ""}
      </div>
      {game.spectators.length > 0 && (
        <div className="local-spectator-names">
          👁 ผู้ชม: {game.spectators.map((s) => s.username).join(", ")}
        </div>
      )}
      <div className="local-lobby-controls">
        {waiting && !myPlayer && !game.isSpectator && (
          <button onClick={() => emit("seat:random")}>นั่งที่นั่งสุ่ม</button>
        )}
        {waiting && myPlayer && (
          <div className="local-ready-row">
            <button
              className={myPlayer.ready ? "secondary" : ""}
              onClick={() => emit("player:ready", { ready: !myPlayer.ready })}
            >
              {myPlayer.ready ? "✓ ยกเลิกพร้อม" : "พร้อมแล้ว"}
            </button>
            <button
              className="secondary local-spectate-btn"
              onClick={() => emit("seat:spectate")}
            >
              ดูเฉย ๆ
            </button>
          </div>
        )}
        {waiting && (
          <div className="local-name-version">
            <span className="local-name-version-label">
              🃏 เวอร์ชันชื่อการ์ด
            </span>
            <div className="local-name-version-opts">
              {(
                [
                  ["modern", "ชื่อใหม่"],
                  ["classic", "ชื่อเดิม"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  className={`local-name-version-btn${(game.cardNameVersion || "modern") === v ? " active" : ""}`}
                  disabled={!isHost}
                  onClick={() => emit("room:card-name-version", { version: v })}
                >
                  {label}
                </button>
              ))}
            </div>
            {!isHost && (
              <small className="local-name-version-note">
                หัวหน้าห้องเป็นผู้เลือก
              </small>
            )}
          </div>
        )}
        {isHost &&
          waiting &&
          (game.startDeadline ? (
            <button
              className="danger"
              onClick={() => emit("game:cancel-start")}
            >
              ✕ ยกเลิกการเริ่ม ({startSecondsLeft})
            </button>
          ) : (
            <button
              onClick={() => setConfirmStart(true)}
              disabled={readyCount < game.players.length}
            >
              เริ่มเกม ({readyCount}/{game.players.length})
            </button>
          ))}
        {isPlaying && myPlayer?.alive && (
          <button
            className="danger"
            onClick={() => {
              setOpenPanel(null);
              setConfirmSurrender(true);
            }}
          >
            🏳️ ยอมแพ้
          </button>
        )}
        <button
          className="danger"
          onClick={() => {
            emit("room:leave");
            setGame(undefined);
            setJoinedRoom("");
            loadRooms();
          }}
        >
          ออกจากห้อง
        </button>
      </div>
    </section>
  );
  const activePlayer = game.players.find(
    (p) => p.id === game.turn?.activePlayerId,
  );
  const navbar = (
    <nav className="local-navbar">
      <div className="local-navbar-left">
        <span className="local-nav-title">ยุทธพิชัยสามก๊ก</span>
        {isPlaying && (
          <span className="local-nav-turn">
            <b>ตา: {activePlayer?.username || "—"}</b>{" "}
            <em>
              {PHASE_LABEL[game.turn?.phase || ""] || game.turn?.phase}
              {isDrawPhase && (game.turn?.drawnThisTurn ?? 0) > 0
                ? ` ${game.turn?.drawnThisTurn}/2`
                : ""}
            </em>
          </span>
        )}
        {game.isSpectator && <span className="local-nav-turn">· ผู้ชม</span>}
      </div>
      {isPlaying && (
        <div className="local-role-counts">
          {(["emperor", "rebel", "loyalist", "traitor"] as const).map(
            (role) => {
              const alive = roleCounts
                ? roleCounts[role]
                : game.players.filter((p) => p.role === role && p.alive).length;
              return (
                <span
                  key={role}
                  className={`local-role-count local-role-${role}${alive === 0 ? " local-role-dead" : ""}`}
                >
                  {ROLE_LABEL[role]} {alive}
                </span>
              );
            },
          )}
        </div>
      )}
      <div className="local-navbar-right">
        <button
          className={`local-nav-btn${openPanel === "room" ? " active" : ""}`}
          onClick={() => setOpenPanel((p) => (p === "room" ? null : "room"))}
          title="ห้อง"
          aria-label="ห้อง"
        >
          <Icon name="home" size={20} />
        </button>
        <button
          className={`local-nav-btn${openPanel === "logchat" ? " active" : ""}`}
          onClick={() =>
            setOpenPanel((p) => (p === "logchat" ? null : "logchat"))
          }
          title="บันทึก/แชท"
          aria-label="บันทึก/แชท"
        >
          <Icon name="comment" size={20} />
        </button>
        <button
          className={`local-nav-btn local-nav-ency${showEncyclopedia ? " active" : ""}`}
          onClick={() => setShowEncyclopedia(true)}
          title="คลังการ์ด / สารานุกรม"
          aria-label="เปิดคลังการ์ด"
        >
          <Icon name="book" size={20} />
        </button>
        {myPlayer?.role && (
          <button
            className="local-nav-btn"
            onClick={() => setShowRole(true)}
            title="บทบาทของฉัน"
            aria-label="บทบาทของฉัน"
          >
            <Icon name="masks" size={20} />
          </button>
        )}
        <div className="local-settings-anchor">
          <button
            className={`local-nav-btn${showSettings ? " active" : ""}`}
            onClick={() => setShowSettings((v) => !v)}
            title="ตั้งค่าในเกม"
            aria-haspopup="dialog"
            aria-expanded={showSettings}
            aria-label="ตั้งค่าในเกม"
          >
            <Icon name="settings" size={20} />
          </button>
          {showSettings && (
            <SettingsPopover
              onClose={() => setShowSettings(false)}
              confirmBeforePlay={confirmBeforePlay}
              onToggleConfirm={toggleConfirmBeforePlay}
              soundOn={soundOn}
              onToggleSound={() => setSoundOn((v) => !v)}
            />
          )}
        </div>
      </div>
    </nav>
  );
  const navPanels = (
    <>
      {openPanel === "room" && roomContent}
      {openPanel === "logchat" && logChatContent}
    </>
  );
  const secondsLeft = game.responseDeadline
    ? Math.max(0, Math.ceil((game.responseDeadline - nowTs) / 1000))
    : null;
  const countdownBadge =
    secondsLeft != null ? (
      <span
        className={`local-countdown${secondsLeft <= 5 ? " local-countdown-urgent" : ""}`}
      >
        ⏳ {secondsLeft} วิ
      </span>
    ) : null;
  // Feature 2: critical final-7-seconds state for the viewer's own decision.
  const criticalCountdown =
    myDecision && secondsLeft != null && secondsLeft <= 7 && secondsLeft >= 1;

  // Card name version for the encyclopedia (in-game cards are already resolved server-side).
  const encyclopediaDrawer = (
    <EncyclopediaDrawer
      isPlaying={isPlaying}
      open={showEncyclopedia}
      onOpen={() => setShowEncyclopedia(true)}
      onClose={() => setShowEncyclopedia(false)}
      classicNames={game.cardNameVersion === "classic"}
      encCharDetail={encCharDetail}
      setEncCharDetail={setEncCharDetail}
      encDetail={encDetail}
      setEncDetail={setEncDetail}
      encSearch={encSearch}
      setEncSearch={setEncSearch}
      encCategory={encCategory}
      setEncCategory={setEncCategory}
      catalog={catalog}
      charCatalog={charCatalog}
    />
  );

  return (
    <>
      {navbar}
      {encyclopediaDrawer}
      {/* QA God Mode — dev builds only; the guard is a compile-time constant so production bundles tree-shake the panel away. */}
      {process.env.NODE_ENV !== "production" && (
        <DebugSandboxPanel game={game} gameId={joinedRoom} socket={socket} />
      )}
      <main
        className={
          isPlaying
            ? `mock-game-page local-game-page mock-count-${game.players.length}`
            : "game-page"
        }
      >
        {navPanels}
        {game.winner &&
          (() => {
            const label =
              game.winner === "traitor"
                ? "คนทรยศชนะ"
                : game.winner === "rebels"
                  ? "กบฏชนะ"
                  : "จักรพรรดิและผู้ภักดีชนะ";
            const me = game.players.find((p) => p.id === game.viewerId);
            const iWin =
              !!me &&
              ((game.winner === "traitor" && me.role === "traitor") ||
                (game.winner === "rebels" && me.role === "rebel") ||
                (game.winner === "emperor_loyalists" &&
                  (me.role === "emperor" || me.role === "loyalist")));
            return (
              <div className="modal-backdrop local-endgame">
                <section className="local-endgame-card">
                  <h1 className="local-endgame-title">🏆 {label}</h1>
                  {me && (
                    <p className={`local-endgame-you ${iWin ? "win" : "lose"}`}>
                      {iWin ? "🎉 คุณชนะ!" : "😔 คุณพ่ายแพ้"}
                    </p>
                  )}
                  <div className="local-endgame-roles">
                    {[...game.players]
                      .sort((a, b) => a.seatIndex - b.seatIndex)
                      .map((p) => (
                        <div
                          key={p.id}
                          className={`local-endgame-row local-role-${p.role || "unknown"}`}
                        >
                          <b>{p.username}</b>
                          <span>
                            {p.character?.name ? `${p.character.name} · ` : ""}
                            {ROLE_LABEL[p.role || ""] || p.role || "—"}
                          </span>
                          <small>{p.alive ? "✅ รอด" : "💀 ตาย"}</small>
                        </div>
                      ))}
                  </div>
                  <div className="mock-response-actions">
                    <button
                      onClick={() => {
                        emit("room:leave");
                        setGame(undefined);
                        setJoinedRoom("");
                        loadRooms();
                      }}
                    >
                      ออกจากห้อง
                    </button>
                  </div>
                </section>
              </div>
            );
          })()}
        {error && (
          <div
            className="local-warn-overlay"
            onClick={() => setError(undefined)}
          >
            <div className="local-warn-box" role="alert">
              <span>⚠️ {error}</span>
              <small>แตะเพื่อปิด</small>
            </div>
          </div>
        )}
        {drawPreview && drawPreview.length > 0 && (
          <div
            className="local-draw-preview"
            role="status"
            onClick={() => setDrawPreview(null)}
          >
            <div
              className="local-draw-preview-fan"
              style={{ "--n": drawPreview.length } as CSSProperties}
            >
              {drawPreview.map((c, i) => (
                <article
                  key={c.id}
                  className={`mock-card mock-card-suit-${suitColor(c.suit)} local-preview-card`}
                  style={{ "--i": i } as CSSProperties}
                >
                  <header>
                    <span className="mock-card-rank">
                      {c.number}
                      {suitTx(c.suit)}
                    </span>
                  </header>
                  {c.image ? (
                    <img className="mock-card-art" src={c.image} alt={c.name} />
                  ) : (
                    <div className="mock-card-art">WTK</div>
                  )}
                  <b className="mock-card-name">{c.name}</b>
                  <small>{cardTypeLabel(c)}</small>
                </article>
              ))}
            </div>
            <p className="local-draw-preview-label">
              🎴 ได้รับการ์ด {drawPreview.length} ใบ · แตะเพื่อปิด
            </p>
          </div>
        )}
        {game.isSpectator && (
          <p className="spectator-banner">
            คุณกำลังรับชมเกมนี้ในฐานะ Spectator
          </p>
        )}

        {/* Pre-game: same table layout as playing but no piles */}
        {!isPlaying && (
          <section
            className={`mock-match-layout mock-count-${game.players.length}`}
          >
            <section className="mock-table-stage" data-density="large">
              <div className="mock-table-surface">
                <div className="mock-table-pattern">三國</div>
              </div>
              <div className="local-lobby-status">
                {waiting && (
                  <p
                    style={{
                      margin: "4px 0",
                      color: "#c8b58a",
                      fontSize: ".82rem",
                    }}
                  >
                    พร้อม {readyCount}/{game.players.length} คน
                  </p>
                )}
                {game.phase === "character-select" && (
                  <div className="local-select-center">
                    {!emperor?.confirmedCharacter ? (
                      <>
                        กำลังรอ <b>จักรพรรดิ</b> เลือกขุนพล
                      </>
                    ) : waitingForCharacter.length ? (
                      <>
                        กำลังรอ{" "}
                        {waitingForCharacter.map((p, i) => (
                          <span key={p.id}>
                            <b>{p.username}</b>
                            {i < waitingForCharacter.length - 1 ? ", " : ""}
                          </span>
                        ))}{" "}
                        เลือกขุนพล
                      </>
                    ) : (
                      <>ผู้เล่นทุกคนเลือกขุนพลแล้ว</>
                    )}
                  </div>
                )}
              </div>
              {/* All 10 seats */}
              {Array.from({ length: 10 }, (_, i) => {
                const seatNum = i + 1;
                const player = game.players.find(
                  (p) => p.seatIndex === seatNum,
                );
                const pos = lobbyPosition(seatNum);
                const style = {
                  "--seat-x": pos.left,
                  "--seat-y": pos.top,
                } as CSSProperties;
                if (!player) {
                  return waiting ? (
                    <div
                      key={seatNum}
                      className="mock-opponent local-lobby-seat"
                      style={style}
                    >
                      <button
                        onClick={() =>
                          emit("seat:select", { seatIndex: seatNum })
                        }
                      >
                        + {seatNum}
                      </button>
                    </div>
                  ) : null;
                }
                const isMe = player.id === game.viewerId;
                return (
                  <div key={seatNum} className="mock-opponent" style={style}>
                    <article
                      className={`mock-player local-opponent ${isMe ? "mock-self" : ""}`}
                    >
                      <div className="mock-portrait">
                        {player.character?.image ? (
                          <img
                            src={player.character.image}
                            alt={charName(player)}
                          />
                        ) : (
                          charName(player).slice(0, 1)
                        )}
                      </div>
                      <div className="mock-player-content">
                        <div className="local-name-row">
                          <b>
                            {player.username}
                            {player.id === game.hostId && (
                              <span className="local-host-badge"> ♛</span>
                            )}
                          </b>
                        </div>
                        {player.character && (
                          <small
                            style={{ color: "var(--danger)", fontWeight: 700 }}
                          >
                            {player.character.name}
                          </small>
                        )}
                        {waiting && (
                          <small
                            className={`local-ready-text ${player.ready ? "ready" : "not-ready"}`}
                          >
                            {player.ready ? "✓ พร้อม" : "ยังไม่พร้อม"}
                          </small>
                        )}
                        {!waiting && hearts(player.hp, player.maxHp)}
                        <small>ที่นั่ง {player.seatIndex}</small>
                      </div>
                    </article>
                  </div>
                );
              })}
            </section>
          </section>
        )}

        {roleOptions.length > 0 && isHost && (
          <section className="choice">
            <h2>เลือกชุดบทบาท</h2>
            {roleOptions.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  emit("game:start", { composition: r });
                  setRoleOptions([]);
                }}
              >
                {roleText(r)}
              </button>
            ))}
          </section>
        )}
        {game.phase === "character-select" && chooser && (
          <div className="modal-backdrop">
            <section className="local-general-picker">
              <h2>เลือกขุนพลของคุณ (คลิกที่การ์ด)</h2>
              <div className="local-general-picker-body">
                <div className="character-grid">
                  {chooser.characterOptions.map((c) => (
                    <article
                      key={c.id}
                      tabIndex={0}
                      onClick={() => setConfirmCharacter(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setConfirmCharacter(c);
                        }
                      }}
                      className={`local-general-card local-faction-${KINGDOM_FACTION[c.kingdom || ""] || "qun"}`}
                    >
                      {c.image ? (
                        <img className="local-general-bg" src={c.image} alt="" />
                      ) : (
                        <div className="local-general-bg local-general-bg-ph">
                          WTK
                        </div>
                      )}
                      <div className="local-general-info">
                        <div className="local-general-head">
                          <h3 className="general-name">{c.name}</h3>
                          <span className="local-general-meta">
                            {c.kingdomTh || "อิสระ"} · HP {c.hp}
                          </span>
                        </div>
                        <div className="local-general-skills">
                          {c.skills.map((s) => (
                            <p key={s.name}>
                              <b>{s.name}</b> — {s.description}
                            </p>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {isPlaying && (
          <section className="mock-match-layout">
            <section className="mock-table-stage" data-density="large">
              <div className="mock-table-surface">
                <div className="mock-table-pattern">三國</div>
                <section className="mock-piles">
                  <button
                    className={`mock-pile${isDrawPhase || myOwedDraws > 0 || myJudgmentDraw ? " local-draw-pile-active" : ""}`}
                    onClick={
                      isDrawPhase
                        ? () => emit("turn:draw-one")
                        : myOwedDraws > 0
                          ? () => emit("pending:draw")
                          : myJudgmentDraw
                            ? () => emit("judgment:draw")
                            : undefined
                    }
                    title={
                      isDrawPhase
                        ? "คลิกเพื่อจั่วไพ่ทีละใบ"
                        : myOwedDraws > 0
                          ? "คลิกเพื่อจั่วไพ่ที่ได้รับ"
                          : myJudgmentDraw
                            ? "คลิกเพื่อเปิดไพ่ตัดสิน"
                            : undefined
                    }
                  >
                    <div className="mock-deck">
                      {isDrawPhase
                        ? `จั่ว ${game.turn?.drawnThisTurn ?? 0}/2`
                        : myOwedDraws > 0
                          ? `รับ +${myOwedDraws}`
                          : myJudgmentDraw
                            ? "⚖"
                            : "🂠"}
                    </div>
                    <b>กองจั่ว</b>
                    <small>{game.deck.length} ใบ</small>
                  </button>
                  <button
                    type="button"
                    className="mock-pile mock-pile-btn"
                    onClick={() => game.discard.length && setShowDropZone(true)}
                    disabled={!game.discard.length}
                    title="ดูไพ่ทั้งหมดในกองทิ้ง"
                  >
                    {topDiscard ? (
                      <CardFace
                        key={topDiscard.id}
                        card={topDiscard}
                        className="mock-card-pile local-card-played"
                        compact
                      />
                    ) : (
                      <div className="mock-discard mock-card-pile-empty">—</div>
                    )}
                    <b>กองทิ้ง</b>
                    <small>
                      {game.discard.length} ใบ
                      {game.discard.length > 0 ? (
                        <>
                          {" "}
                          <Icon name="search" />
                        </>
                      ) : null}
                    </small>
                  </button>
                </section>
                <p className="local-action-empty">
                  {isDrawPhase
                    ? "⬆ กดกองจั่วเพื่อจั่วไพ่"
                    : myOwedDraws > 0
                      ? `⬆ กดกองจั่วเพื่อรับไพ่ที่ได้รับ (${myOwedDraws} ใบ)`
                      : rw
                        ? `กำลังรอ ${responder?.username ?? "ผู้เล่น"} ตอบสนอง`
                        : "—"}
                </p>
              </div>
              {opponents.map((player, index) => {
                const pos = edgePosition(index, opponents.length);
                const style = {
                  "--seat-x": pos.left,
                  "--seat-y": pos.top,
                } as CSSProperties;
                const attackTarget = Boolean(selectedAttackId && player.alive);
                const discardTargetable = Boolean(
                  selectedDiscardId &&
                  player.alive &&
                  player.id !== game.viewerId,
                );
                const stealTargetable = Boolean(
                  selectedStealId &&
                  player.alive &&
                  player.id !== game.viewerId,
                );
                const snakeTargetable = Boolean(
                  snakeMode &&
                  snakeCards.length === 2 &&
                  player.alive &&
                  player.id !== game.viewerId,
                );
                const multiTargetable = Boolean(
                  multiAttackId && player.alive && player.id !== game.viewerId,
                );
                const coerceHolderPick = Boolean(
                  coerceCardId &&
                  !coerceHolderId &&
                  player.alive &&
                  player.id !== game.viewerId &&
                  player.equipment.weapon,
                );
                const coerceVictimPick = Boolean(
                  coerceCardId &&
                  coerceHolderId &&
                  player.alive &&
                  player.id !== coerceHolderId,
                );
                const miracleTargetable = Boolean(
                  miracleMode &&
                  miracleCard &&
                  player.alive &&
                  player.hp !== undefined &&
                  player.maxHp !== undefined &&
                  player.hp < player.maxHp,
                );
                const marriageTargetable = Boolean(
                  marriageMode &&
                  marriageCards.length === 2 &&
                  player.alive &&
                  player.character?.gender === "ชาย" &&
                  player.hp !== undefined &&
                  player.maxHp !== undefined &&
                  player.hp < player.maxHp,
                );
                const raidTargetable = Boolean(
                  raidMode &&
                  player.alive &&
                  player.id !== game.viewerId &&
                  (player.handCount ?? player.hand.length) > 0,
                );
                const benevolenceTargetable = Boolean(
                  benevolenceMode &&
                  benevolenceCards.length > 0 &&
                  player.alive &&
                  player.id !== game.viewerId,
                );
                const redirectTargetable = Boolean(
                  redirectMode &&
                  redirectCard &&
                  player.alive &&
                  player.id !== game.viewerId &&
                  player.id !== game.pendingAction?.actorId,
                );
                const seduceTargetable = Boolean(
                  seduceMode &&
                  seduceCard &&
                  player.alive &&
                  player.id !== game.viewerId,
                );
                const dischordTargetable = Boolean(
                  dischordMode && player.alive && player.id !== game.viewerId,
                );
                const inciteTargetable = Boolean(
                  inciteMode &&
                  inciteCard &&
                  player.alive &&
                  player.id !== game.viewerId &&
                  player.character?.gender === "ชาย" &&
                  player.id !== inciteFirst,
                );
                const unityTgtable = Boolean(
                  unityMode &&
                  !unityTarget &&
                  player.alive &&
                  player.id !== game.viewerId,
                );
                const unityAllyable = Boolean(
                  unityMode &&
                  unityTarget &&
                  player.alive &&
                  player.id !== game.viewerId &&
                  player.id !== unityTarget &&
                  player.character?.kingdom === "SHU",
                );
                const guardianTargetable = Boolean(
                  guardianMode &&
                  player.alive &&
                  player.id !== game.viewerId &&
                  player.character?.kingdom === "WEI",
                );
                const targetable =
                  attackTarget ||
                  discardTargetable ||
                  stealTargetable ||
                  snakeTargetable ||
                  multiTargetable ||
                  coerceHolderPick ||
                  coerceVictimPick ||
                  miracleTargetable ||
                  marriageTargetable ||
                  raidTargetable ||
                  benevolenceTargetable ||
                  redirectTargetable ||
                  seduceTargetable ||
                  dischordTargetable ||
                  inciteTargetable ||
                  unityTgtable ||
                  unityAllyable ||
                  guardianTargetable;
                const onTarget = attackTarget
                  ? () => {
                      emit("card:play", {
                        cardId: selectedAttackId,
                        targetId: player.id,
                      });
                      cancelSelection();
                    }
                  : guardianTargetable
                    ? () => {
                        emit("skill:guardian", { allyId: player.id });
                        setGuardianMode(false);
                      }
                    : unityTgtable
                      ? () => setUnityTarget(player.id)
                      : unityAllyable
                        ? () => {
                            emit("skill:unity", {
                              targetId: unityTarget,
                              allyId: player.id,
                            });
                            setUnityMode(false);
                            setUnityTarget(undefined);
                          }
                        : inciteTargetable
                          ? () => {
                              if (!inciteFirst) setInciteFirst(player.id);
                              else {
                                emit("skill:incite", {
                                  cardId: inciteCard,
                                  firstAttackerId: inciteFirst,
                                  secondPlayerId: player.id,
                                });
                                setInciteMode(false);
                                setInciteCard(undefined);
                                setInciteFirst(undefined);
                              }
                            }
                          : dischordTargetable
                            ? () => {
                                emit("skill:dischord", { targetId: player.id });
                                setDischordMode(false);
                              }
                            : seduceTargetable
                              ? () => {
                                  emit("skill:seduce", {
                                    cardId: seduceCard,
                                    targetId: player.id,
                                  });
                                  setSeduceMode(false);
                                  setSeduceCard(undefined);
                                }
                              : redirectTargetable
                                ? () => {
                                    emit("redirect:attack", {
                                      cardId: redirectCard,
                                      targetId: player.id,
                                    });
                                    setRedirectMode(false);
                                    setRedirectCard(undefined);
                                  }
                                : benevolenceTargetable
                                  ? () => {
                                      emit("skill:benevolence", {
                                        cardIds: benevolenceCards,
                                        targetId: player.id,
                                      });
                                      setBenevolenceCards([]);
                                    }
                                  : raidTargetable
                                    ? () => {
                                        setRaidTargets((prev) =>
                                          prev.includes(player.id)
                                            ? prev.filter(
                                                (x) => x !== player.id,
                                              )
                                            : prev.length < 2
                                              ? [...prev, player.id]
                                              : prev,
                                        );
                                      }
                                    : miracleTargetable
                                      ? () => {
                                          emit("skill:miracle", {
                                            cardId: miracleCard,
                                            targetId: player.id,
                                          });
                                          setMiracleMode(false);
                                          setMiracleCard(undefined);
                                        }
                                      : marriageTargetable
                                        ? () => {
                                            emit("skill:marriage", {
                                              cardIds: marriageCards,
                                              targetId: player.id,
                                            });
                                            setMarriageMode(false);
                                            setMarriageCards([]);
                                          }
                                        : coerceHolderPick
                                          ? () => {
                                              setCoerceHolderId(player.id);
                                            }
                                          : coerceVictimPick
                                            ? () => {
                                                emit("coerce:play", {
                                                  cardId: coerceCardId,
                                                  weaponHolderId:
                                                    coerceHolderId,
                                                  victimId: player.id,
                                                });
                                                cancelSelection();
                                              }
                                            : multiTargetable
                                              ? () => {
                                                  setMultiTargets((prev) =>
                                                    prev.includes(player.id)
                                                      ? prev.filter(
                                                          (x) =>
                                                            x !== player.id,
                                                        )
                                                      : prev.length < 3
                                                        ? [...prev, player.id]
                                                        : prev,
                                                  );
                                                }
                                              : snakeTargetable
                                                ? () => {
                                                    emit(
                                                      "weapon:snake-attack",
                                                      {
                                                        cardIds: snakeCards,
                                                        targetId: player.id,
                                                      },
                                                    );
                                                    cancelSnake();
                                                  }
                                                : discardTargetable
                                                  ? () => {
                                                      setSelectedDiscardTargetId(
                                                        player.id,
                                                      );
                                                      setSelectedDiscardZone(
                                                        undefined,
                                                      );
                                                    }
                                                  : stealTargetable
                                                    ? () => {
                                                        const dist =
                                                          game.distances?.[
                                                            player.id
                                                          ];
                                                        const ignore = (
                                                          game
                                                            .characterSkillKeys?.[
                                                            game.viewerId
                                                          ] || []
                                                        ).includes(
                                                          "trick_ignore_distance",
                                                        );
                                                        if (
                                                          !ignore &&
                                                          (dist == null ||
                                                            dist > 1)
                                                        ) {
                                                          setError(
                                                            `${charName(player)} อยู่นอกระยะลอบขโมย (ต้องระยะ 1) — เลือกเป้าหมายใหม่`,
                                                          );
                                                          return;
                                                        }
                                                        setSelectedStealTargetId(
                                                          player.id,
                                                        );
                                                        setSelectedStealZone(
                                                          undefined,
                                                        );
                                                      }
                                                    : undefined;
                const dist = game.distances?.[player.id];
                const respCard = rw?.responses?.find(
                  (r) => r.playerId === player.id && r.response === "card",
                )?.card;
                return (
                  <div
                    key={player.id}
                    className={`mock-opponent${multiTargets.includes(player.id) || raidTargets.includes(player.id) || inciteFirst === player.id || unityTarget === player.id ? " local-multi-selected" : ""}`}
                    style={style}
                  >
                    <OpponentPanel
                      player={player}
                      targetable={targetable}
                      distance={dist}
                      onClick={onTarget}
                      onSkills={
                        player.character
                          ? () => setSkillsCharacter(player.character)
                          : undefined
                      }
                      onInspect={setDetailCard}
                    />
                    {respCard && (
                      <div
                        className={`local-seat-play mock-card-suit-${suitColor(respCard.suit)}`}
                      >
                        <span className="mock-card-rank">
                          {respCard.number}
                          {suitTx(respCard.suit)}
                        </span>
                        <b>{respCard.name}</b>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </section>
        )}

        {isPlaying && (
          <section className="mock-current-player">
            <article className="mock-player mock-self">
              <div className="mock-portrait-col">
                <div className="mock-portrait">
                  {myPlayer?.character?.image ? (
                    <img
                      src={myPlayer.character.image}
                      alt={charName(myPlayer)}
                    />
                  ) : (
                    charName(myPlayer).slice(0, 1)
                  )}
                </div>
                {myPlayer?.character?.kingdomTh && (
                  <span
                    className={`mock-kingdom kingdom-${myPlayer.character.kingdom ?? "QUN"}`}
                  >
                    {myPlayer.character.kingdomTh}
                  </span>
                )}
              </div>
              <div className="mock-player-content">
                <div className="local-name-row">
                  <b>{charName(myPlayer)}</b>
                  {myPlayer?.character && (
                    <button
                      className="local-skills-btn"
                      onClick={() =>
                        myPlayer.character &&
                        setSkillsCharacter(myPlayer.character)
                      }
                      title="ดูทักษะ"
                    >
                      !
                    </button>
                  )}
                </div>
                <small className="mock-username">@{myPlayer?.username}</small>
                <div className="local-hp-hand">
                  {hearts(myPlayer?.hp, myPlayer?.maxHp)}
                  <span className="mock-hand-count">
                    🂠 × {myPlayer?.hand.length}
                  </span>
                </div>
                <small className="mock-seat-info">
                  ที่นั่ง {myPlayer?.seatIndex}
                </small>
                {myPlayer?.role && (
                  <small
                    className={`mock-role${myPlayer.role === "emperor" || roleVisible ? " local-role-" + myPlayer.role : ""}`}
                  >
                    {myPlayer.role !== "emperor" && (
                      <button
                        className="local-role-toggle"
                        onClick={() => setRoleVisible((v) => !v)}
                        title={roleVisible ? "ซ่อนบทบาท" : "แสดงบทบาท"}
                        aria-label={roleVisible ? "ซ่อนบทบาท" : "แสดงบทบาท"}
                      >
                        <Icon name={roleVisible ? "eye" : "eyeCrossed"} />
                      </button>
                    )}
                    บทบาท:{" "}
                    {myPlayer.role === "emperor" || roleVisible
                      ? (ROLE_LABEL[myPlayer.role] ?? myPlayer.role)
                      : "???"}
                  </small>
                )}
                <EquipmentDisplay
                  eq={
                    myPlayer?.equipment ?? {
                      weapon: null,
                      armor: null,
                      offensiveMount: null,
                      defensiveMount: null,
                    }
                  }
                  onInspect={setDetailCard}
                />
                <DecisionArea
                  cards={myPlayer?.decisionArea ?? []}
                  onInspect={setDetailCard}
                />
              </div>
            </article>
            <div className="mock-your-turn">
              {myOwedDraws > 0 ? (
                <strong>
                  ⬆ คุณได้รับไพ่ {myOwedDraws} ใบ — กดกองจั่วเพื่อรับ
                </strong>
              ) : selectedAttackId || selectedDiscardId || selectedStealId ? (
                <strong>เลือกผู้เล่นเป้าหมายบนโต๊ะ</strong>
              ) : isDrawPhase ? (
                <strong>⬆ กดกองจั่วบนโต๊ะเพื่อจั่วไพ่</strong>
              ) : null}
            </div>
            <div className="local-turn-controls">
              <button
                disabled={
                  !isMyTurn ||
                  Boolean(rw) ||
                  Boolean(pj) ||
                  game.turn?.phase === "draw" ||
                  requiredDiscard > 0 ||
                  myOwedDraws > 0
                }
                onClick={() => emit("turn:end")}
              >
                จบเทิร์น
              </button>
              {requiredDiscard > 0 && isMyTurn && !discardLimitMode && (
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setDiscardLimitMode(true);
                    setDiscardLimitSelected([]);
                  }}
                >
                  ทิ้งไพ่เกินมือ ({requiredDiscard})
                </button>
              )}
              {canSnakeAttack && !snakeMode && !discardLimitMode && (
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    cancelSelection();
                    setSnakeMode(true);
                    setSnakeCards([]);
                  }}
                >
                  ⚔ {myPlayer?.equipment.weapon?.name || "ทวนอสรพิษ"} (ทิ้ง 2
                  ใบ)
                </button>
              )}
              {canAct &&
                hasMySkill("self_damage_draw") &&
                (myPlayer?.hp ?? 0) > 0 && (
                  <button
                    className="local-skill-btn"
                    onClick={() => setConfirmSelfDamage(true)}
                  >
                    ✦ พลีชีพ (จ่าย 1 HP จั่ว 2)
                  </button>
                )}
              {canAct &&
                hasMySkill("discard_then_draw_equal") &&
                !skillUsed("discard_then_draw_equal") &&
                !balanceMode &&
                !discardLimitMode &&
                !snakeMode &&
                !miracleMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setBalanceMode(true);
                      setBalanceCards([]);
                    }}
                  >
                    ✦ ถ่วงดุล (ทิ้ง→จั่ว)
                  </button>
                )}
              {canAct &&
                hasMySkill("miracle_medicine") &&
                !skillUsed("miracle_medicine") &&
                !balanceMode &&
                !discardLimitMode &&
                !snakeMode &&
                !miracleMode &&
                !marriageMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setMiracleMode(true);
                      setMiracleCard(undefined);
                    }}
                  >
                    ✦ ยาสวรรค์ (ทิ้ง 1 → ฟื้น 1 HP)
                  </button>
                )}
              {canAct &&
                hasMySkill("marriage_heal") &&
                !skillUsed("marriage_heal") &&
                !balanceMode &&
                !discardLimitMode &&
                !snakeMode &&
                !miracleMode &&
                !marriageMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setMarriageMode(true);
                      setMarriageCards([]);
                    }}
                  >
                    ✦ แผนแต่งงาน (ทิ้ง 2 → ฟื้น 2)
                  </button>
                )}
              {canAct &&
                hasMySkill("benevolence_give") &&
                !balanceMode &&
                !discardLimitMode &&
                !snakeMode &&
                !miracleMode &&
                !marriageMode &&
                !benevolenceMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setBenevolenceMode(true);
                      setBenevolenceCards([]);
                    }}
                  >
                    ✦ เมตตาธรรม (มอบไพ่ให้พันธมิตร)
                  </button>
                )}
              {canAct &&
                hasMySkill("black_as_dismantle") &&
                !bandinMode &&
                !balanceMode &&
                !discardLimitMode &&
                !snakeMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setBandinMode(true);
                    }}
                  >
                    ✦ บ้าบิ่น (♠/♣ เป็น ถอนสะพาน)
                  </button>
                )}
              {canAct &&
                hasMySkill("diamond_as_indulgence") &&
                !seduceMode &&
                !balanceMode &&
                !discardLimitMode &&
                !snakeMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setSeduceMode(true);
                      setSeduceCard(undefined);
                    }}
                  >
                    ✦ โปรยเสน่ห์ (♦ เป็น มีสุขลืมเมือง)
                  </button>
                )}
              {canAct &&
                hasMySkill("dischord") &&
                !skillUsed("dischord") &&
                (myPlayer?.hand.length ?? 0) > 0 &&
                !dischordMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setDischordMode(true);
                    }}
                  >
                    ✦ บาดหมาง (เลือกเป้าให้ทายดอก)
                  </button>
                )}
              {canAct &&
                hasMySkill("incite_duel") &&
                !skillUsed("incite") &&
                (myPlayer?.hand.length ?? 0) > 0 &&
                !inciteMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setInciteMode(true);
                      setInciteCard(undefined);
                      setInciteFirst(undefined);
                    }}
                  >
                    ✦ สาวงามยุยง (ให้ 2 ชายท้าสู้กัน)
                  </button>
                )}
              {canAct &&
                hasMySkill("ask_shu_attack") &&
                myPlayer?.role === "emperor" &&
                !unityMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setUnityMode(true);
                      setUnityTarget(undefined);
                    }}
                  >
                    ✦ คุณธรรมสามัคคี (ให้จ๊กก๊กโจมตีแทน)
                  </button>
                )}
              {isDrawPhase &&
                hasMySkill("raid_draw_phase") &&
                (game.turn?.drawnThisTurn ?? 0) === 0 &&
                !raidMode && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      cancelSelection();
                      setRaidMode(true);
                      setRaidTargets([]);
                    }}
                  >
                    ✦ จู่โจมฉับพลัน (แทนการจั่ว)
                  </button>
                )}
              {isDrawPhase &&
                hasMySkill("unarmed_tiger") &&
                (game.turn?.drawnThisTurn ?? 0) === 0 && (
                  <button
                    className="local-skill-btn"
                    onClick={() => emit("skill:hunt")}
                  >
                    ✦ ฆ่าเสือมือเปล่า (จั่ว 1 → +1 ดาเมจ)
                  </button>
                )}
              {isDrawPhase &&
                hasMySkill("fortune_judgment") &&
                (game.turn?.drawnThisTurn ?? 0) === 0 &&
                !skillUsed("fortune_done") && (
                  <button
                    className="local-skill-btn"
                    onClick={() => emit("skill:fortune")}
                  >
                    ✦ พึ่งวาสนา (เปิดดวง เก็บดอกดำ)
                  </button>
                )}
              {isDrawPhase &&
                hasMySkill("emperor_arrogance") &&
                myPlayer?.role === "emperor" &&
                (game.turn?.drawnThisTurn ?? 0) === 0 &&
                !skillUsed("arrogance") && (
                  <button
                    className="local-skill-btn"
                    onClick={() => emit("skill:arrogance")}
                  >
                    ✦ จองหอง (จั่ว +1, มือ -1)
                  </button>
                )}
              {isDrawPhase &&
                hasMySkill("peek_reorder_deck") &&
                (game.turn?.drawnThisTurn ?? 0) === 0 &&
                !skillUsed("peek") &&
                !game.pendingPeek && (
                  <button
                    className="local-skill-btn"
                    onClick={() => {
                      setPeekOrder([]);
                      emit("skill:peek");
                    }}
                  >
                    ✦ หยั่งรู้ฟ้าดิน (ดู/จัดกองจั่ว)
                  </button>
                )}
            </div>
            {(selectedAttackId || selectedDiscardId || selectedStealId) && (
              <button className="local-cancel" onClick={cancelSelection}>
                ยกเลิกเลือกเป้าหมาย
              </button>
            )}
            {discardLimitMode && (
              <div className="local-discard-limit-bar">
                <span>
                  เลือก <b>{discardLimitSelected.length}</b> ใบ (อย่างน้อย{" "}
                  {requiredDiscard} ใบ — จะทิ้งมากกว่านี้ก็ได้)
                </span>
                <button
                  disabled={discardLimitSelected.length < requiredDiscard}
                  onClick={() => setDiscardLimitConfirming(true)}
                >
                  ทิ้งที่เลือก
                </button>
                <button
                  className="mock-muted-button"
                  onClick={cancelDiscardLimit}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {snakeMode && (
              <div className="local-discard-limit-bar">
                <span>
                  เลือกไพ่ <b>{snakeCards.length}</b>/2 ใบ{" "}
                  {snakeCards.length === 2
                    ? "→ เลือกเป้าหมายบนโต๊ะ"
                    : "เพื่อใช้เป็นการโจมตี"}
                </span>
                <button className="mock-muted-button" onClick={cancelSnake}>
                  ยกเลิก
                </button>
              </div>
            )}
            {multiAttackId && (
              <div className="local-discard-limit-bar">
                <span>
                  โจมตีหลายเป้า: เลือก <b>{multiTargets.length}</b>/3 คนบนโต๊ะ
                </span>
                <button
                  disabled={multiTargets.length < 1}
                  onClick={() => {
                    emit("attack:multi", {
                      cardId: multiAttackId,
                      targetIds: multiTargets,
                    });
                    cancelSelection();
                  }}
                >
                  โจมตี ({multiTargets.length})
                </button>
                <button className="mock-muted-button" onClick={cancelSelection}>
                  ยกเลิก
                </button>
              </div>
            )}
            {coerceCardId && (
              <div className="local-discard-limit-bar">
                <span>
                  ยืมมือสังหาร:{" "}
                  {!coerceHolderId
                    ? "เลือกขุนพลที่มีอาวุธ"
                    : `เลือกเหยื่อให้ ${charName(game.players.find((p) => p.id === coerceHolderId))}`}
                </span>
                <button className="mock-muted-button" onClick={cancelSelection}>
                  ยกเลิก
                </button>
              </div>
            )}
            {balanceMode && (
              <div className="local-discard-limit-bar">
                <span>
                  ถ่วงดุล: เลือกไพ่ทิ้ง <b>{balanceCards.length}</b> ใบ
                  (จะได้จั่ว {balanceCards.length} ใบ)
                </span>
                <button
                  disabled={balanceCards.length === 0}
                  onClick={() => {
                    emit("skill:balance", { cardIds: balanceCards });
                    setBalanceMode(false);
                    setBalanceCards([]);
                  }}
                >
                  ทิ้งแล้วจั่ว
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setBalanceMode(false);
                    setBalanceCards([]);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {miracleMode && (
              <div className="local-discard-limit-bar">
                <span>
                  ยาสวรรค์:{" "}
                  {!miracleCard
                    ? "เลือกไพ่บนมือ 1 ใบเพื่อทิ้ง"
                    : "เลือกเป้าหมายที่บาดเจ็บบนโต๊ะ"}
                </span>
                {miracleCard &&
                  (myPlayer?.hp ?? 0) < (myPlayer?.maxHp ?? 0) && (
                    <button
                      onClick={() => {
                        emit("skill:miracle", {
                          cardId: miracleCard,
                          targetId: game.viewerId,
                        });
                        setMiracleMode(false);
                        setMiracleCard(undefined);
                      }}
                    >
                      ฟื้นฟูตัวเอง
                    </button>
                  )}
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setMiracleMode(false);
                    setMiracleCard(undefined);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {marriageMode && (
              <div className="local-discard-limit-bar">
                <span>
                  แผนแต่งงาน: เลือกไพ่ทิ้ง <b>{marriageCards.length}</b>/2 ใบ
                  {marriageCards.length === 2
                    ? " → เลือกขุนพลชายที่บาดเจ็บบนโต๊ะ"
                    : ""}
                </span>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setMarriageMode(false);
                    setMarriageCards([]);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {raidMode && (
              <div className="local-discard-limit-bar">
                <span>
                  จู่โจมฉับพลัน: เลือกขุนพลอื่น <b>{raidTargets.length}</b>/2
                  คนบนโต๊ะ (แทนการจั่ว)
                </span>
                <button
                  disabled={raidTargets.length < 1}
                  onClick={() => {
                    emit("skill:raid", { targetIds: raidTargets });
                    setRaidMode(false);
                    setRaidTargets([]);
                  }}
                >
                  หยิบไพ่ ({raidTargets.length})
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setRaidMode(false);
                    setRaidTargets([]);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {benevolenceMode && (
              <div className="local-discard-limit-bar">
                <span>
                  เมตตาธรรม: เลือกไพ่ <b>{benevolenceCards.length}</b> ใบ
                  {benevolenceCards.length > 0
                    ? " → เลือกผู้รับบนโต๊ะ"
                    : " (มอบ 2+ ใบในรอบ = ฟื้น 1 HP)"}
                </span>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setBenevolenceMode(false);
                    setBenevolenceCards([]);
                  }}
                >
                  เสร็จสิ้น
                </button>
              </div>
            )}
            {bandinMode && (
              <div className="local-discard-limit-bar">
                <span>บ้าบิ่น: เลือกไพ่ ♠/♣ 1 ใบ เพื่อใช้เป็น "ถอนสะพาน"</span>
                <button
                  className="mock-muted-button"
                  onClick={() => setBandinMode(false)}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {seduceMode && (
              <div className="local-discard-limit-bar">
                <span>
                  โปรยเสน่ห์:{" "}
                  {!seduceCard
                    ? "เลือกไพ่ ♦ 1 ใบ"
                    : "เลือกเป้าหมายบนโต๊ะ (ใช้เป็น มีสุขลืมเมือง)"}
                </span>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setSeduceMode(false);
                    setSeduceCard(undefined);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {dischordMode && (
              <div className="local-discard-limit-bar">
                <span>บาดหมาง: เลือกขุนพลบนโต๊ะ 1 คน</span>
                <button
                  className="mock-muted-button"
                  onClick={() => setDischordMode(false)}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {inciteMode && (
              <div className="local-discard-limit-bar">
                <span>
                  สาวงามยุยง:{" "}
                  {!inciteCard
                    ? "เลือกไพ่ทิ้ง 1 ใบ"
                    : !inciteFirst
                      ? "เลือกขุนพลชายที่โจมตีก่อน"
                      : "เลือกขุนพลชายคู่ต่อสู้"}
                </span>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setInciteMode(false);
                    setInciteCard(undefined);
                    setInciteFirst(undefined);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {unityMode && (
              <div className="local-discard-limit-bar">
                <span>
                  คุณธรรมสามัคคี:{" "}
                  {!unityTarget
                    ? "เลือกเป้าหมายโจมตี (ในระยะของคุณ)"
                    : "เลือกพันธมิตรจ๊กก๊กให้โจมตีแทน"}
                </span>
                <button
                  className="mock-muted-button"
                  onClick={() => {
                    setUnityMode(false);
                    setUnityTarget(undefined);
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            <div className="mock-hand" ref={handRef}>
              {myPlayer?.hand.map((card) => {
                const info = cardInfo(card);
                const isDiscardSelected = discardLimitSelected.includes(
                  card.id,
                );
                const isSnakeSelected = snakeCards.includes(card.id);
                const isBalanceSelected = balanceCards.includes(card.id);
                const isMiracleSelected =
                  miracleMode && miracleCard === card.id;
                const isMarriageSelected = marriageCards.includes(card.id);
                const isBenevolenceSelected = benevolenceCards.includes(
                  card.id,
                );
                const isSeduceSelected = seduceCard === card.id;
                const isInciteSelected = inciteCard === card.id;
                const pickMode =
                  discardLimitMode ||
                  snakeMode ||
                  balanceMode ||
                  miracleMode ||
                  marriageMode ||
                  benevolenceMode ||
                  bandinMode ||
                  seduceMode ||
                  inciteMode;
                const handleClick = discardLimitMode
                  ? () => toggleDiscardLimit(card.id)
                  : snakeMode
                    ? () => toggleSnake(card.id)
                    : balanceMode
                      ? () => toggleBalance(card.id)
                      : miracleMode
                        ? () => setMiracleCard(card.id)
                        : marriageMode
                          ? () =>
                              setMarriageCards((prev) =>
                                prev.includes(card.id)
                                  ? prev.filter((x) => x !== card.id)
                                  : prev.length < 2
                                    ? [...prev, card.id]
                                    : prev,
                              )
                          : benevolenceMode
                            ? () =>
                                setBenevolenceCards((prev) =>
                                  prev.includes(card.id)
                                    ? prev.filter((x) => x !== card.id)
                                    : [...prev, card.id],
                                )
                            : bandinMode
                              ? () => {
                                  if (card.suit === "♠" || card.suit === "♣") {
                                    setSelectedDiscardId(card.id);
                                    setBandinMode(false);
                                  }
                                }
                              : seduceMode
                                ? () => {
                                    if (card.suit === "♦")
                                      setSeduceCard(card.id);
                                  }
                                : inciteMode
                                  ? () => setInciteCard(card.id)
                                  : () => selectCard(card);
                const playable = canPlayCard(card);
                return (
                  <article
                    key={card.id}
                    tabIndex={0}
                    onClick={handleClick}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClick();
                      }
                    }}
                    className={`mock-card mock-card-suit-${suitColor(card.suit)} ${pickMode ? "local-hand-card" : playable ? "local-hand-card" : "local-card-disabled"} ${!pickMode && (selectedAttackId === card.id || selectedDiscardId === card.id || selectedStealId === card.id) ? "selected-card" : ""} ${(discardLimitMode && !isDiscardSelected) || (snakeMode && !isSnakeSelected) || (balanceMode && !isBalanceSelected) || (miracleMode && !isMiracleSelected) || (marriageMode && !isMarriageSelected) || (benevolenceMode && !isBenevolenceSelected) || (seduceMode && !isSeduceSelected) || (inciteMode && !isInciteSelected) ? "local-discard-unselected" : ""} ${isDiscardSelected || isSnakeSelected || isBalanceSelected || isMiracleSelected || isMarriageSelected || isBenevolenceSelected || isSeduceSelected || isInciteSelected ? "local-discard-selected" : ""}`}
                  >
                    <header>
                      <span className="mock-card-rank">
                        {card.number}
                        {suitTx(card.suit)}
                      </span>
                    </header>
                    <button
                      className="local-card-info"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailCard(card);
                      }}
                      title="ดูรายละเอียดการ์ด"
                    >
                      ℹ
                    </button>
                    {card.image ? (
                      <img
                        className="mock-card-art"
                        src={card.image}
                        alt={card.name}
                      />
                    ) : (
                      <div className="mock-card-art">WTK</div>
                    )}
                    <b className="mock-card-name">{card.name}</b>
                    <small>{cardTypeLabel(card)}</small>
                    {(isDiscardSelected ||
                      isSnakeSelected ||
                      isBalanceSelected ||
                      isMiracleSelected ||
                      isMarriageSelected) && (
                      <span className="local-discard-badge">ทิ้ง</span>
                    )}
                    {isBenevolenceSelected && (
                      <span className="local-discard-badge">มอบ</span>
                    )}
                    {isSeduceSelected && (
                      <span className="local-discard-badge">เสน่ห์</span>
                    )}
                    {!pickMode && info && (
                      <div className="card-tip" role="tooltip">
                        <b className="card-tip-name">{card.name}</b>
                        <span className="card-tip-type">
                          {cardTypeLabel(card)} · {card.number}
                          {suitTx(card.suit)}
                        </span>
                        <p className="card-tip-desc">{info.desc}</p>
                        {info.use && (
                          <p className="card-tip-use">
                            <i>เมื่อไหร่:</i> {info.use}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {isPlaying &&
          rw &&
          rw.type !== "coerce_attack" &&
          rw.type !== "harvest_pick" && (
            <section className="mock-response" role="dialog">
              <span className="mock-response-icon">
                {rw.type === "negate"
                  ? "🛡"
                  : rw.type === "dying_heal"
                    ? "✚"
                    : "⚔"}
              </span>
              {countdownBadge}
              {rw.type === "negate" ? (
                <>
                  {canRespond ? (
                    <>
                      <div>
                        <h2>ใช้คงกระพันชาตรีหรือไม่?</h2>
                      </div>
                      <div className="mock-response-actions">
                        <button
                          disabled={
                            !myPlayer?.hand.some(
                              (c) => c.effect === "negate_trick_effect",
                            )
                          }
                          onClick={() => {
                            const c = myPlayer?.hand.find(
                              (c) => c.effect === "negate_trick_effect",
                            );
                            if (c) emit("negate:play", { cardId: c.id });
                          }}
                        >
                          🛡 ใช้คงกระพันชาตรี
                        </button>
                        <button
                          className="mock-muted-button"
                          onClick={() => emit("negate:decline")}
                        >
                          ไม่ใช้
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <h2>กำลังรอ {responder?.username ?? "ผู้เล่น"}</h2>
                        <p>ว่าจะยกเลิกไพ่อุบายหรือไม่</p>
                      </div>
                    </>
                  )}
                </>
              ) : rw.type === "dying_heal" ? (
                <>
                  {canRespond ? (
                    <>
                      <div>
                        <small>
                          {charName(dyingPlayer)} อยู่ในสถานะใกล้ตาย
                        </small>
                        <h2>ใช้ เสบียง ช่วยหรือไม่?</h2>
                      </div>
                      <div className="mock-response-actions">
                        <button
                          disabled={
                            !myPlayer?.hand.some((c) => myConv("heal", c))
                          }
                          onClick={() => {
                            const c = myPlayer?.hand.find((c) =>
                              myConv("heal", c),
                            );
                            if (c) emit("response:heal", { cardId: c.id });
                          }}
                        >
                          ✚ ใช้ เสบียง
                        </button>
                        <button
                          className="mock-muted-button"
                          onClick={() => emit("response:decline")}
                        >
                          ไม่ทำอะไร
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <h2>กำลังรอ {responder?.username ?? "ผู้เล่น"}</h2>
                        <p>ว่าจะช่วย {charName(dyingPlayer)} หรือไม่</p>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  {canRespond ? (
                    <>
                      <div>
                        <h2>
                          {rw.type === "mass_dodge" ||
                          rw.type === "multi_attack"
                            ? "ต้องใช้ หลบ"
                            : rw.type === "mass_attack"
                              ? "ต้องใช้ โจมตี"
                              : rw.type === "duel_attack"
                                ? "ท้าสู้ — ตอบโต้ด้วย โจมตี"
                                : (game.pendingAction?.dodgesRequired ?? 1) > 1
                                  ? `ถูกโจมตี — ต้องใช้ หลบ อีก ${Math.max(1, (game.pendingAction?.dodgesRequired ?? 1) - (rw.responses?.filter((r) => r.playerId === game.viewerId && r.response === "card").length ?? 0))} ใบ`
                                  : "ถูกโจมตี — ตอบสนอง"}
                        </h2>
                      </div>
                      <div className="mock-response-actions">
                        {rw.type === "attack_dodge" ? (
                          <>
                            {!game.pendingAction?.noDodge && (
                              <button
                                disabled={
                                  !myPlayer?.hand.some((c) =>
                                    myConv("dodge", c),
                                  )
                                }
                                onClick={() => {
                                  const c =
                                    myPlayer?.hand.find(
                                      (c) => c.effect === "dodge",
                                    ) ||
                                    myPlayer?.hand.find((c) =>
                                      myConv("dodge", c),
                                    );
                                  if (c)
                                    emit("attack:respond", { cardId: c.id });
                                }}
                              >
                                🛡 ใช้ หลบ
                              </button>
                            )}
                            <button
                              className="mock-muted-button"
                              onClick={() => emit("attack:respond")}
                            >
                              {game.pendingAction?.noDodge
                                ? "รับความเสียหาย (หลบไม่ได้ — ม้าคะนองศึก)"
                                : "รับความเสียหาย"}
                            </button>
                            {myKeys.includes("redirect_attack") &&
                              (myPlayer?.hand.length ?? 0) > 0 &&
                              !redirectMode && (
                                <button
                                  className="local-skill-btn"
                                  onClick={() => {
                                    setRedirectMode(true);
                                    setRedirectCard(undefined);
                                  }}
                                >
                                  ↪ ระเหเร่ร่อน (เปลี่ยนเป้า)
                                </button>
                              )}
                            {myKeys.includes("ask_wei_dodge") &&
                              myPlayer?.role === "emperor" &&
                              !game.pendingAction?.noDodge &&
                              !guardianMode && (
                                <button
                                  className="local-skill-btn"
                                  onClick={() => setGuardianMode(true)}
                                >
                                  🛡 ปกป้องราชันย์ (ให้วุยก๊กหลบแทน)
                                </button>
                              )}
                            {guardianMode && (
                              <span className="local-force-cards">
                                เลือกพันธมิตรวุยก๊กบนโต๊ะ{" "}
                                <button
                                  className="mock-muted-button"
                                  onClick={() => setGuardianMode(false)}
                                >
                                  ยกเลิก
                                </button>
                              </span>
                            )}
                            {redirectMode && (
                              <div className="local-force-cards">
                                {!redirectCard ? (
                                  <>
                                    {myPlayer?.hand.map((c) => (
                                      <button
                                        key={c.id}
                                        onClick={() => setRedirectCard(c.id)}
                                      >
                                        ทิ้ง {c.name} ({c.number}
                                        {suitTx(c.suit)})
                                      </button>
                                    ))}
                                  </>
                                ) : (
                                  <span>
                                    เลือกเป้าหมายใหม่บนโต๊ะ (ในระยะของคุณ
                                    ไม่ใช่ผู้โจมตี)
                                  </span>
                                )}
                                <button
                                  className="mock-muted-button"
                                  onClick={() => {
                                    setRedirectMode(false);
                                    setRedirectCard(undefined);
                                  }}
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            )}
                          </>
                        ) : rw.type === "mass_dodge" ||
                          rw.type === "multi_attack" ? (
                          <>
                            <button
                              disabled={
                                !myPlayer?.hand.some((c) => myConv("dodge", c))
                              }
                              onClick={() => {
                                const c =
                                  myPlayer?.hand.find(
                                    (c) => c.effect === "dodge",
                                  ) ||
                                  myPlayer?.hand.find((c) =>
                                    myConv("dodge", c),
                                  );
                                if (c) emit("mass:respond", { cardId: c.id });
                              }}
                            >
                              🛡 ใช้ หลบ
                            </button>
                            <button
                              className="mock-muted-button"
                              onClick={() => emit("mass:decline")}
                            >
                              รับความเสียหาย
                            </button>
                          </>
                        ) : rw.type === "duel_attack" ? (
                          <>
                            <button
                              disabled={
                                !myPlayer?.hand.some((c) => myConv("attack", c))
                              }
                              onClick={() => {
                                const c =
                                  myPlayer?.hand.find(
                                    (c) => c.effect === "attack",
                                  ) ||
                                  myPlayer?.hand.find((c) =>
                                    myConv("attack", c),
                                  );
                                if (c) emit("duel:respond", { cardId: c.id });
                              }}
                            >
                              ⚔ ตอบโต้ด้วย โจมตี
                            </button>
                            <button
                              className="mock-muted-button"
                              onClick={() => emit("response:decline")}
                            >
                              ยอมแพ้ (เสีย 1 HP)
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              disabled={
                                !myPlayer?.hand.some((c) => myConv("attack", c))
                              }
                              onClick={() => {
                                const c =
                                  myPlayer?.hand.find(
                                    (c) => c.effect === "attack",
                                  ) ||
                                  myPlayer?.hand.find((c) =>
                                    myConv("attack", c),
                                  );
                                if (c) emit("mass:respond", { cardId: c.id });
                              }}
                            >
                              ⚔ ใช้ โจมตี
                            </button>
                            <button
                              className="mock-muted-button"
                              onClick={() => emit("mass:decline")}
                            >
                              ไม่ใช้ (เสีย 1 HP)
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <h2>
                          กำลังรอ {responder?.username ?? "ผู้เล่น"} ตอบสนอง
                        </h2>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          )}

        {isPlaying &&
          game.pendingCoerce &&
          (() => {
            const pc = game.pendingCoerce!;
            const holder = game.players.find((p) => p.id === pc.weaponHolderId);
            const victim = game.players.find((p) => p.id === pc.victimId);
            const actor = game.players.find((p) => p.id === pc.actorId);
            const isHolder = pc.weaponHolderId === game.viewerId;
            const atk = myPlayer?.hand.find((c) => c.effect === "attack");
            return (
              <section className="mock-response" role="dialog">
                <span className="mock-response-icon">🗡</span>
                {countdownBadge}
                {isHolder ? (
                  <>
                    <div>
                      <small>
                        {charName(actor)} ใช้ {pc.trickName}
                      </small>
                      <h2>ถูกบังคับให้โจมตี {charName(victim)}</h2>
                    </div>
                    <div className="mock-response-actions">
                      <button
                        disabled={!atk}
                        onClick={() =>
                          atk && emit("coerce:attack", { cardId: atk.id })
                        }
                      >
                        {atk ? `⚔ โจมตี ${charName(victim)}` : "ไม่มีไพ่โจมตี"}
                      </button>
                      <button
                        className="mock-muted-button"
                        onClick={() => emit("coerce:decline")}
                      >
                        ไม่โจมตี (ให้ {charName(actor)} ยึดอาวุธ)
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h2>กำลังรอ {holder?.username ?? "ผู้เล่น"} ตัดสินใจ</h2>
                      <p>
                        ยืมมือสังหาร: โจมตี {charName(victim)} หรือเสียอาวุธ
                      </p>
                    </div>
                  </>
                )}
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingHarvest &&
          rw?.type === "harvest_pick" &&
          (() => {
            const picker = game.players.find(
              (p) => p.id === rw.currentResponderId,
            );
            const isPicker = rw.currentResponderId === game.viewerId;
            return (
              <section className="mock-response local-harvest" role="dialog">
                <span className="mock-response-icon">🌾</span>
                {countdownBadge}
                <div>
                  <h2>
                    {isPicker
                      ? "เลือกไพ่ 1 ใบจากยุ้งฉาง"
                      : `กำลังรอ ${picker?.username ?? "ผู้เล่น"} เลือกไพ่`}
                  </h2>
                </div>
                <div className="local-harvest-pool">
                  {game.pendingHarvest!.revealed.map((c, i) => {
                    const hidden = c.effect === "hidden_harvest";
                    const hinfo = hidden ? null : cardInfo(c);
                    return (
                      <button
                        key={c.id || i}
                        disabled={!isPicker || hidden}
                        className={`mock-card ${hidden ? "local-harvest-hidden" : `mock-card-suit-${suitColor(c.suit)}`}`}
                        onClick={() =>
                          isPicker &&
                          !hidden &&
                          emit("harvest:pick", { cardId: c.id })
                        }
                      >
                        {hidden ? null : (
                          <>
                            <header>
                              <span className="mock-card-rank">
                                {c.number}
                                {suitTx(c.suit)}
                              </span>
                            </header>
                            {c.image ? (
                              <img
                                className="mock-card-art"
                                src={c.image}
                                alt={c.name}
                              />
                            ) : (
                              <div className="mock-card-art">WTK</div>
                            )}
                            <b className="mock-card-name">{c.name}</b>
                            <small>{cardTypeLabel(c)}</small>
                          </>
                        )}
                        {hinfo && (
                          <div className="card-tip" role="tooltip">
                            <b className="card-tip-name">{c.name}</b>
                            <span className="card-tip-type">
                              {cardTypeLabel(c)} · {c.number}
                              {suitTx(c.suit)}
                            </span>
                            <p className="card-tip-desc">{hinfo.desc}</p>
                            {hinfo.use && (
                              <p className="card-tip-use">
                                <i>เมื่อไหร่:</i> {hinfo.use}
                              </p>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          pj &&
          (() => {
            const jp = game.players.find((p) => p.id === pj.playerId);
            const r = pj.revealed;
            return (
              <section
                className="mock-response local-judgment-panel"
                role="dialog"
              >
                <span className="mock-response-icon">⚖</span>
                {countdownBadge}
                {pj.stage === "awaiting_draw" ? (
                  <div>
                    <h2>การตัดสิน: {pj.trickName}</h2>
                    {myJudgmentDraw ? (
                      <p>⬆ กดกองจั่ว (หรือปุ่มด้านล่าง) เพื่อเปิดไพ่ตัดสิน</p>
                    ) : (
                      <p>กำลังรอ {jp?.username ?? "ผู้เล่น"} เปิดไพ่ตัดสิน…</p>
                    )}
                    {myJudgmentDraw && (
                      <div className="mock-response-actions">
                        <button onClick={() => emit("judgment:draw")}>
                          ⚖ เปิดไพ่ตัดสิน
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="local-judgment-reveal">
                      <small>
                        ไพ่ตัดสินของ {charName(jp)} — {pj.trickName}
                      </small>
                      {r ? (
                        <div
                          className={`local-judgment-card local-suit-${suitColor(r.suit)}`}
                        >
                          <span>
                            {r.number} {suitTx(r.suit)}
                          </span>
                          <b>{r.name}</b>
                        </div>
                      ) : (
                        <p>ไม่มีไพ่ตัดสิน</p>
                      )}
                    </div>
                    {myJudgmentAct ? (
                      <div className="mock-response-actions">
                        {myKeys.includes("keep_judgment") && (
                          <button onClick={() => emit("judgment:keep")}>
                            🔮 เก็บไพ่ตัดสิน (คาดการณ์แม่นยำ)
                          </button>
                        )}
                        <button
                          className="mock-muted-button"
                          onClick={() => emit("judgment:resolve")}
                        >
                          {myKeys.includes("keep_judgment")
                            ? "ดำเนินการต่อ (เก็บไพ่เข้ามือ)"
                            : "ดำเนินการต่อ (ทิ้ง)"}
                        </button>
                      </div>
                    ) : (
                      <p>กำลังรอ {jp?.username ?? "ผู้เล่น"} ตัดสินใจ…</p>
                    )}
                    {myGuicai &&
                      (myPlayer?.hand.length ?? 0) > 0 &&
                      (guicaiPicking ? (
                        <div className="local-force-cards">
                          {myPlayer?.hand.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                emit("judgment:replace", { cardId: c.id });
                                setGuicaiPicking(false);
                              }}
                            >
                              {c.name} ({c.number}
                              {suitTx(c.suit)})
                            </button>
                          ))}
                          <button
                            className="mock-muted-button"
                            onClick={() => setGuicaiPicking(false)}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          className="local-skill-btn"
                          onClick={() => setGuicaiPicking(true)}
                        >
                          🃏 กำหนดชะตา (เปลี่ยนไพ่ตัดสิน)
                        </button>
                      ))}
                  </>
                )}
                {pj.playerId === game.viewerId &&
                  pj.stage === "awaiting_draw" &&
                  hasMySkill("fortune_judgment") &&
                  !skillUsed("fortune_done") && (
                    <button
                      className="local-skill-btn"
                      onClick={() => emit("skill:fortune")}
                    >
                      ✦ พึ่งวาสนา (ใช้ก่อนตัดสิน — เปิดดวง เก็บดอกดำ)
                    </button>
                  )}
                {pj.playerId === game.viewerId &&
                  pj.stage === "awaiting_draw" &&
                  pj.trickEffect === "delayed_lightning_judgment" &&
                  myPlayer?.hand.some(
                    (c) => c.effect === "negate_trick_effect",
                  ) && (
                    <button
                      className="local-skill-btn"
                      onClick={() => {
                        const neg = myPlayer?.hand.find(
                          (c) => c.effect === "negate_trick_effect",
                        );
                        if (neg) emit("lightning:negate", { cardId: neg.id });
                      }}
                    >
                      🛡 คงกระพันชาตรี (ยกเลิกฟ้าลงโทษ)
                    </button>
                  )}
              </section>
            );
          })()}
        {isPlaying && (
          <RepeatAttackPrompt
            game={game}
            myPlayer={myPlayer}
            emit={emit}
            countdown={countdownBadge}
          />
        )}
        {isPlaying && (
          <DestroyMountPrompt game={game} emit={emit} countdown={countdownBadge} />
        )}
        {isPlaying && (
          <ForceAttackDamagePrompt
            game={game}
            myPlayer={myPlayer}
            emit={emit}
            countdown={countdownBadge}
            forceDiscardRefs={forceDiscardRefs}
            setForceDiscardRefs={setForceDiscardRefs}
          />
        )}
        {isPlaying &&
          game.pendingReplaceDamage &&
          game.pendingReplaceDamage.attackerId === game.viewerId &&
          (() => {
            const target = game.players.find(
              (p) => p.id === game.pendingReplaceDamage!.targetId,
            );
            if (!target) return null;
            const has = (s: IceSelection) =>
              iceSelections.some(
                (x) =>
                  x.zone === s.zone &&
                  (x.zone === "hand"
                    ? x.handIndex === (s as { handIndex: number }).handIndex
                    : x.cardInstanceId ===
                      (s as { cardInstanceId: string }).cardInstanceId),
              );
            const toggle = (s: IceSelection) =>
              setIceSelections((cur) =>
                has(s)
                  ? cur.filter(
                      (x) =>
                        !(
                          x.zone === s.zone &&
                          (x.zone === "hand"
                            ? x.handIndex ===
                              (s as { handIndex: number }).handIndex
                            : x.cardInstanceId ===
                              (s as { cardInstanceId: string }).cardInstanceId)
                        ),
                    )
                  : cur.length < 2
                    ? [...cur, s]
                    : cur,
              );
            const equipEntries = (
              [
                { key: "weapon", label: "อาวุธ" },
                { key: "armor", label: "เกราะ" },
                { key: "offensiveMount", label: "ม้ารุก" },
                { key: "defensiveMount", label: "ม้ารับ" },
              ] as const
            )
              .map(({ key, label }) => ({ card: target.equipment[key], label }))
              .filter((e) => e.card);
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  {game.pendingReplaceDamage!.weaponName}: ทิ้งไพ่ของ{" "}
                  {charName(target)} 1–2 ใบ แทนที่จะสร้างความเสียหายหรือไม่?
                </b>
                {countdownBadge}
                <div className="local-force-cards">
                  {Array.from({ length: target.handCount }, (_, i) => {
                    const s: IceSelection = { zone: "hand", handIndex: i };
                    return (
                      <button
                        key={`h${i}`}
                        className={has(s) ? "selected-card" : ""}
                        onClick={() => toggle(s)}
                      >
                        🂠 {i + 1}
                      </button>
                    );
                  })}
                  {equipEntries.map(({ card, label }) => {
                    const s: IceSelection = {
                      zone: "equipment",
                      cardInstanceId: card!.id,
                    };
                    return (
                      <button
                        key={card!.id}
                        className={has(s) ? "selected-card" : ""}
                        onClick={() => toggle(s)}
                      >
                        {label}: {card!.name}
                      </button>
                    );
                  })}
                </div>
                <div>
                  <button
                    disabled={iceSelections.length < 1}
                    onClick={() => {
                      emit("ice:replace", { selections: iceSelections });
                      setIceSelections([]);
                    }}
                  >
                    ทิ้งไพ่ ({iceSelections.length}/2)
                  </button>
                  <button
                    className="mock-muted-button"
                    onClick={() => {
                      emit("ice:decline");
                      setIceSelections([]);
                    }}
                  >
                    ให้เสียเลือดตามปกติ
                  </button>
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingTwinSwords &&
          game.pendingTwinSwords.targetId === game.viewerId &&
          (() => {
            const attacker = game.players.find(
              (p) => p.id === game.pendingTwinSwords!.attackerId,
            );
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  {charName(attacker)} ใช้ {game.pendingTwinSwords!.weaponName}{" "}
                  — เลือกทิ้งไพ่บนมือ 1 ใบ หรือให้ผู้โจมตีจั่ว 1 ใบ
                </b>
                {countdownBadge}
                <div className="local-force-cards">
                  {myPlayer?.hand.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => emit("twin:discard", { cardId: c.id })}
                    >
                      ทิ้ง {c.name} ({c.number}
                      {suitTx(c.suit)})
                    </button>
                  ))}
                </div>
                <button
                  className="mock-muted-button"
                  onClick={() => emit("twin:draw")}
                >
                  ให้ผู้โจมตีจั่ว 1 ใบ
                </button>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingFankui &&
          game.pendingFankui.playerId === game.viewerId &&
          (() => {
            const damager = game.players.find(
              (p) => p.id === game.pendingFankui!.damagerId,
            );
            if (!damager) return null;
            const equipEntries = (
              [
                { key: "weapon", label: "อาวุธ" },
                { key: "armor", label: "เกราะ" },
                { key: "offensiveMount", label: "ม้ารุก" },
                { key: "defensiveMount", label: "ม้ารับ" },
              ] as const
            )
              .map(({ key, label }) => ({
                card: damager.equipment[key],
                label,
              }))
              .filter((e) => e.card);
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>🎯 กลยุทธ์โต้กลับ: หยิบไพ่ 1 ใบจาก {charName(damager)}</b>
                {countdownBadge}
                <div className="local-force-cards">
                  {Array.from({ length: damager.handCount }, (_, i) => (
                    <button
                      key={`h${i}`}
                      onClick={() =>
                        emit("fankui:take", {
                          selection: { zone: "hand", handIndex: i },
                        })
                      }
                    >
                      🂠 {i + 1}
                    </button>
                  ))}
                  {equipEntries.map(({ card, label }) => (
                    <button
                      key={card!.id}
                      onClick={() =>
                        emit("fankui:take", {
                          selection: {
                            zone: "equipment",
                            cardInstanceId: card!.id,
                          },
                        })
                      }
                    >
                      {label}: {card!.name}
                    </button>
                  ))}
                </div>
                <button
                  className="mock-muted-button"
                  onClick={() => emit("fankui:decline")}
                >
                  ไม่ใช้
                </button>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingLegacy &&
          (() => {
            const isOwner = game.pendingLegacy!.ownerId === game.viewerId;
            const owner = game.players.find(
              (p) => p.id === game.pendingLegacy!.ownerId,
            );
            if (!isOwner)
              return (
                <section className="mock-response" role="dialog">
                  <span className="mock-response-icon">📜</span>
                  {countdownBadge}
                  <div>
                    <h2>คำสั่งเสีย</h2>
                    <p>
                      กำลังรอ {owner?.username ?? "ผู้เล่น"} มอบไพ่ให้ผู้เล่น…
                    </p>
                  </div>
                </section>
              );
            const cards = game.pendingLegacy!.cards;
            return (
              <section className="mock-response local-legacy" role="dialog">
                <span className="mock-response-icon">📜</span>
                {countdownBadge}
                <div className="local-legacy-body">
                  <h2>คำสั่งเสีย — มอบไพ่ให้ผู้เล่น</h2>
                  <p>เลือกผู้รับของแต่ละใบ (ใบบนสุดจั่วก่อน)</p>
                  <div className="local-legacy-list">
                    {cards.map((c) => (
                      <div key={c.id} className="local-legacy-row">
                        <b
                          className={`local-legacy-card local-suit-${suitColor(c.suit)}`}
                        >
                          {c.name} · {c.number}
                          {suitTx(c.suit)}
                        </b>
                        <div className="local-legacy-targets">
                          {game.players
                            .filter((p) => p.alive)
                            .map((p) => (
                              <button
                                key={p.id}
                                onClick={() =>
                                  emit("legacy:assign", {
                                    cardId: c.id,
                                    targetId: p.id,
                                  })
                                }
                              >
                                {p.username}
                                {p.id === game.viewerId ? " (ตัวเอง)" : ""}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingRetaliateJudgment &&
          (() => {
            const owner = game.players.find(
              (p) => p.id === game.pendingRetaliateJudgment!.ownerId,
            );
            const damager = game.players.find(
              (p) => p.id === game.pendingRetaliateJudgment!.damagerId,
            );
            const isOwner =
              game.pendingRetaliateJudgment!.ownerId === game.viewerId;
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  🩸 ย้อนรอยศัตรู
                  {isOwner ? "" : ` — ${owner?.username ?? "ผู้เล่น"}`}
                </b>
                {countdownBadge}
                {isOwner ? (
                  <>
                    <p>
                      เปิดไพ่ตัดสินเอง — ถ้าไม่ใช่ ♥ ผู้ทำดาเมจ (
                      {damager?.username ?? "ผู้เล่น"}) ต้องทิ้งไพ่ 2 ใบ
                      หรือรับความเสียหาย 1 หน่วย
                    </p>
                    <div className="mock-response-actions">
                      <button onClick={() => emit("retaliate:reveal")}>
                        🎴 เปิดไพ่ตัดสิน
                      </button>
                    </div>
                  </>
                ) : (
                  <p>
                    กำลังรอ {owner?.username ?? "ผู้เล่น"} เปิดไพ่ตัดสิน
                    ย้อนรอยศัตรู…
                  </p>
                )}
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingRetaliate &&
          game.pendingRetaliate.damagerId === game.viewerId &&
          (() => {
            const victim = game.players.find(
              (p) => p.id === game.pendingRetaliate!.victimId,
            );
            const toggle = (id: string) =>
              setRetaliateCards((prev) =>
                prev.includes(id)
                  ? prev.filter((x) => x !== id)
                  : prev.length < 2
                    ? [...prev, id]
                    : prev,
              );
            const canDiscard = (myPlayer?.hand.length ?? 0) >= 2;
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  🩸 คุณถูกสกิล ย้อนรอยศัตรู ของ {victim?.username ?? "ผู้เล่น"}{" "}
                  — ทิ้งไพ่บนมือ 2 ใบ หรือรับความเสียหาย 1 หน่วย
                </b>
                {countdownBadge}
                {canDiscard && (
                  <div className="local-force-cards">
                    {myPlayer?.hand.map((c) => (
                      <button
                        key={c.id}
                        className={
                          retaliateCards.includes(c.id) ? "selected-card" : ""
                        }
                        onClick={() => toggle(c.id)}
                      >
                        {c.name} ({c.number}
                        {suitTx(c.suit)})
                      </button>
                    ))}
                  </div>
                )}
                <div className="mock-response-actions">
                  {canDiscard && (
                    <button
                      disabled={retaliateCards.length !== 2}
                      onClick={() => {
                        emit("retaliate:discard", { cardIds: retaliateCards });
                        setRetaliateCards([]);
                      }}
                    >
                      ทิ้งไพ่ 2 ใบ ({retaliateCards.length}/2)
                    </button>
                  )}
                  <button
                    className="mock-muted-button"
                    onClick={() => {
                      emit("retaliate:damage");
                      setRetaliateCards([]);
                    }}
                  >
                    รับความเสียหาย 1 หน่วย
                  </button>
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingDischord &&
          game.pendingDischord.targetId === game.viewerId &&
          (() => {
            const jiuyi = game.players.find(
              (p) => p.id === game.pendingDischord!.jiuyiId,
            );
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  🎴 บาดหมาง จาก {charName(jiuyi)}: เลือก 1 ดอกไพ่
                  (ทายผิดดอกที่หยิบได้ = เสีย 1 HP แต่ได้ไพ่ใบนั้น)
                </b>
                {countdownBadge}
                <div className="mock-response-actions">
                  {["♠", "♥", "♦", "♣"].map((s) => (
                    <button
                      key={s}
                      onClick={() => emit("dischord:suit", { suit: s })}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingAllyAssist &&
          game.pendingAllyAssist.allyId === game.viewerId &&
          (() => {
            const pa = game.pendingAllyAssist!;
            const emperor = game.players.find((p) => p.id === pa.emperorId);
            const need = pa.kind;
            const card = myPlayer?.hand.find((c) => c.effect === need);
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  👑 {charName(emperor)} ขอให้คุณใช้{" "}
                  {need === "attack" ? "โจมตี" : "หลบ"} แทน
                  {pa.targetId
                    ? ` (เป้าหมาย ${charName(game.players.find((p) => p.id === pa.targetId))})`
                    : ""}
                </b>
                {countdownBadge}
                <div className="mock-response-actions">
                  <button
                    disabled={!card}
                    onClick={() =>
                      card && emit("ally:assist", { cardId: card.id })
                    }
                  >
                    {card
                      ? `${need === "attack" ? "⚔ ใช้ โจมตี" : "🛡 ใช้ หลบ"} แทน`
                      : `ไม่มีไพ่${need === "attack" ? "โจมตี" : "หลบ"}`}
                  </button>
                  <button
                    className="mock-muted-button"
                    onClick={() => emit("ally:decline")}
                  >
                    ปฏิเสธ
                  </button>
                </div>
              </section>
            );
          })()}
        {isPlaying &&
          game.pendingPeek &&
          game.pendingPeek.playerId === game.viewerId &&
          (() => {
            const cards = game.pendingPeek.cards;
            const toggle = (id: string) =>
              setPeekOrder((prev) =>
                prev.includes(id)
                  ? prev.filter((x) => x !== id)
                  : [...prev, id],
              );
            const unselected = cards.filter((c) => !peekOrder.includes(c.id));
            const bottomIds = unselected.map((c) => c.id);
            const ordered = [
              ...peekOrder
                .map((id) => cards.find((c) => c.id === id))
                .filter((c): c is Card => !!c),
              ...unselected,
            ];
            return (
              <section className="local-repeat-attack" role="dialog">
                <b>
                  🔮 หยั่งรู้ฟ้าดิน — จัดลำดับกองจั่ว (บนลงล่าง ·
                  ใบบนสุดจั่วก่อน)
                </b>
                <small className="local-peek-hint">
                  กดไพ่เพื่อเลื่อนขึ้นกลุ่ม “บน” ตามลำดับที่กด ·
                  ใบที่ไม่ได้กดจะไหลลงล่าง
                </small>
                {countdownBadge}
                <div className="local-force-cards local-peek-list">
                  {ordered.map((c, i) => {
                    const sel = peekOrder.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        className={sel ? "selected-card" : ""}
                        onClick={() => toggle(c.id)}
                      >
                        <b>{i + 1}.</b> {c.name} ({c.number}
                        {suitTx(c.suit)}){" "}
                        <em>
                          {sel ? "บน" : "ล่าง"}
                          {i === 0 ? " · จั่วก่อน" : ""}
                        </em>
                      </button>
                    );
                  })}
                </div>
                <div className="mock-response-actions">
                  <button
                    onClick={() => {
                      emit("skill:peek-resolve", {
                        topIds: peekOrder,
                        bottomIds,
                      });
                      setPeekOrder([]);
                    }}
                  >
                    ยืนยันการจัดเรียง (บน {peekOrder.length}/ล่าง{" "}
                    {bottomIds.length})
                  </button>
                  <button
                    className="mock-muted-button"
                    onClick={() => {
                      emit("skill:peek-resolve", {
                        topIds: cards.map((c) => c.id),
                        bottomIds: [],
                      });
                      setPeekOrder([]);
                    }}
                  >
                    วางทั้งหมดไว้บน (ตามเดิม)
                  </button>
                </div>
              </section>
            );
          })()}

        {isPlaying && discardTarget && selectedDiscardId && (
          <div className="modal-backdrop">
            <section className="card-detail local-target-picker">
              <h2>เลือกไพ่ของ {charName(discardTarget)}</h2>
              {!selectedDiscardZone ? (
                <>
                  <p>เลือกโซน</p>
                  <div className="local-equipment-picker">
                    <button
                      disabled={!discardTarget.handCount}
                      onClick={() => setSelectedDiscardZone("hand")}
                    >
                      🂠 มือ ({discardTarget.handCount})
                    </button>
                    <button
                      disabled={
                        !Object.values(discardTarget.equipment).some(Boolean)
                      }
                      onClick={() => setSelectedDiscardZone("equipment")}
                    >
                      อุปกรณ์
                    </button>
                  </div>
                </>
              ) : selectedDiscardZone === "hand" ? (
                <>
                  <p>เลือกตำแหน่งไพ่บนมือ</p>
                  <div className="local-equipment-picker">
                    {Array.from({ length: discardTarget.handCount }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          emit("card:discard-target", {
                            cardId: selectedDiscardId,
                            targetId: discardTarget.id,
                            selection: { zone: "hand", handIndex: i },
                          });
                          cancelSelection();
                        }}
                      >
                        🂠 {i + 1}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p>เลือกอุปกรณ์</p>
                  <div className="local-equipment-picker">
                    {(
                      [
                        { key: "weapon", label: "อาวุธ" },
                        { key: "armor", label: "เกราะ" },
                        { key: "offensiveMount", label: "ม้ารุก" },
                        { key: "defensiveMount", label: "ม้ารับ" },
                      ] as const
                    ).map(({ key, label }) => {
                      const eq = discardTarget.equipment[key];
                      return eq ? (
                        <button
                          key={key}
                          onClick={() => {
                            emit("card:discard-target", {
                              cardId: selectedDiscardId,
                              targetId: discardTarget.id,
                              selection: {
                                zone: "equipment",
                                cardInstanceId: eq.id,
                              },
                            });
                            cancelSelection();
                          }}
                        >
                          <small>{label}</small>
                          {eq.name}
                        </button>
                      ) : (
                        <span key={key} className="local-empty-slot">
                          {label}: ว่าง
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
              <button className="mock-muted-button" onClick={cancelSelection}>
                ยกเลิก
              </button>
            </section>
          </div>
        )}
        {isPlaying && stealTarget && selectedStealId && (
          <div className="modal-backdrop">
            <section className="card-detail local-target-picker">
              <h2>เลือกไพ่ของ {charName(stealTarget)}</h2>
              {!selectedStealZone ? (
                <>
                  <p>เลือกโซน</p>
                  <div className="local-equipment-picker">
                    <button
                      disabled={!stealTarget.handCount}
                      onClick={() => setSelectedStealZone("hand")}
                    >
                      🂠 มือ ({stealTarget.handCount})
                    </button>
                    <button
                      disabled={
                        !Object.values(stealTarget.equipment).some(Boolean)
                      }
                      onClick={() => setSelectedStealZone("equipment")}
                    >
                      อุปกรณ์
                    </button>
                  </div>
                </>
              ) : selectedStealZone === "hand" ? (
                <>
                  <p>เลือกตำแหน่งไพ่บนมือ</p>
                  <div className="local-equipment-picker">
                    {Array.from({ length: stealTarget.handCount }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          emit("card:steal-target", {
                            cardId: selectedStealId,
                            targetId: stealTarget.id,
                            selection: { zone: "hand", handIndex: i },
                          });
                          cancelSelection();
                        }}
                      >
                        🂠 {i + 1}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p>เลือกอุปกรณ์</p>
                  <div className="local-equipment-picker">
                    {(
                      [
                        { key: "weapon", label: "อาวุธ" },
                        { key: "armor", label: "เกราะ" },
                        { key: "offensiveMount", label: "ม้ารุก" },
                        { key: "defensiveMount", label: "ม้ารับ" },
                      ] as const
                    ).map(({ key, label }) => {
                      const eq = stealTarget.equipment[key];
                      return eq ? (
                        <button
                          key={key}
                          onClick={() => {
                            emit("card:steal-target", {
                              cardId: selectedStealId,
                              targetId: stealTarget.id,
                              selection: {
                                zone: "equipment",
                                cardInstanceId: eq.id,
                              },
                            });
                            cancelSelection();
                          }}
                        >
                          <small>{label}</small>
                          {eq.name}
                        </button>
                      ) : (
                        <span key={key} className="local-empty-slot">
                          {label}: ว่าง
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
              <button className="mock-muted-button" onClick={cancelSelection}>
                ยกเลิก
              </button>
            </section>
          </div>
        )}
        {confirmSelfDamage && (
          <div
            className="modal-backdrop"
            onClick={() => setConfirmSelfDamage(false)}
          >
            <section
              className="card-detail local-target-picker"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>ใช้ พลีชีพ?</h2>
              <p>
                คุณจะเสีย <b>พลังชีวิต 1 หน่วย</b> เพื่อรับสิทธิ์จั่ว{" "}
                <b>2 ใบ</b>
              </p>
              <div className="mock-response-actions">
                <button
                  onClick={() => {
                    emit("skill:self-damage-draw");
                    setConfirmSelfDamage(false);
                  }}
                >
                  ยืนยัน เสีย 1 HP
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => setConfirmSelfDamage(false)}
                >
                  ยกเลิก
                </button>
              </div>
            </section>
          </div>
        )}
        {confirmSurrender && (
          <div
            className="modal-backdrop"
            onClick={() => setConfirmSurrender(false)}
          >
            <section
              className="card-detail local-target-picker"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>🏳️ ยอมแพ้?</h2>
              <p>
                ตัวละครของคุณจะ <b>ตายทันที</b> และเปิดเผยบทบาท
                เพื่อให้เกมดำเนินต่อได้ (ใช้เมื่อคุณต้องออกจากเกม)
              </p>
              <div className="mock-response-actions">
                <button
                  className="danger"
                  onClick={() => {
                    emit("game:surrender");
                    setConfirmSurrender(false);
                  }}
                >
                  ยืนยัน ยอมแพ้
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => setConfirmSurrender(false)}
                >
                  ยกเลิก
                </button>
              </div>
            </section>
          </div>
        )}
        {confirmCharacter && (
          <div
            className="modal-backdrop"
            onClick={() => setConfirmCharacter(undefined)}
          >
            <section
              className="local-skills-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{confirmCharacter.name}</h2>
              <p className="local-skills-faction">
                {confirmCharacter.kingdomTh || "อิสระ"} · HP{" "}
                {confirmCharacter.hp}
              </p>
              <ul className="local-skills-list">
                {confirmCharacter.skills.map((s) => (
                  <li key={s.name}>
                    <b>{s.name}</b>
                    <p>{s.description}</p>
                    {s.condition && (
                      <small className="local-skill-condition">
                        {s.condition}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mock-response-actions">
                <button
                  onClick={() => {
                    emit("character:select", {
                      characterId: confirmCharacter.id,
                    });
                    setConfirmCharacter(undefined);
                  }}
                >
                  ยืนยัน เลือก {confirmCharacter.name}
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => setConfirmCharacter(undefined)}
                >
                  ยกเลิก
                </button>
              </div>
            </section>
          </div>
        )}
        {discardLimitConfirming && (
          <div className="modal-backdrop">
            <section className="card-detail local-target-picker">
              <h2>ยืนยันการทิ้งไพ่</h2>
              <ul className="local-discard-confirm-list">
                {discardLimitSelected.map((id) => {
                  const c = myPlayer?.hand.find((x) => x.id === id);
                  return c ? (
                    <li key={id}>
                      <b>{c.name}</b>{" "}
                      <small>
                        {c.number}
                        {suitTx(c.suit)}
                      </small>
                    </li>
                  ) : null;
                })}
              </ul>
              <div className="mock-response-actions">
                <button
                  onClick={() => {
                    emit("hand:discard", { cardIds: discardLimitSelected });
                    setDiscardLimitSelected([]);
                    setDiscardLimitConfirming(false);
                  }}
                >
                  ยืนยัน ทิ้งไพ่
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => setDiscardLimitConfirming(false)}
                >
                  กลับไปเลือกใหม่
                </button>
              </div>
            </section>
          </div>
        )}

        {showRole && myPlayer?.role && (
          <div className="modal-backdrop" onClick={() => setShowRole(false)}>
            <section
              className="role-reveal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setShowRole(false)}
              >
                ×
              </button>
              <small>บทบาทของคุณ</small>
              <h2>
                {myRoleInfo?.role_th ||
                  ROLE_LABEL[myPlayer.role] ||
                  myPlayer.role}
              </h2>
              <p>{myRoleInfo?.win_condition_th || ""}</p>
            </section>
          </div>
        )}
        {skillsCharacter && (
          <div
            className="modal-backdrop"
            onClick={() => setSkillsCharacter(undefined)}
          >
            <section
              className="local-skills-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setSkillsCharacter(undefined)}
              >
                ×
              </button>
              <h2>{skillsCharacter.name}</h2>
              <p className="local-skills-faction">
                {skillsCharacter.kingdomTh || "—"} · HP {skillsCharacter.hp}
              </p>
              {game.characterSkillKeys?.[skillsCharacter.id]?.length && (
                <p className="local-skill-live">⚙ ทักษะทำงานในระบบแล้ว</p>
              )}
              {skillsCharacter.skills.length ? (
                <ul className="local-skills-list">
                  {skillsCharacter.skills.map((s) => (
                    <li key={s.name}>
                      <b>{s.name}</b>
                      <p>{s.description}</p>
                      {s.condition && (
                        <small className="local-skill-condition">
                          {s.condition}
                        </small>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="local-skills-empty">ไม่มีทักษะพิเศษ</p>
              )}
            </section>
          </div>
        )}
        <CardDetailModal
          card={detailCard}
          onClose={() => setDetailCard(undefined)}
        />
        <DropZoneModal
          open={showDropZone}
          onClose={() => setShowDropZone(false)}
          discard={game.discard}
          nameTip={nameTip}
          setNameTip={setNameTip}
          onOpenDetail={setDetailCard}
        />
        {pendingPlay &&
          (() => {
            const cid =
              typeof pendingPlay.data?.cardId === "string"
                ? (pendingPlay.data.cardId as string)
                : undefined;
            const card = cid
              ? myPlayer?.hand.find((c) => c.id === cid)
              : undefined;
            const tid =
              typeof pendingPlay.data?.targetId === "string"
                ? (pendingPlay.data.targetId as string)
                : undefined;
            const target = tid
              ? game.players.find((p) => p.id === tid)
              : undefined;
            return (
              <div
                className="modal-backdrop modal-top"
                onClick={cancelPendingPlay}
              >
                <section
                  className="card-detail local-target-picker play-confirm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2>ยืนยันการเล่นการ์ด?</h2>
                  {card ? (
                    <div
                      className={`play-confirm-card local-suit-${suitColor(card.suit)}`}
                    >
                      <span className="card-rank">
                        {card.number} {suitTx(card.suit)}
                      </span>
                      <b>{card.name}</b>
                    </div>
                  ) : (
                    <p>คุณกำลังจะเล่นการ์ด</p>
                  )}
                  {target && (
                    <p className="play-confirm-target">
                      🎯 เป้าหมาย: <b>{charName(target)}</b>
                    </p>
                  )}
                  <div className="mock-response-actions">
                    <button onClick={confirmPendingPlay}>✓ ยืนยัน</button>
                    <button className="danger" onClick={cancelPendingPlay}>
                      ✕ ยกเลิก
                    </button>
                  </div>
                </section>
              </div>
            );
          })()}
        {equipConfirmCard && (
          <div
            className="modal-backdrop"
            onClick={() => setEquipConfirmCard(undefined)}
          >
            <section
              className="card-detail local-target-picker"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>ติดตั้งอุปกรณ์?</h2>
              <p>
                <b>{equipConfirmCard.name}</b>{" "}
                <small>
                  ({equipConfirmCard.number}
                  {suitTx(equipConfirmCard.suit)})
                </small>
              </p>
              <p>
                {cardInfo(equipConfirmCard)?.desc ||
                  equipConfirmCard.description ||
                  equipConfirmCard.type}
              </p>
              {(() => {
                const slot = equipConfirmCard.equipmentSlot;
                const slotKey =
                  slot === "weapon"
                    ? "weapon"
                    : slot === "armor"
                      ? "armor"
                      : slot?.includes("offensive")
                        ? "offensiveMount"
                        : slot?.includes("defensive")
                          ? "defensiveMount"
                          : undefined;
                const current = slotKey
                  ? myPlayer?.equipment[slotKey as keyof EquipmentSlots]
                  : undefined;
                return current ? (
                  <p className="local-equip-replace">
                    จะแทนที่ <b>{current.name}</b> ที่ติดตั้งอยู่
                    (ทิ้งลงกองทิ้ง)
                  </p>
                ) : null;
              })()}
              <div className="mock-response-actions">
                <button
                  onClick={() => {
                    // This modal is itself the confirmation for equipment — bypass the
                    // Card Play Confirmation gate so it isn't asked twice.
                    emitNow("card:play", { cardId: equipConfirmCard.id });
                    setEquipConfirmCard(undefined);
                  }}
                >
                  ยืนยันติดตั้ง
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => setEquipConfirmCard(undefined)}
                >
                  ยกเลิก
                </button>
              </div>
            </section>
          </div>
        )}
        {lightningStrike && (
          <div className="local-lightning" aria-hidden="true">
            <div className="local-lightning-flash" />
            <svg
              className="local-lightning-bolt"
              viewBox="0 0 200 400"
              preserveAspectRatio="xMidYMid meet"
            >
              <polyline points="112,0 78,148 122,158 66,286 104,292 52,400" />
              <polyline
                className="local-lightning-branch"
                points="78,148 36,208"
              />
              <polyline
                className="local-lightning-branch"
                points="104,292 146,332"
              />
            </svg>
          </div>
        )}
        {judgmentBanner &&
          (() => {
            const jp = game.players.find(
              (p) => p.id === judgmentBanner.playerId,
            );
            return (
              <div className="local-judgment-banner" role="status">
                <span className="local-judgment-title">
                  ⚖ การตัดสิน — {judgmentBanner.trickName}
                </span>
                <div className="local-judgment-card">
                  <span>
                    {judgmentBanner.cardNumber}{" "}
                    {suitTx(judgmentBanner.cardSuit)}
                  </span>
                  <b>{judgmentBanner.cardName}</b>
                </div>
                <span className="local-judgment-result">
                  {charName(jp)}: {judgmentBanner.result}
                </span>
              </div>
            );
          })()}
        {criticalCountdown && (
          <>
            <div className="local-critical-vignette" aria-hidden="true" />
            <div className="local-critical-countdown" role="alert">
              <span className="local-critical-label">⚠ ตัดสินใจด่วน!</span>
              <span className="local-critical-num">{secondsLeft}</span>
            </div>
          </>
        )}
        {turnBanner && (
          <div
            className="local-turn-banner"
            role="status"
            aria-live="assertive"
            onClick={() => setTurnBanner(false)}
          >
            <span className="local-turn-banner-icon">⚔</span>
            <b>ถึงตาคุณแล้ว!</b>
            <span className="local-turn-banner-sub">เริ่มเทิร์นของคุณ</span>
          </div>
        )}
        {autoEndBanner && (
          <div
            className="local-autoend-banner"
            role="status"
            aria-live="polite"
          >
            <span className="local-autoend-icon">⏭</span>
            <span>จบเทิร์นอัตโนมัติ (ไม่มีการ์ด/ทักษะให้ใช้)</span>
          </div>
        )}
        {tableBanner && (
          <div className="local-table-flash" role="status">
            <span className="local-table-flash-icon">{tableBanner.icon}</span>
            <div className="local-table-flash-body">
              <b>{tableBanner.title}</b>
              {tableBanner.detail && <span>{tableBanner.detail}</span>}
            </div>
            {tableBanner.card && (
              <div
                className={`local-judgment-card local-suit-${suitColor(tableBanner.card.suit)}`}
              >
                <span>
                  {tableBanner.card.number} {suitTx(tableBanner.card.suit)}
                </span>
                <b>{tableBanner.card.name}</b>
              </div>
            )}
          </div>
        )}
        {startCountdown !== null && (
          <div
            className="local-countdown-overlay"
            onClick={() => setStartCountdown(null)}
          >
            <span className="local-countdown-num" key={startCountdown}>
              {startCountdown > 0 ? startCountdown : "เริ่ม!"}
            </span>
          </div>
        )}
        {game.startDeadline && startSecondsLeft !== null && (
          <div className="local-countdown-overlay">
            <div className="local-start-count">
              <span className="local-countdown-num" key={startSecondsLeft}>
                {startSecondsLeft > 0 ? startSecondsLeft : "เริ่ม!"}
              </span>
              <p>⚔ เกมกำลังจะเริ่ม…</p>
              {isHost && (
                <button
                  className="danger"
                  onClick={() => emit("game:cancel-start")}
                >
                  ✕ ยกเลิกการเริ่มเกม
                </button>
              )}
            </div>
          </div>
        )}
        {confirmStart && (
          <div
            className="modal-backdrop"
            onClick={() => setConfirmStart(false)}
          >
            <section
              className="card-detail local-target-picker"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>เริ่มเกม?</h2>
              <p>
                ผู้เล่น {game.players.length} คนพร้อมแล้ว — จะเริ่มนับถอยหลัง 5
                วินาทีเข้าสู่เกม
              </p>
              <div className="mock-response-actions">
                <button
                  onClick={() => {
                    emit("game:start");
                    setConfirmStart(false);
                  }}
                >
                  ยืนยัน เริ่มเลย
                </button>
                <button
                  className="mock-muted-button"
                  onClick={() => setConfirmStart(false)}
                >
                  ยกเลิก
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    </>
  );
}
