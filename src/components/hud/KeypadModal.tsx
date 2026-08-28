import { SYMBOLS } from "../../../shared/types";
import { HorrorButton } from "../../ui/HorrorButton";

export function KeypadModal({
  selected,
  onPick,
  onSubmit,
  onClose,
}: {
  selected: string[];
  onPick: (id: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="overlay-card">
      <div className="panel">
        <h2>SECURITY LOCK</h2>
        <p className="muted">Enter the four-symbol sequence. Your partner can see it on SPIRIT or ECHO.</p>
        <p>{selected.join(" · ").toUpperCase() || "—"}</p>
        <div className="keypad">
          {SYMBOLS.map((s) => (
            <button key={s} onClick={() => onPick(s)} disabled={selected.length >= 4}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="row">
          <HorrorButton onClick={onSubmit} disabled={selected.length !== 4}>
            SUBMIT
          </HorrorButton>
          <HorrorButton variant="ghost" onClick={onClose}>
            CLOSE
          </HorrorButton>
        </div>
      </div>
    </div>
  );
}
