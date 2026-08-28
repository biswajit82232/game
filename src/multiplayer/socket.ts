import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../../shared/events";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 40,
      reconnectionDelay: 400,
      reconnectionDelayMax: 4000,
      timeout: 12000,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function waitUntilConnected(timeoutMs = 15000): Promise<boolean> {
  const s = getSocket();
  if (s.connected) return Promise.resolve(true);
  if (!s.active) s.connect();
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      window.clearTimeout(timer);
      s.off("connect", onOk);
      resolve(ok);
    };
    const onOk = () => done(true);
    const timer = window.setTimeout(() => done(s.connected), timeoutMs);
    s.once("connect", onOk);
  });
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
