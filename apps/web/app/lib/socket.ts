// Socket singleton + session-token wiring — ย้าย verbatim จาก app/page.tsx
// สำคัญ: listener "session:token" ต้องอยู่ module เดียวกับ io(...) เพื่อคง
// ลำดับการ register ตอน import ครั้งแรก (reconnect identity พึ่งค่านี้)
import { io } from "socket.io-client";
import { getAccessToken } from "../../lib/useAuth";

export const socket = io(
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001",
  { autoConnect: false },
);
// Session token: server แจก secret ผูกกับ wtk-member-id ตอน join แรก แล้วต้องแนบกลับทุกครั้งที่
// join/reconnect — กันคนอื่นสวมรอย userId เรา (callback ยิงเฉพาะฝั่ง browser จึงแตะ localStorage ได้)
const readSessionToken = () => {
  try {
    return localStorage.getItem("wtk-session-token") || undefined;
  } catch {
    return undefined;
  }
};
socket.on("session:token", ({ token }: { token?: string }) => {
  if (typeof token === "string" && token) {
    try {
      localStorage.setItem("wtk-session-token", token);
    } catch {}
  }
});
// Proactive "play a card" socket events gated by the optional Card Play Confirmation
// setting. Response-window plays (dodge/negate/heal) are intentionally excluded — they
// run under the server's response countdown, so a confirm step there could cause timeouts.
export const PLAY_CONFIRM_EVENTS = new Set([
  "card:play",
  "card:discard-target",
  "card:steal-target",
  "coerce:play",
  "attack:multi",
  "weapon:snake-attack",
  "skill:seduce",
]);
// Join a room, attaching a fresh Supabase access token when the account feature is on
// and a session exists — getAccessToken() refreshes an expired token first, so a
// reconnect mid-game still verifies. The server treats a bad/missing token as guest.
export const emitRoomJoin = (
  gameId: string,
  username: string,
  userId: string,
  withToken: boolean,
) => {
  const payload = { gameId, username, userId, sessionToken: readSessionToken() };
  if (withToken) {
    void getAccessToken().then((token) =>
      socket.emit("room:join", token ? { ...payload, accessToken: token } : payload),
    );
  } else {
    socket.emit("room:join", payload);
  }
};
