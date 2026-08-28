import { describe, expect, it, beforeEach } from "vitest";
import { RoomManager } from "../server/rooms/RoomManager";

describe("RoomManager", () => {
  let rooms: RoomManager;

  beforeEach(() => {
    rooms = new RoomManager();
  });

  it("creates a 5-character room code", () => {
    const room = rooms.createRoom("socket-a");
    expect(room.code).toHaveLength(5);
    expect(room.players).toHaveLength(1);
    expect(room.players[0]?.role).toBe("walker");
    expect(room.phase).toBe("lobby");
  });

  it("joins a valid room as watcher", () => {
    const room = rooms.createRoom("socket-a");
    const result = rooms.joinRoom("socket-b", room.code.toLowerCase());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.room.players).toHaveLength(2);
      expect(result.room.players[1]?.role).toBe("watcher");
    }
  });

  it("rejects an unknown room", () => {
    const result = rooms.joinRoom("socket-b", "ZZZZZ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("not_found");
  });

  it("rejects a full room", () => {
    const room = rooms.createRoom("socket-a");
    rooms.joinRoom("socket-b", room.code);
    const result = rooms.joinRoom("socket-c", room.code);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("full");
  });

  it("ready state requires both players", () => {
    const room = rooms.createRoom("socket-a");
    rooms.joinRoom("socket-b", room.code);
    rooms.setReady("socket-a");
    expect(rooms.bothReady(rooms.getRoom(room.code)!)).toBe(false);
    rooms.setReady("socket-b");
    expect(rooms.bothReady(rooms.getRoom(room.code)!)).toBe(true);
  });

  it("assigns swapped roles and clears ready", () => {
    const room = rooms.createRoom("socket-a");
    rooms.joinRoom("socket-b", room.code);
    rooms.setReady("socket-a");
    const swapped = rooms.swapRoles("socket-a");
    expect(swapped?.players[0]?.role).toBe("watcher");
    expect(swapped?.players[1]?.role).toBe("walker");
    expect(swapped?.players.every((p) => !p.ready)).toBe(true);
  });

  it("handles disconnect in lobby", () => {
    const room = rooms.createRoom("socket-a");
    rooms.joinRoom("socket-b", room.code);
    rooms.disconnect("socket-b");
    const after = rooms.getRoom(room.code);
    expect(after?.players).toHaveLength(1);
  });

  it("creates a solo room with an AI watcher and is ready to start", () => {
    const room = rooms.createSolo("socket-a");
    expect(room.solo).toBe(true);
    expect(room.players).toHaveLength(2);
    expect(room.players[1]?.isBot).toBe(true);
    expect(rooms.bothReady(room)).toBe(true);
    const join = rooms.joinRoom("socket-b", room.code);
    expect(join.ok).toBe(false);
  });

  it("marks a disconnected in-game player as not connected", () => {
    const room = rooms.createRoom("socket-a");
    rooms.joinRoom("socket-b", room.code);
    rooms.markStarted(room);
    const result = rooms.disconnect("socket-b");
    expect(result?.role).toBe("watcher");
    expect(rooms.getRoom(room.code)?.players.find((p) => p.role === "watcher")?.connected).toBe(false);
  });

  it("keeps a solo match after disconnect so the walker can rejoin", () => {
    const room = rooms.createSolo("socket-a");
    rooms.markStarted(room);
    rooms.disconnect("socket-a");
    expect(rooms.getRoom(room.code)).toBeDefined();
    const again = rooms.reconnect("socket-new", room.code, "walker");
    expect(again?.players.find((p) => p.role === "walker")?.socketId).toBe("socket-new");
  });

  it("reconnects a disconnected in-game player by role", () => {
    const room = rooms.createRoom("socket-a");
    rooms.joinRoom("socket-b", room.code);
    rooms.markStarted(room);
    rooms.disconnect("socket-b");
    const again = rooms.reconnect("socket-c", room.code, "watcher");
    expect(again?.players.find((p) => p.role === "watcher")?.socketId).toBe("socket-c");
    expect(again?.players.find((p) => p.role === "watcher")?.connected).toBe(true);
  });

  it("does not swap roles in a solo lobby", () => {
    const room = rooms.createSolo("socket-a");
    expect(rooms.swapRoles("socket-a")).toBeUndefined();
    expect(room.players[0]?.role).toBe("walker");
  });

  it("rejects an empty join code", () => {
    const result = rooms.joinRoom("socket-b", "   ");
    expect(result.ok).toBe(false);
  });

  it("prunes matches after every human has been gone long enough", () => {
    const room = rooms.createRoom("socket-a");
    rooms.joinRoom("socket-b", room.code);
    rooms.markStarted(room);
    rooms.disconnect("socket-a");
    rooms.disconnect("socket-b");
    room.disconnectedAt = Date.now() - 120_000;
    expect(rooms.pruneStale(90_000)).toContain(room.code);
    expect(rooms.getRoom(room.code)).toBeUndefined();
  });
});
