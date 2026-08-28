import type { RoomPublic } from "../../../shared/types";
import { HorrorButton } from "../../ui/HorrorButton";

export function Lobby({
  room,
  selfId,
  onReady,
  onSwap,
  onLeave,
}: {
  room: RoomPublic;
  selfId: string;
  onReady: () => void;
  onSwap: () => void;
  onLeave: () => void;
}) {
  const p1 = room.players[0];
  const p2 = room.players[1];
  const me = room.players.find((p) => p.id === selfId);
  const isHost = room.hostId === selfId;

  return (
    <div className="screen menu-overlay">
      <div className="panel">
        <p className="muted">ROOM CODE</p>
        <div className="room-code">{room.code}</div>
        <div className="row" style={{ marginBottom: 18 }}>
          <HorrorButton
            onClick={() => {
              void navigator.clipboard.writeText(room.code);
            }}
          >
            COPY CODE
          </HorrorButton>
        </div>
        <div className="player-slot">
          <span>PLAYER 1 — {p1?.role.toUpperCase() ?? "WALKER"}</span>
          <span className={p1 ? "ok" : "warn"}>{p1 ? (p1.ready ? "READY" : "CONNECTED") : "Waiting for player..."}</span>
        </div>
        <div className="player-slot">
          <span>PLAYER 2 — {p2?.role.toUpperCase() ?? "WATCHER"}</span>
          <span className={p2 ? "ok" : "warn"}>{p2 ? (p2.ready ? "READY" : "CONNECTED") : "Waiting for player..."}</span>
        </div>
        <div className="row" style={{ marginTop: 18 }}>
          <HorrorButton onClick={onReady} disabled={!p2 || me?.ready}>
            {me?.ready ? "WAITING" : "READY"}
          </HorrorButton>
          {isHost && p2 && (
            <HorrorButton variant="ghost" onClick={onSwap}>
              SWAP ROLES
            </HorrorButton>
          )}
          <HorrorButton variant="ghost" onClick={onLeave}>
            LEAVE
          </HorrorButton>
        </div>
      </div>
    </div>
  );
}
