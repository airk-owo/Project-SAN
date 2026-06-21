type Spectator = { id: string; username: string; connectionStatus: 'online' | 'disconnected' };
export function SpectatorList({ spectators }: { spectators: Spectator[] }) {
  if (!spectators.length) return null;
  return <aside className="spectator-list"><b>ผู้ชม ({spectators.length})</b>{spectators.map(spectator => <span key={spectator.id} className={spectator.connectionStatus === 'disconnected' ? 'disconnected' : ''}>{spectator.username}</span>)}</aside>;
}
