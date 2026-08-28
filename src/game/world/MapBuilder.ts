import * as THREE from "three";
import { CORRIDOR_FLOORS, DOORWAYS, MAP_ROOMS, WALLS, WALL_HEIGHT, doorwayCenter } from "../../../shared/map";
import type { DoorState, ItemState, LightState } from "../../../shared/types";

function noiseTexture(size: number, base: string, speck: string, count: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = speck;
    ctx.globalAlpha = 0.08 + Math.random() * 0.18;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export interface WorldHandles {
  group: THREE.Group;
  doors: Map<string, THREE.Object3D>;
  items: Map<string, THREE.Object3D>;
  lights: Map<string, THREE.PointLight>;
  glyphs: THREE.Mesh[];
}

export function buildWorld(quality: "low" | "high"): WorldHandles {
  const group = new THREE.Group();
  const doors = new Map<string, THREE.Object3D>();
  const items = new Map<string, THREE.Object3D>();
  const lights = new Map<string, THREE.PointLight>();
  const glyphs: THREE.Mesh[] = [];
  const lit = quality === "high";
  const floorTex = noiseTexture(256, "#16181c", "#000000", lit ? 900 : 280);
  floorTex.repeat.set(18, 18);
  const wallTex = noiseTexture(256, "#1c2026", "#0a0b0d", lit ? 700 : 220);
  wallTex.repeat.set(2, 1);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x6e6a64, map: wallTex, roughness: 0.94, metalness: 0.03 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x5c5852, map: floorTex, roughness: 0.96 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 1 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.85 });

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
  const fw = maxX - minX + 8;
  const fd = maxZ - minZ + 8;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  group.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, WALL_HEIGHT, cz);
  group.add(ceil);

  const hallMat = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.95 });
  for (const f of CORRIDOR_FLOORS) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.d), hallMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(f.x, 0.02, f.z);
    group.add(strip);
  }

  for (const w of WALLS) {
    const width = w.maxX - w.minX;
    const depth = w.maxZ - w.minZ;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(width, 0.08), WALL_HEIGHT, Math.max(depth, 0.08)),
      wallMat,
    );
    mesh.position.set((w.minX + w.maxX) / 2, WALL_HEIGHT / 2, (w.minZ + w.maxZ) / 2);
    group.add(mesh);
  }

  const tints: Record<string, number> = {
    entrance: 0xc4b496,
    reception: 0xbba888,
    hallway: 0x9aa0a8,
    security: 0x88aa99,
    generator: 0xc9a070,
    storage: 0xa09080,
    office: 0xb8c0c8,
    children: 0xc0a0b0,
    ritual: 0xaa6060,
    basement: 0x8890a0,
  };

  for (const room of MAP_ROOMS) {
    addFurniture(group, room.id, room.cx, room.cz, wood, trim, lit, glyphs);
    const light = new THREE.PointLight(tints[room.id] ?? 0xbba988, room.id === "entrance" ? 1.35 : lit ? 0.42 : 0.28, lit ? 16 : 11, 2);
    light.position.set(room.cx, 2.55, room.cz);
    group.add(light);
    lights.set(`light-${room.id}`, light);
  }

  for (const d of DOORWAYS) {
    const c = doorwayCenter(d);
    if (!c) continue;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 2.48, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.85 }),
    );
    frame.position.set(c.x, 1.24, c.z);
    frame.rotation.y = c.yaw;
    group.add(frame);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.28, 0.08),
      new THREE.MeshStandardMaterial({
        color: d.isExit ? 0x4a1414 : d.locked ? 0x5a3a24 : 0x2e261c,
        roughness: 0.7,
        emissive: d.isExit ? 0x220808 : 0x000000,
        emissiveIntensity: d.isExit ? 0.25 : 0,
      }),
    );
    door.position.set(c.x, 1.14, c.z);
    door.rotation.y = c.yaw;
    door.userData.closedYaw = c.yaw;
    door.userData.baseX = c.x;
    door.userData.baseZ = c.z;
    group.add(door);
    doors.set(d.id, door);
  }

  return { group, doors, items, lights, glyphs };
}

export function upsertItem(
  handles: WorldHandles,
  item: ItemState,
  parent: THREE.Group,
): void {
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
    light.intensity = l.on ? (generatorOn ? 1.45 : 0.62) : generatorOn ? 0.12 : 0.16;
  }
}

function createItemMesh(item: ItemState): THREE.Object3D {
  if (item.type === "key") {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.06, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.6, roughness: 0.3 }),
    );
    m.castShadow = true;
    return m;
  }
  if (item.type === "battery") {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x3d6b3d }),
    );
  }
  if (item.type === "note") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.02, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xd9c9a0 }),
    );
  }
  if (item.type === "keypad") {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.6, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x111111 }),
      ),
    );
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.18, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1a3a2a, emissive: 0x113311, emissiveIntensity: 0.4 }),
    );
    screen.position.y = 0.12;
    screen.position.z = 0.04;
    g.add(screen);
    return g;
  }
  if (item.type === "switch") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.5, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x5a1a1a, emissive: 0x220000, emissiveIntensity: 0.2 }),
    );
  }
  if (item.type === "generator") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.1, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x2a2e24, metalness: 0.4, roughness: 0.5 }),
    );
  }
  if (item.type === "audio-log") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.12, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x3a3a48 }),
    );
  }
  if (item.type === "exit") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.7, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x204020, emissive: 0x113311, emissiveIntensity: 0.5 }),
    );
  }
  return new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
}

function addFurniture(
  group: THREE.Group,
  id: string,
  cx: number,
  cz: number,
  wood: THREE.Material,
  trim: THREE.Material,
  lit: boolean,
  glyphs: THREE.Mesh[],
): void {
  const rust = new THREE.MeshStandardMaterial({ color: 0x3a322c, roughness: 0.92 });
  if (id === "entrance") {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.55), wood);
    bench.position.set(cx - 2.4, 0.22, cz + 2.2);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), rust);
    rack.position.set(cx + 3.2, 0.9, cz - 2.4);
    group.add(bench, rack);
  }
  if (id === "reception") {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.05, 1.1), wood);
    desk.position.set(cx, 0.52, cz - 1.6);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.4, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x222018, emissive: 0x443322, emissiveIntensity: 0.4 }),
    );
    lamp.position.set(cx + 1.1, 1.28, cz - 1.6);
    group.add(desk, lamp);
  }
  if (id === "hallway") {
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.55), wood);
    chair.position.set(cx - 4.5, 0.45, cz + 1.2);
    group.add(chair);
  }
  if (id === "children") {
    for (let i = 0; i < 2; i++) {
      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.4, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x4a3a48 }),
      );
      bed.position.set(cx - 1.4 + i * 2.6, 0.2, cz);
      group.add(bed);
    }
    const toy = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.22, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x8a3048, emissive: 0x330010, emissiveIntensity: 0.2 }),
    );
    toy.position.set(cx, 0.12, cz + 2.4);
    const drawing = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xc4b49a, roughness: 1 }),
    );
    drawing.position.set(cx + 4.2, 1.5, cz);
    group.add(toy, drawing);
  }
  if (id === "storage") {
    for (let i = 0; i < 3; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), trim);
      crate.position.set(cx - 2 + i * 1.2, 0.4, cz + 2);
      group.add(crate);
    }
  }
  if (id === "basement") {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, lit ? 10 : 6), rust);
    tank.position.set(cx + 3.2, 0.8, cz + 2);
    const pipe = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 0.16), rust);
    pipe.position.set(cx, 2.6, cz);
    group.add(tank, pipe);
  }
  if (id === "office") {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.8), wood);
    desk.position.set(cx + 1.4, 0.45, cz + 1.6);
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), trim);
    chair.position.set(cx + 1.4, 0.35, cz + 2.4);
    group.add(desk, chair);
  }
  if (id === "ritual") {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.08, lit ? 8 : 5, lit ? 24 : 12),
      new THREE.MeshStandardMaterial({ color: 0x4a1010, emissive: 0x220000, emissiveIntensity: 0.3 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx, 0.05, cz);
    group.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const candle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, 0.28, 6),
        new THREE.MeshStandardMaterial({ color: 0xd8c8a0, emissive: 0x662200, emissiveIntensity: 0.45 }),
      );
      candle.position.set(cx + Math.cos(a) * 1.55, 0.14, cz + Math.sin(a) * 1.55);
      group.add(candle);
    }
  }
  if (id === "generator") {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 8), rust);
    barrel.position.set(cx - 2.8, 0.45, cz - 2.4);
    group.add(barrel);
  }
  if (id === "exit") {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 2.4), rust);
    rail.position.set(cx + 2.8, 0.55, cz);
    group.add(rail);
  }
  if (id === "security") {
    const monitors = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.9, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111318, emissive: 0x102010, emissiveIntensity: 0.35 }),
    );
    monitors.position.set(cx - 1.4, 1.2, cz + 3.6);
    group.add(monitors);
    const marks = ["triangle", "circle", "square", "diamond"];
    const colors = [0x88aa44, 0x4488aa, 0xaa8844, 0xaa4488];
    marks.forEach((name, i) => {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.45, 0.04),
        new THREE.MeshStandardMaterial({
          color: 0x111111,
          emissive: colors[i],
          emissiveIntensity: 0,
        }),
      );
      plate.position.set(cx + 1.6 + i * 0.7, 1.55, cz + 4.35);
      plate.userData.glyph = name;
      plate.visible = false;
      group.add(plate);
      glyphs.push(plate);
    });
  }
}
