import type { Role } from "../../../shared/types";
import { HorrorButton } from "../../ui/HorrorButton";

export function DisconnectOverlay({
  role,
  onWait,
  onLobby,
}: {
  role: Role;
  onWait: () => void;
  onLobby: () => void;
}) {
  const title = role === "watcher" ? "THE WATCHER HAS DISCONNECTED." : "THE WALKER HAS DISCONNECTED.";
  return (
    <div className="overlay-card">
      <div className="panel">
        <h2>{title}</h2>
        <p className="muted">The other player can rejoin with the same room code if they return quickly.</p>
        <div className="row">
          <HorrorButton onClick={onWait}>WAIT</HorrorButton>
          <HorrorButton variant="ghost" onClick={onLobby}>
            RETURN TO LOBBY
          </HorrorButton>
        </div>
      </div>
    </div>
  );
}
