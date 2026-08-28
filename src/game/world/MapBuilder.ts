import * as THREE from "three";
import { DOORWAYS, MAP_ROOMS, WALLS, WALL_HEIGHT, doorwayCenter } from "../../../shared/map";
import type { DoorState, ItemState, LightState } from "../../../shared/types";

const WALL_MAT = new THREE.MeshStandardMaterial({
  color: 0x1a1e24,
  roughness: 0.92,
  metalness: 0.04,
});
const FLOOR_MAT = new THREE.MeshStandardMaterial({
  color: 0x121417,
  roughness: 0.95,
});
const CEIL_MAT = new THREE.MeshStandardMaterial({
  color: 0x0c0d10,
  roughness: 1,
});
const TRIM = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.8 });

export interface WorldHandles {
  group: THREE.Group;
  doors: Map<string, THREE.Object3D>;
  items: Map<string, THREE.Object3D>;
  lights: Map<string, THREE.PointLight>;
}

export function buildWorld(quality: "low" | "high"): WorldHandles {
  const group = new THREE.Group();
  const doors = new Map<string, THREE.Object3D>();
  const items = new Map<string, THREE.Object3D>();
  const lights = new Map<string, THREE.PointLight>();

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

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), FLOOR_MAT);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = quality === "high";
  group.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), CEIL_MAT);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, WALL_HEIGHT, cz);
  group.add(ceil);

  for (const w of WALLS) {
    const width = w.maxX - w.minX;
    const depth = w.maxZ - w.minZ;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(width, 0.08), WALL_HEIGHT, Math.max(depth, 0.08)),
      WALL_MAT,
    );
    mesh.position.set((w.minX + w.maxX) / 2, WALL_HEIGHT / 2, (w.minZ + w.maxZ) / 2);
    mesh.castShadow = quality === "high";
    group.add(mesh);
  }

  for (const room of MAP_ROOMS) {
    addFurniture(group, room.id, room.cx, room.cz);
    const light = new THREE.PointLight(0xbba988, room.id === "entrance" ? 1.2 : 0.35, 14, 2);
    light.position.set(room.cx, 2.6, room.cz);
    if (quality === "high") light.castShadow = false;
    group.add(light);
    lights.set(`light-${room.id}`, light);
  }

  for (const d of DOORWAYS) {
    const c = doorwayCenter(d);
    if (!c) continue;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 2.3, 0.1),
      new THREE.MeshStandardMaterial({
        color: d.isExit ? 0x3a1010 : d.locked ? 0x4a3020 : 0x2b241c,
        roughness: 0.7,
      }),
    );
    door.position.set(c.x, 1.15, c.z);
    door.rotation.y = c.yaw;
    group.add(door);
    doors.set(d.id, door);
  }

  return { group, doors, items, lights };
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
    mesh.visible = !d.open;
  }
}

export function syncLights(handles: WorldHandles, lights: LightState[], generatorOn: boolean): void {
  for (const l of lights) {
    const light = handles.lights.get(l.id);
    if (!light) continue;
    light.intensity = l.on ? (generatorOn ? 1.35 : 0.55) : 0;
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

function addFurniture(group: THREE.Group, id: string, cx: number, cz: number): void {
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.85 });
  if (id === "reception") {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.05, 1.1), wood);
    desk.position.set(cx, 0.52, cz - 1.6);
    group.add(desk);
  }
  if (id === "children") {
    for (let i = 0; i < 2; i++) {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x4a3a48 }));
      bed.position.set(cx - 1.4 + i * 2.6, 0.2, cz);
      group.add(bed);
    }
  }
  if (id === "storage") {
    for (let i = 0; i < 3; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), TRIM);
      crate.position.set(cx - 2 + i * 1.2, 0.4, cz + 2);
      group.add(crate);
    }
  }
  if (id === "office") {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.8), wood);
    desk.position.set(cx + 1.4, 0.45, cz + 1.6);
    group.add(desk);
  }
  if (id === "ritual") {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.08, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x4a1010, emissive: 0x220000, emissiveIntensity: 0.3 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx, 0.05, cz);
    group.add(ring);
  }
  if (id === "security") {
    const monitors = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.9, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111318, emissive: 0x102010, emissiveIntensity: 0.2 }),
    );
    monitors.position.set(cx - 1.4, 1.2, cz + 3.6);
    group.add(monitors);
  }
}
