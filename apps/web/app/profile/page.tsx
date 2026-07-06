"use client";
// Player stats page — reachable only when NEXT_PUBLIC_FEATURE_AUTH=1. Read-only:
// everything here is anon-key SELECTs; stats are written solely by the game server.
// Minimal on purpose; polish when the feature ships.
import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { AUTH_ENABLED } from "../../lib/flags";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
import { ROLE_LABEL } from "../lib/gameConstants";

type CharRow = {
  character_id: string;
  character_name: string | null;
  games: number;
  wins: number;
};
type FactionRow = { faction: string; games: number; wins: number };
type RecentRow = {
  role: string | null;
  character_id: string | null;
  faction: string | null;
  won: boolean | null;
  survived: boolean | null;
  game_sessions: {
    ended_at: string | null;
    turns: number | null;
    player_count: number | null;
    duration_seconds: number | null;
  } | null;
};

const pct = (wins: number, games: number) =>
  games ? Math.round((wins / games) * 1000) / 10 : 0;

export default function ProfilePage() {
  const { session, profile, signIn } = useAuth();
  const [chars, setChars] = useState<CharRow[]>([]);
  const [factions, setFactions] = useState<FactionRow[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const authUserId = session?.user?.id;

  useEffect(() => {
    if (!AUTH_ENABLED || !supabase || !authUserId) return;
    let cancelled = false;
    supabase
      .from("profile_characters")
      .select("character_id,character_name,games,wins")
      .eq("user_id", authUserId)
      .order("games", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (!cancelled) setChars((data as CharRow[]) ?? []);
      });
    supabase
      .from("profile_factions")
      .select("faction,games,wins")
      .eq("user_id", authUserId)
      .order("games", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setFactions((data as FactionRow[]) ?? []);
      });
    supabase
      .from("game_participants")
      .select(
        "role,character_id,faction,won,survived,game_sessions(ended_at,turns,player_count,duration_seconds)",
      )
      .eq("user_id", authUserId)
      .limit(30)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = ((data as unknown as RecentRow[]) ?? [])
          .slice()
          .sort((a, b) =>
            (b.game_sessions?.ended_at ?? "").localeCompare(
              a.game_sessions?.ended_at ?? "",
            ),
          )
          .slice(0, 10);
        setRecent(rows);
      });
    return () => {
      cancelled = true;
    };
  }, [authUserId]);

  if (!AUTH_ENABLED) notFound(); // feature off → this page does not exist

  if (!session)
    return (
      <main className="lobby profile-page">
        <h1 className="game-title">ประวัติแม่ทัพ</h1>
        <p>ต้องเข้าสู่ระบบก่อนจึงจะดูสถิติได้</p>
        <button onClick={signIn}>เข้าสู่ระบบด้วย Google</button>
        <p>
          <a href="/">← กลับสู่ Lobby</a>
        </p>
      </main>
    );

  const roleRows = profile
    ? ([
        ["emperor", profile.emperor_games, profile.emperor_wins],
        ["loyalist", profile.loyalist_games, profile.loyalist_wins],
        ["rebel", profile.rebel_games, profile.rebel_wins],
        ["traitor", profile.traitor_games, profile.traitor_wins],
      ] as const)
    : [];

  return (
    <main className="lobby profile-page">
      <h1 className="game-title">ประวัติแม่ทัพ</h1>
      {!profile ? (
        <p>กำลังโหลดโปรไฟล์…</p>
      ) : (
        <>
          <section className="profile-card">
            <h2>@{profile.username}</h2>
            <p className="profile-since">
              ร่วมรบตั้งแต่{" "}
              {new Date(profile.created_at).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <table>
              <tbody>
                <tr>
                  <td>เกมทั้งหมด</td>
                  <td>{profile.total_games}</td>
                </tr>
                <tr>
                  <td>ชนะ</td>
                  <td>{profile.total_wins}</td>
                </tr>
                <tr>
                  <td>อัตราชนะ</td>
                  <td>{pct(profile.total_wins, profile.total_games)}%</td>
                </tr>
                <tr>
                  <td>รอดชีวิตจนจบเกม</td>
                  <td>{profile.survived_games} ครั้ง</td>
                </tr>
                <tr>
                  <td>สตรีคชนะปัจจุบัน / สูงสุด</td>
                  <td>
                    {profile.current_win_streak} / {profile.best_win_streak}
                  </td>
                </tr>
                <tr>
                  <td>บทบาทที่เล่นบ่อยสุด</td>
                  <td>
                    {profile.most_played_role
                      ? ROLE_LABEL[profile.most_played_role] ||
                        profile.most_played_role
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td>บทบาทที่ชนะเก่งสุด (≥5 เกม)</td>
                  <td>
                    {profile.best_role
                      ? ROLE_LABEL[profile.best_role] || profile.best_role
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="profile-card">
            <h2>แยกตามบทบาท</h2>
            <table>
              <thead>
                <tr>
                  <th>บทบาท</th>
                  <th>เล่น</th>
                  <th>ชนะ</th>
                  <th>อัตราชนะ</th>
                </tr>
              </thead>
              <tbody>
                {roleRows.map(([role, games, wins]) => (
                  <tr key={role}>
                    <td>{ROLE_LABEL[role] || role}</td>
                    <td>{games}</td>
                    <td>{wins}</td>
                    <td>{pct(wins, games)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {chars.length > 0 && (
            <section className="profile-card">
              <h2>ขุนพลที่ใช้บ่อย</h2>
              <table>
                <thead>
                  <tr>
                    <th>ขุนพล</th>
                    <th>เล่น</th>
                    <th>ชนะ</th>
                    <th>อัตราชนะ</th>
                  </tr>
                </thead>
                <tbody>
                  {chars.map((c) => (
                    <tr key={c.character_id}>
                      <td>{c.character_name || c.character_id}</td>
                      <td>{c.games}</td>
                      <td>{c.wins}</td>
                      <td>{pct(c.wins, c.games)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {factions.length > 0 && (
            <section className="profile-card">
              <h2>แยกตามก๊ก</h2>
              <table>
                <thead>
                  <tr>
                    <th>ก๊ก</th>
                    <th>เล่น</th>
                    <th>ชนะ</th>
                    <th>อัตราชนะ</th>
                  </tr>
                </thead>
                <tbody>
                  {factions.map((f) => (
                    <tr key={f.faction}>
                      <td>{f.faction}</td>
                      <td>{f.games}</td>
                      <td>{f.wins}</td>
                      <td>{pct(f.wins, f.games)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {recent.length > 0 && (
            <section className="profile-card">
              <h2>ศึกล่าสุด</h2>
              <table>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>บทบาท</th>
                    <th>ผล</th>
                    <th>ผู้เล่น</th>
                    <th>เทิร์น</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr key={i}>
                      <td>
                        {r.game_sessions?.ended_at
                          ? new Date(
                              r.game_sessions.ended_at,
                            ).toLocaleDateString("th-TH")
                          : "—"}
                      </td>
                      <td>{r.role ? ROLE_LABEL[r.role] || r.role : "—"}</td>
                      <td>{r.won ? "🏆 ชนะ" : "พ่าย"}</td>
                      <td>{r.game_sessions?.player_count ?? "—"}</td>
                      <td>{r.game_sessions?.turns ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
      <p>
        <a href="/">← กลับสู่ Lobby</a>
      </p>
      {/* Scoped styles — Tailwind is inert in this app; semantic classes only. */}
      <style>{`
        .profile-page { max-width: 720px; margin: 0 auto; padding-bottom: 48px; }
        .profile-card { margin: 18px 0; padding: 14px 18px; border: 1px solid #c99a4166; border-radius: 10px; background: linear-gradient(158deg, #fdf6e3cc, #f7ecd2cc); }
        .profile-card h2 { margin: 0 0 4px; color: #7c2222; }
        .profile-since { margin: 0 0 10px; color: #a4906f; font-size: 0.85rem; }
        .profile-card table { width: 100%; border-collapse: collapse; }
        .profile-card th, .profile-card td { padding: 5px 8px; text-align: left; border-bottom: 1px solid #c99a4133; }
        .profile-card th { color: #a4906f; font-weight: 600; font-size: 0.82rem; }
        .profile-card tr:last-child td { border-bottom: none; }
        .profile-card td:not(:first-child), .profile-card th:not(:first-child) { text-align: right; }
      `}</style>
    </main>
  );
}
