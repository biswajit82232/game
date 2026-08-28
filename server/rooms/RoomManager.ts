import type { Role, RoomPublic, GamePhase } from "../../shared/types";
import { ROOM_CODE_CHARS, ROOM_CODE_LENGTH } from "../../shared/constants";
import { generateRoomCode, normalizeCode } from "../../shared/utils";

export interface RoomPlayer {
  socketId: string;
  role: Role;
  ready: boolean;
  connected: boolean;
  sessionToken: string;
}

export interface Room {
  code: string;
  phase: GamePhase;
  hostId: string;
  players: RoomPlayer[];
  createdAt: number;
  disconnectedAt: number | null;
}

export type JoinError = "not_found" | "full" | "started" | "duplicate";

export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketToRoom = new Map<string, string>();

  getRoom(code: string): Room | undefined {
    return this.rooms.get(normalizeCode(code));
  }

  getRoomBySocket(socketId: string): Room | undefined {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  getPlayer(socketId: string): { room: Room; player: RoomPlayer } | undefined {
    const room = this.getRoomBySocket(socketId);
    if (!room) return undefined;
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) return undefined;
    return { room, player };
  }

  createRoom(socketId: string): Room {
    let code = generateRoomCode(ROOM_CODE_CHARS, ROOM_CODE_LENGTH);
    while (this.rooms.has(code)) {
      code = generateRoomCode(ROOM_CODE_CHARS, ROOM_CODE_LENGTH);
    }
    const room: Room = {
      code,
      phase: "lobby",
      hostId: socketId,
      createdAt: Date.now(),
      disconnectedAt: null,
      players: [
        {
          socketId,
          role: "walker",
          ready: false,
          connected: true,
          sessionToken: `${code}-walker`,
        },
      ],
    };
    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);
    return room;
  }

  joinRoom(
    socketId: string,
    rawCode: string,
  ): { ok: true; room: Room } | { ok: false; error: JoinError } {
    const code = normalizeCode(rawCode);
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: "not_found" };
    if (room.phase !== "lobby") return { ok: false, error: "started" };
    if (room.players.some((p) => p.socketId === socketId)) {
      return { ok: false, error: "duplicate" };
    }
    const connected = room.players.filter((p) => p.connected);
    if (connected.length >= 2 || room.players.length >= 2) {
      return { ok: false, error: "full" };
    }
    room.players.push({
      socketId,
      role: "watcher",
      ready: false,
      connected: true,
      sessionToken: `${code}-watcher`,
    });
    this.socketToRoom.set(socketId, code);
    return { ok: true, room };
  }

  setReady(socketId: string): Room | undefined {
    const found = this.getPlayer(socketId);
    if (!found || found.room.phase !== "lobby") return undefined;
    found.player.ready = true;
    return found.room;
  }

  bothReady(room: Room): boolean {
    return room.players.length === 2 && room.players.every((p) => p.ready && p.connected);
  }

  swapRoles(socketId: string): Room | undefined {
    const found = this.getPlayer(socketId);
    if (!found || found.room.phase !== "lobby") return undefined;
    const { room } = found;
    if (room.hostId !== socketId) return undefined;
    for (const p of room.players) {
      p.role = p.role === "walker" ? "watcher" : "walker";
      p.ready = false;
      p.sessionToken = `${room.code}-${p.role}`;
    }
    return room;
  }

  markStarted(room: Room): void {
    room.phase = "intro";
  }

  markPlaying(room: Room): void {
    room.phase = "playing";
  }

  markEnded(room: Room): void {
    room.phase = "ended";
  }

  disconnect(socketId: string): { room: Room; role: Role } | undefined {
    const found = this.getPlayer(socketId);
    if (!found) return undefined;
    const { room, player } = found;
    player.connected = false;
    this.socketToRoom.delete(socketId);
    if (room.phase === "lobby") {
      room.players = room.players.filter((p) => p.socketId !== socketId);
      for (const p of room.players) p.ready = false;
      if (room.players.length === 0) {
        this.rooms.delete(room.code);
      } else if (room.hostId === socketId) {
        room.hostId = room.players[0]!.socketId;
        room.players[0]!.role = "walker";
      }
      return { room, role: player.role };
    }
    room.disconnectedAt = Date.now();
    return { room, role: player.role };
  }

  reconnect(socketId: string, code: string, role: Role): Room | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    const player = room.players.find((p) => p.role === role);
    if (!player || player.connected) return undefined;
    player.socketId = socketId;
    player.connected = true;
    room.disconnectedAt = null;
    this.socketToRoom.set(socketId, room.code);
    return room;
  }

  leave(socketId: string): Room | undefined {
    const result = this.disconnect(socketId);
    if (!result) return undefined;
    if (result.room.phase !== "lobby" && result.room.players.every((p) => !p.connected)) {
      this.rooms.delete(result.room.code);
    }
    return result.room;
  }

  toPublic(room: Room): RoomPublic {
    return {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      players: room.players.map((p, i) => ({
        id: p.socketId,
        role: p.role,
        ready: p.ready,
        connected: p.connected,
        name: i === 0 || p.role === "walker" ? "PLAYER 1" : "PLAYER 2",
      })),
    };
  }

  /** Exposed for tests. */
  clear(): void {
    this.rooms.clear();
    this.socketToRoom.clear();
  }
}
