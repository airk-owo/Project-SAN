import { ReadyPanel } from './ReadyPanel';
import { SeatButton, type TablePlayer } from './SeatButton';
import { SpectatorList } from './SpectatorList';

type LastCard = { name: string; number: string; suit: string };
type Props = {
  waiting: boolean; players: TablePlayer[]; spectators: { id: string; username: string; connectionStatus: 'online' | 'disconnected' }[];
  anchorSeatIndex: number; viewerId: string; hostId: string; currentPlayerId?: string;
  selectedEffect?: string | null; deckCount: number; discardCount: number; lastCard?: LastCard;
  canDraw: boolean; onDraw: () => void; onLastCardClick: () => void;
  onSelectSeat: (seat: number) => void; onRandomSeat: () => void; onReady: () => void;
  onSpectate: () => void; onStart: () => void; onLeave: () => void;
  onTarget: (player: TablePlayer) => void; onCharacterDetails: (player: TablePlayer) => void;
};

export function LobbyTable(props: Props) {
  const me = props.players.find(player => player.id === props.viewerId);
  return <><section className="table-scene"><div className="table"><div className="center">{props.waiting ? <ReadyPanel hasSeat={Boolean(me)} seatIndex={me?.seatIndex} isReady={me?.ready} isHost={props.hostId === props.viewerId} onReady={props.onReady} onSpectate={props.onSpectate} onRandomSeat={props.onRandomSeat} onStart={props.onStart} onLeave={props.onLeave} /> : <><div className="piles"><button className="pile" onClick={props.onDraw} disabled={!props.canDraw}><span className="pile-card">🂠</span><b>กองจั่ว</b><strong>{props.deckCount}</strong></button><div className="pile"><span className="pile-card discard-pile">{props.lastCard ? `${props.lastCard.number} ${props.lastCard.suit}` : '🂠'}</span><b>กองทิ้ง</b><strong>{props.discardCount}</strong></div></div>{props.lastCard && <button className="last-card" onClick={props.onLastCardClick}><b>{props.lastCard.name}</b><span>{props.lastCard.number} {props.lastCard.suit}</span></button>}</>}</div></div><div className="seats">{Array.from({ length: 10 }, (_, index) => { const seatIndex = index + 1; const player = props.players.find(item => item.seatIndex === seatIndex); const canHeal = props.selectedEffect !== 'heal' || (player?.id === props.viewerId ? (player?.hp || 0) < (player?.maxHp || 0) : (player?.hp || 0) <= 0); const canTarget = Boolean(player && props.selectedEffect && props.currentPlayerId === props.viewerId && player.alive && canHeal && (props.selectedEffect !== 'attack' || player.id !== props.viewerId)); return <SeatButton key={seatIndex} seatIndex={seatIndex} anchorSeatIndex={props.anchorSeatIndex} player={player} waiting={props.waiting} isHost={player?.id === props.hostId} isCurrentTurn={player?.id === props.currentPlayerId} canTarget={canTarget} onSelectEmpty={props.onSelectSeat} onTarget={props.onTarget} onCharacterDetails={props.onCharacterDetails} />; })}</div></section><SpectatorList spectators={props.spectators} /></>;
}
