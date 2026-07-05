"use client";
// QA God Mode panel — floating, draggable, collapsible dev tool driving the server's
// dev:* sandbox handlers (hot-seat, spawn, morph, timers, rigging, snapshots).
// Renders nothing in production; the server also refuses to register dev handlers there,
// so this UI is inert even if a production bundle somehow shipped it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { Card, Character, Game } from "../app/lib/gameTypes";

type Props = { game: Game; gameId: string; socket: Socket };
type QaTab = "spawn" | "flow" | "rig" | "snap";

const SOCKET_BASE =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;

// Searchable pick list shared by the card and character selectors.
function PickList<T extends { id: string }>({
  items,
  selectedId,
  onPick,
  toLabel,
  placeholder,
}: {
  items: T[] | null;
  selectedId?: string;
  onPick: (item: T) => void;
  toLabel: (item: T) => string;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const matched = q
      ? items.filter(
          (item) =>
            toLabel(item).toLowerCase().includes(q) ||
            item.id.toLowerCase().includes(q),
        )
      : items;
    return matched.slice(0, 40);
  }, [items, query, toLabel]);
  return (
    <div className="qa-pick">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
      <div className="qa-list">
        {!items && <span className="qa-empty">กำลังโหลด catalog…</span>}
        {items && !shown.length && (
          <span className="qa-empty">ไม่พบรายการ</span>
        )}
        {shown.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`qa-item${item.id === selectedId ? " sel" : ""}`}
            onClick={() => onPick(item)}
          >
            {toLabel(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DebugSandboxPanel({ game, gameId, socket }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<QaTab>("spawn");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [chars, setChars] = useState<Character[] | null>(null);
  const [targetId, setTargetId] = useState("");
  const [spawnCardId, setSpawnCardId] = useState("");
  const [morphCharId, setMorphCharId] = useState("");
  const [rigCardId, setRigCardId] = useState("");
  const [rigSuit, setRigSuit] = useState<(typeof SUITS)[number]>("♠");
  const [rigRank, setRigRank] = useState<(typeof RANKS)[number]>("A");
  const [frozen, setFrozen] = useState(false);
  const [dummy, setDummy] = useState(false);
  const [snapText, setSnapText] = useState("");
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);

  const flash = useCallback((text: string, ok = true) => {
    setNote({ text, ok });
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 3000);
  }, []);

  // Restore panel open state + position from the previous QA session.
  useEffect(() => {
    setOpen(localStorage.getItem("wtk-qa-open") === "1");
    try {
      const stored = localStorage.getItem("wtk-qa-pos");
      if (stored) setPos(JSON.parse(stored) as { x: number; y: number });
    } catch {
      /* ignore a corrupt stored position */
    }
    return () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("wtk-qa-open", open ? "1" : "0");
  }, [open]);
  useEffect(() => {
    if (pos) localStorage.setItem("wtk-qa-pos", JSON.stringify(pos));
  }, [pos]);

  // Lazy-load full catalogues the first time the panel opens (same endpoints as the encyclopedia).
  useEffect(() => {
    if (!open || cards) return;
    fetch(`${SOCKET_BASE}/cards`)
      .then((r) => r.json())
      .then((c: Card[]) => setCards(Array.isArray(c) ? c : []))
      .catch(() => {
        setCards([]);
        flash("✗ โหลด card catalog ไม่สำเร็จ", false);
      });
    fetch(`${SOCKET_BASE}/characters`)
      .then((r) => r.json())
      .then((c: Character[]) => setChars(Array.isArray(c) ? c : []))
      .catch(() => {
        setChars([]);
        flash("✗ โหลด character catalog ไม่สำเร็จ", false);
      });
  }, [open, cards, flash]);

  // Surface server rejections inline so the tester sees them next to the buttons.
  useEffect(() => {
    if (!open) return;
    const onError = (message: string) => flash(`✗ ${message}`, false);
    socket.on("game:error", onError);
    return () => {
      socket.off("game:error", onError);
    };
  }, [open, socket, flash]);

  const players = useMemo(
    () => [...game.players].sort((a, b) => a.seatIndex - b.seatIndex),
    [game.players],
  );
  const target =
    players.find((p) => p.id === targetId) ??
    players.find((p) => p.id === game.viewerId) ??
    players[0];

  const emitDev = useCallback(
    (event: string, data: Record<string, unknown> = {}) => {
      socket.emit(event, { gameId, ...data });
      flash(`→ ${event}`);
    },
    [socket, gameId, flash],
  );

  const spawn = (zone: "hand" | "equipment") => {
    if (!target) return flash("✗ ไม่มีผู้เล่นเป้าหมาย", false);
    if (!spawnCardId) return flash("✗ เลือกการ์ดก่อน", false);
    emitDev("dev:spawn-card", {
      targetPlayerId: target.id,
      card: spawnCardId,
      zone,
    });
  };
  const morph = () => {
    if (!target) return flash("✗ ไม่มีผู้เล่นเป้าหมาย", false);
    if (!morphCharId) return flash("✗ เลือกขุนพลก่อน", false);
    emitDev("dev:set-character", {
      targetPlayerId: target.id,
      character: morphCharId,
    });
  };
  const bumpHp = (delta: number) => {
    if (!target) return flash("✗ ไม่มีผู้เล่นเป้าหมาย", false);
    emitDev("dev:set-hp", {
      targetPlayerId: target.id,
      hp: (target.hp ?? target.maxHp ?? 4) + delta,
    });
  };
  const exportSnapshot = () => {
    socket.emit(
      "dev:export-snapshot",
      { gameId },
      (snapshot: unknown | null) => {
        if (!snapshot) return flash("✗ export ล้มเหลว", false);
        const json = JSON.stringify(snapshot, null, 2);
        setSnapText(json);
        if (navigator.clipboard?.writeText)
          navigator.clipboard
            .writeText(json)
            .then(() => flash("📋 คัดลอก state ลง clipboard แล้ว"))
            .catch(() =>
              flash("state อยู่ใน textarea (clipboard ถูกปฏิเสธ)"),
            );
        else flash("state อยู่ใน textarea");
      },
    );
  };
  const loadSnapshot = () => {
    if (!snapText.trim()) return flash("✗ วาง JSON ใน textarea ก่อน", false);
    try {
      emitDev("dev:load-snapshot", { snapshot: JSON.parse(snapText) });
    } catch {
      flash("✗ JSON ไม่ถูกต้อง", false);
    }
  };

  // Drag the panel by its header (pointer events cover both mouse and touch).
  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const panel = (e.currentTarget as HTMLElement).parentElement;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    const onMove = (ev: PointerEvent) => {
      const grip = dragOffset.current;
      if (!grip) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 70, ev.clientX - grip.dx)),
        y: Math.max(0, Math.min(window.innerHeight - 36, ev.clientY - grip.dy)),
      });
    };
    const onUp = () => {
      dragOffset.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Belt-and-braces: the mount site is already dev-guarded, but never render in production.
  if (process.env.NODE_ENV === "production") return null;

  const posStyle = pos ? { top: pos.y, left: pos.x } : undefined;
  const seatBar = (
    <div className="qa-seats">
      {players.length ? (
        players.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`qa-seat${p.id === game.viewerId ? " active" : ""}${p.alive ? "" : " dead"}`}
            title={`สลับไปควบคุม ${p.username}`}
            onClick={() => emitDev("dev:switch-control", { seatIndex: p.seatIndex })}
          >
            <b>
              {p.seatIndex}·{p.username}
            </b>
            <i>
              {p.character?.name ?? "—"} {p.hp ?? "?"}/{p.maxHp ?? "?"}
            </i>
          </button>
        ))
      ) : (
        <span className="qa-empty">ยังไม่มีผู้เล่นนั่งประจำที่</span>
      )}
    </div>
  );

  return (
    <>
      {!open && (
        <button
          type="button"
          className="qa-fab"
          style={posStyle}
          onClick={() => setOpen(true)}
          title="เปิด QA God Mode"
        >
          🛠 QA
        </button>
      )}
      {open && (
        <section className="qa-panel" style={posStyle}>
          <div className="qa-head" onPointerDown={onDragStart}>
            <span className="qa-title">🛠 QA GOD MODE</span>
            <span className="qa-phase">{game.phase}</span>
            <button
              type="button"
              className="qa-close"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setOpen(false)}
              title="ย่อเก็บ"
            >
              ─
            </button>
          </div>
          <div className="qa-body">
            <div className="qa-section-label">HOT-SEAT — คลิกเพื่อสลับที่นั่ง</div>
            {seatBar}
            <div className="qa-tabs">
              {(
                [
                  ["spawn", "🃏 Spawn"],
                  ["flow", "⏱ Flow"],
                  ["rig", "🎲 Rig"],
                  ["snap", "💾 Snap"],
                ] as [QaTab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`qa-tab${tab === key ? " active" : ""}`}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "spawn" && (
              <>
                <div className="qa-row">
                  <label>เป้าหมาย</label>
                  <select
                    value={target?.id ?? ""}
                    onChange={(e) => setTargetId(e.target.value)}
                  >
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.seatIndex}. {p.username}
                        {p.character ? ` — ${p.character.name}` : ""}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="qa-btn" onClick={() => bumpHp(1)}>
                    +1 HP
                  </button>
                  <button
                    type="button"
                    className="qa-btn warn"
                    onClick={() => bumpHp(-1)}
                  >
                    −1 HP
                  </button>
                </div>
                <div className="qa-section-label">การ์ด</div>
                <PickList
                  items={cards}
                  selectedId={spawnCardId}
                  onPick={(c) => setSpawnCardId(c.id)}
                  toLabel={(c) =>
                    `${c.name}${c.oldName ? ` / ${c.oldName}` : ""} · ${c.number}${c.suit}`
                  }
                  placeholder="ค้นหาการ์ด (ชื่อ / id)…"
                />
                <div className="qa-row">
                  <button type="button" className="qa-btn" onClick={() => spawn("hand")}>
                    ✋ Spawn to Hand
                  </button>
                  <button
                    type="button"
                    className="qa-btn"
                    onClick={() => spawn("equipment")}
                  >
                    🛡 Equip Direct
                  </button>
                </div>
                <div className="qa-section-label">ขุนพล</div>
                <PickList
                  items={chars}
                  selectedId={morphCharId}
                  onPick={(c) => setMorphCharId(c.id)}
                  toLabel={(c) => `${c.name} · HP ${c.hp}`}
                  placeholder="ค้นหาขุนพล (ชื่อ / id)…"
                />
                <div className="qa-row">
                  <button type="button" className="qa-btn" onClick={morph}>
                    🎭 Morph Character
                  </button>
                </div>
              </>
            )}
            {tab === "flow" && (
              <>
                <label className="qa-toggle">
                  <input
                    type="checkbox"
                    className="qa-switch"
                    checked={frozen}
                    onChange={() => {
                      const next = !frozen;
                      setFrozen(next);
                      emitDev("dev:toggle-freeze-timer", { frozen: next });
                    }}
                  />
                  <span>
                    ⏸️ Freeze Timer — หยุดนาฬิกา response/start
                    ทั้งหมดระหว่างคิดหรือสลับที่นั่ง
                  </span>
                </label>
                <label className="qa-toggle">
                  <input
                    type="checkbox"
                    className="qa-switch"
                    checked={dummy}
                    onChange={() => {
                      const next = !dummy;
                      setDummy(next);
                      emitDev("dev:set-dummy-mode", { enabled: next });
                    }}
                  />
                  <span>
                    🤖 Dummy Auto-Pass —
                    ที่นั่งที่ไม่ได้ควบคุมจะปฏิเสธ/รับดาเมจ/จบเทิร์นอัตโนมัติ
                  </span>
                </label>
                <p className="qa-hint">
                  สถานะ toggle เป็น optimistic ฝั่ง client — ถ้า reload หน้า
                  ให้กดซ้ำเพื่อ sync กับเซิร์ฟเวอร์
                </p>
              </>
            )}
            {tab === "rig" && (
              <>
                <div className="qa-section-label">วางการ์ดบนสุดกองจั่ว</div>
                <PickList
                  items={cards}
                  selectedId={rigCardId}
                  onPick={(c) => setRigCardId(c.id)}
                  toLabel={(c) =>
                    `${c.name}${c.oldName ? ` / ${c.oldName}` : ""} · ${c.number}${c.suit}`
                  }
                  placeholder="ค้นหาการ์ด (ชื่อ / id)…"
                />
                <div className="qa-row">
                  <button
                    type="button"
                    className="qa-btn"
                    onClick={() =>
                      rigCardId
                        ? emitDev("dev:insert-top-deck", { card: rigCardId })
                        : flash("✗ เลือกการ์ดก่อน", false)
                    }
                  >
                    ⬆️ Put Card on Top Deck
                  </button>
                </div>
                <div className="qa-section-label">
                  ล็อกผลตัดสินถัดไป (ฟ้าลงโทษ / มีสุขลืมเมือง / กุยแก ฯลฯ)
                </div>
                <div className="qa-row">
                  <select
                    value={rigSuit}
                    onChange={(e) =>
                      setRigSuit(e.target.value as (typeof SUITS)[number])
                    }
                  >
                    {SUITS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    value={rigRank}
                    onChange={(e) =>
                      setRigRank(e.target.value as (typeof RANKS)[number])
                    }
                  >
                    {RANKS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="qa-btn"
                    onClick={() =>
                      emitDev("dev:force-judgment", {
                        suit: rigSuit,
                        rank: rigRank,
                      })
                    }
                  >
                    ⚖️ Rig Next Judgment
                  </button>
                </div>
              </>
            )}
            {tab === "snap" && (
              <>
                <div className="qa-row">
                  <button type="button" className="qa-btn" onClick={exportSnapshot}>
                    📋 Export State JSON
                  </button>
                  <button type="button" className="qa-btn warn" onClick={loadSnapshot}>
                    📥 Load State JSON
                  </button>
                </div>
                <textarea
                  value={snapText}
                  onChange={(e) => setSnapText(e.target.value)}
                  rows={8}
                  placeholder="Export จะเติม JSON ที่นี่ / วาง snapshot แล้วกด Load"
                  spellCheck={false}
                />
              </>
            )}
          </div>
          <div className={`qa-note${note && !note.ok ? " err" : ""}`}>
            {note?.text ?? " "}
          </div>
        </section>
      )}
      <style>{`
        .qa-fab{position:fixed;top:64px;left:10px;z-index:380;padding:6px 12px;border-radius:8px;cursor:pointer;
          background:rgba(4,14,7,.92);color:#39ff14;border:1px solid #39ff14;box-shadow:0 0 10px rgba(57,255,20,.45);
          font-family:Consolas,'Courier New',monospace;font-size:13px;font-weight:700;}
        .qa-fab:hover{box-shadow:0 0 16px rgba(57,255,20,.8);}
        .qa-panel{position:fixed;top:64px;left:10px;z-index:380;width:min(360px,calc(100vw - 20px));
          max-height:calc(100vh - 84px);display:flex;flex-direction:column;
          background:rgba(5,10,7,.94);border:1px solid #39ff14;border-radius:10px;
          box-shadow:0 0 18px rgba(57,255,20,.35),inset 0 0 40px rgba(57,255,20,.05);
          color:#c8ffd0;font-family:Consolas,'Courier New',monospace;font-size:12px;backdrop-filter:blur(4px);}
        .qa-head{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:grab;user-select:none;touch-action:none;
          border-bottom:1px dashed rgba(57,255,20,.4);}
        .qa-head:active{cursor:grabbing;}
        .qa-title{color:#39ff14;font-weight:700;letter-spacing:1px;text-shadow:0 0 6px rgba(57,255,20,.7);}
        .qa-phase{margin-left:auto;color:#7fe9ff;border:1px solid rgba(0,229,255,.5);border-radius:5px;padding:1px 6px;font-size:10px;}
        .qa-close{background:none;border:1px solid rgba(57,255,20,.5);color:#39ff14;border-radius:5px;
          width:22px;height:22px;line-height:1;cursor:pointer;font:inherit;}
        .qa-body{overflow-y:auto;padding:8px 10px;display:flex;flex-direction:column;gap:8px;}
        .qa-section-label{color:#00e5ff;font-size:10px;letter-spacing:1px;text-transform:uppercase;opacity:.9;}
        .qa-seats{display:flex;flex-wrap:wrap;gap:4px;}
        .qa-seat{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:3px 7px;cursor:pointer;
          background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.45);color:#7fe9ff;border-radius:6px;font:inherit;}
        .qa-seat i{font-style:normal;font-size:10px;opacity:.8;}
        .qa-seat.active{background:rgba(57,255,20,.16);border-color:#39ff14;color:#39ff14;box-shadow:0 0 8px rgba(57,255,20,.5);}
        .qa-seat.dead{opacity:.45;text-decoration:line-through;}
        .qa-tabs{display:flex;gap:4px;}
        .qa-tab{flex:1;padding:4px 2px;cursor:pointer;background:rgba(57,255,20,.05);color:#8fd8a0;
          border:1px solid rgba(57,255,20,.3);border-radius:6px;font:inherit;font-size:11px;}
        .qa-tab.active{background:rgba(57,255,20,.18);color:#39ff14;border-color:#39ff14;}
        .qa-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
        .qa-row label{color:#8fd8a0;}
        .qa-panel input,.qa-panel select,.qa-panel textarea{background:#03110a;color:#aef7bd;
          border:1px solid rgba(57,255,20,.4);border-radius:5px;padding:4px 6px;font:inherit;max-width:100%;}
        .qa-panel textarea{resize:vertical;width:100%;box-sizing:border-box;}
        .qa-pick{display:flex;flex-direction:column;gap:4px;}
        .qa-pick input{width:100%;box-sizing:border-box;}
        .qa-list{max-height:132px;overflow-y:auto;border:1px solid rgba(57,255,20,.25);border-radius:6px;}
        .qa-item{display:block;width:100%;text-align:left;padding:3px 6px;background:none;border:none;
          color:#c8ffd0;cursor:pointer;font:inherit;}
        .qa-item:hover{background:rgba(0,229,255,.12);}
        .qa-item.sel{background:rgba(57,255,20,.2);color:#39ff14;}
        .qa-empty{display:block;padding:6px;color:#5f8f6c;}
        .qa-btn{padding:4px 9px;cursor:pointer;background:rgba(57,255,20,.12);border:1px solid #39ff14;
          color:#39ff14;border-radius:6px;font:inherit;}
        .qa-btn:hover{box-shadow:0 0 8px rgba(57,255,20,.6);}
        .qa-btn.warn{border-color:#ff9800;color:#ffb74d;background:rgba(255,152,0,.1);}
        .qa-btn.warn:hover{box-shadow:0 0 8px rgba(255,152,0,.6);}
        .qa-toggle{display:flex;gap:8px;align-items:flex-start;cursor:pointer;}
        .qa-switch{appearance:none;flex:0 0 34px;width:34px;height:18px;margin-top:1px;position:relative;cursor:pointer;
          background:#0a2012;border:1px solid rgba(57,255,20,.5);border-radius:10px;transition:background .15s;}
        .qa-switch::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;
          background:#39ff14;transition:left .15s;}
        .qa-switch:checked{background:rgba(57,255,20,.35);}
        .qa-switch:checked::after{left:18px;}
        .qa-hint{margin:0;color:#5f8f6c;font-size:10px;}
        .qa-note{min-height:22px;padding:4px 10px;border-top:1px dashed rgba(57,255,20,.4);color:#39ff14;}
        .qa-note.err{color:#ff6e6e;}
      `}</style>
    </>
  );
}
