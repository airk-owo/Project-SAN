import type { ReactNode, RefObject } from "react";
import type { Game } from "../app/lib/gameTypes";

type ChatMessage = { id: string; username: string; text: string; at: string };

type Props = {
  tab: "log" | "chat";
  onTabChange: (tab: "log" | "chat") => void;
  onClose: () => void;
  log: Game["log"];
  renderLog: (message: string) => ReactNode;
  logEndRef: RefObject<HTMLDivElement | null>;
  chat: ChatMessage[];
  chatEndRef: RefObject<HTMLDivElement | null>;
  chatText: string;
  onChatTextChange: (value: string) => void;
  onSendChat: (text: string) => void;
};

// Log/chat panel content — opened from the navbar (top-right overlay so it never covers the hand).
// Kept as a real component that receives its state via props (never remounts on keystroke,
// so the chat input keeps focus).
export function LogChatPanel({
  tab,
  onTabChange,
  onClose,
  log,
  renderLog,
  logEndRef,
  chat,
  chatEndRef,
  chatText,
  onChatTextChange,
  onSendChat,
}: Props) {
  return (
    <section className="mock-log local-navpanel">
      <h2 className="local-tab-bar">
        <button
          className={`local-tab${tab === "log" ? " local-tab-active" : ""}`}
          onClick={() => onTabChange("log")}
        >
          บันทึก
        </button>
        <button
          className={`local-tab${tab === "chat" ? " local-tab-active" : ""}`}
          onClick={() => onTabChange("chat")}
        >
          แชท
        </button>
        <button className="local-chat-collapse" onClick={onClose} title="ปิด">
          ✕
        </button>
      </h2>
      {tab === "log" ? (
        <div className="local-log-scroll">
          {log.map((l) => (
            <p key={l.id}>
              <time>{l.at.slice(11, 16) || l.at}</time>
              <span className="local-log-text">{renderLog(l.message)}</span>
            </p>
          ))}
          <div ref={logEndRef} />
        </div>
      ) : (
        <div className="local-chat-scroll">
          {chat.map((m) => (
            <p key={m.id}>
              <time>{m.at?.slice(11, 16) || ""}</time>
              <span className="local-log-text">
                <b>{m.username}:</b> {m.text}
              </span>
            </p>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}
      {tab === "chat" && (
        <form
          className="local-chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (chatText.trim()) {
              onSendChat(chatText);
              onChatTextChange("");
            }
          }}
        >
          <input
            className="local-chat-input"
            value={chatText}
            onChange={(e) => onChatTextChange(e.target.value)}
            placeholder="พิมพ์ข้อความ…"
            maxLength={200}
          />
          <button type="submit" disabled={!chatText.trim()}>
            ส่ง
          </button>
        </form>
      )}
    </section>
  );
}
