import * as THREE from "three";
import type { RoomBox } from "../../../shared/map";
import { WALL_HEIGHT } from "../../../shared/map";
import type { WorldMats } from "./materials";

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function makeChair(mats: WorldMats, x: number, y: number, z: number, yaw = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.46, 0.05, 0.46, mats.wood, 0, 0.46, 0));
  g.add(box(0.44, 0.04, 0.42, mats.fabric, 0, 0.5, 0.01));
  g.add(box(0.46, 0.48, 0.05, mats.wood, 0, 0.74, -0.2));
  g.add(box(0.42, 0.4, 0.03, mats.fabric, 0, 0.72, -0.17));
  for (const [lx, lz] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ] as const) {
    g.add(box(0.045, 0.44, 0.045, mats.metal, lx, 0.22, lz));
  }
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  return g;
}

export function makeDesk(mats: WorldMats, w: number, d: number, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.05, d, mats.wood, 0, 0.76, 0));
  g.add(box(w - 0.06, 0.52, d - 0.08, mats.trim, 0, 0.47, 0));
  g.add(box(0.06, 0.04, d * 0.7, mats.metal, -w / 2 + 0.2, 0.55, 0));
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      g.add(box(0.06, 0.74, 0.06, mats.metal, (sx * w) / 2 - sx * 0.08, 0.37, (sz * d) / 2 - sz * 0.08));
    }
  }
  g.position.set(x, 0, z);
  return g;
}

export function makeCrate(mats: WorldMats, x: number, y: number, z: number, s = 0.72): THREE.Group {
  const g = new THREE.Group();
  g.add(box(s, s, s, mats.trim, 0, 0, 0));
  g.add(box(s + 0.02, 0.04, 0.04, mats.metal, 0, s * 0.2, s * 0.5));
  g.add(box(s + 0.02, 0.04, 0.04, mats.metal, 0, -s * 0.2, s * 0.5));
  g.position.set(x, y, z);
  return g;
}

export function makeFluorescent(x: number, z: number, yaw = 0): THREE.Group {
  const g = new THREE.Group();
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.08, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x2e3238, metalness: 0.65, roughness: 0.35 }),
  );
  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e8,
    emissive: 0xfff0d0,
    emissiveIntensity: 2.1,
    roughness: 0.25,
  });
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.15, 10), tubeMat);
  t1.rotation.z = Math.PI / 2;
  t1.position.set(0, -0.045, -0.07);
  const t2 = t1.clone();
  t2.position.z = 0.07;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.7),
    new THREE.MeshBasicMaterial({
      color: 0xfff2d8,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glow.rotation.x = Math.PI / 2;
  glow.position.y = -0.1;
  g.add(housing, t1, t2, glow);
  g.position.set(x, WALL_HEIGHT - 0.07, z);
  g.rotation.y = yaw;
  return g;
}

export function makeBed(mats: WorldMats, x: number, z: number, yaw = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.95, 0.22, 0.9, mats.metal, 0, 0.22, 0));
  g.add(box(1.85, 0.14, 0.82, mats.fabric, 0, 0.4, 0));
  g.add(box(0.44, 0.1, 0.34, new THREE.MeshStandardMaterial({ color: 0xe0d4cc, roughness: 1 }), -0.65, 0.52, 0));
  g.add(box(0.12, 0.55, 0.9, mats.metal, -0.95, 0.45, 0));
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  return g;
}

export function makeBench(mats: WorldMats, x: number, z: number, yaw = 0, w = 1.55): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.06, 0.44, mats.wood, 0, 0.44, 0));
  g.add(box(w - 0.05, 0.04, 0.4, mats.fabric, 0, 0.49, 0));
  g.add(box(w, 0.05, 0.07, mats.trim, 0, 0.74, -0.17));
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      g.add(box(0.055, 0.42, 0.055, mats.metal, (sx * w) / 2 - sx * 0.08, 0.21, sz * 0.14));
    }
  }
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  return g;
}

export function makeCabinet(mats: WorldMats, x: number, z: number, yaw = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.55, 1.35, 0.44, mats.metal, 0, 0.68, 0));
  g.add(box(0.48, 0.015, 0.02, mats.trim, 0, 1.1, 0.23));
  g.add(box(0.48, 0.015, 0.02, mats.trim, 0, 0.68, 0.23));
  g.add(box(0.48, 0.015, 0.02, mats.trim, 0, 0.28, 0.23));
  g.add(box(0.04, 0.08, 0.03, mats.metal, 0.18, 0.9, 0.24));
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  return g;
}

export function makeShelf(mats: WorldMats, x: number, z: number, yaw = 0, h = 1.8): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.1, h, 0.08, mats.metal, 0, h / 2, -0.16));
  for (let i = 0; i < 4; i++) {
    g.add(box(1.05, 0.03, 0.32, mats.trim, 0, 0.25 + i * (h / 4.2), 0));
  }
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  return g;
}

export function makePipeRun(mats: WorldMats, x: number, y: number, z: number, len: number, yaw = 0): THREE.Group {
  const g = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len, 10), mats.metal);
  pipe.rotation.z = Math.PI / 2;
  g.add(pipe);
  const bracket = box(0.08, 0.08, 0.12, mats.metal, -len * 0.35, -0.05, 0);
  g.add(bracket, bracket.clone().translateX(len * 0.7));
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  return g;
}

export function makeWallPoster(x: number, y: number, z: number, yaw: number, color = 0x8a7a68): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.95, 0.02),
    new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 }),
  );
  m.position.set(x, y, z);
  m.rotation.y = yaw;
  return m;
}

export function makeOutlet(x: number, y: number, z: number, yaw: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.18, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.55, metalness: 0.1 }),
  );
  m.position.set(x, y, z);
  m.rotation.y = yaw;
  return m;
}

export function makeExitSign(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.18, 0.05),
    new THREE.MeshStandardMaterial({
      color: 0x0c2814,
      emissive: 0x2a8850,
      emissiveIntensity: 1.15,
      roughness: 0.4,
    }),
  );
}

export function makeMonitor(x: number, y: number, z: number, yaw = 0): THREE.Group {
  const g = new THREE.Group();
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.38, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.4, roughness: 0.4 }),
  );
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.3, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x0a1218, emissive: 0x3a5a68, emissiveIntensity: 0.7, roughness: 0.25 }),
  );
  screen.position.z = 0.03;
  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.18, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x222428, metalness: 0.45, roughness: 0.45 }),
  );
  stand.position.y = -0.26;
  g.add(bezel, screen, stand);
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  return g;
}

export function makeTrash(mats: WorldMats, x: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.32, 10), mats.metal);
  m.position.set(x, 0.16, z);
  return m;
}

export function roomFloorCeil(room: RoomBox, floorMat: THREE.Material, ceilMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.hw * 2 - 0.02, room.hd * 2 - 0.02), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(room.cx, 0.01, room.cz);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(room.hw * 2 - 0.02, room.hd * 2 - 0.02), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(room.cx, WALL_HEIGHT - 0.01, room.cz);
  g.add(floor, ceil);
  return g;
}

export function doorwayThreshold(x: number, z: number, yaw: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.035, 0.42), mat);
  m.position.set(x, 0.018, z);
  m.rotation.y = yaw;
  return m;
}

/** Chair rail / mid wall molding for institutional look. */
export function wallRail(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  mat: THREE.Material,
): THREE.Mesh {
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(width, 0.12) + 0.01, 0.08, Math.max(depth, 0.12) + 0.01),
    mat,
  );
  m.position.set((minX + maxX) / 2, 0.92, (minZ + maxZ) / 2);
  return m;
}
