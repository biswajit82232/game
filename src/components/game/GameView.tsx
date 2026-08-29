import { useEffect, useRef, useState } from "react";
import type { ChatMessage, GameSnapshot, Role, WatcherMode } from "../../../shared/types";
import type { GameSettings } from "../../systems/settings";
import { GameEngine } from "../../game/GameEngine";
import { getSocket } from "../../multiplayer/socket";
import { getAudio } from "../../systems/audio";
import { isTouchPreferred } from "../../utils/touch";
import { haptic } from "../../utils/haptic";
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
  const [looking, setLooking] = useState(false);
  const gyroRef = useRef<((ev: DeviceOrientationEvent) => void) | null>(null);
  const [foundScare, setFoundScare] = useState(false);
  const dismissedOverlay = useRef<string | null>(null);
  const chase =
    !foundScare && (snapshot?.monster?.ai === "hunting" || snapshot?.monster?.ai === "attack");

  useEffect(() => {
    if (engineRef.current) engineRef.current.paused = paused || keypad || Boolean(note);
  }, [paused, keypad, note]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const socket = getSocket();
    const engine = new GameEngine(canvas, role, settings, {
      onPrompt: setPrompt,
      onInteract: (id) => {
        if (id === "keypad-security") {
          setKeypad(true);
          setSymbols([]);
          document.exitPointerLock();
        }
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
        if (e.code === "Digit1") {
          getAudio().modeSwitch();
          socket.emit("player:switchMode", { mode: "normal" });
        }
        if (e.code === "Digit2") {
          getAudio().modeSwitch();
          socket.emit("player:switchMode", { mode: "spirit" });
        }
        if (e.code === "Digit3") {
          getAudio().modeSwitch();
          socket.emit("player:switchMode", { mode: "echo" });
        }
        if (e.code === "Digit4") {
          getAudio().modeSwitch();
          socket.emit("player:switchMode", { mode: "danger" });
        }
        if (e.code === "KeyQ") {
          getAudio().radio();
          socket.emit("player:warning");
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyR") socket.emit("player:holdSignal", { holding: false });
    };
    const onKeyDownHold = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "KeyR") socket.emit("player:holdSignal", { holding: true });
    };
    const onEvent = ({ type }: { type: string }) => {
      applyGameEvent(type, engine);
      if (type === "death") {
        setFoundScare(true);
        haptic(0, [40, 40, 90, 40, 120]);
      }
      if (type === "watcher-distort" || type === "silhouette-flash") {
        setFx({ grain: 1, shake: 1 });
        window.setTimeout(() => setFx({ grain: 0, shake: 0 }), 1200);
      }
      if (type === "puzzle-fail") setSymbols([]);
      if (type === "puzzle") {
        setKeypad(false);
        setSymbols([]);
      }
    };
    socket.on("game:event", onEvent);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onKeyDownHold);
    window.addEventListener("keyup", onKeyUp);
    const onLock = () => setLooking(document.pointerLockElement === canvas);
    document.addEventListener("pointerlockchange", onLock);
    const onResize = () => {
      const next = isTouchPreferred();
      setTouch(next);
      engine.controller.touchMode = next;
    };
    window.addEventListener("resize", onResize);
    const blockZoom = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", blockZoom);
    const stopScroll = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    canvas.parentElement?.addEventListener("touchmove", stopScroll, { passive: false });
    return () => {
      socket.off("game:event", onEvent);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onKeyDownHold);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("pointerlockchange", onLock);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("gesturestart", blockZoom);
      canvas.parentElement?.removeEventListener("touchmove", stopScroll);
      if (gyroRef.current) window.removeEventListener("deviceorientation", gyroRef.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, [role, settings.graphics]);

  useEffect(() => {
    if (snapshot) engineRef.current?.applySnapshot(snapshot);
    if (snapshot?.overlay) {
      if (dismissedOverlay.current !== snapshot.overlay) setNote(snapshot.overlay);
    } else {
      dismissedOverlay.current = null;
    }
  }, [snapshot]);

  useEffect(() => {
    engineRef.current?.setSettings(settings);
  }, [settings]);

  const socket = getSocket();

  return (
    <div className={`game-wrap${touch ? " is-touch" : ""}`}>
      <canvas ref={canvasRef} />
      {settings.grain && !settings.reduceMotion && settings.graphics === "high" && (
        <div className="grain" style={{ opacity: (touch ? 0.035 : 0.055) + fx.grain * 0.1 }} />
      )}
      <div className="vignette" />
      {role === "watcher" && <div className="watcher-fx" />}
      {chase && <div className="chase-scare" />}
      {foundScare && (
        <div className={`jumpscare${settings.reduceMotion ? " is-still" : ""}`} aria-hidden>
          <img className="jumpscare-face" src="/assets/textures/hollow-jumpscare.png" alt="" />
          <div className="jumpscare-flash" />
        </div>
      )}
      {!snapshot && (
        <div className="prompt">LOADING THE BUILDING…</div>
      )}
      {snapshot && !touch && !looking && !paused && !keypad && !note && !prompt && (
        <div className="prompt">CLICK TO LOOK · WASD MOVE · SHIFT RUN</div>
      )}
      {snapshot && role === "walker" && !foundScare && (
        <WalkerHUD snap={snapshot} prompt={prompt} otherAlive={!disconnected} touch={touch} />
      )}
      {snapshot && role === "watcher" && !foundScare && (
        <WatcherHUD
          snap={snapshot}
          touch={touch}
          onMode={(mode: WatcherMode) => {
            getAudio().modeSwitch();
            socket.emit("player:switchMode", { mode });
          }}
          onWarn={() => {
            getAudio().radio();
            socket.emit("player:warning");
          }}
          onHold={(holding) => socket.emit("player:holdSignal", { holding })}
        />
      )}
      {!foundScare && (
        <Chat compact={touch} messages={messages} onSend={(text) => socket.emit("player:chat", { text })} />
      )}
      {touch && !foundScare && (
        <TouchControls
          role={role}
          solo={Boolean(snapshot?.solo)}
          prompt={prompt}
          onMove={(x, y) => engineRef.current?.controller.setMoveAxis(x, y)}
          onLookDelta={(dx, dy) => engineRef.current?.controller.applyLook(dx, dy, 2.15)}
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
          onRadio={(held) => socket.emit("player:holdSignal", { holding: held })}
          onGyro={
            settings.gyroLook
              ? async () => {
                  const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
                  if (typeof DOE.requestPermission === "function") {
                    const res = await DOE.requestPermission();
                    if (res !== "granted") return;
                  }
                  if (gyroRef.current) window.removeEventListener("deviceorientation", gyroRef.current);
                  let lastG: number | null = null;
                  let lastB: number | null = null;
                  const onOrient = (ev: DeviceOrientationEvent) => {
                    if (ev.gamma == null || ev.beta == null) return;
                    if (lastG == null || lastB == null) {
                      lastG = ev.gamma;
                      lastB = ev.beta;
                      return;
                    }
                    const dg = ev.gamma - lastG;
                    const db = ev.beta - lastB;
                    lastG = ev.gamma;
                    lastB = ev.beta;
                    engineRef.current?.controller.applyLook(dg * 6.5, db * 6.5, 1);
                  };
                  gyroRef.current = onOrient;
                  window.addEventListener("deviceorientation", onOrient);
                }
              : undefined
          }
        />
      )}
      {settings.subtitles && snapshot?.subtitles && <div className="subtitles">{snapshot.subtitles}</div>}
      {keypad && (
        <KeypadModal
          selected={symbols}
          hint={snapshot?.solo ? snapshot.symbolSolution : null}
          onPick={(id) => setSymbols((s) => [...s, id].slice(0, 4))}
          onClear={() => setSymbols([])}
          onSubmit={() => {
            socket.emit("player:puzzleInput", { puzzleId: "symbols", value: symbols });
          }}
          onClose={() => {
            setKeypad(false);
            setSymbols([]);
          }}
        />
      )}
      {note && (
        <div
          className="overlay-card"
          onClick={() => {
            dismissedOverlay.current = note;
            setNote(null);
            getAudio().ui();
          }}
        >
          <div className="panel">
            <pre className="muted" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
              {note}
            </pre>
            <p className="muted hud-hint">TAP / CLICK TO CLOSE</p>
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
  if (type === "warning" || type === "behind" || type === "false-warning") {
    engine.effects.trigger("heartbeat", 2.2, 1);
    audio.radio();
    audio.heartbeat();
    if (type === "behind") {
      engine.effects.trigger("shake", 0.5, 1);
      audio.scare();
    }
  } else if (type === "death") {
    engine.startJumpscare();
    engine.effects.trigger("shake", 2.4, 1);
    engine.effects.trigger("heartbeat", 2.4, 1);
    audio.jumpscare();
    haptic(0, [30, 20, 80]);
  } else if (type === "silhouette-flash" || type === "shadow-cross" || type === "coat-scare") {
    engine.effects.trigger("shake", 0.5, 1);
    engine.effects.trigger("heartbeat", 2, 1);
    audio.scare();
  } else if (type === "chase-scare") {
    engine.effects.trigger("shake", 1.4, 1);
    engine.effects.trigger("heartbeat", 4, 1);
    audio.laugh();
    audio.scream();
    audio.scare();
    haptic(0, [18, 40, 18, 40, 30]);
  } else if (type === "watcher-distort" || type === "static" || type === "lights-out") {
    engine.effects.trigger("static", 1.5, 1);
    audio.noise(0.4, 0.06);
  } else if (type === "door-slam" || type === "door") {
    engine.effects.trigger("shake", 0.25, 0.5);
    audio.door();
  } else if (type === "child-laugh" || type === "whisper") {
    audio.whisper();
    if (type === "child-laugh") audio.laugh();
  } else if (type === "item" || type === "audio-log") {
    audio.pickup();
    audio.ui();
  } else if (type === "puzzle") {
    audio.puzzleOk();
  } else if (type === "puzzle-fail") {
    audio.puzzleFail();
    engine.effects.trigger("shake", 0.4, 0.6);
  } else if (type === "power" || type === "exit") {
    audio.power();
  } else if (type === "shock") {
    audio.shock();
    engine.effects.trigger("shake", 0.8, 0.8);
    haptic(0, [25, 30, 40]);
  } else if (type === "locked") {
    audio.locked();
  } else if (type === "phone-ring") {
    audio.phone();
  } else if (type === "vending-noise") {
    audio.vending();
  } else if (type === "fake-message" || type === "hint" || type === "keypad" || type === "secret") {
    audio.ui();
    if (type === "fake-message") {
      audio.radio();
      engine.effects.trigger("heartbeat", 1.5, 0.7);
    }
  }
}
