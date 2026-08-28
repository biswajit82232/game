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

  it("marks a disconnected in-game player as not connected", () => {
    const room = rooms.createRoom("socket-a");
    rooms.joinRoom("socket-b", room.code);
    rooms.markStarted(room);
    const result = rooms.disconnect("socket-b");
    expect(result?.role).toBe("watcher");
    expect(rooms.getRoom(room.code)?.players.find((p) => p.role === "watcher")?.connected).toBe(false);
  });
});
