"use client";
import { notFound } from "next/navigation";
import { AUTH_ENABLED } from "../../lib/flags";
import { useAuth } from "../../lib/useAuth";

export default function LoginPage() {
  const { session, signIn } = useAuth();
  if (!AUTH_ENABLED) notFound(); // feature off → this page does not exist

  return (
    <main className="lobby">
      <h1 className="game-title">ยุทธพิชัยสามก๊ก</h1>
      <p>
        เข้าสู่ระบบด้วย Google เพื่อบันทึกสถิติการรบของท่านแม่ทัพ —
        ไม่บังคับ จะร่วมรบแบบไร้นามก็ได้เช่นกัน
      </p>
      {session ? (
        <p>
          เข้าสู่ระบบแล้ว · <a href="/profile">ดูโปรไฟล์</a>
        </p>
      ) : (
        <button onClick={signIn}>เข้าสู่ระบบด้วย Google</button>
      )}
      <p>
        <a href="/">← กลับสู่ Lobby</a>
      </p>
    </main>
  );
}
