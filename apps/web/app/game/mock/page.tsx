import type { CSSProperties } from 'react';

interface PlayerIdentity {
  userId: string;
  username: string;
  displayName?: string;
  characterName: string;
}

type MockPlayer = PlayerIdentity & {
  id: string;
  hp: number;
  maxHp: number;
  handCount: number;
  weapon?: string;
  armor?: string;
  offensiveMount?: string;
  defensiveMount?: string;
  seat: number;
  role?: string;
  isCurrentTurn?: boolean;
};

type MockCard = { name: string; suit: string; number: string; type: string; accent: 'red' | 'gold' | 'blue' };

const currentPlayerId = 'liu-bei';
const players: MockPlayer[] = [
  { id: 'cao-cao', userId: '101', username: 'caocao_player', characterName: 'โจโฉ', hp: 3, maxHp: 4, handCount: 4, weapon: 'กระบี่ชิงกัง', offensiveMount: 'ม้าศึก', seat: 2, isCurrentTurn: true },
  { id: 'sun-quan', userId: '102', username: 'sunquan', characterName: 'ซุนกวน', hp: 4, maxHp: 4, handCount: 3, armor: 'ค่ายกลแปดทิศ', defensiveMount: 'ม้านั่ง', seat: 3 },
  { id: 'zhao-yun', userId: '103', username: 'zhaoyun_main', characterName: 'จูล่ง', hp: 3, maxHp: 4, handCount: 5, weapon: 'หอกมังกรเงิน', seat: 4 },
  { id: currentPlayerId, userId: '123', username: 'pakitta', displayName: 'Pakitta', characterName: 'เล่าปี่', hp: 4, maxHp: 4, handCount: 5, weapon: 'ง้าวมังกรเขียว', armor: 'ค่ายกลแปดทิศ', seat: 1, role: 'จักรพรรดิ' },
];

const hand: MockCard[] = [
  { name: 'โจมตี', suit: '♥', number: '7', type: 'ไพ่พื้นฐาน', accent: 'red' },
  { name: 'หลบ', suit: '♠', number: '2', type: 'ไพ่พื้นฐาน', accent: 'blue' },
  { name: 'เสบียง', suit: '♦', number: '9', type: 'ไพ่พื้นฐาน', accent: 'gold' },
  { name: 'โจมตี', suit: '♣', number: 'K', type: 'ไพ่พื้นฐาน', accent: 'red' },
  { name: 'ง้าวมังกรเขียว', suit: '♠', number: '5', type: 'อาวุธ', accent: 'gold' },
];

const logs = [
  ['20:10', 'เริ่มเกมแล้ว'], ['20:11', 'แจกบทบาทให้ผู้เล่นแล้ว'], ['20:12', 'เล่าปี่ เลือกขุนพล'],
  ['20:13', 'โจโฉ ติดตั้ง กระบี่ชิงกัง'], ['20:14', 'โจโฉ ใช้ โจมตี ใส่ เล่าปี่'],
  ['20:15', 'เล่าปี่ ใช้ หลบ'], ['20:16', 'ซุนกวน ติดตั้ง ค่ายกลแปดทิศ'],
  ['20:17', 'จูล่ง จั่วไพ่ 2 ใบ'], ['20:18', 'เล่าปี่ เริ่มเทิร์น'],
];

const chatMessages = [
  ['pakitta', 'ขอคิดก่อนนะ'],
  ['sunquan', 'พร้อมแล้ว'],
  ['caocao_player', 'ใช้หลบไหม?'],
];

function Hearts({ hp, maxHp }: Pick<MockPlayer, 'hp' | 'maxHp'>) {
  return <span className="mock-hearts" aria-label={`พลังชีวิต ${hp} จาก ${maxHp}`}>{'♥'.repeat(hp)}<i>{'♥'.repeat(maxHp - hp)}</i></span>;
}

function EquipmentSlot({ icon, label, item }: { icon: string; label: string; item?: string }) {
  return <span className={`mock-equipment-slot ${item ? 'equipped' : ''}`} title={item ?? `${label}: ว่าง`}><i>{icon}</i><em>{label}</em><b>{item ?? '—'}</b></span>;
}

function PlayerPanel({ player, distance, current }: { player: MockPlayer; distance: number; current?: boolean }) {
  return <article className={`mock-player ${current ? 'mock-self' : ''} ${player.isCurrentTurn ? 'mock-active-turn' : ''}`}>
    {player.isCurrentTurn && <span className="mock-turn-badge">กำลังเล่น</span>}
    <div className="mock-portrait" aria-hidden="true">{player.characterName.slice(0, 1)}</div>
    <div className="mock-player-content">
      <b>{player.characterName}</b>
      <small className="mock-username">@{player.username}</small>
      <Hearts hp={player.hp} maxHp={player.maxHp} />
      <span className="mock-hand-count">🂠 × {player.handCount}</span>
      <small className="mock-debug">Seat {player.seat} · Distance {distance}</small>
      {player.role && <small className="mock-role">บทบาท: {player.role}</small>}
      <div className="mock-equipment" aria-label="อุปกรณ์">
        <EquipmentSlot icon="🗡" label="อาวุธ" item={player.weapon} />
        <EquipmentSlot icon="🛡" label="เกราะ" item={player.armor} />
        <EquipmentSlot icon="🐎−" label="ม้ารุก" item={player.offensiveMount} />
        <EquipmentSlot icon="🐎+" label="ม้ารับ" item={player.defensiveMount} />
      </div>
    </div>
  </article>;
}

function HandCard({ card }: { card: MockCard }) {
  return <article className={`mock-card mock-card-${card.accent}`}>
    <header><span>{card.number}</span><span>{card.suit}</span></header><div className="mock-card-art">WTK</div><b>{card.name}</b><small>{card.type}</small>
  </article>;
}

function getTableEdgePosition(index: number, opponentCount: number) {
  const layouts: Record<number, Array<[number, number]>> = {
    3: [[50, 1], [1, 50], [99, 50]],
    5: [[25, 1], [50, 1], [75, 1], [1, 50], [99, 50]],
    7: [[20, 1], [50, 1], [80, 1], [1, 33], [1, 67], [99, 33], [99, 67]],
    9: [[12, 1], [31, 1], [50, 1], [69, 1], [88, 1], [1, 33], [1, 67], [99, 33], [99, 67]],
  };
  const [left, top] = layouts[opponentCount]?.[index] ?? [50, 1];
  return { left: `${left}%`, top: `${top}%` };
}

function getDensity(playerCount: number) {
  if (playerCount <= 4) return 'large';
  if (playerCount <= 6) return 'medium';
  if (playerCount <= 8) return 'small';
  return 'compact';
}

export default function MockGamePage() {
  const currentPlayer = players.find(player => player.id === currentPlayerId)!;
  const opponents = players.filter(player => player.id !== currentPlayerId);
  const density = getDensity(players.length);

  return <main className={`mock-game-page mock-count-${players.length}`}>
    <header className="mock-game-header"><div><small>ตัวอย่างหน้าจอเกม</small><h1>ยุทธพิชัยสามก๊ก</h1></div><p>รอบที่ 6 · ทวนเข็มนาฬิกา</p></header>

    <section className="mock-match-layout">
      <aside className="mock-side-panels">
        <section className="mock-log" aria-label="บันทึกเกม"><h2>บันทึกการเล่น <small>ซ่อน⌃</small></h2><div>{logs.map(([time, log]) => <p key={`${time}-${log}`}><time>{time}</time>{log}</p>)}</div></section>
        <section className="mock-chat" aria-label="แชทตัวอย่าง"><h2>แชท</h2><div>{chatMessages.map(([username, message]) => <p key={`${username}-${message}`}><b>{username}:</b> {message}</p>)}</div></section>
      </aside>
      <section className="mock-table-stage" data-density={density} aria-label="โต๊ะเกมตัวอย่าง">
        <div className="mock-table-surface">
          <div className="mock-table-pattern" aria-hidden="true">三國</div>
          <section className="mock-piles" aria-label="กองไพ่">
            <article className="mock-pile"><div className="mock-deck">🂠</div><b>กองจั่ว</b><small>42 ใบ</small></article>
            <article className="mock-pile"><div className="mock-discard">เสบียง<br /><span>♦ 9</span></div><b>กองทิ้ง</b><small>18 ใบ</small></article>
          </section>
          <section className="mock-action" aria-label="การกระทำปัจจุบัน"><small>การกระทำปัจจุบัน</small><p><b>โจโฉ</b> ใช้ <b>โจมตี</b> ใส่ <b>เล่าปี่</b></p><article className="mock-action-card"><span>7 ♥</span><strong>โจมตี</strong><em>Attack</em></article></section>
        </div>
        {opponents.map((player, index) => {
        const position = getTableEdgePosition(index, opponents.length);
        const style = { '--seat-x': position.left, '--seat-y': position.top } as CSSProperties;
        return <div key={player.id} className="mock-opponent" style={style}><PlayerPanel player={player} distance={Math.min(index + 1, opponents.length - index)} /></div>;
      })}
      </section>
    </section>

    <section className="mock-current-player" aria-label="ข้อมูลผู้เล่นของคุณ">
      <PlayerPanel player={currentPlayer} distance={0} current />
      <div className="mock-your-turn">ไพ่ของคุณ <strong>— รอการตัดสินใจ</strong></div>
      <div className="mock-hand" aria-label="ไพ่ในมือ">{hand.map((card, index) => <HandCard key={`${card.name}-${index}`} card={card} />)}</div>
    </section>

    <section className="mock-response" role="dialog" aria-label="การตอบโต้">
      <span className="mock-response-icon">⚔</span><div><small>โจโฉ ใช้ไพ่</small><h2>โจมตี ใส่คุณ</h2><p>คุณต้องการตอบโต้อย่างไร?</p></div><div className="mock-response-actions"><button>🛡 ใช้ หลบ</button><button className="mock-muted-button">ไม่ทำอะไร</button></div>
    </section>
  </main>;
}
