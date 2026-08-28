import * as THREE from "three";
import { CORRIDOR_FLOORS, DOORWAYS, MAP_ROOMS, WALLS, WALL_HEIGHT, doorwayCenter } from "../../../shared/map";
import type { DoorState, ItemState, LightState } from "../../../shared/types";
import { isTouchPreferred } from "../../utils/touch";

function canvasTex(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  paint(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function paintFloor(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = "#4a4640";
  ctx.fillRect(0, 0, size, size);
  const tiles = 8;
  const t = size / tiles;
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      const shade = 62 + ((x * 13 + y * 7) % 18);
      ctx.fillStyle = `rgb(${shade + 8},${shade},${shade - 10})`;
      ctx.fillRect(x * t + 1, y * t + 1, t - 2, t - 2);
      if ((x + y) % 5 === 0) {
        ctx.fillStyle = "rgba(30, 24, 18, 0.18)";
        ctx.fillRect(x * t + 4, y * t + 6, t * 0.4, t * 0.22);
      }
    }
  }
  ctx.strokeStyle = "rgba(22, 20, 18, 0.55)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath();
    ctx.moveTo(i * t, 0);
    ctx.lineTo(i * t, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * t);
    ctx.lineTo(size, i * t);
    ctx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(12,10,8,${0.04 + Math.random() * 0.1})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 4, 1 + Math.random() * 3);
  }
}

function paintWall(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = "#8a8378";
  ctx.fillRect(0, 0, size, size);
  const grd = ctx.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, "rgba(20,18,16,0.18)");
  grd.addColorStop(0.15, "rgba(0,0,0,0)");
  grd.addColorStop(0.85, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(18,14,10,0.28)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * size;
    ctx.fillStyle = `rgba(40, 32, 24, ${0.04 + Math.random() * 0.08})`;
    ctx.fillRect(x, 0, 2 + Math.random() * 5, size);
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,245,220,${0.02 + Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 8, 3);
  }
}

function paintCeil(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = "#2c2e34";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = ctx.createRadialGradient(x, y, 4, x, y, 40 + Math.random() * 50);
    g.addColorStop(0, "rgba(18, 16, 12, 0.45)");
    g.addColorStop(1, "rgba(18,16,12,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
}

function paintWood(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = "#5c4636";
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    ctx.fillStyle = `rgba(20,12,8,${0.04 + (Math.sin(y * 0.2) + 1) * 0.04})`;
    ctx.fillRect(0, y, size, 1);
  }
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = `rgba(30, 18, 10, ${0.12 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.moveTo(0, Math.random() * size);
    ctx.bezierCurveTo(size * 0.3, Math.random() * size, size * 0.7, Math.random() * size, size, Math.random() * size);
    ctx.stroke();
  }
}

function paintMetal(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = "#3a3e44";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(220,220,230,${0.03 + Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 6 + Math.random() * 10);
  }
}

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
  const texSize = high ? (mobile ? 256 : 512) : 128;
  const aniso = anisotropy;

  const floorTex = canvasTex(texSize, paintFloor, aniso, 14, 14);
  const wallTex = canvasTex(texSize, paintWall, aniso, 3, 1);
  const ceilTex = canvasTex(Math.min(256, texSize), paintCeil, aniso, 8, 8);
  const woodTex = canvasTex(Math.min(256, texSize), paintWood, aniso, 2, 2);
  const metalTex = canvasTex(128, paintMetal, aniso, 2, 2);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xc4bbae,
    map: wallTex,
    roughness: 0.88,
    metalness: 0.02,
    bumpMap: wallTex,
    bumpScale: 0.035,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xb8b0a4,
    map: floorTex,
    roughness: 0.78,
    metalness: 0.04,
    bumpMap: floorTex,
    bumpScale: 0.04,
  });
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0x6a6e76,
    map: ceilTex,
    roughness: 1,
    metalness: 0,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: 0x6a5648,
    map: woodTex,
    roughness: 0.72,
    metalness: 0.04,
  });
  const wood = new THREE.MeshStandardMaterial({
    color: 0x8a6a50,
    map: woodTex,
    roughness: 0.7,
    metalness: 0.05,
  });
  const rust = new THREE.MeshStandardMaterial({
    color: 0x5a5048,
    map: metalTex,
    roughness: 0.82,
    metalness: 0.28,
  });

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
  group.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, WALL_HEIGHT, cz);
  group.add(ceil);

  const hallMat = new THREE.MeshStandardMaterial({
    color: 0x9a948c,
    map: floorTex,
    roughness: 0.8,
    bumpMap: floorTex,
    bumpScale: 0.03,
  });
  for (const f of CORRIDOR_FLOORS) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.d), hallMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(f.x, 0.015, f.z);
    group.add(strip);
  }

  const boardMat = new THREE.MeshStandardMaterial({ color: 0x3a322c, roughness: 0.86, map: woodTex });
  for (const w of WALLS) {
    const width = w.maxX - w.minX;
    const depth = w.maxZ - w.minZ;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(width, 0.08), WALL_HEIGHT, Math.max(depth, 0.08)),
      wallMat,
    );
    mesh.position.set((w.minX + w.maxX) / 2, WALL_HEIGHT / 2, (w.minZ + w.maxZ) / 2);
    group.add(mesh);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(width, 0.1) + 0.02, 0.14, Math.max(depth, 0.1) + 0.02),
      boardMat,
    );
    board.position.set(mesh.position.x, 0.07, mesh.position.z);
    group.add(board);
  }

  const tints: Record<string, number> = {
    entrance: 0xffe2b0,
    reception: 0xf0d8a8,
    hallway: 0xc8d0d8,
    security: 0xa8d0bc,
    generator: 0xffc078,
    storage: 0xe0c8a8,
    office: 0xd0e0f0,
    children: 0xf0c0d0,
    ritual: 0xe07070,
    basement: 0xa8b8d0,
  };

  for (const room of MAP_ROOMS) {
    addFurniture(group, room.id, room.cx, room.cz, wood, trim, rust, high, glyphs);
    const hue = tints[room.id] ?? 0xe8d2a8;
    const light = new THREE.PointLight(hue, room.id === "entrance" ? 42 : high ? 24 : 16, high ? 22 : 16, 2);
    light.position.set(room.cx, 2.62, room.cz);
    group.add(light);
    lights.set(`light-${room.id}`, light);

    const fixture = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.06, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x222428,
        emissive: hue,
        emissiveIntensity: 0.85,
        roughness: 0.4,
        metalness: 0.3,
      }),
    );
    fixture.position.set(room.cx, WALL_HEIGHT - 0.08, room.cz);
    group.add(fixture);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.1),
      new THREE.MeshBasicMaterial({
        color: hue,
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.set(room.cx, WALL_HEIGHT - 0.12, room.cz);
    group.add(glow);
  }

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a221c, map: woodTex, roughness: 0.78 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xc4b48a, metalness: 0.75, roughness: 0.28 });
  for (const d of DOORWAYS) {
    const c = doorwayCenter(d);
    if (!c) continue;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.78, 2.48, 0.18), frameMat);
    frame.position.set(c.x, 1.24, c.z);
    frame.rotation.y = c.yaw;
    group.add(frame);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.28, 0.08),
      new THREE.MeshStandardMaterial({
        color: d.isExit ? 0x6a2020 : d.locked ? 0x7a4a30 : 0x4a3a2c,
        map: woodTex,
        roughness: 0.62,
        metalness: 0.08,
        emissive: d.isExit ? 0x3a0808 : 0x000000,
        emissiveIntensity: d.isExit ? 0.35 : 0,
      }),
    );
    door.position.set(c.x, 1.14, c.z);
    door.rotation.y = c.yaw;
    door.userData.closedYaw = c.yaw;
    door.userData.baseX = c.x;
    door.userData.baseZ = c.z;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.16), handleMat);
    handle.position.set(0.58, 0, 0.08);
    door.add(handle);
    group.add(door);
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
    light.intensity = l.on ? (generatorOn ? 52 : 28) : generatorOn ? 8 : 10;
  }
}

function createItemMesh(item: ItemState): THREE.Object3D {
  if (item.type === "key") {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0xe0c25a, metalness: 0.85, roughness: 0.22 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 14), metal);
    ring.rotation.x = Math.PI / 2;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.28), metal);
    shaft.position.z = 0.16;
    g.add(ring, shaft);
    g.rotation.x = 0.4;
    return g;
  }
  if (item.type === "battery") {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.22, 10),
        new THREE.MeshStandardMaterial({ color: 0x2a4a2a, roughness: 0.45, metalness: 0.2 }),
      ),
    );
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8d0c0, metalness: 0.7, roughness: 0.3 }),
    );
    cap.position.y = 0.13;
    g.add(cap);
    return g;
  }
  if (item.type === "note") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.02, 0.38),
      new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.95, emissive: 0x332211, emissiveIntensity: 0.08 }),
    );
  }
  if (item.type === "keypad") {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.6, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.4, roughness: 0.4 }),
      ),
    );
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.18, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1a3a2a, emissive: 0x226633, emissiveIntensity: 0.7 }),
    );
    screen.position.set(0, 0.12, 0.05);
    g.add(screen);
    return g;
  }
  if (item.type === "switch") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.5, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x5a1a1a, emissive: 0x440000, emissiveIntensity: 0.35, roughness: 0.5 }),
    );
  }
  if (item.type === "generator") {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.1, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x3a4034, metalness: 0.45, roughness: 0.42 }),
      ),
    );
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.12, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x111208, emissive: 0x334410, emissiveIntensity: 0.25 }),
    );
    vent.position.y = 0.58;
    g.add(vent);
    return g;
  }
  if (item.type === "audio-log") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.12, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x3a3a48, roughness: 0.55, metalness: 0.2 }),
    );
  }
  if (item.type === "exit") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.7, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x204020, emissive: 0x226622, emissiveIntensity: 0.7 }),
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
  rust: THREE.Material,
  extra: boolean,
  glyphs: THREE.Mesh[],
): void {
  const add = (...m: THREE.Object3D[]) => group.add(...m);
  if (id === "entrance") {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.55), wood);
    bench.position.set(cx - 2.4, 0.22, cz + 2.2);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), rust);
    rack.position.set(cx + 3.2, 0.9, cz - 2.4);
    add(bench, rack);
    if (extra) {
      const mat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 1.2), trim);
      mat.position.set(cx + 2.2, 0.03, cz + 1.8);
      add(mat);
    }
  }
  if (id === "reception") {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.05, 1.1), wood);
    desk.position.set(cx, 0.52, cz - 1.6);
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 0.42, 8),
      new THREE.MeshStandardMaterial({ color: 0x222018, emissive: 0x886644, emissiveIntensity: 0.55 }),
    );
    lamp.position.set(cx + 1.1, 1.28, cz - 1.6);
    add(desk, lamp);
    if (extra) {
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.38, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x101418, emissive: 0x334455, emissiveIntensity: 0.4 }),
      );
      screen.position.set(cx - 0.6, 1.28, cz - 1.55);
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.55), trim);
      chair.position.set(cx, 0.36, cz - 0.55);
      add(screen, chair);
    }
  }
  if (id === "hallway") {
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.55), wood);
    chair.position.set(cx - 4.5, 0.45, cz + 1.2);
    add(chair);
    if (extra) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 8, 8), rust);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(cx, 3.05, cz - 1.7);
      add(pipe);
    }
  }
  if (id === "children") {
    for (let i = 0; i < 2; i++) {
      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.4, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x6a5468, roughness: 0.9 }),
      );
      bed.position.set(cx - 1.4 + i * 2.6, 0.2, cz);
      const pillow = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.12, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xd8c8c0, roughness: 1 }),
      );
      pillow.position.set(cx - 1.9 + i * 2.6, 0.46, cz);
      add(bed, pillow);
    }
    const toy = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a3048, emissive: 0x330010, emissiveIntensity: 0.2 }),
    );
    toy.position.set(cx, 0.14, cz + 2.4);
    const drawing = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xc4b49a, roughness: 1 }),
    );
    drawing.position.set(cx + 4.2, 1.5, cz);
    add(toy, drawing);
  }
  if (id === "storage") {
    for (let i = 0; i < 3; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), trim);
      crate.position.set(cx - 2 + i * 1.2, 0.4, cz + 2);
      add(crate);
    }
    if (extra) {
      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.7), trim);
      stack.position.set(cx + 2.6, 0.6, cz - 1.8);
      add(stack);
    }
  }
  if (id === "basement") {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, extra ? 12 : 6), rust);
    tank.position.set(cx + 3.2, 0.8, cz + 2);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8), rust);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(cx, 2.6, cz);
    add(tank, pipe);
  }
  if (id === "office") {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.8), wood);
    desk.position.set(cx + 1.4, 0.45, cz + 1.6);
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), trim);
    chair.position.set(cx + 1.4, 0.35, cz + 2.4);
    add(desk, chair);
    if (extra) {
      const papers = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.02, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 1 }),
      );
      papers.position.set(cx + 1.5, 0.92, cz + 1.55);
      add(papers);
    }
  }
  if (id === "ritual") {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.08, extra ? 10 : 5, extra ? 28 : 12),
      new THREE.MeshStandardMaterial({ color: 0x4a1010, emissive: 0x330000, emissiveIntensity: 0.4 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx, 0.05, cz);
    add(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const candle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, 0.28, 8),
        new THREE.MeshStandardMaterial({ color: 0xd8c8a0, emissive: 0x884400, emissiveIntensity: 0.55 }),
      );
      candle.position.set(cx + Math.cos(a) * 1.55, 0.14, cz + Math.sin(a) * 1.55);
      add(candle);
    }
  }
  if (id === "generator") {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10), rust);
    barrel.position.set(cx - 2.8, 0.45, cz - 2.4);
    add(barrel);
  }
  if (id === "exit") {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 2.4), rust);
    rail.position.set(cx + 2.8, 0.55, cz);
    add(rail);
  }
  if (id === "security") {
    const monitors = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.9, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111318, emissive: 0x1a3020, emissiveIntensity: 0.45, metalness: 0.3 }),
    );
    monitors.position.set(cx - 1.4, 1.2, cz + 3.6);
    add(monitors);
    const marks = ["triangle", "circle", "square", "diamond"];
    const colors = [0x88aa44, 0x4488aa, 0xaa8844, 0xaa4488];
    marks.forEach((name, i) => {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.45, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: colors[i], emissiveIntensity: 0 }),
      );
      plate.position.set(cx + 1.6 + i * 0.7, 1.55, cz + 4.35);
      plate.userData.glyph = name;
      plate.visible = false;
      add(plate);
      glyphs.push(plate);
    });
  }
}
