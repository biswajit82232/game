import type { GameSnapshot } from "../../../shared/types";
import { getRoomAt } from "../../../shared/map";
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
  const room = getRoomAt(snap.walker.position.x, snap.walker.position.z);
  return (
    <div className={`hud${touch ? " hud-touch" : ""}`}>
      <div className="hud-tl">
        <div className="bar-label">OBJECTIVE</div>
        <div>{snap.objective.text}</div>
        {room && <p className="muted hud-hint">{room.name.toUpperCase()}</p>}
        {touch && (
          <div className="hud-mini-bars">
            <div>
              <div className="bar-label">STAMINA</div>
              <div className="bar">
                {bar(snap.walker.stamina)} {Math.round(snap.walker.stamina)}%
              </div>
            </div>
            <div>
              <div className="bar-label">LIGHT</div>
              <div className="bar">
                {bar(snap.walker.battery)} {Math.round(snap.walker.battery)}%
              </div>
            </div>
          </div>
        )}
        <p className="muted hud-hint">SIGNAL: {snap.signalQuality}</p>
      </div>
      {!touch && (
        <>
          <div className="hud-tr">
            <div className="bar-label">PLAYER STATUS</div>
            <div>WATCHER: {snap.solo ? "ELI / SIGNAL" : otherAlive ? "ALIVE" : "GONE"}</div>
            {snap.solo && (
              <p className="muted hud-hint">{snap.signalHeld ? "SIGNAL: TUNED" : "HOLD R — THE SIGNAL"}</p>
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
        </>
      )}
      {touch && (
        <div className="hud-top">
          <div>{snap.solo ? (snap.signalHeld ? "SIGNAL: TUNED" : "ELI — HOLD RADIO") : `WATCHER: ${otherAlive ? "ALIVE" : "GONE"}`}</div>
        </div>
      )}
      {prompt && <div className="prompt">{touch ? prompt.replace("[E]", "TAP USE") : prompt}</div>}
    </div>
  );
}
