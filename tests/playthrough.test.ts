import { describe, expect, it } from "vitest";
import { GameSession } from "../server/gameState/GameSession";
import {
  DOORWAYS,
  doorOnRoom,
  getRoomAt,
  getRoomById,
} from "../shared/map";

function quiet(session: GameSession): void {
  session.monster.stateTimer = 100;
  session.monster.behindCooldown = 100;
  session.monster.state.ai = "idle";
  session.monster.state.behindWalker = false;
}

function walkTo(session: GameSession, x: number, z: number, seconds = 30): boolean {
  const dt = 1 / 15;
  const ticks = Math.ceil(seconds / dt);
  for (let i = 0; i < ticks; i++) {
    quiet(session);
    const px = session.walker.position.x;
    const pz = session.walker.position.z;
    const dx = x - px;
    const dz = z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.48) return true;
    const step = Math.min(0.48, dist);
    session.applyMove(
      "walker",
      {
        x: px + (dx / dist) * step,
        z: pz + (dz / dist) * step,
        yaw: session.walker.yaw,
        pitch: 0,
        sprinting: true,
      },
      dt,
    );
    session.tick(dt);
    if (session.ended) return true;
    if (!session.walker.alive) return false;
  }
  return Math.hypot(session.walker.position.x - x, session.walker.position.z - z) < 0.75;
}

function roomPath(fromId: string, toId: string): string[] {
  if (fromId === toId) return [fromId];
  const adj = new Map<string, string[]>();
  for (const d of DOORWAYS) {
    if (!adj.has(d.from)) adj.set(d.from, []);
    if (!adj.has(d.to)) adj.set(d.to, []);
    adj.get(d.from)!.push(d.to);
    adj.get(d.to)!.push(d.from);
  }
  const q = [fromId];
  const prev = new Map<string, string | null>([[fromId, null]]);
  while (q.length) {
    const cur = q.shift()!;
    if (cur === toId) break;
    for (const n of adj.get(cur) ?? []) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      q.push(n);
    }
  }
  if (!prev.has(toId)) return [];
  const out = [toId];
  while (out[0] !== fromId) {
    const p = prev.get(out[0]!)!;
    out.unshift(p);
  }
  return out;
}

function waypoints(fromId: string, toId: string): { x: number; z: number }[] {
  const rooms = roomPath(fromId, toId);
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < rooms.length; i++) {
    const room = getRoomById(rooms[i]!)!;
    if (i > 0) {
      const prev = getRoomById(rooms[i - 1]!)!;
      pts.push(doorOnRoom(prev, room));
      pts.push(doorOnRoom(room, prev));
    }
    pts.push({ x: room.cx, z: room.cz });
  }
  return pts;
}

function follow(session: GameSession, pts: { x: number; z: number }[]): void {
  for (const p of pts) {
    const ok = walkTo(session, p.x, p.z);
    if (!ok) {
      throw new Error(
        `stuck going to ${p.x.toFixed(1)},${p.z.toFixed(1)} (at ${session.walker.position.x.toFixed(1)},${session.walker.position.z.toFixed(1)})`,
      );
    }
  }
}

function here(session: GameSession): string {
  return getRoomAt(session.walker.position.x, session.walker.position.z)?.id ?? "void";
}

describe("full walkable run", () => {
  it("blocks the locked office instead of letting you walk around it", () => {
    const session = new GameSession(true);
    follow(session, waypoints("entrance", "hallway"));
    expect(here(session)).toBe("hallway");
    const office = getRoomById("office")!;
    walkTo(session, office.cx, office.cz, 8);
    expect(here(session)).not.toBe("office");
    expect(session.walker.position.x).toBeLessThan(office.cx - office.hw);
  });

  it("keeps the walker inside connecting halls instead of the void", () => {
    const session = new GameSession(true);
    follow(session, waypoints("entrance", "hallway"));
    walkTo(session, 26, 40, 10);
    expect(here(session)).not.toBe("void");
    expect(session.walker.position.z).toBeLessThan(20);
  });

  it("places the exit panel inside the office", () => {
    const session = new GameSession(true);
    const panel = session.items.find((i) => i.id === "exit-panel")!;
    expect(getRoomAt(panel.position.x, panel.position.z)?.id).toBe("office");
  });

  it("can restore power, get the key, solve the keypad, and escape in solo", () => {
    const session = new GameSession(true);
    follow(session, waypoints("entrance", "generator"));
    expect(here(session)).toBe("generator");
    const sw = session.items.find((i) => i.id === `switch-${session.powerSafeSwitch}`)!;
    expect(walkTo(session, sw.position.x, sw.position.z)).toBe(true);
    session.interact("walker", sw.id);
    expect(session.generatorOn).toBe(true);

    const key = session.items.find((i) => i.id === "office-key")!;
    follow(session, [
      ...waypoints(here(session), key.roomId),
      { x: key.position.x, z: key.position.z },
    ]);
    session.interact("walker", key.id);
    expect(session.walker.inventory).toContain("office-key");

    const pad = session.items.find((i) => i.id === "keypad-security")!;
    follow(session, [
      ...waypoints(here(session), "security"),
      { x: pad.position.x, z: pad.position.z },
    ]);
    expect(session.submitPuzzle("walker", "symbols", [...session.symbolSolution])).toBe(true);

    follow(session, waypoints(here(session), "hallway"));
    const office = getRoomById("office")!;
    const hall = getRoomById("hallway")!;
    const officeDoorPos = doorOnRoom(hall, office);
    expect(walkTo(session, officeDoorPos.x - 1.15, officeDoorPos.z)).toBe(true);
    session.interact("walker", "door-hallway-office");
    expect(session.doors.find((d) => d.id === "door-hallway-office")?.locked).toBe(false);

    const panel = session.items.find((i) => i.id === "exit-panel")!;
    follow(session, [
      doorOnRoom(office, hall),
      { x: office.cx, z: office.cz },
      { x: panel.position.x, z: panel.position.z },
    ]);
    session.interact("walker", panel.id);
    expect(session.doors.find((d) => d.id === "door-office-exit")?.open).toBe(true);

    const exit = getRoomById("exit")!;
    follow(session, [
      doorOnRoom(office, exit),
      doorOnRoom(exit, office),
      { x: exit.cx, z: exit.cz },
    ]);
    for (let i = 0; i < 8; i++) {
      quiet(session);
      session.tick(1 / 15);
    }
    expect(session.ended).not.toBeNull();
    expect(["escape", "betrayal", "hollow", "loop"]).toContain(session.ended?.ending);
  });
});
