import { HorrorButton } from "../../ui/HorrorButton";

const DUST = Array.from({ length: 28 }, (_, i) => i);

export function MainMenu({
  onCreate,
  onJoin,
  onSolo,
  onHow,
  onSettings,
  loopTitle,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onSolo: () => void;
  onHow: () => void;
  onSettings: () => void;
  loopTitle?: boolean;
}) {
  return (
    <div className="screen">
      <div className="menu-bg" aria-hidden>
        <div className="hallway" />
        <div className="hallway-light" />
        <div className="hallway-shadow" />
        <div className="dust">
          {DUST.map((i) => (
            <span
              key={i}
              style={{
                left: `${(i * 17) % 100}%`,
                animationDelay: `${(i % 9) * 0.4}s`,
                animationDuration: `${7 + (i % 5)}s`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="menu-overlay">
        <h1 className="game-title">{loopTitle ? "YOU NEVER LEFT." : "DON'T TURN AROUND"}</h1>
        <p className="game-sub">Two players. One monster. Trust nobody.</p>
        <div className="menu-col">
          <HorrorButton onClick={onSolo}>PLAY ALONE</HorrorButton>
          <HorrorButton onClick={onCreate}>CREATE ROOM</HorrorButton>
          <HorrorButton onClick={onJoin}>JOIN ROOM</HorrorButton>
          <HorrorButton variant="ghost" onClick={onHow}>
            HOW TO PLAY
          </HorrorButton>
          <HorrorButton variant="ghost" onClick={onSettings}>
            SETTINGS
          </HorrorButton>
        </div>
      </div>
    </div>
  );
}
