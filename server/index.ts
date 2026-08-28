import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { ClientToServerEvents, ServerToClientEvents } from "../shared/events";
import { SERVER_PORT, TICK_DT, TICK_RATE } from "../shared/constants";
import { RoomManager } from "./rooms/RoomManager";
import { GameSession } from "./gameState/GameSession";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

const rooms = new RoomManager();
const sessions = new Map<string, GameSession>();
const loops = new Map<string, NodeJS.Timeout>();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const serveClient = process.argv.includes("--serve-client") || process.env.NODE_ENV === "production";
const dist = join(__dirname, "..", "dist");
if (serveClient && existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => {
    res.sendFile(join(dist, "index.html"));
  });
}

function emitRoom(code: string): void {
  const room = rooms.getRoom(code);
  if (!room) return;
  const pub = rooms.toPublic(room);
  for (const p of room.players) {
    if (p.connected) io.to(p.socketId).emit("room:updated", pub);
  }
}

function stopLoop(code: string): void {
  const t = loops.get(code);
  if (t) clearInterval(t);
  loops.delete(code);
  sessions.delete(code);
}

function startGame(code: string): void {
  const room = rooms.getRoom(code);
  if (!room || room.phase !== "lobby" || sessions.has(code)) return;
  rooms.markStarted(room);
  const session = new GameSession();
  sessions.set(code, session);
  for (const p of room.players) {
    io.to(p.socketId).emit("game:started", { role: p.role });
  }
  emitRoom(code);

  const interval = setInterval(() => {
    const r = rooms.getRoom(code);
    const s = sessions.get(code);
    if (!r || !s) {
      stopLoop(code);
      return;
    }
    if (s.ended) {
      for (const p of r.players) {
        if (p.connected) io.to(p.socketId).emit("game:ended", s.ended);
      }
      rooms.markEnded(r);
      stopLoop(code);
      emitRoom(code);
      return;
    }
    s.tick(TICK_DT);
    const events = s.drainEvents();
    for (const p of r.players) {
      if (!p.connected) continue;
      io.to(p.socketId).emit("game:snapshot", s.snapshotFor(p.role));
      for (const ev of events) {
        if (ev.to === "both" || ev.to === p.role) {
          io.to(p.socketId).emit("game:event", {
            type: ev.type,
            message: ev.message,
            intensity: ev.intensity,
          });
        }
      }
    }
  }, 1000 / TICK_RATE);
  loops.set(code, interval);
}

io.on("connection", (socket) => {
  socket.on("room:create", () => {
    const existing = rooms.getRoomBySocket(socket.id);
    if (existing) {
      socket.emit("room:updated", rooms.toPublic(existing));
      return;
    }
    const room = rooms.createRoom(socket.id);
    socket.join(room.code);
    socket.emit("room:updated", rooms.toPublic(room));
  });

  socket.on("room:join", ({ code }) => {
    const result = rooms.joinRoom(socket.id, code);
    if (result.ok) {
      socket.join(result.room.code);
      emitRoom(result.room.code);
      return;
    }
    if (result.error === "started") {
      const room = rooms.getRoom(code);
      const slot = room?.players.find((p) => !p.connected);
      if (room && slot) {
        const re = rooms.reconnect(socket.id, room.code, slot.role);
        if (re) {
          socket.join(re.code);
          socket.emit("player:reconnected", { role: slot.role });
          socket.emit("game:started", { role: slot.role });
          emitRoom(re.code);
          const session = sessions.get(re.code);
          if (session) socket.emit("game:snapshot", session.snapshotFor(slot.role));
          return;
        }
      }
      socket.emit("room:error", { message: "Game already started." });
      return;
    }
    const messages: Record<string, string> = {
      not_found: "Room not found.",
      full: "Room is full.",
      duplicate: "Already in this room.",
      started: "Game already started.",
    };
    socket.emit("room:error", { message: messages[result.error] ?? "Could not join room." });
  });

  socket.on("room:ready", () => {
    const room = rooms.setReady(socket.id);
    if (!room) {
      socket.emit("room:error", { message: "Cannot ready now." });
      return;
    }
    emitRoom(room.code);
    if (rooms.bothReady(room) && room.phase === "lobby") {
      startGame(room.code);
    }
  });

  socket.on("room:swapRoles", () => {
    const room = rooms.swapRoles(socket.id);
    if (!room) {
      socket.emit("room:error", { message: "Only the host can swap roles before the game starts." });
      return;
    }
    emitRoom(room.code);
  });

  socket.on("room:leave", () => {
    const found = rooms.getPlayer(socket.id);
    const room = rooms.leave(socket.id);
    if (found && found.room.phase !== "lobby") {
      stopLoop(found.room.code);
    }
    if (room && rooms.getRoom(room.code)) emitRoom(room.code);
  });

  socket.on("player:introDone", () => {
    const found = rooms.getPlayer(socket.id);
    const session = found ? sessions.get(found.room.code) : undefined;
    if (!found || !session) return;
    session.markIntroDone(found.player.role);
    if (session.bothIntroDone()) rooms.markPlaying(found.room);
  });

  socket.on("player:move", (payload) => {
    const found = rooms.getPlayer(socket.id);
    const session = found ? sessions.get(found.room.code) : undefined;
    if (!found || !session) return;
    session.applyMove(found.player.role, payload);
  });

  socket.on("player:interact", ({ targetId }) => {
    const found = rooms.getPlayer(socket.id);
    const session = found ? sessions.get(found.room.code) : undefined;
    if (!found || !session) return;
    session.interact(found.player.role, targetId);
  });

  socket.on("player:flashlight", ({ on }) => {
    const found = rooms.getPlayer(socket.id);
    const session = found ? sessions.get(found.room.code) : undefined;
    if (!found || !session) return;
    if (found.player.role !== "walker") return;
    session.setFlashlight(on);
  });

  socket.on("player:switchMode", ({ mode }) => {
    const found = rooms.getPlayer(socket.id);
    const session = found ? sessions.get(found.room.code) : undefined;
    if (!found || !session) return;
    if (found.player.role !== "watcher") return;
    session.switchMode(mode);
  });

  socket.on("player:chat", ({ text }) => {
    const found = rooms.getPlayer(socket.id);
    if (!found) return;
    const clean = text.slice(0, 160).trim();
    if (!clean) return;
    for (const p of found.room.players) {
      if (p.connected) {
        io.to(p.socketId).emit("game:chat", { from: found.player.role, text: clean });
      }
    }
  });

  socket.on("player:warning", () => {
    const found = rooms.getPlayer(socket.id);
    const session = found ? sessions.get(found.room.code) : undefined;
    if (!found || !session || found.player.role !== "watcher") return;
    session.warn();
    for (const p of found.room.players) {
      if (p.connected) {
        io.to(p.socketId).emit("game:chat", { from: "watcher", text: "DO NOT TURN AROUND." });
      }
    }
  });

  socket.on("player:puzzleInput", ({ puzzleId, value }) => {
    const found = rooms.getPlayer(socket.id);
    const session = found ? sessions.get(found.room.code) : undefined;
    if (!found || !session) return;
    session.submitPuzzle(found.player.role, puzzleId, value);
  });

  socket.on("player:holdSignal", ({ holding }) => {
    const found = rooms.getPlayer(socket.id);
    const session = found ? sessions.get(found.room.code) : undefined;
    if (!found || !session || found.player.role !== "watcher") return;
    session.holdSignal(holding);
  });

  socket.on("disconnect", () => {
    const result = rooms.disconnect(socket.id);
    if (!result) return;
    const { room, role } = result;
    if (room.phase === "lobby") {
      if (rooms.getRoom(room.code)) emitRoom(room.code);
      return;
    }
    for (const p of room.players) {
      if (p.connected) {
        io.to(p.socketId).emit("player:disconnected", { role });
      }
    }
  });
});

const port = Number(process.env.PORT) || SERVER_PORT;
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Don't Turn Around server on http://localhost:${port}`);
});

export { rooms, sessions };
