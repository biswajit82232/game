import * as THREE from "three";
import {
  CORRIDOR_FLOORS,
  DOORWAYS,
  MAP_ROOMS,
  WALLS,
  WALL_HEIGHT,
  doorwayCenter,
  type RoomBox,
} from "../../../shared/map";
import type { DoorState, ItemState, LightState } from "../../../shared/types";
import { isTouchPreferred } from "../../utils/touch";
import { createWorldMats, scaledMat, tintedFloor, type WorldMats } from "./materials";
import {
  doorwayThreshold,
  makeBed,
  makeBench,
  makeCabinet,
  makeChair,
  makeCrate,
  makeDesk,
  makeExitSign,
  makeFluorescent,
  makeMonitor,
  makeOutlet,
  makePipeRun,
  makeShelf,
  makeTrash,
  makeWallPoster,
  roomFloorCeil,
  wallRail,
} from "./props";

export interface WorldHandles {
  group: THREE.Group;
  doors: Map<string, THREE.Object3D>;
  items: Map<string, THREE.Object3D>;
  lights: Map<string, THREE.PointLight>;
  glyphs: THREE.Mesh[];
}

export function buildWorld(quality: "low" | "high", anisotropy = 4): WorldHandles {
  const group = new THREE.Group();
  const doors = new Map<string, THREE.Object3D>();
  const items = new Map<string, THREE.Object3D>();
  const lights = new Map<string, THREE.PointLight>();
  const glyphs: THREE.Mesh[] = [];
  const high = quality === "high";
  const mobile = typeof window !== "undefined" && isTouchPreferred();
  const mats = createWorldMats(quality, anisotropy, mobile);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const r of MAP_ROOMS) {
    minX = Math.min(minX, r.cx - r.hw);
    maxX = Math.max(maxX, r.cx + r.hw);
    minZ = Math.min(minZ, r.cz - r.hd);
    maxZ = Math.max(maxZ, r.cz + r.hd);
  }
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX + 12, maxZ - minZ + 12),
    new THREE.MeshStandardMaterial({ color: 0x12100e, roughness: 1 }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.set((minX + maxX) / 2, -0.05, (minZ + maxZ) / 2);
  group.add(slab);

  const floorTint: Record<string, number> = {
    entrance: 0xb0a898,
    reception: 0xb8b0a4,
    hallway: 0xa8a49c,
    security: 0x989ea4,
    generator: 0x8a8680,
    office: 0xaea69a,
    exit: 0x7a8084,
    storage: 0x9e968c,
    children: 0xb09a92,
    basement: 0x7a7670,
    ritual: 0x6a5850,
  };

  for (const room of MAP_ROOMS) {
    const industrial = room.id === "generator" || room.id === "basement" || room.id === "ritual";
    const floorMat = industrial
      ? tintedFloor(mats.concrete, floorTint[room.id] ?? 0x8a8680)
      : tintedFloor(mats.vinyl, floorTint[room.id] ?? 0xb0a898);
    const tile = industrial ? 1.35 : 0.72;
    group.add(
      roomFloorCeil(
        room,
        scaledMat(floorMat, (room.hw * 2) / tile, (room.hd * 2) / tile),
        scaledMat(mats.ceiling, (room.hw * 2) / 1.35, (room.hd * 2) / 0.68),
      ),
    );
    addFurniture(group, room, mats, high, glyphs);
    addRoomLights(group, lights, room, high, mobile);
  }

  for (const f of CORRIDOR_FLOORS) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(f.w, f.d),
      tintedFloor(mats.vinyl, 0xa8a49c),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(f.x, 0.012, f.z);
    group.add(strip);
  }

  for (const w of WALLS) {
    const width = w.maxX - w.minX;
    const depth = w.maxZ - w.minZ;
    const span = Math.max(width, depth);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(width, 0.1), WALL_HEIGHT, Math.max(depth, 0.1)),
      scaledMat(mats.plaster, Math.max(1.1, span / 1.85), WALL_HEIGHT / 2.4),
    );
    mesh.position.set((w.minX + w.maxX) / 2, WALL_HEIGHT / 2, (w.minZ + w.maxZ) / 2);
    group.add(mesh);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(width, 0.12) + 0.02, 0.14, Math.max(depth, 0.12) + 0.02),
      mats.trim,
    );
    board.position.set(mesh.position.x, 0.07, mesh.position.z);
    group.add(board);
    if (high) {
      group.add(wallRail(w.minX, w.maxX, w.minZ, w.maxZ, mats.trim));
      const crown = board.clone();
      crown.position.y = WALL_HEIGHT - 0.07;
      group.add(crown);
    }
  }

  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xc4b898,
    metalness: 0.88,
    roughness: 0.18,
    envMap: mats.env,
    envMapIntensity: 0.95,
  });
  for (const d of DOORWAYS) {
    const c = doorwayCenter(d);
    if (!c) continue;
    group.add(doorwayThreshold(c.x, c.z, c.yaw, mats.metal));
    const frame = new THREE.Group();
    const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.18), mats.trim);
    jambL.position.set(-0.82, 1.2, 0);
    const jambR = jambL.clone();
    jambR.position.x = 0.82;
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.14, 0.18), mats.trim);
    head.position.set(0, 2.42, 0);
    frame.add(jambL, jambR, head);
    frame.position.set(c.x, 0, c.z);
    frame.rotation.y = c.yaw;
    group.add(frame);

    const doorMat = new THREE.MeshStandardMaterial({
      color: d.isExit ? 0x5a2020 : d.locked ? 0x5a4030 : 0x4a3c30,
      map: mats.wood.map,
      roughness: 0.58,
      metalness: 0.06,
      envMap: mats.env,
      envMapIntensity: 0.28,
      emissive: d.isExit ? 0x220808 : 0x000000,
      emissiveIntensity: d.isExit ? 0.22 : 0,
    });
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.26, 0.05), doorMat);
    door.position.set(c.x, 1.13, c.z);
    door.rotation.y = c.yaw;
    door.userData.closedYaw = c.yaw;
    // door panel inset
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.9, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.7, map: mats.wood.map }),
    );
    panel.position.set(0, 0.35, 0.03);
    door.add(panel);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 10), handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.58, 0, 0.06);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.02), handleMat);
    plate.position.set(0.58, 0, 0.035);
    door.add(handle, plate);
    group.add(door);
    if (d.isExit) {
      const sign = makeExitSign();
      const along = c.yaw === 0 ? { x: 0, z: 0.14 } : { x: 0.14, z: 0 };
      sign.position.set(c.x + along.x, 2.6, c.z + along.z);
      sign.rotation.y = c.yaw;
      group.add(sign);
    }
    doors.set(d.id, door);
  }

  return { group, doors, items, lights, glyphs };
}

export function upsertItem(handles: WorldHandles, item: ItemState, parent: THREE.Group): void {
  let mesh = handles.items.get(item.id);
  if (item.taken && item.type !== "keypad" && item.type !== "switch" && item.type !== "generator" && item.type !== "exit") {
    if (mesh) mesh.visible = false;
    return;
  }
  if (!mesh) {
    mesh = createItemMesh(item);
    parent.add(mesh);
    handles.items.set(item.id, mesh);
  }
  mesh.position.set(item.position.x, item.position.y, item.position.z);
  mesh.visible = true;
}

export function syncDoors(handles: WorldHandles, doors: DoorState[]): void {
  for (const d of doors) {
    const mesh = handles.doors.get(d.id);
    if (!mesh) continue;
    const yaw = (mesh.userData.closedYaw as number) ?? mesh.rotation.y;
    mesh.visible = true;
    mesh.rotation.y = d.open ? yaw + 1.55 : yaw;
  }
}

export function syncLights(handles: WorldHandles, lights: LightState[], generatorOn: boolean): void {
  for (const l of lights) {
    const light = handles.lights.get(l.id);
    if (!light) continue;
    light.intensity = l.on ? (generatorOn ? 42 : 24) : generatorOn ? 6 : 4;
  }
}

function addRoomLights(
  group: THREE.Group,
  lights: Map<string, THREE.PointLight>,
  room: RoomBox,
  high: boolean,
  mobile: boolean,
): void {
  const hue: Record<string, number> = {
    entrance: 0xffe4c0,
    reception: 0xf2e8d4,
    hallway: 0xe6eef4,
    security: 0xc4dcd0,
    generator: 0xffb878,
    storage: 0xe4d0b4,
    office: 0xd8e4f0,
    children: 0xecd0d8,
    ritual: 0xd87868,
    basement: 0xb8c4d4,
    exit: 0xc8d4e0,
  };
  const color = hue[room.id] ?? 0xf0e6d0;
  const decay = 2.15;
  const main = new THREE.PointLight(
    color,
    room.id === "entrance" ? 36 : high ? 22 : 15,
    high ? (mobile ? 14 : 17) : 11,
    decay,
  );
  main.position.set(room.cx, 2.58, room.cz);
  group.add(main);
  lights.set(`light-${room.id}`, main);
  group.add(makeFluorescent(room.cx, room.cz, room.hw > room.hd ? 0 : Math.PI / 2));

  if (high && room.hw > 5) {
    group.add(makeFluorescent(room.cx - room.hw * 0.42, room.cz, 0));
    group.add(makeFluorescent(room.cx + room.hw * 0.42, room.cz, 0));
    if (!mobile) {
      const a = new THREE.PointLight(color, 9, 11, decay);
      a.position.set(room.cx - room.hw * 0.4, 2.52, room.cz);
      const b = new THREE.PointLight(color, 9, 11, decay);
      b.position.set(room.cx + room.hw * 0.4, 2.52, room.cz);
      group.add(a, b);
    }
  }
  if (high && room.id === "hallway") {
    group.add(makeFluorescent(room.cx - 4.8, room.cz, 0));
    group.add(makeFluorescent(room.cx + 4.8, room.cz, 0));
    if (!mobile) {
      const mid = new THREE.PointLight(0xe8eef2, 12, 10, decay);
      mid.position.set(room.cx - 4.5, 2.5, room.cz);
      group.add(mid);
    }
  }
  // dim fill so corners aren't pure black (still dark horror) — skip on phones
  if (!mobile) {
    const fill = new THREE.PointLight(color, high ? 3.5 : 2.2, high ? 10 : 8, 2.4);
    fill.position.set(room.cx, 1.4, room.cz);
    group.add(fill);
  }
}

function createItemMesh(item: ItemState): THREE.Object3D {
  if (item.type === "key") {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0xe0c25a, metalness: 0.9, roughness: 0.16 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 8, 16), metal);
    ring.rotation.x = Math.PI / 2;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.26), metal);
    shaft.position.z = 0.15;
    g.add(ring, shaft);
    g.rotation.x = 0.35;
    return g;
  }
  if (item.type === "battery") {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x2a4a2a, roughness: 0.38, metalness: 0.25 }),
      ),
    );
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.032, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8d0c0, metalness: 0.8, roughness: 0.22 }),
    );
    cap.position.y = 0.12;
    g.add(cap);
    return g;
  }
  if (item.type === "note") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.012, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xf0e4c4, roughness: 0.9 }),
    );
  }
  if (item.type === "keypad") {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.58, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x161618, metalness: 0.5, roughness: 0.32 }),
      ),
    );
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.16, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x1a3a2a, emissive: 0x226633, emissiveIntensity: 0.9 }),
    );
    screen.position.set(0, 0.12, 0.045);
    g.add(screen);
    return g;
  }
  if (item.type === "switch") {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.42, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.35, roughness: 0.42 }),
      ),
    );
    const lever = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.18, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x8a2020, emissive: 0x440000, emissiveIntensity: 0.45 }),
    );
    lever.position.z = 0.08;
    g.add(lever);
    return g;
  }
  if (item.type === "generator") {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 1.1, 0.98),
        new THREE.MeshStandardMaterial({ color: 0x3a4036, metalness: 0.55, roughness: 0.38 }),
      ),
    );
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.1, 0.72),
      new THREE.MeshStandardMaterial({ color: 0x111208, emissive: 0x334410, emissiveIntensity: 0.35 }),
    );
    vent.position.y = 0.58;
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.75, 12),
      new THREE.MeshStandardMaterial({ color: 0x4a4038, metalness: 0.5, roughness: 0.42 }),
    );
    tank.position.set(0.72, 0.08, 0);
    g.add(vent, tank);
    return g;
  }
  if (item.type === "audio-log") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.1, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x3a3a48, roughness: 0.48, metalness: 0.28 }),
    );
  }
  if (item.type === "exit") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.64, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x1a301a, emissive: 0x228822, emissiveIntensity: 0.8 }),
    );
  }
  return new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
}

function addFurniture(
  group: THREE.Group,
  room: RoomBox,
  mats: WorldMats,
  extra: boolean,
  glyphs: THREE.Mesh[],
): void {
  const { id, cx, cz, hw, hd } = room;
  if (id === "entrance") {
    group.add(makeBench(mats, cx - 1.6, cz + 2.0, 0, 1.7));
    group.add(makeChair(mats, cx + 2.0, 0, cz + 1.8, -0.35));
    group.add(makeTrash(mats, cx + 2.6, cz - 2.3));
    group.add(makeWallPoster(cx - hw + 0.06, 1.55, cz, Math.PI / 2, 0x6a6054));
    group.add(makeOutlet(cx + hw - 0.06, 0.42, cz - 1.2, -Math.PI / 2));
    if (extra) {
      group.add(makeShelf(mats, cx + 2.5, cz - 2.5, Math.PI / 2, 1.6));
      const mat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.025, 1.15), mats.trim);
      mat.position.set(cx + 1.4, 0.015, cz - 1.5);
      group.add(mat);
    }
  }
  if (id === "reception") {
    group.add(makeDesk(mats, 3.2, 1.1, cx, cz - 1.85));
    group.add(makeChair(mats, cx, 0, cz - 0.65, Math.PI));
    group.add(makeBench(mats, cx - 3.8, cz + 3.5, Math.PI, 2.0));
    group.add(makeChair(mats, cx + 3.6, 0, cz + 3.4, -0.25));
    group.add(makeChair(mats, cx + 4.4, 0, cz + 2.6, -0.9));
    group.add(makeMonitor(cx - 0.75, 1.3, cz - 1.8));
    group.add(makeMonitor(cx + 0.35, 1.3, cz - 1.8, 0.05));
    group.add(makeTrash(mats, cx - 4.2, cz - 3.5));
    group.add(makeWallPoster(cx, 1.6, cz + hd - 0.06, Math.PI, 0x5a5048));
    group.add(makeOutlet(cx - hw + 0.06, 0.4, cz, Math.PI / 2));
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.1, 0.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x2a241c, emissive: 0x997755, emissiveIntensity: 0.75 }),
    );
    lamp.position.set(cx + 1.15, 1.3, cz - 1.8);
    group.add(lamp);
    if (extra) {
      group.add(makeCabinet(mats, cx + 4.8, cz - 3.6, -Math.PI / 2));
      group.add(makePipeRun(mats, cx, WALL_HEIGHT - 0.22, cz + hd - 0.35, 8, 0));
    }
  }
  if (id === "hallway") {
    group.add(makeChair(mats, cx - 5.4, 0, cz + 1.2, 0.15));
    group.add(makeTrash(mats, cx + 5.5, cz - 1.2));
    group.add(makeWallPoster(cx - 2, 1.5, cz + hd - 0.05, Math.PI, 0x706858));
    group.add(makeOutlet(cx, 0.4, cz - hd + 0.05, 0));
    if (extra) {
      group.add(makePipeRun(mats, cx, WALL_HEIGHT - 0.2, cz - hd + 0.2, 12, 0));
      group.add(makePipeRun(mats, cx, WALL_HEIGHT - 0.35, cz - hd + 0.28, 12, 0));
      group.add(makeShelf(mats, cx + 6.5, cz + 1.1, Math.PI, 1.4));
    }
  }
  if (id === "children") {
    group.add(makeBed(mats, cx - 1.7, cz - 0.2, 0));
    group.add(makeBed(mats, cx + 1.7, cz - 0.2, Math.PI));
    group.add(makeChair(mats, cx, 0, cz + 2.5, Math.PI));
    const toy = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a3048, emissive: 0x330010, emissiveIntensity: 0.15, roughness: 0.7 }),
    );
    toy.position.set(cx - 0.4, 0.12, cz + 2.2);
    const drawing = makeWallPoster(cx + hw - 0.05, 1.45, cz, -Math.PI / 2, 0xc4b49a);
    group.add(toy, drawing);
    if (extra) group.add(makeShelf(mats, cx - hw + 0.35, cz + 2.8, Math.PI / 2, 1.5));
  }
  if (id === "storage") {
    group.add(makeCrate(mats, cx - 2.1, 0.36, cz + 2.1));
    group.add(makeCrate(mats, cx - 1.0, 0.36, cz + 2.1));
    group.add(makeCrate(mats, cx + 0.15, 0.36, cz + 2.0, 0.82));
    group.add(makeCrate(mats, cx - 2.1, 1.1, cz + 2.1, 0.65));
    group.add(makeShelf(mats, cx + 2.8, cz - 2.2, -Math.PI / 2, 2.0));
    group.add(makeOutlet(cx - hw + 0.05, 0.4, cz, Math.PI / 2));
    if (extra) {
      group.add(makeCrate(mats, cx + 2.0, 0.55, cz - 1.6, 0.7));
      group.add(makePipeRun(mats, cx, WALL_HEIGHT - 0.25, cz + hd - 0.25, 6, 0));
    }
  }
  if (id === "basement") {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.68, 1.6, extra ? 16 : 10), mats.metal);
    tank.position.set(cx + 2.9, 0.8, cz + 1.9);
    const tank2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 1.1, 12), mats.metal);
    tank2.position.set(cx - 2.6, 0.55, cz + 2.0);
    group.add(tank, tank2);
    group.add(makePipeRun(mats, cx, 2.55, cz, 5.5, 0));
    group.add(makePipeRun(mats, cx + 1.2, 2.2, cz - 1, 3.5, Math.PI / 2));
    group.add(makeOutlet(cx, 0.45, cz - hd + 0.05, 0));
  }
  if (id === "office") {
    group.add(makeDesk(mats, 1.75, 0.8, cx + 1.55, cz + 1.75));
    group.add(makeChair(mats, cx + 1.55, 0, cz + 2.55, Math.PI));
    group.add(makeMonitor(cx + 1.6, 1.24, cz + 1.6));
    group.add(makeCabinet(mats, cx - 3.7, cz + 2.9, Math.PI / 2));
    group.add(makeCabinet(mats, cx - 3.7, cz + 1.6, Math.PI / 2));
    group.add(makeTrash(mats, cx + 3.2, cz + 2.8));
    group.add(makeWallPoster(cx - hw + 0.05, 1.55, cz - 1, Math.PI / 2, 0x4a5048));
    if (extra) {
      const papers = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.012, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.95 }),
      );
      papers.position.set(cx + 1.75, 0.82, cz + 1.6);
      group.add(papers);
      group.add(makeShelf(mats, cx + 3.8, cz - 2.5, -Math.PI / 2, 1.7));
    }
  }
  if (id === "ritual") {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.3, 0.065, extra ? 12 : 6, extra ? 32 : 14),
      new THREE.MeshStandardMaterial({ color: 0x3a0c0c, emissive: 0x2a0000, emissiveIntensity: 0.5, roughness: 0.8 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx, 0.035, cz);
    group.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const candle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 0.28, 8),
        new THREE.MeshStandardMaterial({ color: 0xd8c8a0, emissive: 0x884400, emissiveIntensity: 0.7 }),
      );
      candle.position.set(cx + Math.cos(a) * 1.45, 0.14, cz + Math.sin(a) * 1.45);
      const flame = new THREE.PointLight(0xff8844, 2.2, 3.5, 2);
      flame.position.copy(candle.position);
      flame.position.y += 0.22;
      group.add(candle, flame);
    }
  }
  if (id === "generator") {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.9, 14), mats.metal);
    barrel.position.set(cx - 2.5, 0.45, cz - 2.3);
    const barrel2 = barrel.clone();
    barrel2.position.set(cx - 1.5, 0.45, cz - 2.5);
    group.add(barrel, barrel2);
    group.add(makePipeRun(mats, cx, WALL_HEIGHT - 0.28, cz + hd - 0.3, 5, 0));
    group.add(makeShelf(mats, cx + 2.8, cz + 2.2, Math.PI, 1.5));
    group.add(makeOutlet(cx + hw - 0.05, 0.5, cz, -Math.PI / 2));
  }
  if (id === "exit") {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 2.3), mats.metal);
    rail.position.set(cx + 2.5, 0.55, cz);
    group.add(rail);
    group.add(makeWallPoster(cx - hw + 0.05, 1.7, cz, Math.PI / 2, 0x204028));
  }
  if (id === "security") {
    const monitors = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.88, 0.38),
      new THREE.MeshStandardMaterial({
        color: 0x101218,
        emissive: 0x1a3828,
        emissiveIntensity: 0.55,
        metalness: 0.4,
        roughness: 0.38,
      }),
    );
    monitors.position.set(cx - 1.25, 1.18, cz + hd - 0.5);
    group.add(monitors, makeDesk(mats, 2.3, 0.72, cx - 1.25, cz + hd - 1.4));
    group.add(makeChair(mats, cx - 1.25, 0, cz + hd - 2.2, 0));
    group.add(makeCabinet(mats, cx + 2.8, cz + hd - 1.2, Math.PI));
    group.add(makeTrash(mats, cx + 3.2, cz));
    const marks = ["triangle", "circle", "square", "diamond"];
    const colors = [0x88aa44, 0x4488aa, 0xaa8844, 0xaa4488];
    marks.forEach((name, i) => {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.42, 0.035),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: colors[i], emissiveIntensity: 0 }),
      );
      plate.position.set(cx - 0.95 + i * 0.65, 1.55, cz + hd - 0.06);
      plate.userData.glyph = name;
      plate.visible = false;
      group.add(plate);
      glyphs.push(plate);
    });
  }
}
