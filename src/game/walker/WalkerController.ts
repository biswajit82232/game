import { PLAYER_RADIUS, SPRINT_SPEED, WALK_SPEED, WATCHER_FLY_SPEED } from "../../../shared/constants";
import { WALLS, resolveMove, type WallSeg } from "../../../shared/map";
import type { Role } from "../../../shared/types";

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export class WalkerController {
  keys = new Set<string>();
  yaw = 0;
  pitch = 0;
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  locked = false;
  touchMode = false;
  invertY = false;
  inputEnabled = true;
  moveAxis = { x: 0, y: 0 };
  lookAxis = { x: 0, y: 0 };
  sprintHeld = false;
  wantInteract = false;
  wantFlashlight = false;
  wantSignal = false;
  sensitivity = 0.0022;
  private dragging = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private skipLook = 0;

  bind(target: HTMLElement, onLock?: () => void): () => void {
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      // Key-repeat would re-arm E/F every frame after consume() deletes them.
      if (e.repeat && (e.code === "KeyE" || e.code === "KeyF")) return;
      this.keys.add(e.code);
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(
          e.code,
        )
      ) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const move = (e: MouseEvent) => {
      if (this.touchMode && !this.locked && !this.dragging) return;
      if (this.skipLook > 0) {
        this.skipLook -= 1;
        return;
      }
      if (this.locked) {
        this.applyLook(e.movementX, e.movementY);
        return;
      }
      if (!this.dragging) return;
      this.applyLook(e.clientX - this.lastDragX, e.clientY - this.lastDragY);
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
    };
    const pointerDown = (e: PointerEvent) => {
      if (this.touchMode && e.pointerType !== "mouse") return;
      if (e.button !== 0 && e.button !== 2) return;
      this.dragging = true;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      if (e.button === 0 && document.pointerLockElement !== target) {
        void target.requestPointerLock();
      }
    };
    const pointerUp = () => {
      this.dragging = false;
    };
    const context = (e: Event) => e.preventDefault();
    const lockChange = () => {
      this.locked = document.pointerLockElement === target;
      if (this.locked) {
        this.dragging = false;
        this.skipLook = 2;
        onLock?.();
      }
    };
    const onBlur = () => this.resetInput();
    const onVis = () => {
      if (document.hidden) this.resetInput();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mousemove", move);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    target.addEventListener("pointerdown", pointerDown);
    target.addEventListener("contextmenu", context);
    document.addEventListener("pointerlockchange", lockChange);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      target.removeEventListener("pointerdown", pointerDown);
      target.removeEventListener("contextmenu", context);
      document.removeEventListener("pointerlockchange", lockChange);
    };
  }

  resetInput(): void {
    this.keys.clear();
    this.moveAxis.x = 0;
    this.moveAxis.y = 0;
    this.lookAxis.x = 0;
    this.lookAxis.y = 0;
    this.sprintHeld = false;
    this.dragging = false;
    this.wantInteract = false;
    this.wantFlashlight = false;
    this.wantSignal = false;
  }

  discardToggles(): void {
    this.keys.delete("KeyF");
    this.keys.delete("KeyE");
    this.wantInteract = false;
    this.wantFlashlight = false;
  }

  applyLook(dx: number, dy: number, scale = 1): void {
    if (!this.inputEnabled) return;
    const cap = 72;
    const mx = Math.max(-cap, Math.min(cap, dx));
    const my = Math.max(-cap, Math.min(cap, dy));
    if (mx === 0 && my === 0) return;
    const lookY = this.invertY ? -my : my;
    this.yaw -= mx * this.sensitivity * scale;
    this.pitch -= lookY * this.sensitivity * scale;
    this.pitch = Math.max(-1.15, Math.min(1.15, this.pitch));
  }

  setMoveAxis(x: number, y: number): void {
    const mag = Math.hypot(x, y);
    if (mag < 0.08) {
      this.moveAxis.x = 0;
      this.moveAxis.y = 0;
      return;
    }
    const cap = Math.min(1, mag);
    this.moveAxis.x = (x / mag) * cap;
    this.moveAxis.y = (y / mag) * cap;
  }

  setLookAxis(x: number, y: number): void {
    const mag = Math.hypot(x, y);
    if (mag < 0.08) {
      this.lookAxis.x = 0;
      this.lookAxis.y = 0;
      return;
    }
    const curved = Math.min(1, mag);
    const power = curved * curved;
    this.lookAxis.x = (x / mag) * power;
    this.lookAxis.y = (y / mag) * power;
  }

  stepLook(dt: number): void {
    if (!this.inputEnabled) return;
    if (this.lookAxis.x === 0 && this.lookAxis.y === 0) return;
    const rate = 780;
    this.applyLook(this.lookAxis.x * rate * dt, -this.lookAxis.y * rate * dt);
  }

  speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  step(dt: number, role: Role, stamina: number, extraWalls: WallSeg[] = []): { sprinting: boolean; moving: boolean } {
    let fwd = this.moveAxis.y;
    let strafe = this.moveAxis.x;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) fwd += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) fwd -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) strafe -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) strafe += 1;
    const len = Math.hypot(fwd, strafe);
    if (len > 1) {
      fwd /= len;
      strafe /= len;
    }

    const wantSprint = this.sprintHeld || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const canSprint = wantSprint && stamina > 1 && fwd > 0.12;
    const base = role === "watcher" ? WATCHER_FLY_SPEED : canSprint ? SPRINT_SPEED : WALK_SPEED;
    const back = fwd < -0.04 ? 0.64 : 1;
    const side = Math.abs(strafe) > 0.2 && fwd < 0.2 ? 0.86 : 1;
    const maxSpeed = base * back * side;

    const dirX = len > 0 ? -Math.sin(this.yaw) * fwd + Math.cos(this.yaw) * strafe : 0;
    const dirZ = len > 0 ? -Math.cos(this.yaw) * fwd - Math.sin(this.yaw) * strafe : 0;
    const wishX = dirX * maxSpeed;
    const wishZ = dirZ * maxSpeed;
    const accel = role === "watcher" ? (len > 0.01 ? 14 : 10) : len > 0.01 ? (canSprint ? 11 : 9) : 13;
    this.vx = damp(this.vx, wishX, accel, dt);
    this.vz = damp(this.vz, wishZ, accel, dt);
    if (Math.hypot(this.vx, this.vz) < 0.04 && len < 0.01) {
      this.vx = 0;
      this.vz = 0;
    }

    const wishXStep = this.vx * dt;
    const wishZStep = this.vz * dt;
    if (role === "walker") {
      const walls = extraWalls.length ? WALLS.concat(extraWalls) : WALLS;
      const next = resolveMove(this.x, this.z, wishXStep, wishZStep, PLAYER_RADIUS, walls);
      const invDt = 1 / Math.max(dt, 1 / 240);
      this.vx = (next.x - this.x) * invDt;
      this.vz = (next.z - this.z) * invDt;
      this.x = next.x;
      this.z = next.z;
    } else {
      const next = resolveMove(this.x, this.z, wishXStep, wishZStep, 0.22, WALLS);
      const invDt = 1 / Math.max(dt, 1 / 240);
      this.vx = (next.x - this.x) * invDt;
      this.vz = (next.z - this.z) * invDt;
      this.x = next.x;
      this.z = next.z;
    }
    const moving = this.speed() > 0.18;
    return { sprinting: canSprint && moving, moving };
  }

  consume(code: string): boolean {
    if (!this.keys.has(code)) return false;
    this.keys.delete(code);
    return true;
  }

  consumeTap(kind: "interact" | "flashlight" | "signal"): boolean {
    if (kind === "interact" && this.wantInteract) {
      this.wantInteract = false;
      return true;
    }
    if (kind === "flashlight" && this.wantFlashlight) {
      this.wantFlashlight = false;
      return true;
    }
    if (kind === "signal" && this.wantSignal) {
      this.wantSignal = false;
      return true;
    }
    return false;
  }
}
