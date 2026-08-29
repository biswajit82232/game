import * as THREE from "three";

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number): number {
  return (
    valueNoise(x, y) * 0.5 +
    valueNoise(x * 2.03, y * 2.03) * 0.27 +
    valueNoise(x * 4.07, y * 4.07) * 0.145 +
    valueNoise(x * 8.13, y * 8.13) * 0.055 +
    valueNoise(x * 16.3, y * 16.3) * 0.03
  );
}

export function canvasTex(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  paint(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = colorSpace;
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

/** Aged hospital plaster — mottled, stained, no cartoon stripes. */
function paintPlaster(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 55, y / 55);
      const fine = fbm(x / 11, y / 11);
      const stain = Math.max(0, fbm(x / 90 + 3, y / 70) - 0.55) * 55;
      const water = Math.max(0, (y / size - 0.72) * fbm(x / 40, y / 20)) * 48;
      const crack = hash2(x >> 3, y >> 2) > 0.992 ? 28 : 0;
      const v = 142 + n * 18 + fine * 8 - stain - water - crack;
      const i = (y * size + x) * 4;
      d[i] = Math.max(40, Math.min(200, v + 4));
      d[i + 1] = Math.max(38, Math.min(195, v - 2));
      d[i + 2] = Math.max(32, Math.min(185, v - 12));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Worn vinyl tile with real grout lines and scuffs. */
function paintVinyl(ctx: CanvasRenderingContext2D, size: number): void {
  const tiles = 8;
  const t = size / tiles;
  ctx.fillStyle = "#1c1a18";
  ctx.fillRect(0, 0, size, size);
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const n = fbm(tx * 2.1 + 1, ty * 2.4);
      const base = 62 + n * 22;
      const wear = hash2(tx, ty) * 12;
      ctx.fillStyle = `rgb(${(base + 14 + wear) | 0},${(base + 6) | 0},${(base - 4) | 0})`;
      ctx.fillRect(tx * t + 2, ty * t + 2, t - 4, t - 4);
      // scuff
      if ((tx * 7 + ty * 3) % 5 === 0) {
        ctx.fillStyle = "rgba(255,245,230,0.06)";
        ctx.beginPath();
        ctx.ellipse(tx * t + t * 0.55, ty * t + t * 0.4, t * 0.28, t * 0.08, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if ((tx + ty * 2) % 7 === 0) {
        ctx.fillStyle = "rgba(10,8,6,0.2)";
        ctx.beginPath();
        ctx.ellipse(tx * t + t * 0.35, ty * t + t * 0.65, t * 0.2, t * 0.12, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = "rgba(18,16,14,0.85)";
  ctx.lineWidth = 3;
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
}

function paintConcrete(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 32, y / 32);
      const gravel = hash2(x, y) > 0.96 ? 35 : hash2(x + 3, y + 1) > 0.985 ? -20 : 0;
      const crack =
        Math.abs(Math.sin(x * 0.04 + y * 0.015) * Math.cos(y * 0.03)) > 0.97 ? -30 : 0;
      const v = 58 + n * 32 + gravel + crack;
      const i = (y * size + x) * 4;
      d[i] = v;
      d[i + 1] = v - 1;
      d[i + 2] = v - 5;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function paintCeiling(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = "#9a968c";
  ctx.fillRect(0, 0, size, size);
  const cols = 2;
  const rows = 4;
  const tw = size / cols;
  const th = size / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const n = fbm(x * 3.2, y * 3.1);
      const v = 150 + n * 22;
      ctx.fillStyle = `rgb(${v | 0},${(v - 4) | 0},${(v - 14) | 0})`;
      ctx.fillRect(x * tw + 3, y * th + 3, tw - 6, th - 6);
      // water stain
      if ((x + y) % 3 === 0) {
        const g = ctx.createRadialGradient(
          x * tw + tw * 0.55,
          y * th + th * 0.4,
          4,
          x * tw + tw * 0.55,
          y * th + th * 0.4,
          tw * 0.4,
        );
        g.addColorStop(0, "rgba(70,60,40,0.28)");
        g.addColorStop(1, "rgba(70,60,40,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x * tw, y * th, tw, th);
      }
    }
  }
  ctx.strokeStyle = "rgba(35,32,28,0.55)";
  ctx.lineWidth = 4;
  for (let i = 0; i <= cols; i++) {
    ctx.beginPath();
    ctx.moveTo(i * tw, 0);
    ctx.lineTo(i * tw, size);
    ctx.stroke();
  }
  for (let i = 0; i <= rows; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * th);
    ctx.lineTo(size, i * th);
    ctx.stroke();
  }
}

function paintWood(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const grain = Math.sin(y / 7 + fbm(x / 90, y / 12) * 5) * 14;
      const pore = hash2(x, y) > 0.94 ? -18 : 0;
      const n = fbm(x / 70, y / 16);
      const v = 78 + grain + n * 16 + pore;
      const i = (y * size + x) * 4;
      d[i] = Math.max(30, v + 22);
      d[i + 1] = Math.max(24, v + 4);
      d[i + 2] = Math.max(16, v - 16);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function paintMetal(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const brush = Math.sin(y * 0.35) * 6;
      const n = fbm(x / 18, y / 5);
      const rust = Math.max(0, fbm(x / 40 + 2, y / 40) - 0.62) * 40;
      const v = 92 + n * 28 + brush;
      const i = (y * size + x) * 4;
      d[i] = v + rust;
      d[i + 1] = v + 2 - rust * 0.4;
      d[i + 2] = v + 8 - rust;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function paintRoughness(ctx: CanvasRenderingContext2D, size: number, bias: number): void {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.min(255, Math.max(0, bias + fbm(x / 20, y / 20) * 90));
      const i = (y * size + x) * 4;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function paintBump(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = fbm(x / 14, y / 14) * 255;
      const i = (y * size + x) * 4;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function indoorEnv(): THREE.CubeTexture {
  const faces = [0x8a8278, 0x6a645c, 0x9a948a, 0x2a2824, 0x7a746c, 0x4a4640];
  const images = faces.map((hex) => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    const r = (hex >> 16) & 255;
    const g = (hex >> 8) & 255;
    const b = hex & 255;
    const grd = ctx.createRadialGradient(32, 32, 4, 32, 32, 40);
    grd.addColorStop(0, `rgb(${r},${g},${b})`);
    grd.addColorStop(1, `rgb(${(r * 0.22) | 0},${(g * 0.22) | 0},${(b * 0.22) | 0})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  });
  const tex = new THREE.CubeTexture(images);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface WorldMats {
  plaster: THREE.MeshStandardMaterial;
  vinyl: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  fabric: THREE.MeshStandardMaterial;
  env: THREE.CubeTexture;
}

export function createWorldMats(quality: "low" | "high", anisotropy: number, mobile: boolean): WorldMats {
  const high = quality === "high";
  const size = high ? (mobile ? 320 : 512) : 160;
  const bumpSize = high ? (mobile ? 192 : 384) : 96;
  const env = indoorEnv();
  const plasterMap = canvasTex(size, paintPlaster, anisotropy, 1, 1);
  const vinylMap = canvasTex(size, paintVinyl, anisotropy, 1, 1);
  const concMap = canvasTex(size, paintConcrete, anisotropy, 1, 1);
  const ceilMap = canvasTex(Math.min(size, 512), paintCeiling, anisotropy, 1, 1);
  const woodMap = canvasTex(Math.min(size, 512), paintWood, anisotropy, 2, 1);
  const metalMap = canvasTex(Math.min(256, size), paintMetal, anisotropy, 2, 2);
  const bump = canvasTex(bumpSize, paintBump, 1, 1, 1, THREE.NoColorSpace);
  const roughWall = canvasTex(bumpSize, (c, s) => paintRoughness(c, s, 170), 1, 1, 1, THREE.NoColorSpace);
  const roughFloor = canvasTex(bumpSize, (c, s) => paintRoughness(c, s, 120), 1, 1, 1, THREE.NoColorSpace);
  const roughMetal = canvasTex(128, (c, s) => paintRoughness(c, s, 70), 1, 1, 1, THREE.NoColorSpace);

  const std = (map: THREE.Texture, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({
      map,
      envMap: env,
      envMapIntensity: 0.42,
      bumpMap: bump,
      bumpScale: 0.055,
      ...extra,
    });

  const fabric = new THREE.MeshStandardMaterial({
    color: 0x6a5a58,
    roughness: 0.95,
    metalness: 0,
    bumpMap: bump,
    bumpScale: 0.08,
  });

  return {
    plaster: std(plasterMap, {
      color: 0xc8c0b4,
      roughness: 0.9,
      metalness: 0.02,
      roughnessMap: roughWall,
      bumpScale: 0.04,
      envMapIntensity: 0.22,
    }),
    vinyl: std(vinylMap, {
      color: 0xb8b0a4,
      roughness: 0.55,
      metalness: 0.06,
      roughnessMap: roughFloor,
      bumpScale: 0.035,
      envMapIntensity: 0.35,
    }),
    concrete: std(concMap, {
      color: 0x9a9690,
      roughness: 0.95,
      metalness: 0.05,
      roughnessMap: roughWall,
      bumpScale: 0.09,
      envMapIntensity: 0.18,
    }),
    ceiling: std(ceilMap, {
      color: 0xb8b4aa,
      roughness: 0.92,
      metalness: 0,
      bumpScale: 0.025,
      envMapIntensity: 0.15,
    }),
    wood: std(woodMap, {
      color: 0xa88868,
      roughness: 0.72,
      metalness: 0.04,
      roughnessMap: roughFloor,
      envMapIntensity: 0.3,
    }),
    metal: std(metalMap, {
      color: 0x8a9298,
      roughness: 0.42,
      metalness: 0.78,
      roughnessMap: roughMetal,
      envMapIntensity: 0.85,
      bumpScale: 0.03,
    }),
    trim: std(woodMap, {
      color: 0x6a5648,
      roughness: 0.78,
      metalness: 0.05,
      envMapIntensity: 0.25,
    }),
    fabric,
    env,
  };
}

export function tintedFloor(base: THREE.MeshStandardMaterial, color: number): THREE.MeshStandardMaterial {
  const m = base.clone();
  m.color = new THREE.Color(color);
  return m;
}

export function scaledMat(
  base: THREE.MeshStandardMaterial,
  repeatX: number,
  repeatY: number,
): THREE.MeshStandardMaterial {
  const m = base.clone();
  if (m.map) {
    m.map = m.map.clone();
    m.map.repeat.set(repeatX, repeatY);
    m.map.needsUpdate = true;
  }
  if (m.bumpMap) {
    m.bumpMap = m.bumpMap.clone();
    m.bumpMap.repeat.set(repeatX, repeatY);
    m.bumpMap.needsUpdate = true;
  }
  if (m.roughnessMap) {
    m.roughnessMap = m.roughnessMap.clone();
    m.roughnessMap.repeat.set(repeatX, repeatY);
    m.roughnessMap.needsUpdate = true;
  }
  return m;
}
