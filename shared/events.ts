import type {
  EndingId,
  GameEndPayload,
  GameSnapshot,
  Role,
  RoomPublic,
  WatcherMode,
} from "./types";

export interface ClientToServerEvents {
  "room:create": () => void;
  "room:join": (payload: { code: string }) => void;
  "room:ready": () => void;
  "room:swapRoles": () => void;
  "room:leave": () => void;
  "player:introDone": () => void;
  "player:move": (payload: {
    x: number;
    z: number;
    yaw: number;
    pitch: number;
    sprinting: boolean;
  }) => void;
  "player:interact": (payload: { targetId: string }) => void;
  "player:flashlight": (payload: { on: boolean }) => void;
  "player:switchMode": (payload: { mode: WatcherMode }) => void;
  "player:chat": (payload: { text: string }) => void;
  "player:warning": () => void;
  "player:puzzleInput": (payload: { puzzleId: string; value: string[] }) => void;
  "player:holdSignal": (payload: { holding: boolean }) => void;
  "player:waitReconnect": () => void;
}

export interface ServerToClientEvents {
  "room:updated": (room: RoomPublic) => void;
  "room:error": (payload: { message: string }) => void;
  "game:started": (payload: { role: Role }) => void;
  "game:snapshot": (snapshot: GameSnapshot) => void;
  "game:event": (payload: { type: string; message: string; intensity?: number }) => void;
  "game:chat": (payload: {
    from: Role | "system";
    text: string;
    fake?: boolean;
  }) => void;
  "game:ended": (payload: GameEndPayload) => void;
  "game:note": (payload: { title: string; body: string }) => void;
  "player:disconnected": (payload: { role: Role }) => void;
  "player:reconnected": (payload: { role: Role }) => void;
}

export type EndingTitles = Record<EndingId, { title: string; body: string }>;
