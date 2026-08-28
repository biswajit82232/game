import { useEffect, useRef, useState } from "react";
import type { ChatMessage, GameSnapshot, Role, WatcherMode } from "../../../shared/types";
import type { GameSettings } from "../../systems/settings";
import { GameEngine } from "../../game/GameEngine";
import { getSocket } from "../../multiplayer/socket";
import { getAudio } from "../../systems/audio";
import { isTouchPreferred } from "../../utils/touch";
import { WalkerHUD } from "../hud/WalkerHUD";
import { WatcherHUD } from "../hud/WatcherHUD";
import { Chat } from "../hud/Chat";
import { PauseMenu } from "../hud/PauseMenu";
import { DisconnectOverlay } from "../hud/DisconnectOverlay";
import { KeypadModal } from "../hud/KeypadModal";
import { SettingsPanel } from "../menu/SettingsPanel";
import { TouchControls } from "../hud/TouchControls";

export function GameView({
  role,
  settings,
  snapshot,
  messages,
  disconnected,
  onLobby,
  onSettingsChange,
}: {
  role: Role;
  settings: GameSettings;
  snapshot: GameSnapshot | null;
  messages: ChatMessage[];
  disconnected: Role | null;
  onLobby: () => void;
  onSettingsChange: (next: GameSettings) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [fx, setFx] = useState({ grain: 0, shake: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [touch, setTouch] = useState(() => isTouchPreferred());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const socket = getSocket();
    const engine = new GameEngine(canvas, role, settings, {
      onPrompt: setPrompt,
      onInteract: (id) => {
        if (id === "keypad-security") setKeypad(true);
      },
      sendMove: (payload) => socket.emit("player:move", payload),
      sendFlashlight: (on) => socket.emit("player:flashlight", { on }),
      sendInteract: (id) => socket.emit("player:interact", { targetId: id }),
    });
    engineRef.current = engine;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        setPaused((p) => !p);
        document.exitPointerLock();
      }
      if (role === "watcher") {
        if (e.code === "Digit1") socket.emit("player:switchMode", { mode: "normal" });
        if (e.code === "Digit2") socket.emit("player:switchMode", { mode: "spirit" });
        if (e.code === "Digit3") socket.emit("player:switchMode", { mode: "echo" });
        if (e.code === "Digit4") socket.emit("player:switchMode", { mode: "danger" });
        if (e.code === "KeyQ") socket.emit("player:warning");
      }
    };
    const onEvent = ({ type }: { type: string }) => {
      applyGameEvent(type, engine);
      if (type === "watcher-distort" || type === "silhouette-flash") {
        setFx({ grain: 1, shake: 1 });
        window.setTimeout(() => setFx({ grain: 0, shake: 0 }), 1200);
      }
    };
    socket.on("game:event", onEvent);
    window.addEventListener("keydown", onKey);
    const onResize = () => {
      const next = isTouchPreferred();
      setTouch(next);
      engine.controller.touchMode = next;
    };
    window.addEventListener("resize", onResize);
    return () => {
      socket.off("game:event", onEvent);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      engine.dispose();
      engineRef.current = null;
    };
  }, [role]);

  useEffect(() => {
    if (snapshot) engineRef.current?.applySnapshot(snapshot);
    if (snapshot?.overlay) setNote(snapshot.overlay);
  }, [snapshot]);

  useEffect(() => {
    engineRef.current?.setSettings(settings);
  }, [settings]);

  const socket = getSocket();

  return (
    <div className={`game-wrap${touch ? " is-touch" : ""}`}>
      <canvas ref={canvasRef} />
      {settings.grain && !settings.reduceMotion && (
        <div className="grain" style={{ opacity: 0.06 + fx.grain * 0.1 }} />
      )}
      <div className="vignette" />
      {role === "watcher" && <div className="watcher-fx" />}
      {!snapshot && (
        <div className="prompt">LOADING THE BUILDING…</div>
      )}
      {snapshot && role === "walker" && (
        <WalkerHUD snap={snapshot} prompt={prompt} otherAlive={!disconnected} />
      )}
      {snapshot && role === "watcher" && (
        <WatcherHUD
          snap={snapshot}
          onMode={(mode: WatcherMode) => socket.emit("player:switchMode", { mode })}
          onWarn={() => socket.emit("player:warning")}
          onHold={(holding) => socket.emit("player:holdSignal", { holding })}
        />
      )}
      <Chat compact={touch} messages={messages} onSend={(text) => socket.emit("player:chat", { text })} />
      {touch && (
        <TouchControls
          role={role}
          prompt={prompt}
          onMove={(x, y) => engineRef.current?.controller.setMoveAxis(x, y)}
          onLook={(dx, dy) => engineRef.current?.controller.applyLook(dx, dy, 1.8)}
          onSprint={(held) => {
            if (engineRef.current) engineRef.current.controller.sprintHeld = held;
          }}
          onInteract={() => {
            if (engineRef.current) engineRef.current.controller.wantInteract = true;
          }}
          onFlashlight={() => {
            if (engineRef.current) engineRef.current.controller.wantFlashlight = true;
          }}
          onPause={() => {
            setPaused(true);
            document.exitPointerLock();
          }}
          onWarn={() => socket.emit("player:warning")}
          onHold={(held) => socket.emit("player:holdSignal", { holding: held })}
        />
      )}
      {settings.subtitles && snapshot?.subtitles && <div className="subtitles">{snapshot.subtitles}</div>}
      {keypad && (
        <KeypadModal
          selected={symbols}
          onPick={(id) => setSymbols((s) => [...s, id].slice(0, 4))}
          onSubmit={() => {
            socket.emit("player:puzzleInput", { puzzleId: "symbols", value: symbols });
            setKeypad(false);
            setSymbols([]);
          }}
          onClose={() => {
            setKeypad(false);
            setSymbols([]);
          }}
        />
      )}
      {note && (
        <div className="overlay-card" onClick={() => setNote(null)}>
          <div className="panel">
            <pre className="muted" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
              {note}
            </pre>
          </div>
        </div>
      )}
      {paused && !showSettings && (
        <PauseMenu
          onResume={() => setPaused(false)}
          onSettings={() => setShowSettings(true)}
          onLobby={onLobby}
        />
      )}
      {showSettings && (
        <div className="overlay-card">
          <SettingsPanel
            settings={settings}
            onChange={onSettingsChange}
            onBack={() => setShowSettings(false)}
          />
        </div>
      )}
      {disconnected && !waiting && (
        <DisconnectOverlay role={disconnected} onWait={() => setWaiting(true)} onLobby={onLobby} />
      )}
    </div>
  );
}

export function applyGameEvent(
  type: string,
  engine: GameEngine | null,
  audio = getAudio(),
): void {
  if (!engine) return;
  if (type === "death" || type === "behind" || type === "silhouette-flash") {
    engine.effects.trigger("shake", 0.5, 1);
    engine.effects.trigger("heartbeat", 2, 1);
    audio.scare();
  } else if (type === "watcher-distort" || type === "static") {
    engine.effects.trigger("static", 1.5, 1);
    audio.noise(0.4, 0.06);
  } else if (type === "door-slam" || type === "door") {
    engine.effects.trigger("shake", 0.25, 0.5);
    audio.door();
  } else if (type === "child-laugh" || type === "whisper") {
    audio.whisper();
  }
}
