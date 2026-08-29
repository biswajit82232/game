import { describe, expect, it } from "vitest";
import { GameSession } from "../server/gameState/GameSession";
import {
  CORRIDOR_FLOORS,
  DOORWAYS,
  WALLS,
  doorBlockers,
  doorwayCenter,
  getRoomAt,
  getRoomById,
  MAP_ROOMS,
  resolveMove,
  steerToward,
} from "../shared/map";
import { tickMonster } from "../server/gameState/monster";

describe("GameSession", () => {
  it("kills the walker and ends the game", () => {
    const session = new GameSession();
    session.killWalker();
    expect(session.walker.alive).toBe(false);
    expect(session.ended?.title).toContain("HOLLOW");
    expect(session.drainEvents().some((e) => e.type === "death")).toBe(true);
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
    const exit = getRoomById("exit")!;
    session.walker.position = { x: exit.cx, y: 1.6, z: exit.cz };
    session.watcher.position = { x: exit.cx, y: 2.4, z: exit.cz };
    session.tick(0.1);
    expect(session.ended).not.toBeNull();
    expect(["escape", "betrayal", "hollow", "loop"]).toContain(session.ended?.ending);
  });

  it("builds Site 07 as one connected building, not floating rooms", () => {
    const share = (a: string, b: string, axis: "x" | "z") => {
      const ra = getRoomById(a)!;
      const rb = getRoomById(b)!;
      if (axis === "x") expect(ra.cx + ra.hw).toBeCloseTo(rb.cx - rb.hw, 5);
      else expect(ra.cz + ra.hd).toBeCloseTo(rb.cz - rb.hd, 5);
    };
    share("entrance", "reception", "x");
    share("reception", "hallway", "x");
    share("hallway", "office", "x");
    share("office", "exit", "x");
    share("reception", "security", "z");
    share("storage", "reception", "z");
    share("basement", "storage", "z");
    share("hallway", "generator", "z");
    share("children", "hallway", "z");
    share("generator", "ritual", "x");
    share("ritual", "office", "x");
    expect(CORRIDOR_FLOORS).toHaveLength(0);
  });

  it("spawns interactables inside their rooms", () => {
    const session = new GameSession();
    for (const item of session.items) {
      expect(getRoomAt(item.position.x, item.position.z)?.id).toBe(item.roomId);
    }
  });

  it("solo mode hides keypad solution until Eli tells it", () => {
    const session = new GameSession(true);
    const snap = session.snapshotFor("walker");
    expect(snap.solo).toBe(true);
    expect(snap.symbolSolution).toBeNull();
    expect(snap.powerSafeSwitch).toBeGreaterThanOrEqual(0);
    (session as unknown as { eliToldSymbols: boolean }).eliToldSymbols = true;
    expect(session.snapshotFor("walker").symbolSolution).toHaveLength(4);
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

  it("solo AI follows the walker and holds signal only at the office", () => {
    const session = new GameSession(true);
    session.tick(0.2);
    expect(session.watcher.holdingSignal).toBe(false);
    expect(session.watcher.position.x).toBe(session.walker.position.x);
    session.walker.position = { x: getRoomById("office")!.cx, y: 1.6, z: 0 };
    session.tick(0.2);
    expect(session.watcher.holdingSignal).toBe(true);
  });

  it("ignores malformed move payloads", () => {
    const session = new GameSession();
    const x = session.walker.position.x;
    session.applyMove("walker", undefined as never);
    expect(session.walker.position.x).toBe(x);
  });

  it("includes a coarse signal quality instead of raw trust", () => {
    const session = new GameSession();
    expect(session.snapshotFor("walker").signalQuality).toBe("STABLE");
  });

  it("completes the ritual secret when the walker enters the ritual room", () => {
    const session = new GameSession();
    const inner = session as unknown as { secretKind: string };
    inner.secretKind = "ritual";
    const ritual = getRoomById("ritual")!;
    session.walker.position = { x: ritual.cx, y: 1.6, z: ritual.cz };
    session.applyMove(
      "walker",
      { x: ritual.cx, z: ritual.cz, yaw: 0, pitch: 0, sprinting: false },
      0.05,
    );
    expect((session as unknown as { secretComplete: boolean }).secretComplete).toBe(true);
  });

  it("does not kill on a small look twitch during a behind-event", () => {
    const session = new GameSession();
    session.monster.state.behindWalker = true;
    session.monster.state.behindTimer = 8;
    (session as unknown as { behindStartYaw: number }).behindStartYaw = 0;
    session.walker.yaw = 0;
    session.applyMove(
      "walker",
      {
        x: session.walker.position.x,
        z: session.walker.position.z,
        yaw: 0.35,
        pitch: 0,
        sprinting: false,
      },
      0.2,
    );
    session.tick(0.2);
    expect(session.walker.alive).toBe(true);
  });

  it("kills if the walker holds a look toward the rear", () => {
    const session = new GameSession();
    session.time = 25;
    session.monster.state.behindWalker = true;
    session.monster.state.behindTimer = 8;
    (session as unknown as { behindStartYaw: number; warningWindow: boolean }).behindStartYaw = 0;
    (session as unknown as { warningWindow: boolean }).warningWindow = true;
    session.walker.yaw = 0;
    for (let i = 0; i < 12; i++) {
      session.applyMove(
        "walker",
        {
          x: session.walker.position.x,
          z: session.walker.position.z,
          yaw: Math.PI,
          pitch: 0,
          sprinting: false,
        },
        1 / 15,
      );
      if (session.ended) break;
      session.tick(1 / 15);
    }
    expect(session.walker.alive).toBe(false);
  });

  it("steers The Hollow through doorways instead of the void", () => {
    const ritual = getRoomById("ritual")!;
    const entrance = getRoomById("entrance")!;
    const p = steerToward(ritual.cx, ritual.cz, entrance.cx, entrance.cz);
    expect(getRoomAt(p.x, p.z)?.id).toBeTruthy();
    expect(p.x).not.toBe(entrance.cx);
  });

  it("does not leak the keypad when Eli claims to be lying", () => {
    let lied = false;
    for (let i = 0; i < 120 && !lied; i++) {
      const s = new GameSession(true);
      s.walker.position = { x: getRoomById("security")!.cx, y: 1.6, z: getRoomById("security")!.cz };
      (s as unknown as { signalCooldown: number }).signalCooldown = 0;
      s.tuneSignal(true);
      s.tuneSignal(false);
      const chats = s.drainChats();
      if (chats.some((c) => c.text.includes("lying"))) {
        lied = true;
        expect((s as unknown as { eliToldSymbols: boolean }).eliToldSymbols).toBe(false);
        expect(s.snapshotFor("walker").symbolSolution).toBeNull();
      }
    }
    expect(lied).toBe(true);
  });

  it("keeps the exit open once unlocked and still wins", () => {
    const session = new GameSession();
    const exitDoor = session.doors.find((d) => d.id === "door-office-exit")!;
    exitDoor.locked = false;
    exitDoor.open = true;
    const c = doorwayCenter(DOORWAYS.find((d) => d.id === "door-office-exit")!);
    session.walker.position = { x: c!.x, y: 1.6, z: c!.z };
    session.interact("walker", "door-office-exit");
    expect(exitDoor.open).toBe(true);
    const exit = getRoomById("exit")!;
    session.walker.position = { x: exit.cx, y: 1.6, z: exit.cz };
    session.watcher.position = { x: exit.cx, y: 2.4, z: exit.cz };
    session.tick(0.1);
    expect(session.ended).not.toBeNull();
  });

  it("blocks walking through a closed unlocked office door", () => {
    const session = new GameSession(true);
    const officeDoor = session.doors.find((d) => d.id === "door-hallway-office")!;
    officeDoor.locked = false;
    officeDoor.open = false;
    const walls = [...WALLS, ...doorBlockers(session.doors)];
    const hall = getRoomById("hallway")!;
    let x = hall.cx + hall.hw - 0.6;
    let z = hall.cz;
    for (let i = 0; i < 40; i++) {
      const next = resolveMove(x, z, 0.4, 0, 0.35, walls);
      x = next.x;
      z = next.z;
    }
    expect(getRoomAt(x, z)?.id).not.toBe("office");
    expect(x).toBeLessThan(getRoomById("office")!.cx - getRoomById("office")!.hw);
  });

  it("solo exit objective does not tell the Walker to Hold R", () => {
    const session = new GameSession(true);
    for (const o of session.objectives) {
      if (o.id !== "obj-exit" && o.id !== "obj-escape") o.done = true;
    }
    const text = session.snapshotFor("walker").objective.text;
    expect(text.toLowerCase()).not.toContain("hold r");
    expect(text.toLowerCase()).toMatch(/panel|eli/);
  });

  it("keeps a hunting Hollow inside rooms while closing", () => {
    const session = new GameSession();
    const start = { ...session.monster.state.position };
    session.monster.state.ai = "hunting";
    session.monster.stateTimer = 8;
    session.monster.target = { x: session.walker.position.x, y: 0, z: session.walker.position.z };
    for (let i = 0; i < 20; i++) {
      tickMonster(
        session.monster,
        1 / 15,
        { x: session.walker.position.x, z: session.walker.position.z, yaw: session.walker.yaw },
        false,
        false,
        null,
      );
    }
    const room = getRoomAt(session.monster.state.position.x, session.monster.state.position.z);
    const nearBuilding = MAP_ROOMS.some(
      (r) => Math.hypot(session.monster.state.position.x - r.cx, session.monster.state.position.z - r.cz) < r.hw + r.hd + 3,
    );
    expect(room || nearBuilding).toBeTruthy();
    const moved =
      Math.hypot(session.monster.state.position.x - start.x, session.monster.state.position.z - start.z) > 0.05;
    expect(moved || room?.id === "entrance" || room?.id === "ritual").toBe(true);
  });
});
