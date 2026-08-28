import { describe, expect, it } from "vitest";
import { WalkerController } from "../src/game/walker/WalkerController";

describe("WalkerController", () => {
  it("walks the direction the camera faces (yaw 0 looks -Z)", () => {
    const c = new WalkerController();
    c.yaw = 0;
    c.x = 0;
    c.z = 0;
    c.keys.add("KeyW");
    c.step(0.2, "walker", 100);
    expect(c.z).toBeLessThan(-0.2);
    expect(Math.abs(c.x)).toBeLessThan(0.05);
  });

  it("walks right when looking east", () => {
    const c = new WalkerController();
    c.yaw = Math.PI / 2;
    c.x = 0;
    c.z = 0;
    c.keys.add("KeyW");
    c.step(0.2, "walker", 100);
    expect(c.x).toBeGreaterThan(0.2);
    expect(Math.abs(c.z)).toBeLessThan(0.05);
  });

  it("strafes right relative to look", () => {
    const c = new WalkerController();
    c.yaw = 0;
    c.keys.add("KeyD");
    c.step(0.2, "walker", 100);
    expect(c.x).toBeGreaterThan(0.2);
  });
});
