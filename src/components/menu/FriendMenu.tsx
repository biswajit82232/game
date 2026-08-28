import { HorrorButton } from "../../ui/HorrorButton";

export function FriendMenu({
  onCreate,
  onJoin,
  onBack,
  busy = false,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onBack: () => void;
  busy?: boolean;
}) {
  return (
    <div className="screen menu-overlay">
      <div className="panel">
        <p className="muted">TWO PLAYERS</p>
        <h2>PLAY WITH FRIEND</h2>
        <p className="muted">One of you walks. The other watches. You will not see the same thing.</p>
        <div className="menu-col" style={{ marginTop: 22 }}>
          <HorrorButton onClick={onCreate} disabled={busy}>
            {busy ? "OPENING…" : "CREATE ROOM"}
          </HorrorButton>
          <HorrorButton onClick={onJoin} disabled={busy}>
            JOIN ROOM
          </HorrorButton>
          <HorrorButton variant="ghost" onClick={onBack} disabled={busy}>
            BACK
          </HorrorButton>
        </div>
      </div>
    </div>
  );
}
