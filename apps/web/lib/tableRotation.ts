export type TablePosition = { left: string; top: string };

/**
 * Converts a real seat (1–10) to a client-local position. The anchor seat is
 * always rendered at the bottom; server order is never changed.
 */
export function getRotatedSeatPosition(seatIndex: number, anchorSeatIndex: number): TablePosition {
  const offset = (seatIndex - anchorSeatIndex + 10) % 10;
  const radians = (90 + offset * 36) * Math.PI / 180;
  return { left: `${50 + 44 * Math.cos(radians)}%`, top: `${50 + 46 * Math.sin(radians)}%` };
}
