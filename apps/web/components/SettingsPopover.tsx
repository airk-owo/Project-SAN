type Props = {
  onClose: () => void;
  confirmBeforePlay: boolean;
  onToggleConfirm: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  musicOn: boolean;
  onToggleMusic: () => void;
  cardTipEnabled: boolean;
  onToggleCardTip: () => void;
};

// A single labelled on/off row — reused across both settings sections.
function SettingRow({
  title,
  hint,
  checked,
  onToggle,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">
        <b>{title}</b>
        <small>{hint}</small>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`settings-switch${checked ? " on" : ""}`}
        onClick={onToggle}
      >
        <span className="settings-switch-knob" />
      </button>
    </div>
  );
}

// In-game settings popover — anchored under the ⚙️ navbar button.
// The trigger button and the `showSettings &&` guard stay in the navbar; this
// renders the backdrop + dialog once open. Split into two sections:
// ตั้งค่าการเล่น (gameplay) and ตั้งค่าเสียง (audio).
export function SettingsPopover({
  onClose,
  confirmBeforePlay,
  onToggleConfirm,
  soundOn,
  onToggleSound,
  musicOn,
  onToggleMusic,
  cardTipEnabled,
  onToggleCardTip,
}: Props) {
  return (
    <>
      <div className="local-pop-backdrop" onClick={onClose} />
      <div
        className="local-settings-pop"
        role="dialog"
        aria-label="ตั้งค่าในเกม"
      >
        <h4 className="settings-section-title">ตั้งค่าการเล่น</h4>
        <SettingRow
          title="ยืนยันก่อนเล่นการ์ด"
          hint="ถามยืนยันทุกครั้งก่อนเล่นการ์ด กันเผลอเล่นผิดใบ"
          checked={confirmBeforePlay}
          onToggle={onToggleConfirm}
        />
        <SettingRow
          title="ทูลทิปไพ่"
          hint="แสดงชื่อ/คำอธิบายการ์ดตอนชี้เมาส์ที่ไพ่บนมือ"
          checked={cardTipEnabled}
          onToggle={onToggleCardTip}
        />

        <h4 className="settings-section-title">ตั้งค่าเสียง</h4>
        <SettingRow
          title="เพลงประกอบ"
          hint="เปิดเพลงบรรเลงคลอระหว่างเล่น"
          checked={musicOn}
          onToggle={onToggleMusic}
        />
        <SettingRow
          title="เสียงแจ้งเตือน"
          hint="เล่นเสียงเมื่อถึงตาของคุณ"
          checked={soundOn}
          onToggle={onToggleSound}
        />
      </div>
    </>
  );
}
