import type { Role } from "../../../shared/types";
import { HorrorButton } from "../../ui/HorrorButton";

export function RoleIntro({ role, onContinue }: { role: Role; onContinue: () => void }) {
  const walker = role === "walker";
  return (
    <div className="intro">
      <p className="muted">{walker ? "PLAYER 1" : "PLAYER 2"}</p>
      <h1>{walker ? "THE WALKER" : "THE WATCHER"}</h1>
      {walker ? (
        <>
          <p>You are inside the building.</p>
          <p>You can see the world.</p>
          <p>But you cannot see what is hunting you.</p>
        </>
      ) : (
        <>
          <p>You can see what the other player cannot.</p>
          <p>Guide them.</p>
          <p>But be careful.</p>
          <p>Something can hear you.</p>
        </>
      )}
      <div style={{ marginTop: 28 }}>
        <HorrorButton onClick={onContinue}>CONTINUE</HorrorButton>
      </div>
    </div>
  );
}
