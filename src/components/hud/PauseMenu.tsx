import { HorrorButton } from "../../ui/HorrorButton";

export function PauseMenu({
  onResume,
  onSettings,
  onLobby,
}: {
  onResume: () => void;
  onSettings: () => void;
  onLobby: () => void;
}) {
  return (
    <div className="overlay-card">
      <div className="panel">
        <h2>PAUSED</h2>
        <div className="menu-col">
          <HorrorButton onClick={onResume}>RESUME</HorrorButton>
          <HorrorButton variant="ghost" onClick={onSettings}>
            SETTINGS
          </HorrorButton>
          <HorrorButton variant="ghost" onClick={onLobby}>
            RETURN TO LOBBY
          </HorrorButton>
        </div>
      </div>
    </div>
  );
}
