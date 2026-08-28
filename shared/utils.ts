import { SYMBOLS, type SymbolId } from "./types";

export function generateRoomCode(chars: string, length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function randomSymbolSequence(length = 4): SymbolId[] {
  return Array.from({ length }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!);
}

export function sequencesMatch(attempt: string[], solution: string[]): boolean {
  if (attempt.length !== solution.length) return false;
  return attempt.every((v, i) => v === solution[i]);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

/** Smallest signed angle from `b` to `a`, in (-PI, PI]. */
export function shortestAngle(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function signalQuality(trust: number): "STABLE" | "FRACTURED" | "DEAD" {
  if (trust >= 60) return "STABLE";
  if (trust >= 35) return "FRACTURED";
  return "DEAD";
}

export function trustLabel(trust: number): string {
  if (trust >= 85) return "UNSHAKEN";
  if (trust >= 60) return "STEADY";
  if (trust >= 40) return "FRACTURED";
  if (trust >= 20) return "BRITTLE";
  return "BROKEN";
}

export function normalizeCode(code: string): string {
  return String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
