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
  { id: "entrance", name: "Entrance", cx: 0, cz: 0, hw: 4.5, hd: 4 },
  { id: "reception", name: "Reception", cx: 12, cz: 0, hw: 6, hd: 5.5 },
  { id: "hallway", name: "Hallway", cx: 26, cz: 0, hw: 8, hd: 2.2 },
  { id: "security", name: "Security Room", cx: 12, cz: 12, hw: 4.5, hd: 4.5 },
  { id: "generator", name: "Generator Room", cx: 26, cz: 12, hw: 4.5, hd: 4.5 },
  { id: "office", name: "Locked Office", cx: 40, cz: 0, hw: 5.5, hd: 4.5 },
  { id: "exit", name: "Exit", cx: 52, cz: 0, hw: 4.2, hd: 4.2 },
  { id: "storage", name: "Storage Room", cx: 12, cz: -12, hw: 4.5, hd: 4.5 },
  { id: "children", name: "Children's Room", cx: 26, cz: -12, hw: 4.5, hd: 4.5 },
  { id: "basement", name: "Basement", cx: 12, cz: -24, hw: 5.5, hd: 4.5 },
  { id: "ritual", name: "Ritual Room", cx: 40, cz: 12, hw: 5, hd: 4.5 },
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

export function doorwayCenter(def: DoorwayDef): { x: number; z: number; yaw: number } | null {
  const a = getRoomById(def.from);
  const b = getRoomById(def.to);
  if (!a || !b) return null;

  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  if (Math.abs(dx) > Math.abs(dz)) {
    const x = dx > 0 ? a.cx + a.hw : a.cx - a.hw;
    const z = (Math.max(a.cz - a.hd, b.cz - b.hd) + Math.min(a.cz + a.hd, b.cz + b.hd)) / 2;
    return { x, z, yaw: 0 };
  }
  const z = dz > 0 ? a.cz + a.hd : a.cz - a.hd;
  const x = (Math.max(a.cx - a.hw, b.cx - b.hw) + Math.min(a.cx + a.hw, b.cx + b.hw)) / 2;
  return { x, z, yaw: Math.PI / 2 };
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
    if (side === "e" && east) {
      const c = doorwayCenter(d);
      if (c) gaps.push({ start: c.z - DOOR_WIDTH / 2, end: c.z + DOOR_WIDTH / 2 });
    }
    if (side === "w" && west) {
      const c = doorwayCenter(d);
      if (c) gaps.push({ start: c.z - DOOR_WIDTH / 2, end: c.z + DOOR_WIDTH / 2 });
    }
    if (side === "n" && north) {
      const c = doorwayCenter(d);
      if (c) gaps.push({ start: c.x - DOOR_WIDTH / 2, end: c.x + DOOR_WIDTH / 2 });
    }
    if (side === "s" && south) {
      const c = doorwayCenter(d);
      if (c) gaps.push({ start: c.x - DOOR_WIDTH / 2, end: c.x + DOOR_WIDTH / 2 });
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
    for (const s of splitEdge(z0, z1, gapOnEdge(room, "w"))) {
      addWall(walls, x0 - t / 2, x0 + t / 2, s.start, s.end);
    }
    for (const s of splitEdge(x0, x1, gapOnEdge(room, "n"))) {
      addWall(walls, s.start, s.end, z1 - t / 2, z1 + t / 2);
    }
    for (const s of splitEdge(x0, x1, gapOnEdge(room, "s"))) {
      addWall(walls, s.start, s.end, z0 - t / 2, z0 + t / 2);
    }
  }
  return walls;
}

export const WALLS = buildWalls();

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
    title: "NOTE #01",
    body: "Subject 07 reported seeing something behind the observer. The observer reported nothing. Both recordings were later found incomplete.",
  },
  "note-02": {
    title: "NOTE #02",
    body: "The entity does not appear to exist in our physical recording. It is visible only through the secondary consciousness channel.",
  },
  "note-03": {
    title: "NOTE #03",
    body: "Never allow both subjects to look at the same mirror. Sequence for Site B lock: the Watcher already knows it. Do not write it down.",
  },
  "note-04": {
    title: "HANDWRITTEN",
    body: "If it stands behind you, do not turn around. If your partner tells you to turn around, they are already gone.",
  },
  "note-05": {
    title: "SECURITY MEMO",
    body: "Generator failsafe: only one breaker is isolated. The others trip the containment field. The night-shift diagram is on the spirit channel.",
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
