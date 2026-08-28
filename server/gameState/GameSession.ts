import type {
  DoorState,
  GameEndPayload,
  GameSnapshot,
  ItemState,
  LightState,
  ObjectiveState,
  PuzzleState,
  Role,
  WatcherMode,
  WalkerState,
  WatcherState,
} from "../../shared/types";
import {
  BATTERY_DRAIN,
  BATTERY_PICKUP,
  ENERGY_REGEN,
  INTERACT_RANGE,
  MAX_BATTERY,
  MAX_ENERGY,
  MAX_STAMINA,
  MODE_COOLDOWN,
  MODE_SWITCH_COST,
  PLAYER_RADIUS,
  SPRINT_SPEED,
  STAMINA_DRAIN,
  STAMINA_REGEN,
  TRUST_START,
  WALK_SPEED,
  WATCHER_FLY_SPEED,
} from "../../shared/constants";
import {
  DOORWAYS,
  KEY_SPAWN_ROOMS,
  MAP_ROOMS,
  NOTES,
  OBJECTIVES,
  doorwayCenter,
  getRoomAt,
  getRoomById,
  resolveMove,
} from "../../shared/map";
import { clamp, dist2, randomSymbolSequence, trustLabel } from "../../shared/utils";
import { createMonster, tickMonster, type MonsterBrain } from "./monster";
import { isSafeSwitch, validateSymbolPuzzle } from "./puzzles";

export interface GameEvent {
  type: string;
  message: string;
  intensity?: number;
  to?: Role | "both";
}

export class GameSession {
  tickCount = 0;
  time = 0;
  trust = TRUST_START;
  generatorOn = false;
  powerSafeSwitch: number;
  symbolSolution: string[];
  walker: WalkerState;
  watcher: WatcherState;
  monster: MonsterBrain;
  doors: DoorState[];
  items: ItemState[];
  puzzles: PuzzleState[];
  lights: LightState[];
  objectives: ObjectiveState[];
  objectiveIndex = 0;
  introDone = { walker: false, watcher: false };
  ended: GameEndPayload | null = null;
  secretObjective: string | null = null;
  secretComplete = false;
  pendingEvents: GameEvent[] = [];
  nearbyWalker: { id: string; prompt: string } | null = null;
  overlay: string | null = null;
  subtitles: string | null = null;
  stats = {
    itemsFound: 0,
    puzzlesSolved: 0,
    monsterEncounters: 0,
    warningsIgnored: 0,
    warningsGiven: 0,
    notesRead: 0,
    secretEvents: 0,
  };
  private horrorTimer = 8;
  private warningWindow = false;
  private warnedThisWindow = false;
  private walkerLookedBack = false;
  private lastWalkerYaw = 0;
  private officeEntered = false;
  private ritualEntered = false;
  private coatUsed = false;
  private lastNoise: { x: number; y: number; z: number } | null = null;
  private simultaneousTimer = 0;

  constructor() {
    this.powerSafeSwitch = Math.floor(Math.random() * 3);
    this.symbolSolution = randomSymbolSequence(4);
    const spawn = getRoomById("entrance")!;
    this.walker = {
      position: { x: spawn.cx, y: 1.6, z: spawn.cz },
      yaw: Math.PI / 2,
      pitch: 0,
      stamina: MAX_STAMINA,
      health: 100,
      flashlightOn: true,
      battery: MAX_BATTERY,
      inventory: [],
      sprinting: false,
      alive: true,
    };
    this.watcher = {
      position: { x: spawn.cx, y: 2.4, z: spawn.cz + 1.2 },
      yaw: Math.PI / 2,
      pitch: -0.2,
      energy: MAX_ENERGY,
      mode: "normal",
      modeCooldown: 0,
      holdingSignal: false,
    };
    this.monster = createMonster();
    this.doors = DOORWAYS.map((d) => ({
      id: d.id,
      open: !d.locked,
      locked: Boolean(d.locked),
    }));
    this.puzzles = [
      { id: "symbols", solved: false, kind: "symbols" },
      { id: "switches", solved: false, kind: "switches" },
      { id: "simultaneous", solved: false, kind: "simultaneous" },
    ];
    this.lights = MAP_ROOMS.map((r) => ({
      id: `light-${r.id}`,
      on: r.id === "entrance",
      roomId: r.id,
    }));
    this.objectives = OBJECTIVES.map((o) => ({ ...o, done: false }));
    this.items = this.spawnItems();
    if (Math.random() < 0.28) {
      const secrets = [
        "Do not tell the Walker about the red marks in the ritual room.",
        "Wait 30 seconds before warning them if something stands behind them.",
        "Convince the Walker to enter the children's room before the office.",
      ];
      this.secretObjective = secrets[Math.floor(Math.random() * secrets.length)]!;
    }
  }

  private spawnItems(): ItemState[] {
    const keyRoom = KEY_SPAWN_ROOMS[Math.floor(Math.random() * KEY_SPAWN_ROOMS.length)]!;
    const kr = getRoomById(keyRoom)!;
    const items: ItemState[] = [
      {
        id: "office-key",
        type: "key",
        position: { x: kr.cx + 1.2, y: 0.9, z: kr.cz - 0.8 },
        taken: false,
        roomId: keyRoom,
      },
      {
        id: "battery-1",
        type: "battery",
        position: { x: 12.8, y: 0.4, z: 2.1 },
        taken: false,
        roomId: "reception",
      },
      {
        id: "battery-2",
        type: "battery",
        position: { x: 26.4, y: 0.4, z: 12.8 },
        taken: false,
        roomId: "generator",
      },
      {
        id: "note-01",
        type: "note",
        position: { x: 10.2, y: 1.05, z: 1.6 },
        taken: false,
        roomId: "reception",
      },
      {
        id: "note-02",
        type: "note",
        position: { x: 12.4, y: 1.05, z: 12.6 },
        taken: false,
        roomId: "security",
      },
      {
        id: "note-03",
        type: "note",
        position: { x: 10.5, y: 1.05, z: -24.2 },
        taken: false,
        roomId: "basement",
      },
      {
        id: "note-04",
        type: "note",
        position: { x: 40.8, y: 1.05, z: 1.4 },
        taken: false,
        roomId: "office",
      },
      {
        id: "note-05",
        type: "note",
        position: { x: 24.6, y: 1.05, z: 13.4 },
        taken: false,
        roomId: "generator",
      },
      {
        id: "keypad-security",
        type: "keypad",
        position: { x: 14.6, y: 1.4, z: 12 },
        taken: false,
        roomId: "security",
      },
      {
        id: "switch-0",
        type: "switch",
        position: { x: 23.4, y: 1.4, z: 13.6 },
        taken: false,
        roomId: "generator",
      },
      {
        id: "switch-1",
        type: "switch",
        position: { x: 26, y: 1.4, z: 13.8 },
        taken: false,
        roomId: "generator",
      },
      {
        id: "switch-2",
        type: "switch",
        position: { x: 28.6, y: 1.4, z: 13.6 },
        taken: false,
        roomId: "generator",
      },
      {
        id: "generator",
        type: "generator",
        position: { x: 26, y: 0.8, z: 10.2 },
        taken: false,
        roomId: "generator",
      },
      {
        id: "exit-panel",
        type: "exit",
        position: { x: 50.4, y: 1.3, z: 0 },
        taken: false,
        roomId: "office",
      },
      {
        id: "audio-log-1",
        type: "audio-log",
        position: { x: 13.6, y: 1.0, z: -23.2 },
        taken: false,
        roomId: "basement",
      },
    ];
    return items;
  }

  markIntroDone(role: Role): void {
    this.introDone[role] = true;
  }

  bothIntroDone(): boolean {
    return this.introDone.walker && this.introDone.watcher;
  }

  applyMove(
    role: Role,
    payload: { x: number; z: number; yaw: number; pitch: number; sprinting: boolean },
    dt = 1 / 15,
  ): void {
    if (this.ended || !this.walker.alive) return;
    if (role === "walker") {
      const prev = this.walker.position;
      const dx = payload.x - prev.x;
      const dz = payload.z - prev.z;
      const max = (payload.sprinting && this.walker.stamina > 0 ? SPRINT_SPEED : WALK_SPEED) * dt * 1.35;
      const len = Math.hypot(dx, dz);
      let mx = dx;
      let mz = dz;
      if (len > max && len > 0) {
        mx = (dx / len) * max;
        mz = (dz / len) * max;
      }
      const resolved = resolveMove(prev.x, prev.z, mx, mz, PLAYER_RADIUS);
      this.walker.position.x = resolved.x;
      this.walker.position.z = resolved.z;
      this.lastWalkerYaw = this.walker.yaw;
      this.walker.yaw = payload.yaw;
      this.walker.pitch = clamp(payload.pitch, -1.2, 1.2);
      this.walker.sprinting = payload.sprinting && this.walker.stamina > 1;
      if (this.walker.sprinting && len > 0.02) {
        this.lastNoise = { x: resolved.x, y: 0, z: resolved.z };
      }
      if (this.monster.state.behindWalker) {
        const delta = Math.abs(payload.yaw - this.lastWalkerYaw);
        if (delta > 0.9) this.walkerLookedBack = true;
      }
      const room = getRoomAt(resolved.x, resolved.z);
      if (room?.id === "office") {
        this.officeEntered = true;
        this.advanceObjective("obj-office");
      }
      if (room?.id === "ritual") this.ritualEntered = true;
      if (room?.id === "generator") this.advanceObjective("obj-generator");
      if (room?.id === "children" && this.secretObjective?.includes("children")) {
        this.secretComplete = true;
      }
    } else {
      const prev = this.watcher.position;
      const dx = payload.x - prev.x;
      const dz = payload.z - prev.z;
      const max = WATCHER_FLY_SPEED * dt * 1.5;
      const len = Math.hypot(dx, dz);
      let mx = dx;
      let mz = dz;
      if (len > max && len > 0) {
        mx = (dx / len) * max;
        mz = (dz / len) * max;
      }
      this.watcher.position.x = prev.x + mx;
      this.watcher.position.z = prev.z + mz;
      this.watcher.position.y = 2.35;
      this.watcher.yaw = payload.yaw;
      this.watcher.pitch = clamp(payload.pitch, -1.4, 1.2);
    }
  }

  setFlashlight(on: boolean): void {
    if (this.walker.battery <= 0) {
      this.walker.flashlightOn = false;
      return;
    }
    this.walker.flashlightOn = on;
  }

  switchMode(mode: WatcherMode): boolean {
    if (this.watcher.modeCooldown > 0) return false;
    if (this.watcher.energy < MODE_SWITCH_COST) return false;
    if (this.watcher.mode === mode) return true;
    this.watcher.mode = mode;
    this.watcher.energy -= MODE_SWITCH_COST;
    this.watcher.modeCooldown = MODE_COOLDOWN;
    return true;
  }

  holdSignal(holding: boolean): void {
    this.watcher.holdingSignal = holding;
  }

  warn(): void {
    this.stats.warningsGiven += 1;
    if (this.monster.state.behindWalker) {
      this.warnedThisWindow = true;
      this.trust = clamp(this.trust + 5, 0, 100);
      this.pushEvent("warning", "DO NOT TURN AROUND.", 0.6, "both");
      this.subtitles = "WATCHER: DO NOT TURN AROUND.";
    } else if (this.coatUsed) {
      this.trust = clamp(this.trust - 4, 0, 100);
      this.pushEvent("warning", "It was nothing. Keep moving.", 0.2, "walker");
    } else {
      this.trust = clamp(this.trust - 10, 0, 100);
      this.pushEvent("false-warning", "STOP MOVING.", 0.4, "walker");
    }
  }

  interact(role: Role, targetId: string): void {
    if (role !== "walker" || this.ended || !this.walker.alive) return;
    const item = this.items.find((i) => i.id === targetId);
    const door = this.doors.find((d) => d.id === targetId);
    const w = this.walker.position;

    if (item && !item.taken) {
      if (dist2(w.x, w.z, item.position.x, item.position.z) > INTERACT_RANGE * INTERACT_RANGE) return;
      this.handleItem(item);
      return;
    }
    if (door) {
      const c = doorwayCenter(DOORWAYS.find((d) => d.id === door.id)!);
      if (!c || dist2(w.x, w.z, c.x, c.z) > INTERACT_RANGE * INTERACT_RANGE) return;
      this.handleDoor(door);
    }
  }

  submitPuzzle(role: Role, puzzleId: string, value: string[]): boolean {
    if (role !== "walker" || this.ended) return false;
    if (puzzleId !== "symbols") return false;
    const puzzle = this.puzzles.find((p) => p.id === "symbols");
    if (!puzzle || puzzle.solved) return false;
    const keypad = this.items.find((i) => i.id === "keypad-security");
    if (!keypad) return false;
    const w = this.walker.position;
    if (dist2(w.x, w.z, keypad.position.x, keypad.position.z) > INTERACT_RANGE * INTERACT_RANGE) {
      return false;
    }
    if (validateSymbolPuzzle(value, this.symbolSolution)) {
      puzzle.solved = true;
      this.stats.puzzlesSolved += 1;
      this.pushEvent("puzzle", "The lock accepts the sequence.", 0.3, "both");
      this.advanceObjective("obj-puzzle");
      return true;
    }
    this.pushEvent("puzzle-fail", "Wrong sequence. Something in the walls notices.", 0.5, "both");
    this.lastNoise = { x: keypad.position.x, y: 0, z: keypad.position.z };
    this.monster.state.ai = "investigating";
    return false;
  }

  private handleItem(item: ItemState): void {
    if (item.type === "key") {
      item.taken = true;
      this.walker.inventory.push(item.id);
      this.stats.itemsFound += 1;
      this.pushEvent("item", "Picked up the office key.", 0.2, "walker");
      this.advanceObjective("obj-key");
    } else if (item.type === "battery") {
      item.taken = true;
      this.walker.battery = clamp(this.walker.battery + BATTERY_PICKUP, 0, MAX_BATTERY);
      this.stats.itemsFound += 1;
      this.pushEvent("item", "Flashlight battery restored.", 0.15, "walker");
    } else if (item.type === "note") {
      item.taken = true;
      this.stats.notesRead += 1;
      this.stats.itemsFound += 1;
      const note = NOTES[item.id];
      if (note) {
        this.overlay = `${note.title}\n\n${note.body}`;
        this.subtitles = note.body.slice(0, 80);
      }
    } else if (item.type === "audio-log") {
      item.taken = true;
      this.stats.itemsFound += 1;
      this.pushEvent("audio-log", "Recording: the observer channel is not a camera. It is a person.", 0.4, "both");
      this.subtitles = "AUDIO LOG: The observer channel is not a camera. It is a person.";
    } else if (item.type === "switch") {
      const index = Number(item.id.split("-")[1]);
      if (!isSafeSwitch(index, this.powerSafeSwitch)) {
        this.pushEvent("shock", "The breaker screams. Wrong one.", 0.7, "walker");
        this.lastNoise = { x: item.position.x, y: 0, z: item.position.z };
        this.monster.state.ai = "hunting";
        this.walker.health -= 8;
        return;
      }
      this.puzzles.find((p) => p.id === "switches")!.solved = true;
      this.stats.puzzlesSolved += 1;
      this.generatorOn = true;
      for (const l of this.lights) l.on = true;
      this.pushEvent("power", "The building hums back to life.", 0.45, "both");
      this.advanceObjective("obj-power");
    } else if (item.type === "generator") {
      this.advanceObjective("obj-generator");
      this.pushEvent("hint", "Three breakers. Only one is safe.", 0.2, "walker");
    } else if (item.type === "exit") {
      this.tryOpenExit();
    } else if (item.type === "keypad") {
      this.pushEvent("keypad", "A four-symbol lock. The sequence is not written here.", 0.1, "walker");
    }
  }

  private handleDoor(door: DoorState): void {
    const def = DOORWAYS.find((d) => d.id === door.id);
    if (!def) return;
    if (door.locked) {
      if (def.needsKey && this.walker.inventory.includes(def.needsKey)) {
        door.locked = false;
        door.open = true;
        this.pushEvent("door", "The office lock turns.", 0.25, "both");
        this.advanceObjective("obj-office");
        return;
      }
      if (def.isExit) {
        this.tryOpenExit();
        return;
      }
      this.pushEvent("locked", "It's locked.", 0.1, "walker");
      return;
    }
    door.open = !door.open;
  }

  private tryOpenExit(): void {
    const ready =
      this.generatorOn &&
      this.puzzles.find((p) => p.id === "symbols")?.solved &&
      this.walker.inventory.includes("office-key");
    if (!ready) {
      this.pushEvent("locked", "The exit needs power, the keypad, and the office key.", 0.2, "walker");
      return;
    }
    if (this.watcher.holdingSignal) {
      this.puzzles.find((p) => p.id === "simultaneous")!.solved = true;
      this.stats.puzzlesSolved += 1;
      const door = this.doors.find((d) => d.id === "door-office-exit");
      if (door) {
        door.locked = false;
        door.open = true;
      }
      this.advanceObjective("obj-exit");
      this.pushEvent("exit", "The final door unlatches.", 0.5, "both");
    } else {
      this.pushEvent("hint", "The Watcher must hold the signal at the same time.", 0.25, "both");
    }
  }

  tick(dt: number): void {
    if (this.ended || !this.walker.alive) return;
    this.tickCount += 1;
    this.time += dt;
    this.overlay = null;
    this.subtitles = null;

    if (this.walker.sprinting && this.walker.stamina > 0) {
      this.walker.stamina = clamp(this.walker.stamina - STAMINA_DRAIN * dt, 0, MAX_STAMINA);
    } else {
      this.walker.stamina = clamp(this.walker.stamina + STAMINA_REGEN * dt, 0, MAX_STAMINA);
    }

    if (this.walker.flashlightOn) {
      this.walker.battery = clamp(this.walker.battery - BATTERY_DRAIN * dt, 0, MAX_BATTERY);
      if (this.walker.battery <= 0) this.walker.flashlightOn = false;
    }

    this.watcher.energy = clamp(this.watcher.energy + ENERGY_REGEN * dt, 0, MAX_ENERGY);
    this.watcher.modeCooldown = Math.max(0, this.watcher.modeCooldown - dt);

    const result = tickMonster(
      this.monster,
      dt,
      { x: this.walker.position.x, z: this.walker.position.z, yaw: this.walker.yaw },
      this.walker.flashlightOn,
      this.generatorOn,
      this.lastNoise,
    );
    this.lastNoise = null;
    if (result.startedBehind) {
      this.warningWindow = true;
      this.warnedThisWindow = false;
      this.walkerLookedBack = false;
      this.stats.monsterEncounters += 1;
      this.pushEvent("behind", "It is standing behind them.", 0.8, "watcher");
      if (this.secretObjective?.includes("Wait 30 seconds")) {
        this.pushEvent("secret", this.secretObjective, 0.2, "watcher");
      }
    }
    if (this.warningWindow && !this.monster.state.behindWalker) {
      this.warningWindow = false;
      if (this.warnedThisWindow && this.walkerLookedBack) {
        this.trust = clamp(this.trust - 5, 0, 100);
        this.stats.warningsIgnored += 1;
      } else if (!this.warnedThisWindow) {
        this.trust = clamp(this.trust - 8, 0, 100);
      }
    }
    if (this.monster.state.behindWalker && this.walkerLookedBack) {
      result.caught = true;
    }
    if (result.caught) {
      this.killWalker();
      return;
    }

    this.updateNearby();
    this.tickHorror(dt);
    this.tickSimultaneous(dt);
    this.checkWin();
  }

  private tickSimultaneous(dt: number): void {
    const door = this.doors.find((d) => d.id === "door-office-exit");
    if (!door || door.open) return;
    const panel = this.items.find((i) => i.id === "exit-panel")!;
    const near =
      dist2(this.walker.position.x, this.walker.position.z, panel.position.x, panel.position.z) <
      INTERACT_RANGE * INTERACT_RANGE;
    if (near && this.watcher.holdingSignal) {
      this.simultaneousTimer += dt;
      if (this.simultaneousTimer > 1.2) this.tryOpenExit();
    } else {
      this.simultaneousTimer = 0;
    }
  }

  private tickHorror(dt: number): void {
    this.horrorTimer -= dt;
    if (this.horrorTimer > 0) return;
    this.horrorTimer = 11 + Math.random() * 16;
    const roll = Math.random();
    if (roll < 0.12) {
      const light = this.lights[Math.floor(Math.random() * this.lights.length)]!;
      light.on = false;
      this.pushEvent("lights-out", "A light dies.", 0.4, "walker");
    } else if (roll < 0.2) {
      this.pushEvent("child-laugh", "A child's laugh, far away. There are no children here.", 0.45, "both");
      this.subtitles = "A child's laugh, far away.";
    } else if (roll < 0.28) {
      this.pushEvent("phone-ring", "A phone rings in an empty office. The voicemail is a pizza coupon.", 0.25, "walker");
      this.subtitles = "Automated voice: Your pizza will arrive in twenty minutes.";
    } else if (roll < 0.36) {
      this.pushEvent("silhouette-flash", "", 0.7, "walker");
    } else if (roll < 0.44) {
      this.pushEvent("fake-message", "RUN.", 0.5, "walker");
    } else if (roll < 0.52) {
      this.pushEvent("watcher-distort", "Signal fracture.", 0.55, "watcher");
    } else if (roll < 0.6 && !this.coatUsed) {
      this.coatUsed = true;
      this.pushEvent("coat-scare", "Something in the hallway. Wait—it's a coat.", 0.35, "watcher");
    } else if (roll < 0.68) {
      this.pushEvent("vending-noise", "A vending machine detonates a can. Everyone jumps. It is only soda.", 0.3, "both");
    } else if (roll < 0.76) {
      this.pushEvent("whisper", "A whisper uses the Walker's voice.", 0.4, "watcher");
    } else if (roll < 0.84) {
      const door = this.doors.find((d) => !d.locked && d.open);
      if (door) {
        door.open = false;
        this.pushEvent("door-slam", "A door closes by itself.", 0.4, "both");
      }
    } else {
      this.pushEvent("shadow-cross", "A shadow crosses the hallway.", 0.35, "walker");
    }
  }

  private updateNearby(): void {
    const w = this.walker.position;
    let best: { id: string; prompt: string; d: number } | null = null;
    for (const item of this.items) {
      if (item.taken && item.type !== "keypad" && item.type !== "switch" && item.type !== "generator" && item.type !== "exit") {
        continue;
      }
      const d = dist2(w.x, w.z, item.position.x, item.position.z);
      if (d > INTERACT_RANGE * INTERACT_RANGE) continue;
      if (!best || d < best.d) {
        best = { id: item.id, prompt: promptFor(item), d };
      }
    }
    for (const door of this.doors) {
      const def = DOORWAYS.find((d) => d.id === door.id);
      if (!def) continue;
      const c = doorwayCenter(def);
      if (!c) continue;
      const d = dist2(w.x, w.z, c.x, c.z);
      if (d > INTERACT_RANGE * INTERACT_RANGE) continue;
      if (!best || d < best.d) {
        const prompt = door.locked ? "[E] Locked Door" : door.open ? "[E] Close Door" : "[E] Open Door";
        best = { id: door.id, prompt, d };
      }
    }
    this.nearbyWalker = best ? { id: best.id, prompt: best.prompt } : null;
  }

  private currentObjective(): ObjectiveState {
    const pending = this.objectives.find((o) => !o.done);
    return pending ?? this.objectives[this.objectives.length - 1]!;
  }

  private advanceObjective(id: string): void {
    const obj = this.objectives.find((o) => o.id === id);
    if (obj && !obj.done) obj.done = true;
    if (id === "obj-generator" || this.getRoomId() === "generator") {
      const g = this.objectives.find((o) => o.id === "obj-generator");
      if (g) g.done = true;
    }
  }

  private getRoomId(): string | undefined {
    return getRoomAt(this.walker.position.x, this.walker.position.z)?.id;
  }

  private checkWin(): void {
    const exitDoor = this.doors.find((d) => d.id === "door-office-exit");
    const exit = getRoomById("exit")!;
    const walkerInExit =
      Math.abs(this.walker.position.x - exit.cx) < exit.hw &&
      Math.abs(this.walker.position.z - exit.cz) < exit.hd;
    const watcherInExit =
      Math.abs(this.watcher.position.x - exit.cx) < exit.hw + 2 &&
      Math.abs(this.watcher.position.z - exit.cz) < exit.hd + 2;
    if (exitDoor?.open && walkerInExit && watcherInExit) {
      this.advanceObjective("obj-escape");
      this.endGame(this.pickEnding());
    }
  }

  private pickEnding(): GameEndPayload["ending"] {
    if (this.ritualEntered && this.secretObjective?.includes("ritual") && this.secretComplete) {
      this.trust = clamp(this.trust - 25, 0, 100);
      return "betrayal";
    }
    if (this.ritualEntered && (!this.officeEntered || this.trust < 35)) return "betrayal";
    if (this.stats.notesRead >= 4 && this.trust >= 70 && Math.random() < 0.35) return "loop";
    if (this.trust < 25) return "hollow";
    return "escape";
  }

  killWalker(): void {
    this.walker.alive = false;
    this.ended = {
      ending: "hollow",
      title: "THE HOLLOW FOUND YOU.",
      body: "The recording ends. The observer channel goes silent.",
      stats: this.buildStats(),
    };
    this.pushEvent("death", "THE HOLLOW FOUND YOU.", 1, "both");
  }

  private endGame(ending: GameEndPayload["ending"]): void {
    const titles: Record<GameEndPayload["ending"], { title: string; body: string }> = {
      escape: {
        title: "YOU ESCAPED",
        body: "The doors open onto cold air. You do not look back.",
      },
      betrayal: {
        title: "BETRAYAL",
        body: "The Watcher led them to the wrong threshold. The Hollow was waiting.",
      },
      hollow: {
        title: "THE HOLLOW",
        body: "The Walker steps into the night. The Watcher's signal ends mid-sentence.",
      },
      loop: {
        title: "YOU NEVER LEFT.",
        body: "The lobby looks the same. The title on the wall has changed.",
      },
    };
    const t = titles[ending];
    this.ended = { ending, title: t.title, body: t.body, stats: this.buildStats() };
  }

  private buildStats() {
    return {
      timeSeconds: Math.floor(this.time),
      itemsFound: this.stats.itemsFound,
      puzzlesSolved: this.stats.puzzlesSolved,
      monsterEncounters: this.stats.monsterEncounters,
      warningsIgnored: this.stats.warningsIgnored,
      warningsGiven: this.stats.warningsGiven,
      notesRead: this.stats.notesRead,
      trustLabel: trustLabel(this.trust),
      secretEvents: this.secretObjective ? 1 : 0,
    };
  }

  private pushEvent(type: string, message: string, intensity: number, to: Role | "both"): void {
    this.pendingEvents.push({ type, message, intensity, to });
  }

  drainEvents(): GameEvent[] {
    const e = this.pendingEvents;
    this.pendingEvents = [];
    return e;
  }

  snapshotFor(role: Role): GameSnapshot {
    const monsterVisible =
      role === "watcher"
        ? {
            ...this.monster.state,
            visibleToWalker: this.monster.state.visibleToWalker,
          }
        : this.monster.state.visibleToWalker || this.monster.state.behindWalker
          ? {
              ...this.monster.state,
              position: this.monster.state.visibleToWalker
                ? this.monster.state.position
                : { x: 0, y: -20, z: 0 },
              behindWalker: this.monster.state.behindWalker,
            }
          : null;

    return {
      tick: this.tickCount,
      time: this.time,
      phase: this.ended ? "ended" : "playing",
      objective: this.currentObjective(),
      walker: { ...this.walker, position: { ...this.walker.position }, inventory: [...this.walker.inventory] },
      watcher: { ...this.watcher, position: { ...this.watcher.position } },
      monster: monsterVisible,
      doors: this.doors.map((d) => ({ ...d })),
      items: this.items
        .filter((i) => !i.taken || i.type === "keypad" || i.type === "switch" || i.type === "generator" || i.type === "exit")
        .map((i) => ({ ...i, position: { ...i.position } })),
      puzzles: this.puzzles.map((p) => ({ ...p })),
      lights: this.lights.map((l) => ({ ...l })),
      generatorOn: this.generatorOn,
      powerSafeSwitch: role === "watcher" && this.watcher.mode === "danger" ? this.powerSafeSwitch : -1,
      symbolSolution: role === "watcher" && (this.watcher.mode === "spirit" || this.watcher.mode === "echo")
        ? [...this.symbolSolution]
        : null,
      nearbyInteractable: role === "walker" ? this.nearbyWalker : null,
      secretObjective: role === "watcher" ? this.secretObjective : null,
      overlay: role === "walker" ? this.overlay : null,
      subtitles: this.subtitles,
    };
  }
}

function promptFor(item: ItemState): string {
  switch (item.type) {
    case "key":
      return "[E] Pick Up Key";
    case "battery":
      return "[E] Take Battery";
    case "note":
      return "[E] Read Note";
    case "keypad":
      return "[E] Use Keypad";
    case "switch":
      return "[E] Flip Breaker";
    case "generator":
      return "[E] Inspect Generator";
    case "audio-log":
      return "[E] Play Recording";
    case "exit":
      return "[E] Hold Exit Mechanism";
    default:
      return "[E] Interact";
  }
}
