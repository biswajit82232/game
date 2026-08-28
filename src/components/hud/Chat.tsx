import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../../shared/types";

export function Chat({
  messages,
  onSend,
  compact = false,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  compact?: boolean;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(!compact);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open]);

  return (
    <div className={`chat${compact ? " chat-compact" : ""}`}>
      {compact && (
        <button type="button" className="chat-toggle" onClick={() => setOpen((v) => !v)}>
          CHAT{messages.length ? ` (${messages.length})` : ""}
        </button>
      )}
      {open && (
        <>
          <div className="chat-log">
            {messages.map((m) => (
              <div key={m.id}>
                <strong>{m.from.toUpperCase()}:</strong> {m.text}
              </div>
            ))}
            <div ref={end} />
          </div>
          <input
            value={text}
            placeholder="Message…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) {
                onSend(text);
                setText("");
              }
            }}
          />
        </>
      )}
    </div>
  );
}
