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

  it("walks with the camera when yaw is PI/2 (camera looks -X)", () => {
    const c = new WalkerController();
    c.yaw = Math.PI / 2;
    c.x = 0;
    c.z = 0;
    c.keys.add("KeyW");
    c.step(0.2, "walker", 100);
    expect(c.x).toBeLessThan(-0.2);
    expect(Math.abs(c.z)).toBeLessThan(0.05);
  });

  it("look stick up pitches the camera up", () => {
    const c = new WalkerController();
    c.pitch = 0;
    c.setLookAxis(0, 1);
    c.stepLook(0.05);
    expect(c.pitch).toBeGreaterThan(0);
  });

  it("strafes right relative to look", () => {
    const c = new WalkerController();
    c.yaw = 0;
    c.keys.add("KeyD");
    c.step(0.2, "walker", 100);
    expect(c.x).toBeGreaterThan(0.2);
  });
});
