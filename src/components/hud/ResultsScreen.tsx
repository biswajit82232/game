import type { GameEndPayload } from "../../../shared/types";
import { HorrorButton } from "../../ui/HorrorButton";
import { formatTime } from "../../utils/format";

export function ResultsScreen({
  end,
  onAgain,
  onLobby,
}: {
  end: GameEndPayload;
  onAgain: () => void;
  onLobby: () => void;
}) {
  const s = end.stats;
  return (
    <div className="screen menu-overlay">
      <div className="panel results">
        <h1>{end.title}</h1>
        <p className="muted">{end.body}</p>
        <ul className="stats">
          <li>TIME — {formatTime(s.timeSeconds)}</li>
          <li>ITEMS FOUND — {s.itemsFound}</li>
          <li>PUZZLES SOLVED — {s.puzzlesSolved}</li>
          <li>MONSTER ENCOUNTERS — {s.monsterEncounters}</li>
          <li>WARNINGS IGNORED — {s.warningsIgnored}</li>
          <li>TRUST — {s.trustLabel}</li>
          <li>SECRET EVENTS — {s.secretEvents}</li>
        </ul>
        <div className="row">
          <HorrorButton onClick={onAgain}>TRY AGAIN</HorrorButton>
          <HorrorButton variant="ghost" onClick={onLobby}>
            RETURN TO LOBBY
          </HorrorButton>
        </div>
      </div>
    </div>
  );
}
