import { useCallback, useRef, type PointerEvent } from "react";
import type { Role } from "../../../shared/types";
import { haptic } from "../../utils/haptic";

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
  solo = false,
  prompt,
  onMove,
  onLookAxis,
  onLookDelta,
  onSprint,
  onInteract,
  onFlashlight,
  onPause,
  onWarn,
  onHold,
  onRadio,
  onGyro,
}: {
  role: Role;
  solo?: boolean;
  prompt: string | null;
  onMove: (x: number, y: number) => void;
  onLookAxis?: (x: number, y: number) => void;
  onLookDelta?: (dx: number, dy: number) => void;
  onSprint: (held: boolean) => void;
  onInteract: () => void;
  onFlashlight: () => void;
  onPause: () => void;
  onWarn: () => void;
  onHold: (held: boolean) => void;
  onRadio?: (held: boolean) => void;
  onGyro?: () => void;
}) {
  const moveRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef<HTMLDivElement>(null);
  const moveKnob = useRef<HTMLDivElement>(null);
  const lookKnob = useRef<HTMLDivElement>(null);
  const moveOrigin = useRef<{ x: number; y: number; id: number } | null>(null);
  const lookOrigin = useRef<{ x: number; y: number; id: number } | null>(null);
  const lookLast = useRef<{ x: number; y: number } | null>(null);

  const placeStick = (
    wrap: HTMLDivElement | null,
    knob: HTMLDivElement | null,
    nx: number,
    ny: number,
    origin: { x: number; y: number },
  ) => {
    if (!knob || !wrap) return;
    knob.style.transform = `translate(${nx * 36}px, ${-ny * 36}px)`;
    const zone = wrap.parentElement;
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    const half = wrap.offsetWidth / 2;
    wrap.style.left = `${origin.x - rect.left - half}px`;
    wrap.style.top = `${origin.y - rect.top - half}px`;
    wrap.style.bottom = "auto";
    wrap.style.right = "auto";
    wrap.classList.add("is-active");
  };

  const resetStick = (wrap: HTMLDivElement | null, knob: HTMLDivElement | null) => {
    if (knob) knob.style.transform = "translate(0, 0)";
    if (!wrap) return;
    wrap.classList.remove("is-active");
    wrap.style.removeProperty("left");
    wrap.style.removeProperty("top");
    wrap.style.removeProperty("bottom");
    wrap.style.removeProperty("right");
  };

  const onMoveDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    moveOrigin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    onMove(0, 0);
    placeStick(moveRef.current, moveKnob.current, 0, 0, moveOrigin.current);
  };
  const onMoveDrag = (e: PointerEvent<HTMLDivElement>) => {
    const o = moveOrigin.current;
    if (!o || o.id !== e.pointerId) return;
    const a = analogFrom(o.x, o.y, e.clientX, e.clientY, 72);
    onMove(a.x, a.y);
    placeStick(moveRef.current, moveKnob.current, a.x, a.y, o);
  };
  const onMoveUp = (e: PointerEvent<HTMLDivElement>) => {
    if (moveOrigin.current?.id !== e.pointerId) return;
    moveOrigin.current = null;
    onMove(0, 0);
    resetStick(moveRef.current, moveKnob.current);
  };

  const onLookDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    lookOrigin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    lookLast.current = { x: e.clientX, y: e.clientY };
    onLookAxis?.(0, 0);
    placeStick(lookRef.current, lookKnob.current, 0, 0, lookOrigin.current);
  };
  const onLookDrag = (e: PointerEvent<HTMLDivElement>) => {
    const o = lookOrigin.current;
    if (!o || o.id !== e.pointerId) return;
    const last = lookLast.current;
    if (last) {
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (dx * dx + dy * dy > 0.15) onLookDelta?.(dx, dy);
    }
    lookLast.current = { x: e.clientX, y: e.clientY };
    const a = analogFrom(o.x, o.y, e.clientX, e.clientY, 72);
    onLookAxis?.(a.x, a.y);
    placeStick(lookRef.current, lookKnob.current, a.x, a.y, o);
  };
  const onLookUp = (e: PointerEvent<HTMLDivElement>) => {
    if (lookOrigin.current?.id !== e.pointerId) return;
    lookOrigin.current = null;
    lookLast.current = null;
    onLookAxis?.(0, 0);
    resetStick(lookRef.current, lookKnob.current);
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
    haptic(16);
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
        <div ref={moveRef} className="touch-stick touch-stick-move">
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
        <div ref={lookRef} className="touch-stick touch-stick-look">
          <div ref={lookKnob} className="touch-knob" />
          <span className="touch-stick-label">SWIPE</span>
        </div>
      </div>
      {role === "walker" && (
        <div className="touch-left-actions">
          <button type="button" className="touch-btn touch-btn-hold" {...hold(onSprint)}>
            RUN
          </button>
          {solo && onRadio && (
            <button type="button" className="touch-btn touch-btn-hold" {...hold(onRadio)}>
              RADIO
            </button>
          )}
        </div>
      )}
      <div className="touch-actions">
        {role === "walker" ? (
          <>
            <button type="button" className={`touch-btn touch-btn-use${prompt ? " touch-btn-hot" : ""}`} onPointerDown={tap(onInteract)}>
              USE
            </button>
            <button type="button" className="touch-btn" onPointerDown={tap(onFlashlight)}>
              LIGHT
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
      </div>
      <div className="touch-top-right">
        <button type="button" className="touch-pause" onPointerDown={tap(onPause)}>
          PAUSE
        </button>
        {onGyro && (
          <button type="button" className="touch-pause" onPointerDown={tap(onGyro)}>
            GYRO
          </button>
        )}
      </div>
    </div>
  );
}
