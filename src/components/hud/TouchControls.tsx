import { useCallback, useRef, type PointerEvent } from "react";
import type { Role } from "../../../shared/types";

function analogFrom(originX: number, originY: number, x: number, y: number, radius: number): { x: number; y: number } {
  let ax = (x - originX) / radius;
  let ay = (originY - y) / radius;
  const mag = Math.hypot(ax, ay);
  if (mag > 1) {
    ax /= mag;
    ay /= mag;
  }
  return { x: ax, y: ay };
}

export function TouchControls({
  role,
  prompt,
  onMove,
  onLookAxis,
  onSprint,
  onInteract,
  onFlashlight,
  onPause,
  onWarn,
  onHold,
  onGyro,
}: {
  role: Role;
  prompt: string | null;
  onMove: (x: number, y: number) => void;
  onLookAxis: (x: number, y: number) => void;
  onSprint: (held: boolean) => void;
  onInteract: () => void;
  onFlashlight: () => void;
  onPause: () => void;
  onWarn: () => void;
  onHold: (held: boolean) => void;
  onGyro?: () => void;
}) {
  const moveRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef<HTMLDivElement>(null);
  const moveKnob = useRef<HTMLDivElement>(null);
  const lookKnob = useRef<HTMLDivElement>(null);
  const moveOrigin = useRef<{ x: number; y: number; id: number } | null>(null);
  const lookOrigin = useRef<{ x: number; y: number; id: number } | null>(null);

  const place = (el: HTMLDivElement | null, clientX: number, clientY: number, nx: number, ny: number) => {
    if (!el) return;
    el.style.opacity = "1";
    el.style.transform = `translate(${nx * 42}px, ${-ny * 42}px)`;
    const stick = el.parentElement;
    const zone = stick?.parentElement;
    if (stick && zone) {
      const rect = zone.getBoundingClientRect();
      stick.style.left = `${clientX - rect.left - 70}px`;
      stick.style.top = `${clientY - rect.top - 70}px`;
      stick.style.bottom = "auto";
      stick.style.right = "auto";
      stick.classList.add("is-active");
    }
  };

  const resetStick = (kind: "move" | "look") => {
    const knob = kind === "move" ? moveKnob.current : lookKnob.current;
    const wrap = kind === "move" ? moveRef.current : lookRef.current;
    if (knob) knob.style.transform = "translate(0, 0)";
    wrap?.classList.remove("is-active");
  };

  const onMoveDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    moveOrigin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    onMove(0, 0);
    place(moveKnob.current, e.clientX, e.clientY, 0, 0);
  };
  const onMoveDrag = (e: PointerEvent<HTMLDivElement>) => {
    const o = moveOrigin.current;
    if (!o || o.id !== e.pointerId) return;
    const a = analogFrom(o.x, o.y, e.clientX, e.clientY, 56);
    onMove(a.x, a.y);
    place(moveKnob.current, o.x, o.y, a.x, a.y);
  };
  const onMoveUp = (e: PointerEvent<HTMLDivElement>) => {
    if (moveOrigin.current?.id !== e.pointerId) return;
    moveOrigin.current = null;
    onMove(0, 0);
    resetStick("move");
  };

  const onLookDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    lookOrigin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    onLookAxis(0, 0);
    place(lookKnob.current, e.clientX, e.clientY, 0, 0);
  };
  const onLookDrag = (e: PointerEvent<HTMLDivElement>) => {
    const o = lookOrigin.current;
    if (!o || o.id !== e.pointerId) return;
    const a = analogFrom(o.x, o.y, e.clientX, e.clientY, 56);
    onLookAxis(a.x, a.y);
    place(lookKnob.current, o.x, o.y, a.x, a.y);
  };
  const onLookUp = (e: PointerEvent<HTMLDivElement>) => {
    if (lookOrigin.current?.id !== e.pointerId) return;
    lookOrigin.current = null;
    onLookAxis(0, 0);
    resetStick("look");
  };

  const hold = useCallback(
    (fn: (held: boolean) => void) => ({
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        fn(true);
      },
      onPointerUp: () => fn(false),
      onPointerCancel: () => fn(false),
    }),
    [],
  );

  const tap = (fn: () => void) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  return (
    <div className="touch-layer">
      <div
        className="touch-zone touch-zone-move"
        onPointerDown={onMoveDown}
        onPointerMove={onMoveDrag}
        onPointerUp={onMoveUp}
        onPointerCancel={onMoveUp}
      >
        <div ref={moveRef} className="touch-stick touch-stick-float">
          <div ref={moveKnob} className="touch-knob" />
          <span className="touch-stick-label">MOVE</span>
        </div>
      </div>
      <div
        className="touch-zone touch-zone-look"
        onPointerDown={onLookDown}
        onPointerMove={onLookDrag}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      >
        <div ref={lookRef} className="touch-stick touch-stick-float">
          <div ref={lookKnob} className="touch-knob" />
          <span className="touch-stick-label">LOOK</span>
        </div>
      </div>
      <div className="touch-actions">
        {role === "walker" ? (
          <>
            <button type="button" className={`touch-btn${prompt ? " touch-btn-hot" : ""}`} onPointerDown={tap(onInteract)}>
              USE
            </button>
            <button type="button" className="touch-btn" onPointerDown={tap(onFlashlight)}>
              LIGHT
            </button>
            <button type="button" className="touch-btn touch-btn-hold" {...hold(onSprint)}>
              RUN
            </button>
          </>
        ) : (
          <>
            <button type="button" className="touch-btn touch-btn-warn" onPointerDown={tap(onWarn)}>
              WARN
            </button>
            <button type="button" className="touch-btn touch-btn-hold" {...hold(onHold)}>
              SIGNAL
            </button>
          </>
        )}
        {onGyro && (
          <button type="button" className="touch-btn touch-btn-small" onPointerDown={tap(onGyro)}>
            GYRO
          </button>
        )}
      </div>
      <button type="button" className="touch-pause" onPointerDown={tap(onPause)}>
        PAUSE
      </button>
    </div>
  );
}
