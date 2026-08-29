import type { AABB } from "./types";

export interface RoomBox {
  id: string;
  name: string;
  cx: number;
  cz: number;
  hw: number;
  hd: number;
}

export interface DoorwayDef {
  id: string;
  from: string;
  to: string;
  locked?: boolean;
  needsKey?: string;
  isExit?: boolean;
}

export const WALL_HEIGHT = 3.2;
export const DOOR_WIDTH = 1.7;
export const DOOR_HEIGHT = 2.35;
export const WALL_THICKNESS = 0.28;

export const MAP_ROOMS: RoomBox[] = [
  { id: "entrance", name: "Entrance", cx: 0, cz: 0, hw: 3.6, hd: 3.4 },
  { id: "reception", name: "Reception", cx: 10, cz: 0, hw: 6.4, hd: 5.5 },
  { id: "hallway", name: "Hallway", cx: 24.6, cz: 0, hw: 8.2, hd: 1.85 },
  { id: "security", name: "Security Room", cx: 10, cz: 10.1, hw: 4.5, hd: 4.6 },
  { id: "generator", name: "Generator Room", cx: 21, cz: 6.25, hw: 4.2, hd: 4.4 },
  { id: "office", name: "Locked Office", cx: 38.2, cz: 0, hw: 5.4, hd: 4.6 },
  { id: "exit", name: "Exit", cx: 47.6, cz: 0, hw: 4.0, hd: 3.6 },
  { id: "storage", name: "Storage Room", cx: 10, cz: -9.9, hw: 4.5, hd: 4.4 },
  { id: "children", name: "Children's Room", cx: 24.6, cz: -6.15, hw: 4.5, hd: 4.3 },
  { id: "basement", name: "Basement", cx: 10, cz: -18.9, hw: 5.0, hd: 4.6 },
  { id: "ritual", name: "Ritual Room", cx: 29.0, cz: 6.25, hw: 3.8, hd: 4.4 },
];

export const DOORWAYS: DoorwayDef[] = [
  { id: "door-entrance-reception", from: "entrance", to: "reception" },
  { id: "door-reception-hallway", from: "reception", to: "hallway" },
  { id: "door-reception-security", from: "reception", to: "security" },
  { id: "door-reception-storage", from: "reception", to: "storage" },
  { id: "door-hallway-office", from: "hallway", to: "office", locked: true, needsKey: "office-key" },
  { id: "door-hallway-generator", from: "hallway", to: "generator" },
  { id: "door-hallway-children", from: "hallway", to: "children" },
  { id: "door-storage-basement", from: "storage", to: "basement" },
  { id: "door-office-exit", from: "office", to: "exit", locked: true, isExit: true },
  { id: "door-generator-ritual", from: "generator", to: "ritual" },
];

export function roomBounds(room: RoomBox): AABB {
  return {
    minX: room.cx - room.hw,
    maxX: room.cx + room.hw,
    minY: 0,
    maxY: WALL_HEIGHT,
    minZ: room.cz - room.hd,
    maxZ: room.cz + room.hd,
  };
}

export function getRoomById(id: string): RoomBox | undefined {
  return MAP_ROOMS.find((r) => r.id === id);
}

export function getRoomAt(x: number, z: number): RoomBox | undefined {
  return MAP_ROOMS.find(
    (r) =>
      x >= r.cx - r.hw - 0.15 &&
      x <= r.cx + r.hw + 0.15 &&
      z >= r.cz - r.hd - 0.15 &&
      z <= r.cz + r.hd + 0.15,
  );
}

/** Door threshold on `room`'s wall that faces `other`. */
export function doorOnRoom(room: RoomBox, other: RoomBox): { x: number; z: number } {
  const dx = other.cx - room.cx;
  const dz = other.cz - room.cz;
  if (Math.abs(dx) > Math.abs(dz)) {
    return {
      x: dx > 0 ? room.cx + room.hw : room.cx - room.hw,
      z: (Math.max(room.cz - room.hd, other.cz - other.hd) + Math.min(room.cz + room.hd, other.cz + other.hd)) / 2,
    };
  }
  return {
    z: dz > 0 ? room.cz + room.hd : room.cz - room.hd,
    x: (Math.max(room.cx - room.hw, other.cx - other.hw) + Math.min(room.cx + room.hw, other.cx + other.hw)) / 2,
  };
}

export function doorwayCenter(def: DoorwayDef): { x: number; z: number; yaw: number } | null {
  const a = getRoomById(def.from);
  const b = getRoomById(def.to);
  if (!a || !b) return null;
  const p = doorOnRoom(a, b);
  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  // Door meshes are wide on local X / thin on local Z. East–west openings span world Z,
  // so they need yaw = π/2; north–south openings span world X and use yaw = 0.
  return { x: p.x, z: p.z, yaw: Math.abs(dx) > Math.abs(dz) ? Math.PI / 2 : 0 };
}

export function roomPath(fromId: string, toId: string): string[] {
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

/** Next point The Hollow should walk toward without leaving corridors. */
export function steerToward(x: number, z: number, tx: number, tz: number): { x: number; z: number } {
  const from = getRoomAt(x, z);
  const to = getRoomAt(tx, tz);
  if (!from) {
    let best = MAP_ROOMS[0]!;
    let bestD = Infinity;
    for (const r of MAP_ROOMS) {
      const d = (r.cx - x) ** 2 + (r.cz - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return { x: best.cx, z: best.cz };
  }
  if (!to || from.id === to.id) return { x: tx, z: tz };
  const path = roomPath(from.id, to.id);
  if (path.length < 2) return { x: tx, z: tz };
  const next = getRoomById(path[1]!)!;
  const door = doorOnRoom(from, next);
  if (Math.hypot(door.x - x, door.z - z) < 0.6) return doorOnRoom(next, from);
  return door;
}

export interface WallSeg {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function addWall(walls: WallSeg[], minX: number, maxX: number, minZ: number, maxZ: number): void {
  if (maxX - minX < 0.05 || maxZ - minZ < 0.05) return;
  walls.push({ minX, maxX, minZ, maxZ });
}

function gapOnEdge(
  room: RoomBox,
  side: "n" | "s" | "e" | "w",
): { start: number; end: number }[] {
  const gaps: { start: number; end: number }[] = [];
  for (const d of DOORWAYS) {
    if (d.from !== room.id && d.to !== room.id) continue;
    const otherId = d.from === room.id ? d.to : d.from;
    const other = getRoomById(otherId);
    if (!other) continue;
    const dx = other.cx - room.cx;
    const dz = other.cz - room.cz;
    const east = dx > 0 && Math.abs(dx) > Math.abs(dz);
    const west = dx < 0 && Math.abs(dx) > Math.abs(dz);
    const north = dz > 0 && Math.abs(dz) >= Math.abs(dx);
    const south = dz < 0 && Math.abs(dz) >= Math.abs(dx);
    const c = doorOnRoom(room, other);
    if (side === "e" && east) {
      gaps.push({ start: c.z - DOOR_WIDTH / 2, end: c.z + DOOR_WIDTH / 2 });
    }
    if (side === "w" && west) {
      gaps.push({ start: c.z - DOOR_WIDTH / 2, end: c.z + DOOR_WIDTH / 2 });
    }
    if (side === "n" && north) {
      gaps.push({ start: c.x - DOOR_WIDTH / 2, end: c.x + DOOR_WIDTH / 2 });
    }
    if (side === "s" && south) {
      gaps.push({ start: c.x - DOOR_WIDTH / 2, end: c.x + DOOR_WIDTH / 2 });
    }
  }
  return gaps;
}

/** West/south faces that sit on a shared room edge — the other room already owns that wall. */
function ownedByNeighbor(room: RoomBox, side: "w" | "s"): { start: number; end: number }[] {
  const gaps: { start: number; end: number }[] = [];
  for (const other of MAP_ROOMS) {
    if (other.id === room.id) continue;
    if (side === "w") {
      if (Math.abs(other.cx + other.hw - (room.cx - room.hw)) > 0.12) continue;
      const start = Math.max(room.cz - room.hd, other.cz - other.hd);
      const end = Math.min(room.cz + room.hd, other.cz + other.hd);
      if (end - start > 0.05) gaps.push({ start, end });
    } else {
      if (Math.abs(other.cz + other.hd - (room.cz - room.hd)) > 0.12) continue;
      const start = Math.max(room.cx - room.hw, other.cx - other.hw);
      const end = Math.min(room.cx + room.hw, other.cx + other.hw);
      if (end - start > 0.05) gaps.push({ start, end });
    }
  }
  return gaps;
}

function splitEdge(
  start: number,
  end: number,
  gaps: { start: number; end: number }[],
): { start: number; end: number }[] {
  let segs = [{ start, end }];
  for (const g of gaps) {
    const next: { start: number; end: number }[] = [];
    for (const s of segs) {
      if (g.end <= s.start || g.start >= s.end) {
        next.push(s);
        continue;
      }
      if (g.start > s.start) next.push({ start: s.start, end: Math.min(g.start, s.end) });
      if (g.end < s.end) next.push({ start: Math.max(g.end, s.start), end: s.end });
    }
    segs = next;
  }
  return segs;
}

export function buildWalls(): WallSeg[] {
  const walls: WallSeg[] = [];
  const t = WALL_THICKNESS;
  for (const room of MAP_ROOMS) {
    const x0 = room.cx - room.hw;
    const x1 = room.cx + room.hw;
    const z0 = room.cz - room.hd;
    const z1 = room.cz + room.hd;

    for (const s of splitEdge(z0, z1, gapOnEdge(room, "e"))) {
      addWall(walls, x1 - t / 2, x1 + t / 2, s.start, s.end);
    }
    for (const s of splitEdge(z0, z1, [...gapOnEdge(room, "w"), ...ownedByNeighbor(room, "w")])) {
      addWall(walls, x0 - t / 2, x0 + t / 2, s.start, s.end);
    }
    for (const s of splitEdge(x0, x1, gapOnEdge(room, "n"))) {
      addWall(walls, s.start, s.end, z1 - t / 2, z1 + t / 2);
    }
    for (const s of splitEdge(x0, x1, [...gapOnEdge(room, "s"), ...ownedByNeighbor(room, "s")])) {
      addWall(walls, s.start, s.end, z0 - t / 2, z0 + t / 2);
    }
  }
  return walls;
}

export interface CorridorFloor {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Solid walls along the sides of the gaps between rooms so players cannot walk into the void. */
export function buildCorridors(): { walls: WallSeg[]; floors: CorridorFloor[] } {
  const walls: WallSeg[] = [];
  const floors: CorridorFloor[] = [];
  const t = WALL_THICKNESS;
  const inner = DOOR_WIDTH / 2;
  for (const def of DOORWAYS) {
    const a = getRoomById(def.from);
    const b = getRoomById(def.to);
    if (!a || !b) continue;
    const from = doorOnRoom(a, b);
    const to = doorOnRoom(b, a);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if (Math.abs(dx) >= Math.abs(dz)) {
      const x0 = Math.min(from.x, to.x);
      const x1 = Math.max(from.x, to.x);
      if (x1 - x0 < 0.12) continue;
      const z = (from.z + to.z) / 2;
      addWall(walls, x0, x1, z + inner, z + inner + t);
      addWall(walls, x0, x1, z - inner - t, z - inner);
      floors.push({ x: (x0 + x1) / 2, z, w: x1 - x0 + 0.2, d: DOOR_WIDTH });
    } else {
      const z0 = Math.min(from.z, to.z);
      const z1 = Math.max(from.z, to.z);
      if (z1 - z0 < 0.12) continue;
      const x = (from.x + to.x) / 2;
      addWall(walls, x + inner, x + inner + t, z0, z1);
      addWall(walls, x - inner - t, x - inner, z0, z1);
      floors.push({ x, z: (z0 + z1) / 2, w: DOOR_WIDTH, d: z1 - z0 + 0.2 });
    }
  }
  return { walls, floors };
}

const CORRIDOR = buildCorridors();
export const CORRIDOR_FLOORS = CORRIDOR.floors;
export const WALLS = [...buildWalls(), ...CORRIDOR.walls];

/** Collision for locked doors so the office and exit cannot be skipped. */
export function doorBlockers(doors: { id: string; open: boolean; locked: boolean }[]): WallSeg[] {
  const walls: WallSeg[] = [];
  const t = WALL_THICKNESS + 0.08;
  for (const state of doors) {
    if (!state.locked) continue;
    const def = DOORWAYS.find((d) => d.id === state.id);
    if (!def) continue;
    const c = doorwayCenter(def);
    const a = getRoomById(def.from);
    const b = getRoomById(def.to);
    if (!c || !a || !b) continue;
    if (Math.abs(b.cx - a.cx) > Math.abs(b.cz - a.cz)) {
      addWall(walls, c.x - t, c.x + t, c.z - DOOR_WIDTH / 2, c.z + DOOR_WIDTH / 2);
    } else {
      addWall(walls, c.x - DOOR_WIDTH / 2, c.x + DOOR_WIDTH / 2, c.z - t, c.z + t);
    }
  }
  return walls;
}

export function circleHitsWall(
  x: number,
  z: number,
  radius: number,
  walls: WallSeg[] = WALLS,
): boolean {
  for (const w of walls) {
    const nx = Math.max(w.minX, Math.min(x, w.maxX));
    const nz = Math.max(w.minZ, Math.min(z, w.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

export function resolveMove(
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
  walls: WallSeg[] = WALLS,
): { x: number; z: number } {
  let nx = x + dx;
  let nz = z + dz;
  if (!circleHitsWall(nx, z, radius, walls)) {
    x = nx;
  }
  if (!circleHitsWall(x, nz, radius, walls)) {
    z = nz;
  }
  return { x, z };
}

export const KEY_SPAWN_ROOMS = ["storage", "basement", "children", "reception"] as const;

export const NOTES: Record<string, { title: string; body: string }> = {
  "note-01": {
    title: "SITE 07 — INTAKE",
    body: "Two subjects. One walks. One watches through the observer channel. The channel is a person, not a camera. If the walker turns around during a behind-event, the recording ends.",
  },
  "note-02": {
    title: "ENTITY CLASS: HOLLOW",
    body: "It will not show on tape. Spirit and Echo frequencies reveal it. A flashlight slows a stalk. It does not banish a hunt. When it hunts, you will see it. Run.",
  },
  "note-03": {
    title: "SECURITY LOCK",
    body: "The four-symbol pad is not written down. The Watcher reads the marks on the security wall in SPIRIT. Do not radio the sequence in the clear if something is listening.",
  },
  "note-04": {
    title: "HANDWRITTEN — ELI",
    body: "If it stands behind you, do not turn around. If your partner tells you to turn around, they are already gone. If the signal says STABLE, you can still be wrong.",
  },
  "note-05": {
    title: "GENERATOR FAILSAFE",
    body: "Three breakers. One is isolated. DANGER frequency paints the true breaker gold and the traps red. The other two wake it.",
  },
  "note-06": {
    title: "RITUAL THRESHOLD",
    body: "Do not enter the room past the generator if you can walk around it. Red marks there are not paint. The Watcher who leads you in is not your friend.",
  },
  "note-07": {
    title: "CHILDREN'S WARD — CLOSED",
    body: "Beds still warm. No patients on the roster since 1989. If someone asks you to check on the children first, ask why they already know the layout.",
  },
};

export const OBJECTIVES = [
  { id: "obj-generator", text: "Find the generator." },
  { id: "obj-power", text: "Restore power." },
  { id: "obj-key", text: "Find the office key." },
  { id: "obj-puzzle", text: "Solve the security keypad." },
  { id: "obj-office", text: "Enter the locked office." },
  { id: "obj-exit", text: "Open the exit. Both of you." },
  { id: "obj-escape", text: "Reach the exit." },
];
