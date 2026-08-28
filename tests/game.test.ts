import { describe, expect, it } from "vitest";
import { GameSession } from "../server/gameState/GameSession";

describe("GameSession", () => {
  it("kills the walker and ends the game", () => {
    const session = new GameSession();
    session.killWalker();
    expect(session.walker.alive).toBe(false);
    expect(session.ended?.title).toContain("HOLLOW");
  });

  it("rejects puzzle input from the watcher", () => {
    const session = new GameSession();
    const ok = session.submitPuzzle("watcher", "symbols", session.symbolSolution);
    expect(ok).toBe(false);
    expect(session.puzzles.find((p) => p.id === "symbols")?.solved).toBe(false);
  });

  it("solves the symbol puzzle when the walker is at the keypad", () => {
    const session = new GameSession();
    const keypad = session.items.find((i) => i.id === "keypad-security")!;
    session.walker.position.x = keypad.position.x;
    session.walker.position.z = keypad.position.z;
    const ok = session.submitPuzzle("walker", "symbols", [...session.symbolSolution]);
    expect(ok).toBe(true);
    expect(session.puzzles.find((p) => p.id === "symbols")?.solved).toBe(true);
  });

  it("wins when both are in the open exit", () => {
    const session = new GameSession();
    const door = session.doors.find((d) => d.id === "door-office-exit")!;
    door.open = true;
    door.locked = false;
    session.walker.position = { x: 52, y: 1.6, z: 0 };
    session.watcher.position = { x: 52, y: 2.4, z: 0 };
    session.tick(0.1);
    expect(session.ended).not.toBeNull();
    expect(["escape", "betrayal", "hollow", "loop"]).toContain(session.ended?.ending);
  });

  it("does not allow flashlight when battery is empty", () => {
    const session = new GameSession();
    session.walker.battery = 0;
    session.setFlashlight(true);
    expect(session.walker.flashlightOn).toBe(false);
  });

  it("charges mode switch energy cost", () => {
    const session = new GameSession();
    const before = session.watcher.energy;
    expect(session.switchMode("spirit")).toBe(true);
    expect(session.watcher.energy).toBeLessThan(before);
    expect(session.switchMode("echo")).toBe(false);
  });
});
