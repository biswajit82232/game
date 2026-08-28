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

  it("solo mode includes watcher puzzle assist for the walker", () => {
    const session = new GameSession(true);
    const snap = session.snapshotFor("walker");
    expect(snap.solo).toBe(true);
    expect(snap.symbolSolution).toHaveLength(4);
    expect(snap.powerSafeSwitch).toBeGreaterThanOrEqual(0);
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

  it("keeps note overlay across several ticks", () => {
    const session = new GameSession();
    const note = session.items.find((i) => i.type === "note")!;
    session.walker.position.x = note.position.x;
    session.walker.position.z = note.position.z;
    session.interact("walker", note.id);
    expect(session.overlay).toBeTruthy();
    session.tick(0.2);
    expect(session.overlay).toBeTruthy();
    session.tick(20);
    expect(session.overlay).toBeNull();
  });

  it("does not re-award the exit puzzle after the door is open", () => {
    const session = new GameSession();
    session.generatorOn = true;
    session.puzzles.find((p) => p.id === "symbols")!.solved = true;
    session.walker.inventory.push("office-key");
    session.watcher.holdingSignal = true;
    const panel = session.items.find((i) => i.id === "exit-panel")!;
    session.walker.position.x = panel.position.x;
    session.walker.position.z = panel.position.z;
    session.interact("walker", panel.id);
    const solved = session.stats.puzzlesSolved;
    session.interact("walker", panel.id);
    expect(session.stats.puzzlesSolved).toBe(solved);
    expect(session.doors.find((d) => d.id === "door-office-exit")?.open).toBe(true);
  });

  it("ignores malformed move payloads", () => {
    const session = new GameSession();
    const x = session.walker.position.x;
    session.applyMove("walker", undefined as never);
    expect(session.walker.position.x).toBe(x);
  });
});
