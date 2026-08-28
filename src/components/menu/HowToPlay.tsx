import { HorrorButton } from "../../ui/HorrorButton";

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen menu-overlay">
      <div className="panel">
        <h2>HOW TO PLAY</h2>
        <p className="muted">Information is the resource. Trust is optional.</p>
        <ul className="how-list">
          <li>
            <strong>PLAY SOLO — The Lonely Signal.</strong> You walk the building. Eli talks through an old radio. Hold{" "}
            <strong>R</strong> or <strong>RADIO</strong> to ask him. He is not always right.
          </li>
          <li>
            <strong>PLAY WITH FRIEND.</strong> Create a room, share the code, both ready up. One Walker. One Watcher.
          </li>
          <li>
            <strong>PC Walker:</strong> WASD move · mouse look (click the view) · Shift sprint (forward only) · F flashlight
            · E use · R radio (solo) · Esc pause
          </li>
          <li>
            <strong>Phone:</strong> left stick walks. Right side: swipe to look (like a mouse). RUN / RADIO left. USE /
            LIGHT right. Optional GYRO in settings. PAUSE top-right. Chat is read-only on phones so the keyboard stays
            away.
          </li>
          <li>
            <strong>Watcher:</strong> WASD fly · 1–4 frequencies · Q warn · hold SIGNAL at the exit
          </li>
          <li>
            Layout: Entrance east into Reception. Security north. Storage then Basement south. Hallway further east.
            Generator north of the hallway. Locked office further east. Exit beyond that.
          </li>
          <li>If something stands behind you: do not turn around unless you trust the warning.</li>
          <li>When it hunts, you will see it. Run. Do not stare.</li>
        </ul>
        <HorrorButton onClick={onBack}>BACK</HorrorButton>
      </div>
    </div>
  );
}
