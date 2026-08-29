import { HorrorButton } from "../../ui/HorrorButton";

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen menu-overlay">
      <div className="panel">
        <h2>HOW TO PLAY</h2>
        <p className="muted">Short path. Get out. Don’t turn around when it stands behind you.</p>
        <ul className="how-list">
          <li>
            <strong>Solo:</strong> Walk the building. Eli helps on the radio (<strong>R</strong> / RADIO).
          </li>
          <li>
            <strong>Escape in 4 steps:</strong> Flip a generator breaker → grab the reception key → enter the security
            keypad code → use the office exit panel.
          </li>
          <li>
            <strong>Move:</strong> WASD · mouse look · Shift run · F light · E use. Phone: sticks + USE / LIGHT.
          </li>
          <li>
            <strong>With a friend:</strong> One Walker, one Watcher. Watcher holds SIGNAL at the exit. Warn with Q when
            something is behind them.
          </li>
          <li>
            <strong>The Hollow:</strong> If it hunts, you’ll see the ghost — run. Lightning means it’s close. If you’re
            told not to turn around, don’t.
          </li>
        </ul>
        <HorrorButton onClick={onBack}>BACK</HorrorButton>
      </div>
    </div>
  );
}
