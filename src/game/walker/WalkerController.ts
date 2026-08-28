import { PLAYER_RADIUS, SPRINT_SPEED, WALK_SPEED, WATCHER_FLY_SPEED } from "../../../shared/constants";
import { WALLS, resolveMove, type WallSeg } from "../../../shared/map";
import type { Role } from "../../../shared/types";

export class WalkerController {
  keys = new Set<string>();
  yaw = 0;
  pitch = 0;
  x = 0;
  z = 0;
  locked = false;
  touchMode = false;
  invertY = false;
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

  bind(target: HTMLElement, onLock?: () => void): () => void {
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
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
      if (this.touchMode) return;
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
      if (this.touchMode) return;
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
        onLock?.();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mousemove", move);
    window.addEventListener("pointerup", pointerUp);
    target.addEventListener("pointerdown", pointerDown);
    target.addEventListener("contextmenu", context);
    document.addEventListener("pointerlockchange", lockChange);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("pointerup", pointerUp);
      target.removeEventListener("pointerdown", pointerDown);
      target.removeEventListener("contextmenu", context);
      document.removeEventListener("pointerlockchange", lockChange);
    };
  }

  applyLook(dx: number, dy: number, scale = 1): void {
    const lookY = this.invertY ? -dy : dy;
    this.yaw -= dx * this.sensitivity * scale;
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
    if (mag < 0.12) {
      this.lookAxis.x = 0;
      this.lookAxis.y = 0;
      return;
    }
    const cap = Math.min(1, mag);
    this.lookAxis.x = (x / mag) * cap;
    this.lookAxis.y = (y / mag) * cap;
  }

  stepLook(dt: number): void {
    if (this.lookAxis.x === 0 && this.lookAxis.y === 0) return;
    const rate = 920;
    this.applyLook(this.lookAxis.x * rate * dt, this.lookAxis.y * rate * dt);
  }

  step(dt: number, role: Role, stamina: number, extraWalls: WallSeg[] = []): { sprinting: boolean; moving: boolean } {
    const sprint = this.sprintHeld || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed =
      role === "watcher" ? WATCHER_FLY_SPEED : sprint && stamina > 1 ? SPRINT_SPEED : WALK_SPEED;
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
    const dz = -Math.cos(this.yaw) * fwd + Math.sin(this.yaw) * strafe;
    const wishX = dx * speed * dt;
    const wishZ = dz * speed * dt;
    if (role === "walker") {
      const walls = extraWalls.length ? WALLS.concat(extraWalls) : WALLS;
      const next = resolveMove(this.x, this.z, wishX, wishZ, PLAYER_RADIUS, walls);
      this.x = next.x;
      this.z = next.z;
    } else {
      const next = resolveMove(this.x, this.z, wishX, wishZ, 0.22, WALLS);
      this.x = next.x;
      this.z = next.z;
    }
    return { sprinting: sprint && len > 0 && stamina > 1, moving: len > 0 };
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
