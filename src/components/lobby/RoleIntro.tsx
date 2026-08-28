import type { Role } from "../../../shared/types";
import { HorrorButton } from "../../ui/HorrorButton";

export function RoleIntro({
  role,
  solo = false,
  onContinue,
}: {
  role: Role;
  solo?: boolean;
  onContinue: () => void;
}) {
  const walker = role === "walker";
  return (
    <div className="intro">
      {solo ? (
        <>
          <p className="muted">THE LONELY SIGNAL</p>
          <h1>02:13 AM</h1>
          <p>Unknown location.</p>
          <p>Signal lost.</p>
          <p>Signal restored.</p>
          <p>Voice detected.</p>
          <p className="muted">“Hello?”</p>
          <p>You are the Walker. There is no one else in the building.</p>
          <p>There is a radio. Something on the other end calls itself Eli.</p>
        </>
      ) : walker ? (
        <>
          <p className="muted">PLAYER 1</p>
          <h1>THE WALKER</h1>
          <p>You are inside the building.</p>
          <p>You can see the world.</p>
          <p>But you cannot see what is hunting you.</p>
        </>
      ) : (
        <>
          <p className="muted">PLAYER 2</p>
          <h1>THE WATCHER</h1>
          <p>Guide them with frequencies, not a cheat sheet.</p>
          <p>SPIRIT reads wall marks. DANGER paints the true breaker.</p>
          <p>If it stands behind them: warn. Do not tell them to turn around.</p>
        </>
      )}
      <div className="intro-actions">
        <HorrorButton onClick={onContinue}>CONTINUE</HorrorButton>
      </div>
    </div>
  );
}
