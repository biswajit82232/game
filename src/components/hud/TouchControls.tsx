import { useCallback, useRef, type PointerEvent } from "react";
import type { Role } from "../../../shared/types";

export function TouchControls({
  role,
  prompt,
  onMove,
  onLook,
  onSprint,
  onInteract,
  onFlashlight,
  onPause,
  onWarn,
  onHold,
}: {
  role: Role;
  prompt: string | null;
  onMove: (x: number, y: number) => void;
  onLook: (dx: number, dy: number) => void;
  onSprint: (held: boolean) => void;
  onInteract: () => void;
  onFlashlight: () => void;
  onPause: () => void;
  onWarn: () => void;
  onHold: (held: boolean) => void;
}) {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const lookLast = useRef<{ x: number; y: number } | null>(null);
  const stickId = useRef<number | null>(null);

  const setKnob = (nx: number, ny: number) => {
    const knob = knobRef.current;
    if (!knob) return;
    knob.style.transform = `translate(${nx * 34}px, ${-ny * 34}px)`;
  };

  const onStickDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    stickId.current = e.pointerId;
    updateStick(e);
  };

  const updateStick = (e: PointerEvent<HTMLDivElement>) => {
    const el = stickRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let x = (e.clientX - cx) / (r.width / 2);
    let y = (cy - e.clientY) / (r.height / 2);
    const mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    onMove(x, y);
    setKnob(x, y);
  };

  const onStickMove = (e: PointerEvent<HTMLDivElement>) => {
    if (stickId.current !== e.pointerId) return;
    updateStick(e);
  };

  const onStickUp = (e: PointerEvent<HTMLDivElement>) => {
    if (stickId.current !== e.pointerId) return;
    stickId.current = null;
    onMove(0, 0);
    setKnob(0, 0);
  };

  const onLookDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    lookLast.current = { x: e.clientX, y: e.clientY };
  };

  const onLookMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!lookLast.current) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    onLook(dx, dy);
  };

  const onLookUp = () => {
    lookLast.current = null;
  };

  const hold = useCallback(
    (fn: (held: boolean) => void) => ({
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        fn(true);
      },
      onPointerUp: () => fn(false),
      onPointerCancel: () => fn(false),
    }),
    [],
  );

  return (
    <div className="touch-layer" aria-hidden={false}>
      <div
        className="touch-look"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />
      <div
        ref={stickRef}
        className="touch-stick"
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
      >
        <div ref={knobRef} className="touch-knob" />
        <span className="touch-stick-label">MOVE</span>
      </div>
      <div className="touch-actions">
        {role === "walker" ? (
          <>
            <button type="button" className="touch-btn" onPointerDown={onInteract}>
              {prompt ? "USE" : "USE"}
            </button>
            <button type="button" className="touch-btn" onPointerDown={onFlashlight}>
              LIGHT
            </button>
            <button type="button" className="touch-btn touch-btn-hold" {...hold(onSprint)}>
              SPRINT
            </button>
          </>
        ) : (
          <>
            <button type="button" className="touch-btn touch-btn-warn" onPointerDown={onWarn}>
              WARN
            </button>
            <button type="button" className="touch-btn touch-btn-hold" {...hold(onHold)}>
              SIGNAL
            </button>
          </>
        )}
      </div>
      <button type="button" className="touch-pause" onPointerDown={onPause}>
        PAUSE
      </button>
      <div className="touch-look-hint">DRAG TO LOOK</div>
    </div>
  );
}
