import { PLAYER_RADIUS, SPRINT_SPEED, WALK_SPEED, WATCHER_FLY_SPEED } from "../../../shared/constants";
import { resolveMove } from "../../../shared/map";
import type { Role } from "../../../shared/types";

export class WalkerController {
  keys = new Set<string>();
  yaw = Math.PI / 2;
  pitch = 0;
  x = 0;
  z = 0;
  locked = false;
  touchMode = false;
  moveAxis = { x: 0, y: 0 };
  lookAxis = { x: 0, y: 0 };
  sprintHeld = false;
  wantInteract = false;
  wantFlashlight = false;
  sensitivity = 0.0022;

  bind(target: HTMLElement, onLock?: () => void): () => void {
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      this.keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const move = (e: MouseEvent) => {
      if (this.touchMode) return;
      if (!this.locked) return;
      this.applyLook(e.movementX, e.movementY);
    };
    const click = () => {
      if (this.touchMode) return;
      if (document.pointerLockElement !== target) {
        void target.requestPointerLock();
      }
    };
    const lockChange = () => {
      this.locked = document.pointerLockElement === target;
      if (this.locked) onLock?.();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mousemove", move);
    target.addEventListener("click", click);
    document.addEventListener("pointerlockchange", lockChange);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousemove", move);
      target.removeEventListener("click", click);
      document.removeEventListener("pointerlockchange", lockChange);
    };
  }

  applyLook(dx: number, dy: number, scale = 1): void {
    this.yaw -= dx * this.sensitivity * scale;
    this.pitch -= dy * this.sensitivity * scale;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
  }

  setLookAxis(x: number, y: number): void {
    const mag = Math.hypot(x, y);
    if (mag < 0.055) {
      this.lookAxis.x = 0;
      this.lookAxis.y = 0;
      return;
    }
    const cap = Math.min(1, mag);
    this.lookAxis.x = (x / mag) * cap;
    this.lookAxis.y = (y / mag) * cap;
  }

  stepLook(dt: number): void {
    const mag = Math.hypot(this.lookAxis.x, this.lookAxis.y);
    if (mag < 0.04) return;
    const t = Math.min(1, mag);
    const curved = t * t * (0.35 + 0.65 * t);
    const nx = this.lookAxis.x / mag;
    const ny = this.lookAxis.y / mag;
    const rate = 2.65 * (this.sensitivity / 0.0022);
    this.yaw -= nx * curved * rate * dt;
    this.pitch -= ny * curved * rate * dt;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
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

  step(dt: number, role: Role, stamina: number): { sprinting: boolean; moving: boolean } {
    const sprint =
      this.sprintHeld || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed =
      role === "watcher"
        ? WATCHER_FLY_SPEED
        : sprint && stamina > 1
          ? SPRINT_SPEED
          : WALK_SPEED;
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
    const dx = Math.sin(this.yaw) * fwd + Math.cos(this.yaw) * strafe;
    const dz = Math.cos(this.yaw) * fwd - Math.sin(this.yaw) * strafe;
    const wishX = dx * speed * dt;
    const wishZ = dz * speed * dt;
    if (role === "walker") {
      const next = resolveMove(this.x, this.z, wishX, wishZ, PLAYER_RADIUS);
      this.x = next.x;
      this.z = next.z;
    } else {
      this.x += wishX;
      this.z += wishZ;
    }
    return { sprinting: sprint && len > 0 && stamina > 1, moving: len > 0 };
  }

  consume(code: string): boolean {
    if (!this.keys.has(code)) return false;
    this.keys.delete(code);
    return true;
  }

  consumeTap(kind: "interact" | "flashlight"): boolean {
    if (kind === "interact" && this.wantInteract) {
      this.wantInteract = false;
      return true;
    }
    if (kind === "flashlight" && this.wantFlashlight) {
      this.wantFlashlight = false;
      return true;
    }
    return false;
  }
}
