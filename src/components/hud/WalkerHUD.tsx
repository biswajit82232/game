import type { GameSnapshot } from "../../../shared/types";
import { bar } from "../../utils/format";

export function WalkerHUD({
  snap,
  prompt,
  otherAlive,
  touch = false,
}: {
  snap: GameSnapshot;
  prompt: string | null;
  otherAlive: boolean;
  touch?: boolean;
}) {
  return (
    <div className="hud">
      <div className="hud-tl">
        <div className="bar-label">OBJECTIVE</div>
        <div>{snap.objective.text}</div>
      </div>
      <div className="hud-tr">
        <div className="bar-label">PLAYER STATUS</div>
        <div>WATCHER: {snap.solo ? "AI" : otherAlive ? "ALIVE" : "GONE"}</div>
        {snap.solo && snap.symbolSolution && (
          <p className="muted" style={{ marginTop: 8 }}>
            SEQUENCE: {snap.symbolSolution.join(" · ").toUpperCase()}
          </p>
        )}
        {snap.solo && snap.powerSafeSwitch >= 0 && (
          <p className="muted">SAFE BREAKER: {snap.powerSafeSwitch + 1}</p>
        )}
      </div>
      <div className="hud-bl">
        <div className="bar-label">STAMINA</div>
        <div className="bar">
          {bar(snap.walker.stamina)} {Math.round(snap.walker.stamina)}%
        </div>
      </div>
      <div className="hud-br">
        <div className="bar-label">FLASHLIGHT</div>
        <div className="bar">
          {bar(snap.walker.battery)} {Math.round(snap.walker.battery)}%
        </div>
      </div>
      {prompt && <div className="prompt">{touch ? prompt.replace("[E]", "TAP") : prompt}</div>}
    </div>
  );
}
