import { SYMBOLS, SYMBOL_GLYPH, type SymbolId } from "../../../shared/types";
import { HorrorButton } from "../../ui/HorrorButton";

export function KeypadModal({
  selected,
  hint = null,
  onPick,
  onClear,
  onSubmit,
  onClose,
}: {
  selected: string[];
  hint?: string[] | null;
  onPick: (id: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="overlay-card">
      <div className="panel">
        <h2>SECURITY LOCK</h2>
        <p className="muted">
          Enter the four-symbol sequence. In co-op, the Watcher reads the wall in SPIRIT. Playing alone, Eli may tell you
          — if you asked.
        </p>
        {hint && hint.length > 0 && (
          <p className="hud-hint">
            SEQUENCE: {hint.map((id) => SYMBOL_GLYPH[id as SymbolId] ?? id).join("  ")}
          </p>
        )}
        <p className="keypad-readout">
          {selected.map((id) => SYMBOL_GLYPH[id as SymbolId] ?? id).join("  ") || "—"}
        </p>
        <div className="keypad">
          {SYMBOLS.map((s) => (
            <button key={s} onClick={() => onPick(s)} disabled={selected.length >= 4} aria-label={s}>
              <span className="keypad-glyph">{SYMBOL_GLYPH[s]}</span>
              <span className="keypad-name">{s}</span>
            </button>
          ))}
        </div>
        <div className="row">
          <HorrorButton onClick={onSubmit} disabled={selected.length !== 4}>
            SUBMIT
          </HorrorButton>
          <HorrorButton variant="ghost" onClick={onClear}>
            CLEAR
          </HorrorButton>
          <HorrorButton variant="ghost" onClick={onClose}>
            CLOSE
          </HorrorButton>
        </div>
      </div>
    </div>
  );
}
