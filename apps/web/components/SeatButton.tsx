import { getRotatedSeatPosition } from '../lib/tableRotation';

export type TableCharacter = {
  id: string;
  name: string;
  hp: number;
  kingdomTh?: string;
  skills: { name: string; description: string; condition?: string | null }[];
};
export type TablePlayer = {
  id: string; username: string; seatIndex: number; ready: boolean; alive: boolean;
  connectionStatus: 'online' | 'disconnected'; role?: string; character?: TableCharacter;
  hp?: number; maxHp?: number; handCount: number;
};

type Props = {
  seatIndex: number; anchorSeatIndex: number; player?: TablePlayer; waiting: boolean;
  isHost: boolean; isCurrentTurn: boolean; canTarget: boolean;
  onSelectEmpty: (seatIndex: number) => void; onTarget: (player: TablePlayer) => void;
  onCharacterDetails: (player: TablePlayer) => void;
};

const hearts = (hp?: number, maxHp?: number) => hp === undefined || maxHp === undefined ? null : <span className="hearts">{'♥'.repeat(Math.max(0, hp))}{'♡'.repeat(Math.max(0, maxHp - hp))}</span>;

export function SeatButton({ seatIndex, anchorSeatIndex, player, waiting, isHost, isCurrentTurn, canTarget, onSelectEmpty, onTarget, onCharacterDetails }: Props) {
  const style = getRotatedSeatPosition(seatIndex, anchorSeatIndex);
  if (!player) {
    return waiting ? <article className="player-seat empty-seat" onClick={() => onSelectEmpty(seatIndex)} style={style}><b>ที่นั่ง {seatIndex}</b><span className="empty-avatar">＋</span><small>ว่าง</small></article> : null;
  }
  const crownTitle = waiting && isHost ? 'หัวหน้าห้อง' : !waiting && player.role === 'emperor' ? 'จักรพรรดิ' : null;
  return <article onClick={() => canTarget ? onTarget(player) : player.character && onCharacterDetails(player)} className={`player-seat ${isCurrentTurn ? 'active-player' : ''} ${canTarget ? 'targetable' : ''} ${player.character ? 'has-character' : ''}`} style={style}>
    <b>{crownTitle && <span className="crown" title={crownTitle}>♛</span>}{player.username}</b>
    <span className="avatar">{player.username.slice(0, 1).toUpperCase()}</span>
    {player.connectionStatus === 'disconnected' ? <p className="disconnected">Disconnected</p> : player.character ? <><p className="general-name">{player.character.name}</p>{hearts(player.hp, player.maxHp)}<p className="hand-backs">{'🂠'.repeat(Math.min(player.handCount, 6))} <small>hand: {player.handCount}</small></p></> : <p className={`ready-status ${player.ready ? 'ready' : 'not-ready'}`}>{player.ready ? 'พร้อม' : 'ไม่พร้อม'}</p>}
  </article>;
}
