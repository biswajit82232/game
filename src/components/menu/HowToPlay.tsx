import { HorrorButton } from "../../ui/HorrorButton";

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen menu-overlay">
      <div className="panel">
        <h2>HOW TO PLAY</h2>
        <p className="muted">Two players. One sees the monster. The other does not.</p>
        <ul className="how-list">
          <li>Create a room and share the code. Both players must ready up.</li>
          <li>
            <strong>WALKER</strong> — WASD move, mouse look, Shift sprint, F flashlight, E interact. You cannot normally see The Hollow. On a phone: left stick to move, drag the right side to look, USE / LIGHT / SPRINT buttons.
          </li>
          <li>
            <strong>WATCHER</strong> — fly the surveillance view, switch frequencies (1–4), warn with WARN, hold SIGNAL to open the exit. On a phone: left stick to fly, drag to look, WARN and SIGNAL buttons.
          </li>
          <li>Puzzles need both of you. The Watcher sees sequences and safe breakers. The Walker touches the world.</li>
          <li>If something stands behind the Walker: do not turn around unless you trust the warning.</li>
          <li>Escape through the final door after power, keypad, and key. Both must be at the exit.</li>
        </ul>
        <HorrorButton onClick={onBack}>BACK</HorrorButton>
      </div>
    </div>
  );
}
