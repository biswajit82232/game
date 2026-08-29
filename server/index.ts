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
  app.get("*", (req, res, next) => {
    if (req.path === "/health" || req.path.startsWith("/socket.io")) {
      next();
      return;
    }
    res.sendFile(join(dist, "index.html"));
  });
}

function emitRoom(code: string): void {
  const room = rooms.getRoom(code);
  if (!room) return;
  const pub = rooms.toPublic(room);
  for (const p of room.players) {
    if (p.connected && !p.isBot) io.to(p.socketId).emit("room:updated", pub);
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
  const session = new GameSession(room.solo);
  sessions.set(code, session);
  if (room.solo) session.markIntroDone("watcher");
  for (const p of room.players) {
    if (p.isBot) continue;
    io.to(p.socketId).emit("game:started", { role: p.role });
    io.to(p.socketId).emit("game:snapshot", session.snapshotFor(p.role));
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
        if (p.connected && !p.isBot) io.to(p.socketId).emit("game:ended", s.ended);
      }
      rooms.markEnded(r);
      stopLoop(code);
      emitRoom(code);
      return;
    }
    const humans = r.players.filter((p) => !p.isBot);
    const humansOnline = humans.some((p) => p.connected);
    if (!humansOnline) return;
    // Pause while a partner is reconnecting so WAIT actually freezes the match.
    if (humans.length > 1 && humans.some((p) => !p.connected)) {
      for (const p of r.players) {
        if (!p.connected || p.isBot) continue;
        io.to(p.socketId).emit("game:snapshot", s.snapshotFor(p.role));
      }
      return;
    }
    if (!s.bothIntroDone()) {
      for (const p of r.players) {
        if (!p.connected || p.isBot) continue;
        io.to(p.socketId).emit("game:snapshot", s.snapshotFor(p.role));
      }
      return;
    }
    s.tick(TICK_DT);
    const events = s.drainEvents();
    const chats = s.drainChats();
    for (const p of r.players) {
      if (!p.connected || p.isBot) continue;
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
      for (const c of chats) {
        io.to(p.socketId).emit("game:chat", c);
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

  socket.on("room:solo", () => {
    const existing = rooms.getRoomBySocket(socket.id);
    const previous = existing?.code;
    if (existing) rooms.leave(socket.id);
    if (previous && !rooms.getRoom(previous)) stopLoop(previous);
    const room = rooms.createSolo(socket.id);
    socket.join(room.code);
    startGame(room.code);
  });

  socket.on("room:join", (payload) => {
    const code = typeof payload?.code === "string" ? payload.code : "";
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

  socket.on("room:rejoin", (payload) => {
    const code = typeof payload?.code === "string" ? payload.code : "";
    const role = payload?.role === "watcher" ? "watcher" : payload?.role === "walker" ? "walker" : null;
    if (!code || !role) {
      socket.emit("room:error", { message: "Could not rejoin." });
      return;
    }
    const re = rooms.reconnect(socket.id, code, role);
    if (!re) {
      socket.emit("room:error", { message: "Match no longer available." });
      return;
    }
    socket.join(re.code);
    socket.emit("player:reconnected", { role });
    emitRoom(re.code);
    const session = sessions.get(re.code);
    if (session) {
      socket.emit("game:started", { role });
      socket.emit("game:snapshot", session.snapshotFor(role));
    }
  });

  socket.on("room:leave", () => {
    const found = rooms.getPlayer(socket.id);
    const code = found?.room.code;
    const phase = found?.room.phase;
    const role = found?.player.role;
    rooms.leave(socket.id);
    if (!code) return;
    if (!rooms.getRoom(code)) {
      if (phase !== "lobby") stopLoop(code);
      return;
    }
    if (phase !== "lobby" && role) {
      for (const p of rooms.getRoom(code)!.players) {
        if (p.connected && !p.isBot) io.to(p.socketId).emit("player:disconnected", { role });
      }
    }
    emitRoom(code);
  });

  socket.on("player:introDone", () => {
    const found = rooms.getPlayer(socket.id);
    const session = found ? sessions.get(found.room.code) : undefined;
    if (!found || !session) return;
    session.markIntroDone(found.player.role);
    if (session.bothIntroDone()) rooms.markPlaying(found.room);
  });

  function partnersConnected(room: NonNullable<ReturnType<RoomManager["getRoom"]>>): boolean {
    const humans = room.players.filter((p) => !p.isBot);
    return humans.length > 0 && humans.every((p) => p.connected);
  }

  function gameplayReady(socketId: string): { session: GameSession; role: "walker" | "watcher" } | null {
    const found = rooms.getPlayer(socketId);
    const session = found ? sessions.get(found.room.code) : undefined;
    if (!found || !session || found.room.phase === "lobby") return null;
    if (!session.bothIntroDone()) return null;
    // Freeze inputs while a co-op partner is reconnecting (tick already pauses).
    if (!partnersConnected(found.room)) return null;
    return { session, role: found.player.role };
  }

  socket.on("player:move", (payload) => {
    const live = gameplayReady(socket.id);
    if (!live || !payload) return;
    live.session.applyMove(live.role, payload);
  });

  socket.on("player:interact", ({ targetId }) => {
    const live = gameplayReady(socket.id);
    if (!live) return;
    live.session.interact(live.role, targetId);
  });

  socket.on("player:flashlight", ({ on }) => {
    const live = gameplayReady(socket.id);
    if (!live || live.role !== "walker") return;
    live.session.setFlashlight(on);
  });

  socket.on("player:switchMode", ({ mode }) => {
    const live = gameplayReady(socket.id);
    if (!live || live.role !== "watcher") return;
    live.session.switchMode(mode);
  });

  socket.on("player:chat", ({ text }) => {
    const found = rooms.getPlayer(socket.id);
    if (!found) return;
    const clean = String(text ?? "")
      .slice(0, 160)
      .trim();
    if (!clean) return;
    for (const p of found.room.players) {
      if (p.connected && !p.isBot) {
        io.to(p.socketId).emit("game:chat", { from: found.player.role, text: clean });
      }
    }
  });

  socket.on("player:warning", () => {
    const live = gameplayReady(socket.id);
    if (!live || live.role !== "watcher") return;
    live.session.warn();
  });

  socket.on("player:puzzleInput", (payload) => {
    const live = gameplayReady(socket.id);
    if (!live || !payload?.puzzleId || !Array.isArray(payload.value)) return;
    live.session.submitPuzzle(live.role, payload.puzzleId, payload.value.map(String));
  });

  socket.on("player:holdSignal", ({ holding }) => {
    const live = gameplayReady(socket.id);
    if (!live) return;
    if (live.role === "watcher") {
      live.session.holdSignal(holding);
      return;
    }
    if (live.session.solo && live.role === "walker") {
      live.session.tuneSignal(holding);
    }
  });

  socket.on("player:waitReconnect", () => {
    // Match already pauses while any human is disconnected (see game loop).
  });

  socket.on("disconnect", () => {
    const result = rooms.disconnect(socket.id);
    if (!result) return;
    const { room, role } = result;
    if (room.phase === "lobby") {
      if (rooms.getRoom(room.code)) emitRoom(room.code);
      return;
    }
    const session = sessions.get(room.code);
    if (session) {
      session.holdSignal(false);
      session.tuneSignal(false);
    }
    for (const p of room.players) {
      if (p.connected && !p.isBot) {
        io.to(p.socketId).emit("player:disconnected", { role });
      }
    }
  });
});

const port = Number(process.env.PORT) || SERVER_PORT;
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Don't Turn Around server on http://localhost:${port}`);
});

setInterval(() => {
  for (const code of rooms.pruneStale()) stopLoop(code);
}, 10_000);

export { rooms, sessions };
