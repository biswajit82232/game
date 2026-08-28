import { useState } from "react";
import { HorrorButton } from "../../ui/HorrorButton";

export function JoinRoom({
  error,
  onJoin,
  onBack,
}: {
  error: string | null;
  onJoin: (code: string) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  return (
    <div className="screen menu-overlay">
      <div className="panel">
        <h2>ENTER ROOM CODE</h2>
        <div className="field">
          <label>ROOM CODE</label>
          <input
            type="text"
            maxLength={6}
            value={code}
            placeholder="A7K9P"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") onJoin(code);
            }}
          />
        </div>
        <p className="error">{error}</p>
        <div className="row">
          <HorrorButton onClick={() => onJoin(code)}>JOIN</HorrorButton>
          <HorrorButton variant="ghost" onClick={onBack}>
            BACK
          </HorrorButton>
        </div>
      </div>
    </div>
  );
}
