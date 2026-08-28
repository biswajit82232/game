export type Role = "walker" | "watcher";

export type GamePhase =
  | "lobby"
  | "intro"
  | "playing"
  | "ended"
  | "disconnected";

export type WatcherMode = "normal" | "spirit" | "echo" | "danger";

export type MonsterAiState =
  | "idle"
  | "observing"
  | "stalking"
  | "investigating"
  | "hunting"
  | "attack"
  | "retreat";

export type EndingId = "escape" | "betrayal" | "hollow" | "loop";

export type InteractableType =
  | "door"
  | "key"
  | "battery"
  | "note"
  | "keypad"
  | "switch"
  | "generator"
  | "audio-log"
  | "exit";

export type HorrorEventType =
  | "lights-out"
  | "door-slam"
  | "chair-move"
  | "shadow-cross"
  | "phone-ring"
  | "child-laugh"
  | "silhouette-flash"
  | "monster-only-watcher"
  | "room-change"
  | "radio-voice"
  | "watcher-distort"
  | "fake-message"
  | "coat-scare"
  | "vending-noise";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface PlayerPublic {
  id: string;
  role: Role;
  ready: boolean;
  connected: boolean;
  name: string;
}

export interface RoomPublic {
  code: string;
  phase: GamePhase;
  players: PlayerPublic[];
  hostId: string;
}

export interface WalkerState {
  position: Vec3;
  yaw: number;
  pitch: number;
  stamina: number;
  health: number;
  flashlightOn: boolean;
  battery: number;
  inventory: string[];
  sprinting: boolean;
  alive: boolean;
}

export interface WatcherState {
  position: Vec3;
  yaw: number;
  pitch: number;
  energy: number;
  mode: WatcherMode;
  modeCooldown: number;
  holdingSignal: boolean;
}

export interface MonsterState {
  position: Vec3;
  yaw: number;
  ai: MonsterAiState;
  visibleToWalker: boolean;
  behindWalker: boolean;
  behindTimer: number;
}

export interface DoorState {
  id: string;
  open: boolean;
  locked: boolean;
}

export interface ItemState {
  id: string;
  type: InteractableType;
  position: Vec3;
  taken: boolean;
  roomId: string;
}

export interface PuzzleState {
  id: string;
  solved: boolean;
  kind: "symbols" | "switches" | "code" | "simultaneous";
}

export interface LightState {
  id: string;
  on: boolean;
  roomId: string;
}

export interface ObjectiveState {
  id: string;
  text: string;
  done: boolean;
}

export interface NoteContent {
  id: string;
  title: string;
  body: string;
}

export interface ChatMessage {
  id: string;
  from: Role | "system";
  text: string;
  at: number;
  fake?: boolean;
}

export interface GameStats {
  timeSeconds: number;
  itemsFound: number;
  puzzlesSolved: number;
  monsterEncounters: number;
  warningsIgnored: number;
  warningsGiven: number;
  notesRead: number;
  trustLabel: string;
  secretEvents: number;
}

export interface GameSnapshot {
  tick: number;
  time: number;
  phase: GamePhase;
  objective: ObjectiveState;
  walker: WalkerState;
  watcher: WatcherState;
  monster: MonsterState | null;
  doors: DoorState[];
  items: ItemState[];
  puzzles: PuzzleState[];
  lights: LightState[];
  generatorOn: boolean;
  powerSafeSwitch: number;
  symbolSolution: string[] | null;
  nearbyInteractable: {
    id: string;
    prompt: string;
  } | null;
  secretObjective: string | null;
  overlay: string | null;
  subtitles: string | null;
  solo: boolean;
}

export interface GameEndPayload {
  ending: EndingId;
  title: string;
  body: string;
  stats: GameStats;
}

export const SYMBOLS = ["triangle", "circle", "square", "diamond"] as const;
export type SymbolId = (typeof SYMBOLS)[number];
