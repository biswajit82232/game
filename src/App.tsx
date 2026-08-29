import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, GameEndPayload, GameSnapshot, Role, RoomPublic } from "../shared/types";
import { getSocket, waitUntilConnected } from "./multiplayer/socket";
import { getAudio } from "./systems/audio";
import { loadSettings, saveSettings, type GameSettings } from "./systems/settings";
import { MainMenu } from "./components/menu/MainMenu";
import { FriendMenu } from "./components/menu/FriendMenu";
import { HowToPlay } from "./components/menu/HowToPlay";
import { SettingsPanel } from "./components/menu/SettingsPanel";
import { JoinRoom } from "./components/lobby/JoinRoom";
import { Lobby } from "./components/lobby/Lobby";
import { RoleIntro } from "./components/lobby/RoleIntro";
import { GameView } from "./components/game/GameView";
import { ResultsScreen } from "./components/hud/ResultsScreen";

type Screen = "menu" | "friend" | "how" | "settings" | "join" | "lobby" | "intro" | "game" | "results";

const PLAY_KEY = "dta-last-play";

type LastPlay = { code: string; role: Role | null };

function readLastPlay(): LastPlay | null {
  try {
    const raw = sessionStorage.getItem(PLAY_KEY);
    return raw ? (JSON.parse(raw) as LastPlay) : null;
  } catch {
    return null;
  }
}

function writeLastPlay(play: LastPlay | null): void {
  if (!play?.code) sessionStorage.removeItem(PLAY_KEY);
  else sessionStorage.setItem(PLAY_KEY, JSON.stringify(play));
}

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
  const [reconnecting, setReconnecting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [settingsFrom, setSettingsFrom] = useState<Screen>("menu");
  const [lastSolo, setLastSolo] = useState(false);
  const socketId = useRef("");
  const screenRef = useRef<Screen>(screen);
  const playRef = useRef<LastPlay>(readLastPlay() ?? { code: "", role: null });
  const endTimerRef = useRef(0);
  screenRef.current = screen;

  const applySettings = (next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
    getAudio(next).applySettings(next);
  };

  const rememberPlay = (partial: Partial<LastPlay>) => {
    playRef.current = { ...playRef.current, ...partial };
    writeLastPlay(playRef.current.code ? playRef.current : null);
  };

  const resetPlay = useCallback(() => {
    setSnapshot(null);
    setMessages([]);
    setEnd(null);
    setDisconnected(null);
    setRole(null);
    setRoom(null);
    setReconnecting(false);
    setStarting(false);
    setMenuError(null);
    playRef.current = { code: "", role: null };
    writeLastPlay(null);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const audio = getAudio();

    const tryRejoin = () => {
      const play = playRef.current;
      const current = screenRef.current;
      if (!play.code || !play.role) return;
      if (current === "menu" || current === "game" || current === "intro") {
        socket.emit("room:rejoin", { code: play.code, role: play.role });
      } else if (current === "lobby") {
        socket.emit("room:join", { code: play.code });
      }
    };

    const onConnect = () => {
      socketId.current = socket.id ?? "";
      setReconnecting(false);
      tryRejoin();
    };
    const onDisconnect = () => {
      const current = screenRef.current;
      if (current === "game" || current === "intro" || current === "lobby") {
        setReconnecting(true);
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", () => {
      if (screenRef.current === "game" || screenRef.current === "intro" || screenRef.current === "lobby") {
        setReconnecting(true);
      }
    });

    socket.on("room:updated", (next) => {
      setRoom(next);
      setJoinError(null);
      setLastSolo(Boolean(next.solo));
      rememberPlay({ code: next.code });
      if (next.phase === "lobby") setScreen("lobby");
    });
    socket.on("room:error", ({ message }) => {
      if (
        screenRef.current === "menu" &&
        (message.includes("Match no longer") || message.includes("Could not rejoin"))
      ) {
        playRef.current = { code: "", role: null };
        writeLastPlay(null);
        return;
      }
      setJoinError(message);
      setStarting(false);
      if (screenRef.current === "menu") setMenuError(message);
      if (screenRef.current === "game" || screenRef.current === "intro") {
        setReconnecting(false);
      }
    });
    socket.on("game:started", ({ role: nextRole }) => {
      setRole(nextRole);
      setStarting(false);
      setMenuError(null);
      rememberPlay({ role: nextRole });
      setScreen((s) => (s === "game" || s === "results" ? s : "intro"));
      void audio.resume();
    });
    socket.on("game:snapshot", (snap) => {
      setSnapshot(snap);
      if (snap.solo) setLastSolo(true);
    });
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
      playRef.current = { code: "", role: null };
      writeLastPlay(null);
      window.clearTimeout(endTimerRef.current);
      if (payload.title.includes("FOUND YOU")) {
        endTimerRef.current = window.setTimeout(() => setScreen("results"), 2500);
      } else {
        setScreen("results");
      }
      if (payload.ending === "loop") {
        setLoopTitle(true);
        window.setTimeout(() => setLoopTitle(false), 4000);
      }
    });
    socket.on("player:disconnected", ({ role: r }) => setDisconnected(r));
    socket.on("player:reconnected", () => {
      setDisconnected(null);
      setReconnecting(false);
    });

    if (socket.connected) onConnect();

    return () => {
      window.clearTimeout(endTimerRef.current);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error");
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
    window.clearTimeout(endTimerRef.current);
    getSocket().emit("room:leave");
    resetPlay();
    setScreen("menu");
  };

  const playAgain = () => {
    window.clearTimeout(endTimerRef.current);
    getSocket().emit("room:leave");
    resetPlay();
    if (lastSolo) {
      setScreen("menu");
      setStarting(true);
      setMenuError(null);
      void getAudio(settings).resume();
      void waitUntilConnected(18000).then((ok) => {
        if (!ok) {
          setStarting(false);
          setMenuError("Could not reach the server. Wait a few seconds and try again.");
          return;
        }
        getSocket().emit("room:solo");
        window.setTimeout(() => {
          if (screenRef.current === "menu") {
            setStarting(false);
            setMenuError("The match did not start. Try PLAY SOLO again.");
          }
        }, 12000);
      });
      return;
    }
    setScreen("menu");
  };

  const reconnectBanner = reconnecting ? (
    <div className="reconnect-banner">CONNECTION LOST — RECONNECTING</div>
  ) : null;

  if (screen === "menu") {
    return (
      <MainMenu
        loopTitle={loopTitle}
        busy={starting}
        error={menuError}
        onSolo={() => {
          void (async () => {
            setMenuError(null);
            setStarting(true);
            void getAudio(settings).resume();
            const ok = await waitUntilConnected(18000);
            if (!ok) {
              setStarting(false);
              setMenuError("Could not reach the server. Wait a few seconds and try again.");
              return;
            }
            getSocket().emit("room:solo");
            window.setTimeout(() => {
              if (screenRef.current === "menu") {
                setStarting(false);
                setMenuError("The match did not start. Try PLAY SOLO again.");
              }
            }, 12000);
          })();
        }}
        onFriend={() => {
          setMenuError(null);
          setScreen("friend");
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
  if (screen === "friend") {
    return (
      <FriendMenu
        busy={starting}
        onBack={() => setScreen("menu")}
        onJoin={() => {
          setJoinError(null);
          setScreen("join");
        }}
        onCreate={() => {
          void (async () => {
            setMenuError(null);
            setStarting(true);
            void getAudio(settings).resume();
            const ok = await waitUntilConnected(18000);
            if (!ok) {
              setStarting(false);
              setMenuError("Could not reach the server. Wait a few seconds and try again.");
              setScreen("menu");
              return;
            }
            setStarting(false);
            getSocket().emit("room:create");
            setScreen("lobby");
          })();
        }}
      />
    );
  }
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
        onBack={() => setScreen("friend")}
        onJoin={(code) => {
          if (!code.trim()) {
            setJoinError("Enter a room code.");
            return;
          }
          void getAudio(settings).resume();
          getSocket().emit("room:join", { code });
        }}
      />
    );
  }
  if (screen === "lobby" && room) {
    return (
      <>
        {reconnectBanner}
        <Lobby
          room={room}
          selfId={getSocket().id ?? socketId.current}
          onReady={() => getSocket().emit("room:ready")}
          onSwap={() => getSocket().emit("room:swapRoles")}
          onLeave={leave}
        />
      </>
    );
  }
  if (screen === "intro" && role) {
    return (
      <>
        {reconnectBanner}
        <RoleIntro
          role={role}
          solo={Boolean(snapshot?.solo || room?.solo)}
          onContinue={() => {
            getSocket().emit("player:introDone");
            setScreen("game");
          }}
        />
      </>
    );
  }
  if (screen === "game" && role) {
    return (
      <>
        {reconnectBanner}
        <GameView
          role={role}
          settings={settings}
          snapshot={snapshot}
          messages={messages}
          disconnected={snapshot?.solo ? null : disconnected}
          onLobby={leave}
          onSettingsChange={applySettings}
        />
      </>
    );
  }
  if (screen === "results" && end) {
    return (
      <ResultsScreen
        end={end}
        onAgain={playAgain}
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
  return (
    <MainMenu
      loopTitle={loopTitle}
      busy={starting}
      error={menuError}
      onSolo={() => getSocket().emit("room:solo")}
      onFriend={() => setScreen("friend")}
      onHow={() => setScreen("how")}
      onSettings={() => setScreen("settings")}
    />
  );
}
