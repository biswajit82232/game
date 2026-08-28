import type { GameSnapshot, WatcherMode } from "../../../shared/types";
import { bar } from "../../utils/format";

const MODES: { id: WatcherMode; label: string; key: string }[] = [
  { id: "normal", label: "NORMAL", key: "1" },
  { id: "spirit", label: "SPIRIT", key: "2" },
  { id: "echo", label: "ECHO", key: "3" },
  { id: "danger", label: "DANGER", key: "4" },
];

export function WatcherHUD({
  snap,
  onMode,
  onWarn,
  onHold,
}: {
  snap: GameSnapshot;
  onMode: (mode: WatcherMode) => void;
  onWarn: () => void;
  onHold: (holding: boolean) => void;
}) {
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="bar-label">PLAYER STATUS</div>
        <div>WALKER: {snap.walker.alive ? "ALIVE" : "LOST"}</div>
      </div>
      <div className="hud-tl">
        <div className="bar-label">OBJECTIVE</div>
        <div>{snap.objective.text}</div>
        {snap.secretObjective && <p className="secret">SECRET: {snap.secretObjective}</p>}
      </div>
      <div className="hud-bl">
        <div className="bar-label">ENERGY</div>
        <div className="bar">
          {bar(snap.watcher.energy)} {Math.round(snap.watcher.energy)}%
        </div>
      </div>
      <div className="hud-br">
        <div className="bar-label">SIGNAL</div>
        <div>{snap.watcher.modeCooldown > 0 ? "COOLING" : "STABLE"}</div>
      </div>
      <div className="hud-tr">
        <div className="modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={snap.watcher.mode === m.id ? "active" : ""}
              onClick={() => onMode(m.id)}
            >
              {m.key} {m.label}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
          <button className="warn-btn" onClick={onWarn}>
            WARN
          </button>
          <button
            className="warn-btn"
            onMouseDown={() => onHold(true)}
            onMouseUp={() => onHold(false)}
            onMouseLeave={() => onHold(false)}
            onTouchStart={(e) => {
              e.preventDefault();
              onHold(true);
            }}
            onTouchEnd={() => onHold(false)}
          >
            HOLD SIGNAL
          </button>
        </div>
        {snap.symbolSolution && (
          <p className="muted" style={{ marginTop: 8 }}>
            SEQUENCE: {snap.symbolSolution.join(" · ").toUpperCase()}
          </p>
        )}
        {snap.powerSafeSwitch >= 0 && (
          <p className="muted">SAFE BREAKER: {snap.powerSafeSwitch + 1} (shape, not color)</p>
        )}
      </div>
    </div>
  );
}
