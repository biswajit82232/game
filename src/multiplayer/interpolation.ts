import { lerp } from "../../shared/utils";
import type { Vec3 } from "../../shared/types";

export class InterpolatedVec {
  private from: Vec3 = { x: 0, y: 0, z: 0 };
  private to: Vec3 = { x: 0, y: 0, z: 0 };
  private t = 1;

  push(next: Vec3): void {
    this.from = this.sample();
    this.to = { ...next };
    this.t = 0;
  }

  sample(dt = 1 / 60): Vec3 {
    this.t = Math.min(1, this.t + dt / 0.09);
    return {
      x: lerp(this.from.x, this.to.x, this.t),
      y: lerp(this.from.y, this.to.y, this.t),
      z: lerp(this.from.z, this.to.z, this.t),
    };
  }
}
