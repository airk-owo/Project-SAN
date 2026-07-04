type Props = {
  onClose: () => void;
  confirmBeforePlay: boolean;
  onToggleConfirm: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
};

// In-game settings popover — anchored under the ⚙️ navbar button.
// The trigger button and the `showSettings &&` guard stay in the navbar; this
// renders the backdrop + dialog once open.
export function SettingsPopover({
  onClose,
  confirmBeforePlay,
  onToggleConfirm,
  soundOn,
  onToggleSound,
}: Props) {
  return (
    <>
      <div className="local-pop-backdrop" onClick={onClose} />
      <div className="local-settings-pop" role="dialog" aria-label="ตั้งค่าในเกม">
        <div className="settings-row">
          <span className="settings-row-label">
            <b>ยืนยันก่อนเล่นการ์ด</b>
            <small>ถามยืนยันทุกครั้งก่อนเล่นการ์ด กันเผลอเล่นผิดใบ</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={confirmBeforePlay}
            className={`settings-switch${confirmBeforePlay ? " on" : ""}`}
            onClick={onToggleConfirm}
          >
            <span className="settings-switch-knob" />
          </button>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">
            <b>เสียงแจ้งเตือน</b>
            <small>เล่นเสียงเมื่อถึงตาของคุณ</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={soundOn}
            className={`settings-switch${soundOn ? " on" : ""}`}
            onClick={onToggleSound}
          >
            <span className="settings-switch-knob" />
          </button>
        </div>
      </div>
    </>
  );
}
