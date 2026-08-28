import { HorrorButton } from "../../ui/HorrorButton";

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen menu-overlay">
      <div className="panel">
        <h2>HOW TO PLAY</h2>
        <p className="muted">Two players. One sees the monster. The other does not.</p>
        <ul className="how-list">
          <li>Create a room and share the code. Both players must ready up.</li>
          <li>Tap <strong>PLAY ALONE</strong> to start immediately. You are the Walker. An AI Watcher warns you, calls out puzzle codes, and holds the exit signal.</li>
          <li>
            <strong>WALKER</strong> — WASD move, mouse look, Shift sprint, F flashlight, E interact. You cannot normally see The Hollow.
          </li>
          <li>
            <strong>Phone:</strong> left half of the screen is a move stick (press where you like). Right half is a look stick. USE / LIGHT / RUN. GYRO uses the phone's sensor for fine aiming.
          </li>
          <li>
            <strong>WATCHER</strong> — fly the surveillance view, switch frequencies (1–4), warn with WARN, hold SIGNAL to open the exit.
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
