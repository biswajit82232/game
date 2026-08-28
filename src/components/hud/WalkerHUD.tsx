import type { GameSnapshot } from "../../../shared/types";
import { bar } from "../../utils/format";

export function WalkerHUD({
  snap,
  prompt,
  otherAlive,
}: {
  snap: GameSnapshot;
  prompt: string | null;
  otherAlive: boolean;
}) {
  return (
    <div className="hud">
      <div className="hud-tl">
        <div className="bar-label">OBJECTIVE</div>
        <div>{snap.objective.text}</div>
      </div>
      <div className="hud-tr">
        <div className="bar-label">PLAYER STATUS</div>
        <div>WATCHER: {otherAlive ? "ALIVE" : "GONE"}</div>
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
      {prompt && <div className="prompt">{prompt}</div>}
    </div>
  );
}
