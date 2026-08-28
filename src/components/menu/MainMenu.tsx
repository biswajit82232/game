import { HorrorButton } from "../../ui/HorrorButton";

const DUST = Array.from({ length: typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? 12 : 28 }, (_, i) => i);

export function MainMenu({
  onSolo,
  onFriend,
  onHow,
  onSettings,
  loopTitle,
  busy = false,
  error = null,
}: {
  onSolo: () => void;
  onFriend: () => void;
  onHow: () => void;
  onSettings: () => void;
  loopTitle?: boolean;
  busy?: boolean;
  error?: string | null;
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
        <p className="game-sub">One monster. One signal. Trust nobody.</p>
        <div className="menu-col">
          <HorrorButton onClick={onSolo} disabled={busy}>
            {busy ? "STARTING…" : "PLAY SOLO"}
          </HorrorButton>
          <HorrorButton onClick={onFriend} disabled={busy}>
            PLAY WITH FRIEND
          </HorrorButton>
          <HorrorButton variant="ghost" onClick={onHow} disabled={busy}>
            HOW TO PLAY
          </HorrorButton>
          <HorrorButton variant="ghost" onClick={onSettings} disabled={busy}>
            SETTINGS
          </HorrorButton>
          {error && <p className="error">{error}</p>}
        </div>
        <p className="menu-dedication">Priti's Wish ❤️</p>
      </div>
    </div>
  );
}
