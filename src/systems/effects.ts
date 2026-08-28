export type HorrorEffect =
  | "static"
  | "shake"
  | "heartbeat"
  | "vignette"
  | "blur"
  | "distortion"
  | "flash"
  | "darkness"
  | "chromatic";

export interface EffectState {
  shake: number;
  grain: number;
  heartbeat: number;
  vignette: number;
  blur: number;
  distortion: number;
  flash: number;
  darkness: number;
  chromatic: number;
}

const EMPTY: EffectState = {
  shake: 0,
  grain: 0,
  heartbeat: 0,
  vignette: 0,
  blur: 0,
  distortion: 0,
  flash: 0,
  darkness: 0,
  chromatic: 0,
};

export class EffectBus {
  state: EffectState = { ...EMPTY };
  private timers: number[] = [];

  trigger(name: HorrorEffect, duration: number, intensity = 1): void {
    this.state[name === "static" ? "grain" : name] = intensity;
    const id = window.setTimeout(() => {
      this.state[name === "static" ? "grain" : name] = 0;
    }, duration * 1000);
    this.timers.push(id);
  }

  tick(dt: number): void {
    (Object.keys(this.state) as (keyof EffectState)[]).forEach((k) => {
      this.state[k] = Math.max(0, this.state[k] - dt * 0.55);
    });
  }

  reset(): void {
    this.state = { ...EMPTY };
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
  }
}

export function triggerHorrorEffect(bus: EffectBus, name: HorrorEffect, duration: number): void {
  bus.trigger(name, duration);
}
