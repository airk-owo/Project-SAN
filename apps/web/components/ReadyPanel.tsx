type Props = { hasSeat: boolean; seatIndex?: number; isReady?: boolean; isHost: boolean; onReady: () => void; onSpectate: () => void; onRandomSeat: () => void; onStart: () => void; onLeave: () => void };

export function ReadyPanel({ hasSeat, seatIndex, isReady, isHost, onReady, onSpectate, onRandomSeat, onStart, onLeave }: Props) {
  return <div className="waiting-actions">{hasSeat ? <><b>เลือกที่นั่งแล้ว: {seatIndex}</b><button onClick={onReady}>{isReady ? 'Unready' : 'Ready'}</button><button onClick={onSpectate}>กลับเป็นผู้ชม</button></> : <><b>คุณเป็นผู้ชม — เลือกที่นั่งเพื่อเข้าร่วม</b><button onClick={onRandomSeat}>สุ่มที่นั่ง</button></>}{isHost ? <button onClick={onStart}>♛ เริ่มเกม</button> : <small>รอหัวหน้าห้องเริ่มเกม</small>}<button onClick={onLeave}>ออกจากห้อง</button></div>;
}
