import * as THREE from "three";
import type { GameSnapshot, Role, WatcherMode } from "../../shared/types";
import { PLAYER_HEIGHT } from "../../shared/constants";
import type { GameSettings } from "../systems/settings";
import { EffectBus } from "../systems/effects";
import { InterpolatedVec } from "../multiplayer/interpolation";
import { buildWorld, syncDoors, syncLights, upsertItem, type WorldHandles } from "./world/MapBuilder";
import { animateHollow, createHollow } from "./monster/HollowMesh";
import { WalkerController } from "./walker/WalkerController";
import { getAudio } from "../systems/audio";
import { isTouchPreferred } from "../utils/touch";

export interface EngineCallbacks {
  onInteract: (id: string, prompt: string) => void;
  onPrompt: (prompt: string | null) => void;
  sendMove: (payload: {
    x: number;
    z: number;
    yaw: number;
    pitch: number;
    sprinting: boolean;
  }) => void;
  sendFlashlight: (on: boolean) => void;
  sendInteract: (id: string) => void;
}

export class GameEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly scene: THREE.Scene;
  readonly controller = new WalkerController();
  readonly effects = new EffectBus();
  private world: WorldHandles;
  private hollow: THREE.Group;
  private flashlight: THREE.SpotLight;
  private ambient: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;
  private walkerMarker: THREE.Mesh;
  private raf = 0;
  private last = performance.now();
  private sendAcc = 0;
  private footAcc = 0;
  private disposed = false;
  private unbind: () => void;
  private resizeObserver: ResizeObserver;
  private monsterLerp = new InterpolatedVec();
  private walkerLerp = new InterpolatedVec();
  private snapshot: GameSnapshot | null = null;
  private flicker = 1;
  private mode: WatcherMode = "normal";
  paused = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private role: Role,
    private settings: GameSettings,
    private callbacks: EngineCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: settings.graphics === "high",
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.graphics === "high" ? 2 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = role === "watcher" ? 0.85 : 1.05;
    this.renderer.shadowMap.enabled = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(role === "watcher" ? 0x08140c : 0x101218);
    this.scene.fog = new THREE.FogExp2(role === "watcher" ? 0x08140c : 0x101218, 0.028);

    this.camera = new THREE.PerspectiveCamera(
      72,
      (canvas.clientWidth || window.innerWidth) / (canvas.clientHeight || window.innerHeight),
      0.08,
      80,
    );

    this.ambient = new THREE.AmbientLight(0x6a7380, role === "watcher" ? 0.55 : 0.7);
    this.hemi = new THREE.HemisphereLight(0x8899aa, 0x1a1814, 0.65);
    this.scene.add(this.ambient, this.hemi);
    const fill = new THREE.DirectionalLight(0xc8c0a8, 0.35);
    fill.position.set(8, 12, 6);
    this.scene.add(fill);

    this.world = buildWorld(settings.graphics);
    this.scene.add(this.world.group);

    this.hollow = createHollow();
    this.scene.add(this.hollow);

    this.flashlight = new THREE.SpotLight(0xf2e6c9, 4.2, 22, Math.PI / 6, 0.28, 1);
    this.flashlight.visible = role === "walker";
    this.camera.add(this.flashlight);
    this.flashlight.target.position.set(0, 0, -1);
    this.camera.add(this.flashlight.target);
    this.scene.add(this.camera);

    this.walkerMarker = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 1.1, 4, 8),
      new THREE.MeshStandardMaterial({
        color: 0x8899aa,
        transparent: true,
        opacity: 0.35,
        emissive: 0x223344,
        emissiveIntensity: 0.4,
      }),
    );
    this.walkerMarker.visible = role === "watcher";
    this.scene.add(this.walkerMarker);

    this.controller.sensitivity = settings.sensitivity * 0.01;
    this.controller.x = 0;
    this.controller.z = 0;
    this.controller.touchMode = isTouchPreferred();
    this.unbind = this.controller.bind(canvas);
    window.addEventListener("resize", this.onResize);
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    window.visualViewport?.addEventListener("resize", this.onResize);
    this.onResize();
    this.raf = requestAnimationFrame(this.loop);
  }

  applySnapshot(snap: GameSnapshot): void {
    this.snapshot = snap;
    this.mode = snap.watcher.mode;
    syncDoors(this.world, snap.doors);
    syncLights(this.world, snap.lights, snap.generatorOn);
    for (const item of snap.items) upsertItem(this.world, item, this.world.group);
    if (snap.monster) this.monsterLerp.push(snap.monster.position);
    this.walkerLerp.push(snap.walker.position);

    if (this.role === "walker") {
      const dx = snap.walker.position.x - this.controller.x;
      const dz = snap.walker.position.z - this.controller.z;
      if (dx * dx + dz * dz > 6) {
        this.controller.x = snap.walker.position.x;
        this.controller.z = snap.walker.position.z;
      }
    } else {
      const dx = snap.watcher.position.x - this.controller.x;
      const dz = snap.watcher.position.z - this.controller.z;
      if (dx * dx + dz * dz > 10) {
        this.controller.x = snap.watcher.position.x;
        this.controller.z = snap.watcher.position.z;
      }
    }
  }

  setSettings(settings: GameSettings): void {
    this.settings = settings;
    this.controller.sensitivity = settings.sensitivity * 0.01;
  }

  private onResize = (): void => {
    if (this.disposed) return;
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private loop = (now: number): void => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    if (this.paused) return;
    const snap = this.snapshot;
    const stamina = snap?.walker.stamina ?? 100;
    const { sprinting, moving } = this.controller.step(dt, this.role, stamina);
    this.controller.stepLook(dt);
    this.effects.tick(dt);

    this.camera.position.set(
      this.controller.x,
      this.role === "watcher" ? 2.35 : PLAYER_HEIGHT,
      this.controller.z,
    );
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.controller.yaw + Math.PI;
    this.camera.rotation.x = this.controller.pitch;

    const shakeOn = this.settings.shake && !this.settings.reduceMotion;
    if (shakeOn && this.effects.state.shake > 0.05) {
      this.camera.position.x += (Math.random() - 0.5) * 0.04 * this.effects.state.shake;
      this.camera.position.y += (Math.random() - 0.5) * 0.03 * this.effects.state.shake;
    }
    if (this.effects.state.heartbeat > 0) {
      this.camera.position.y += Math.sin(performance.now() / 90) * 0.02 * this.effects.state.heartbeat;
    }

    const flashlightOn = this.role === "walker" && (snap ? snap.walker.flashlightOn : true);
    this.flashlight.visible = flashlightOn;
    this.flicker = 0.92 + Math.random() * 0.08;
    if (snap?.monster?.behindWalker || (snap?.monster && distApprox(snap))) {
      this.flicker = 0.65 + Math.random() * 0.25;
    }
    this.flashlight.intensity = flashlightOn && (snap?.walker.battery ?? 100) > 0 ? 4.2 * this.flicker : 0;

    if (this.role === "watcher") {
      this.renderer.toneMappingExposure = this.mode === "spirit" ? 1.0 : this.mode === "danger" ? 0.9 : 0.8;
      this.scene.fog = new THREE.FogExp2(this.mode === "spirit" ? 0x0a1c10 : 0x08140c, this.mode === "normal" ? 0.04 : 0.03);
    }

    const monsterPos = this.monsterLerp.sample();
    const showMonster =
      this.role === "watcher"
        ? this.mode === "spirit" || this.mode === "echo" || Boolean(snap?.monster)
        : Boolean(snap?.monster?.visibleToWalker);
    this.hollow.visible = showMonster && Boolean(snap?.monster);
    if (snap?.monster && this.hollow.visible) {
      this.hollow.position.set(monsterPos.x, 0, monsterPos.z);
      this.hollow.rotation.y = snap.monster.yaw;
      animateHollow(this.hollow, performance.now() / 1000);
    }

    if (this.role === "watcher" && snap) {
      const wp = this.walkerLerp.sample();
      this.walkerMarker.position.set(wp.x, 0.9, wp.z);
      this.walkerMarker.rotation.y = snap.walker.yaw;
      this.walkerMarker.visible = this.mode !== "normal";
    }

    for (const [id, mesh] of this.world.items) {
      if (id.startsWith("switch-") && this.role === "watcher" && this.mode === "danger" && snap) {
        const idx = Number(id.split("-")[1]);
        const mat = (mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (idx === snap.powerSafeSwitch) {
          mat.emissive = new THREE.Color(0x886600);
          mat.emissiveIntensity = 1.2;
        } else {
          mat.emissive = new THREE.Color(0x880000);
          mat.emissiveIntensity = 0.8;
        }
      }
    }

    if ((this.controller.consume("KeyF") || this.controller.consumeTap("flashlight")) && this.role === "walker") {
      const next = !(snap?.walker.flashlightOn ?? true);
      this.callbacks.sendFlashlight(next);
    }
    if (
      (this.controller.consume("KeyE") || this.controller.consumeTap("interact")) &&
      this.role === "walker" &&
      snap?.nearbyInteractable
    ) {
      this.callbacks.onInteract(snap.nearbyInteractable.id, snap.nearbyInteractable.prompt);
      this.callbacks.sendInteract(snap.nearbyInteractable.id);
    }
    this.callbacks.onPrompt(this.role === "walker" ? snap?.nearbyInteractable?.prompt ?? null : null);

    this.sendAcc += dt;
    if (this.sendAcc >= 1 / 15) {
      this.sendAcc = 0;
      this.callbacks.sendMove({
        x: this.controller.x,
        z: this.controller.z,
        yaw: this.controller.yaw,
        pitch: this.controller.pitch,
        sprinting,
      });
    }

    if (moving) {
      this.footAcc += dt;
      if (this.footAcc > (sprinting ? 0.28 : 0.45)) {
        this.footAcc = 0;
        getAudio().footstep();
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unbind();
    window.removeEventListener("resize", this.onResize);
    this.resizeObserver.disconnect();
    window.visualViewport?.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
    this.effects.reset();
  }
}

function distApprox(snap: GameSnapshot): boolean {
  if (!snap.monster) return false;
  const dx = snap.monster.position.x - snap.walker.position.x;
  const dz = snap.monster.position.z - snap.walker.position.z;
  return dx * dx + dz * dz < 36;
}
