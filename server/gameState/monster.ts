import type { MonsterAiState, MonsterState, Vec3 } from "../../shared/types";
import { dist2 } from "../../shared/utils";
import { getRoomAt, MAP_ROOMS } from "../../shared/map";

export interface MonsterBrain {
  state: MonsterState;
  target: Vec3 | null;
  stateTimer: number;
  behindCooldown: number;
  encounters: number;
  lastNoise: Vec3 | null;
}

export function createMonster(): MonsterBrain {
  const ritual = MAP_ROOMS.find((r) => r.id === "ritual")!;
  return {
    state: {
      position: { x: ritual.cx, y: 0, z: ritual.cz },
      yaw: 0,
      ai: "idle",
      visibleToWalker: false,
      behindWalker: false,
      behindTimer: 0,
    },
    target: null,
    stateTimer: 4 + Math.random() * 6,
    behindCooldown: 12,
    encounters: 0,
    lastNoise: null,
  };
}

function pickState(noise: boolean, close: boolean): MonsterAiState {
  const roll = Math.random();
  if (noise) {
    if (roll < 0.55) return "investigating";
    if (roll < 0.8) return "stalking";
    return "observing";
  }
  if (close) {
    if (roll < 0.5) return "observing";
    if (roll < 0.78) return "stalking";
    if (roll < 0.9) return "hunting";
    return "idle";
  }
  if (roll < 0.7) return "observing";
  if (roll < 0.9) return "stalking";
  return "hunting";
}

function roamPoint(): Vec3 {
  const room = MAP_ROOMS[Math.floor(Math.random() * MAP_ROOMS.length)]!;
  return {
    x: room.cx + (Math.random() - 0.5) * room.hw * 1.2,
    y: 0,
    z: room.cz + (Math.random() - 0.5) * room.hd * 1.2,
  };
}

export function tickMonster(
  brain: MonsterBrain,
  dt: number,
  walker: { x: number; z: number; yaw: number },
  flashlightOn: boolean,
  generatorOn: boolean,
  noise: Vec3 | null,
): { caught: boolean; startedBehind: boolean } {
  const m = brain.state;
  brain.stateTimer -= dt;
  brain.behindCooldown -= dt;
  if (noise) brain.lastNoise = noise;

  if (m.behindWalker) {
    m.behindTimer -= dt;
    const bx = walker.x - Math.sin(walker.yaw) * 1.85;
    const bz = walker.z - Math.cos(walker.yaw) * 1.85;
    m.position.x = bx;
    m.position.z = bz;
    m.yaw = walker.yaw;
    m.visibleToWalker = false;
    if (m.behindTimer <= 0) {
      m.behindWalker = false;
      m.ai = "retreat";
      brain.stateTimer = 3;
      m.position = roamPoint();
    }
    return { caught: false, startedBehind: false };
  }

  if (flashlightOn && m.ai !== "hunting" && m.ai !== "attack") {
    const d = Math.sqrt(dist2(m.position.x, m.position.z, walker.x, walker.z));
    if (d < 7 && m.ai !== "retreat") {
      m.ai = "retreat";
      brain.stateTimer = 2 + Math.random() * 2;
      brain.target = roamPoint();
    }
  }

  if (brain.stateTimer <= 0 && m.ai !== "attack") {
    const d = Math.sqrt(dist2(m.position.x, m.position.z, walker.x, walker.z));
    m.ai = pickState(Boolean(brain.lastNoise), d < 10);
    brain.stateTimer = 3 + Math.random() * 7;
    const noisePoint = brain.lastNoise;
    brain.lastNoise = null;
    if (m.ai === "observing") brain.target = { x: walker.x, y: 0, z: walker.z };
    if (m.ai === "stalking") {
      brain.target = {
        x: walker.x + (Math.random() - 0.5) * 6,
        y: 0,
        z: walker.z + (Math.random() - 0.5) * 6,
      };
    }
    if (m.ai === "investigating" && noisePoint) brain.target = { ...noisePoint };
    if (m.ai === "hunting") brain.target = { x: walker.x, y: 0, z: walker.z };
    if (m.ai === "idle" || m.ai === "retreat") brain.target = roamPoint();
  }

  let speed = 0.9;
  if (m.ai === "stalking") speed = 1.6;
  if (m.ai === "investigating") speed = 2.1;
  if (m.ai === "hunting") speed = 3.4;
  if (m.ai === "retreat") speed = 4.2;
  if (m.ai === "observing") speed = 0.35;
  if (m.ai === "idle") speed = 0.15;

  const target =
    m.ai === "hunting" || m.ai === "attack"
      ? { x: walker.x, z: walker.z }
      : brain.target;

  if (target) {
    const dx = target.x - m.position.x;
    const dz = target.z - m.position.z;
    const len = Math.hypot(dx, dz) || 1;
    m.position.x += (dx / len) * speed * dt;
    m.position.z += (dz / len) * speed * dt;
    m.yaw = Math.atan2(dx, dz);
  }

  const dist = Math.sqrt(dist2(m.position.x, m.position.z, walker.x, walker.z));
  m.visibleToWalker = m.ai === "hunting" || m.ai === "attack" || (m.ai === "stalking" && dist < 4 && Math.random() < 0.02);

  if (generatorOn && dist < 5 && m.ai !== "hunting") {
    m.visibleToWalker = false;
  }

  let startedBehind = false;
  if (
    brain.behindCooldown <= 0 &&
    (m.ai === "stalking" || m.ai === "observing") &&
    dist > 3 &&
    Math.random() < 0.012
  ) {
    m.behindWalker = true;
    m.behindTimer = 4.2;
    m.visibleToWalker = false;
    m.ai = "stalking";
    brain.behindCooldown = 22 + Math.random() * 18;
    brain.encounters += 1;
    startedBehind = true;
  }

  if (m.ai === "hunting" && dist < 1.15) {
    m.ai = "attack";
    return { caught: true, startedBehind };
  }

  const room = getRoomAt(m.position.x, m.position.z);
  if (!room && brain.target) {
    m.position.x += (brain.target.x - m.position.x) * 0.02;
  }

  return { caught: false, startedBehind };
}
