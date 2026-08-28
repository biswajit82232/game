import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, GameEndPayload, GameSnapshot, Role, RoomPublic } from "../shared/types";
import { getSocket } from "./multiplayer/socket";
import { getAudio } from "./systems/audio";
import { loadSettings, saveSettings, type GameSettings } from "./systems/settings";
import { MainMenu } from "./components/menu/MainMenu";
import { HowToPlay } from "./components/menu/HowToPlay";
import { SettingsPanel } from "./components/menu/SettingsPanel";
import { JoinRoom } from "./components/lobby/JoinRoom";
import { Lobby } from "./components/lobby/Lobby";
import { RoleIntro } from "./components/lobby/RoleIntro";
import { GameView } from "./components/game/GameView";
import { ResultsScreen } from "./components/hud/ResultsScreen";

type Screen = "menu" | "how" | "settings" | "join" | "lobby" | "intro" | "game" | "results";

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [end, setEnd] = useState<GameEndPayload | null>(null);
  const [disconnected, setDisconnected] = useState<Role | null>(null);
  const [loopTitle, setLoopTitle] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const [settingsFrom, setSettingsFrom] = useState<Screen>("menu");
  const socketId = useRef("");

  const applySettings = (next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
    getAudio(next).applySettings(next);
  };

  const resetPlay = useCallback(() => {
    setSnapshot(null);
    setMessages([]);
    setEnd(null);
    setDisconnected(null);
    setRole(null);
    setRoom(null);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const audio = getAudio();

    const onConnect = () => {
      socketId.current = socket.id ?? "";
      setServerDown(false);
    };
    const onDisconnect = () => setServerDown(true);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", () => setServerDown(true));

    socket.on("room:updated", (next) => {
      setRoom(next);
      setJoinError(null);
      if (next.phase === "lobby") setScreen("lobby");
    });
    socket.on("room:error", ({ message }) => setJoinError(message));
    socket.on("game:started", ({ role: nextRole }) => {
      setRole(nextRole);
      setScreen("intro");
      void audio.resume();
    });
    socket.on("game:snapshot", (snap) => setSnapshot(snap));
    socket.on("game:event", ({ type, message }) => {
      if (type === "fake-message") {
        setMessages((m) => [
          ...m,
          { id: `${Date.now()}-fake`, from: "system", text: message || "RUN.", at: Date.now(), fake: true },
        ]);
      }
    });
    socket.on("game:chat", ({ from, text, fake }) => {
      setMessages((m) => [...m, { id: `${Date.now()}-${Math.random()}`, from, text, at: Date.now(), fake }]);
    });
    socket.on("game:ended", (payload) => {
      setEnd(payload);
      setScreen("results");
      if (payload.ending === "loop") {
        setLoopTitle(true);
        window.setTimeout(() => setLoopTitle(false), 4000);
      }
    });
    socket.on("player:disconnected", ({ role: r }) => setDisconnected(r));
    socket.on("player:reconnected", () => setDisconnected(null));

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:updated");
      socket.off("room:error");
      socket.off("game:started");
      socket.off("game:snapshot");
      socket.off("game:event");
      socket.off("game:chat");
      socket.off("game:ended");
      socket.off("player:disconnected");
      socket.off("player:reconnected");
    };
  }, []);

  const leave = () => {
    getSocket().emit("room:leave");
    resetPlay();
    setScreen("menu");
  };

  if (serverDown && screen !== "menu" && screen !== "settings" && screen !== "how") {
    return (
      <div className="screen menu-overlay">
        <div className="panel">
          <h2>CONNECTION LOST</h2>
          <p className="muted">The server is unavailable. Start it with npm run dev and try again.</p>
          <button className="hbtn" onClick={() => setScreen("menu")}>
            BACK
          </button>
        </div>
      </div>
    );
  }

  if (screen === "menu") {
    return (
      <MainMenu
        loopTitle={loopTitle}
        onCreate={() => {
          void getAudio(settings).resume();
          getSocket().emit("room:create");
          setScreen("lobby");
        }}
        onJoin={() => {
          setJoinError(null);
          setScreen("join");
        }}
        onHow={() => setScreen("how")}
        onSettings={() => {
          setSettingsFrom("menu");
          setScreen("settings");
        }}
      />
    );
  }
  if (screen === "how") return <HowToPlay onBack={() => setScreen("menu")} />;
  if (screen === "settings") {
    return (
      <SettingsPanel
        settings={settings}
        onChange={applySettings}
        onBack={() => setScreen(settingsFrom)}
      />
    );
  }
  if (screen === "join") {
    return (
      <JoinRoom
        error={joinError}
        onBack={() => setScreen("menu")}
        onJoin={(code) => {
          void getAudio(settings).resume();
          getSocket().emit("room:join", { code });
        }}
      />
    );
  }
  if (screen === "lobby" && room) {
    return (
      <Lobby
        room={room}
        selfId={getSocket().id ?? socketId.current}
        onReady={() => getSocket().emit("room:ready")}
        onSwap={() => getSocket().emit("room:swapRoles")}
        onLeave={leave}
      />
    );
  }
  if (screen === "intro" && role) {
    return (
      <RoleIntro
        role={role}
        onContinue={() => {
          getSocket().emit("player:introDone");
          setScreen("game");
        }}
      />
    );
  }
  if (screen === "game" && role) {
    return (
      <GameView
        role={role}
        settings={settings}
        snapshot={snapshot}
        messages={messages}
        disconnected={disconnected}
        onLobby={leave}
        onSettingsChange={applySettings}
      />
    );
  }
  if (screen === "results" && end) {
    return (
      <ResultsScreen
        end={end}
        onAgain={leave}
        onLobby={leave}
      />
    );
  }
  if (screen === "lobby") {
    return (
      <div className="screen menu-overlay">
        <div className="panel">
          <p className="muted">Opening room…</p>
        </div>
      </div>
    );
  }
  return <MainMenu loopTitle={loopTitle} onCreate={() => getSocket().emit("room:create")} onJoin={() => setScreen("join")} onHow={() => setScreen("how")} onSettings={() => setScreen("settings")} />;
}
