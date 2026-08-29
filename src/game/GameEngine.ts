import * as THREE from "three";
import type { GameSnapshot, Role, WatcherMode } from "../../shared/types";
import { PLAYER_HEIGHT, SPRINT_SPEED, WALK_SPEED } from "../../shared/constants";
import { doorBlockers } from "../../shared/map";
import type { GameSettings } from "../systems/settings";
import { EffectBus } from "../systems/effects";
import { InterpolatedVec } from "../multiplayer/interpolation";
import { buildWorld, syncDoors, syncLights, upsertItem, type WorldHandles } from "./world/MapBuilder";
import { animateHollow, createHollow } from "./monster/HollowMesh";
import { WalkerController } from "./walker/WalkerController";
import { getAudio } from "../systems/audio";
import { gfxProfile } from "./gfx";

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
  private echoHollow: THREE.Group;
  private echoTrail: { x: number; z: number; yaw: number }[] = [];
  private flashlight: THREE.SpotLight;
  private flashFill: THREE.PointLight;
  private flashCone: THREE.Mesh;
  private ambient: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;
  private fill: THREE.DirectionalLight;
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
  private dpr: number;
  private slowFrames = 0;
  private hidden = false;
  private fogWalker = new THREE.FogExp2(0x10141c, 0.011);
  private fogWatcher = new THREE.FogExp2(0x0a1210, 0.015);
  private bgWalker = new THREE.Color(0x0e1016);
  private bgSpirit = new THREE.Color(0x0c1c12);
  private bgEcho = new THREE.Color(0x140c1c);
  private bgDanger = new THREE.Color(0x1c1008);
  private bgNormal = new THREE.Color(0x0a1410);
  private fogSpirit = new THREE.Color(0x14281c);
  private fogEcho = new THREE.Color(0x1c1028);
  private fogDanger = new THREE.Color(0x28180c);
  private fogNormal = new THREE.Color(0x0c1812);
  private placed = false;
  private jumpscareT = 0;
  private baseFov: number;
  private bob = 0;
  private camRoll = 0;
  private mobileGfx = false;
  private lightning: THREE.PointLight;
  private lightningBolt: THREE.Mesh;
  private lightningT = 0;
  private stormAcc = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private role: Role,
    private settings: GameSettings,
    private callbacks: EngineCallbacks,
  ) {
    const gfx = gfxProfile(settings);
    this.mobileGfx = gfx.mobile;
    this.dpr = Math.min(window.devicePixelRatio || 1, gfx.dprCap);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: gfx.antialias,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
      depth: true,
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = role === "watcher" ? 1.0 : 1.05;
    this.renderer.shadowMap.enabled = false;
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(role === "watcher" ? 0x0a1210 : 0x0e1016);
    this.scene.fog = role === "watcher" ? this.fogWatcher : this.fogWalker;

    this.baseFov = gfx.mobile ? 68 : 70;
    this.camera = new THREE.PerspectiveCamera(
      this.baseFov,
      (canvas.clientWidth || window.innerWidth) / (canvas.clientHeight || window.innerHeight),
      0.06,
      gfx.far,
    );

    this.ambient = new THREE.AmbientLight(0x4a5058, role === "watcher" ? 0.38 : 0.18);
    this.hemi = new THREE.HemisphereLight(0xc8d0dc, 0x1e1a14, role === "watcher" ? 0.48 : 0.32);
    this.scene.add(this.ambient, this.hemi);
    this.fill = new THREE.DirectionalLight(0xe8dcc8, 0.1);
    this.fill.position.set(4, 16, 2);
    this.scene.add(this.fill);

    this.world = buildWorld(settings.graphics, Math.min(gfx.anisotropy, maxAniso));
    this.scene.add(this.world.group);

    this.hollow = createHollow();
    this.scene.add(this.hollow);
    this.echoHollow = createHollow();
    this.echoHollow.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (mat && "opacity" in mat) {
        mat.transparent = true;
        mat.opacity = 0.28;
      }
    });
    this.echoHollow.visible = false;
    this.scene.add(this.echoHollow);

    this.lightning = new THREE.PointLight(0xddeeff, 0, 48, 1.4);
    this.lightning.position.set(12, 14, -4);
    this.scene.add(this.lightning);
    this.lightningBolt = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 14),
      new THREE.MeshBasicMaterial({
        color: 0xe8f4ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.lightningBolt.position.set(8, 8, -2);
    this.lightningBolt.visible = false;
    this.scene.add(this.lightningBolt);

    this.flashlight = new THREE.SpotLight(
      0xffe2b8,
      gfx.mobile ? 140 : 175,
      22,
      Math.PI / 6.2,
      0.55,
      1.75,
    );
    this.flashlight.visible = role === "walker";
    this.flashlight.castShadow = false;
    this.flashlight.position.set(0.14, -0.08, 0.12);
    this.camera.add(this.flashlight);
    this.flashlight.target.position.set(0, -0.05, -8);
    this.camera.add(this.flashlight.target);
    this.flashFill = new THREE.PointLight(0xffd9a8, gfx.mobile ? 12 : 16, 5.5, 2.1);
    this.flashFill.position.set(0.05, -0.02, 0.25);
    this.camera.add(this.flashFill);
    this.flashCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 6.5, gfx.mobile ? 10 : 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe6c8,
        transparent: true,
        opacity: gfx.mobile ? 0 : 0.035,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.flashCone.rotation.x = Math.PI / 2;
    this.flashCone.position.set(0, -0.06, -3.2);
    this.flashCone.visible = role === "walker" && !gfx.mobile;
    this.camera.add(this.flashCone);
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

    this.controller.sensitivity = settings.sensitivity * 0.012;
    this.controller.invertY = settings.invertLookY;
    this.controller.x = 0;
    this.controller.z = 0;
    this.controller.touchMode = gfx.mobile;
    this.unbind = this.controller.bind(canvas);
    window.addEventListener("resize", this.onResize);
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    window.visualViewport?.addEventListener("resize", this.onResize);
    this.onResize();
    document.addEventListener("visibilitychange", this.onVisibility);
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

    const body = this.role === "walker" ? snap.walker : snap.watcher;
    if (!this.placed) {
      this.controller.x = body.position.x;
      this.controller.z = body.position.z;
      this.controller.yaw = body.yaw;
      this.controller.pitch = body.pitch;
      this.placed = true;
    } else if (this.role === "walker") {
      const dx = snap.walker.position.x - this.controller.x;
      const dz = snap.walker.position.z - this.controller.z;
      if (dx * dx + dz * dz > 2.8) {
        this.controller.x = snap.walker.position.x;
        this.controller.z = snap.walker.position.z;
        this.controller.vx = 0;
        this.controller.vz = 0;
      }
    } else {
      const dx = snap.watcher.position.x - this.controller.x;
      const dz = snap.watcher.position.z - this.controller.z;
      if (dx * dx + dz * dz > 6) {
        this.controller.x = snap.watcher.position.x;
        this.controller.z = snap.watcher.position.z;
        this.controller.vx = 0;
        this.controller.vz = 0;
      }
    }
  }

  startJumpscare(): void {
    this.jumpscareT = 2.5;
    this.hollow.visible = true;
    this.echoHollow.visible = false;
    this.controller.pitch = 0;
    this.controller.inputEnabled = false;
    this.controller.vx = 0;
    this.controller.vz = 0;
    this.effects.trigger("shake", 2.4, 1);
    this.effects.trigger("heartbeat", 2.4, 1);
    this.effects.trigger("flash", 0.35, 1);
    this.strikeLightning(1.4);
  }

  /** Brief white-blue sky flash + bolt near The Hollow / the player. */
  strikeLightning(intensity = 1): void {
    if (this.settings.reduceMotion) {
      this.lightning.intensity = 18 * intensity;
      this.lightningT = 0.12;
      return;
    }
    const hx = this.hollow.visible ? this.hollow.position.x : this.camera.position.x;
    const hz = this.hollow.visible ? this.hollow.position.z : this.camera.position.z;
    this.lightning.position.set(hx + (Math.random() - 0.5) * 6, 12 + Math.random() * 4, hz + (Math.random() - 0.5) * 6);
    this.lightning.intensity = 42 * intensity;
    this.lightningT = 0.18 + Math.random() * 0.12;
    this.lightningBolt.position.set(this.lightning.position.x, 7, this.lightning.position.z);
    this.lightningBolt.rotation.y = Math.random() * Math.PI;
    this.lightningBolt.rotation.z = (Math.random() - 0.5) * 0.35;
    this.lightningBolt.visible = true;
    const mat = this.lightningBolt.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.85 * intensity;
    this.renderer.toneMappingExposure = Math.min(2.4, this.renderer.toneMappingExposure + 0.55 * intensity);
  }

  setSettings(settings: GameSettings): void {
    this.settings = settings;
    this.controller.sensitivity = settings.sensitivity * 0.012;
    this.controller.invertY = settings.invertLookY;
  }

  private onResize = (): void => {
    if (this.disposed) return;
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private onVisibility = (): void => {
    this.hidden = document.hidden;
    if (!this.hidden) this.last = performance.now();
  };

  private loop = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.hidden) {
      this.last = now;
      return;
    }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (dt > 0.033) this.slowFrames += 2;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 26 && this.dpr > 0.92) {
      this.dpr = Math.max(0.9, Number((this.dpr - 0.18).toFixed(2)));
      this.renderer.setPixelRatio(this.dpr);
      const coneMat = this.flashCone.material as THREE.MeshBasicMaterial;
      coneMat.opacity = Math.min(coneMat.opacity, 0.02);
      this.onResize();
      this.slowFrames = 0;
    }
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number): void {
    const scaring = this.jumpscareT > 0;
    if (this.paused && !scaring) {
      this.controller.inputEnabled = false;
      this.controller.discardToggles();
      return;
    }
    if (!scaring) this.controller.inputEnabled = true;
    const snap = this.snapshot;
    const stamina = snap?.walker.stamina ?? 100;
    const extraWalls = this.role === "walker" && snap ? doorBlockers(snap.doors) : [];
    let sprinting = false;
    let moving = false;
    if (!scaring) {
      const stepped = this.controller.step(dt, this.role, stamina, extraWalls);
      sprinting = stepped.sprinting;
      moving = stepped.moving;
      this.controller.stepLook(dt);
    } else {
      this.controller.inputEnabled = false;
    }
    this.effects.tick(dt);

    const eyeY = this.role === "watcher" ? 2.35 : PLAYER_HEIGHT;
    this.camera.position.set(this.controller.x, eyeY, this.controller.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.controller.yaw;
    this.camera.rotation.x = this.controller.pitch;
    this.camera.rotation.z = 0;

    const spd = this.controller.speed();
    const motion = !this.settings.reduceMotion && this.role === "walker" && !scaring;
    if (motion && spd > 0.35) {
      this.bob += dt * spd * 1.85;
      const a = Math.min(1, spd / (sprinting ? SPRINT_SPEED : WALK_SPEED));
      this.camera.translateX(Math.sin(this.bob * 0.5) * 0.02 * a);
      this.camera.translateY(Math.sin(this.bob) * 0.035 * a);
      const yaw = this.controller.yaw;
      const side = this.controller.vx * Math.cos(yaw) + this.controller.vz * -Math.sin(yaw);
      this.camRoll = dampRoll(this.camRoll, -side * 0.018, 8, dt);
      this.camera.rotation.z = this.camRoll;
    } else {
      this.camRoll = dampRoll(this.camRoll, 0, 10, dt);
      this.camera.rotation.z = this.camRoll;
    }

    if (!scaring && !this.settings.reduceMotion) {
      const targetFov = this.baseFov + (sprinting ? 5 : 0);
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 7);
        this.camera.updateProjectionMatrix();
      }
    }

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
    this.flashFill.visible = flashlightOn;
    this.flicker = 0.94 + Math.random() * 0.06;
    if (snap?.monster?.behindWalker || (snap?.monster && distApprox(snap))) {
      this.flicker = 0.72 + Math.random() * 0.18;
    }
    const battery = snap?.walker.battery ?? 100;
    const beam = flashlightOn && battery > 0 ? this.flicker : 0;
    this.flashlight.intensity = beam ? 155 * beam : 0;
    this.flashFill.intensity = beam ? (this.mobileGfx ? 10 : 14) * beam : 0;
    this.flashCone.visible = !this.mobileGfx && beam > 0;
    this.ambient.intensity = this.role === "watcher" ? 0.38 : flashlightOn && battery > 8 ? 0.16 : 0.08;
    this.hemi.intensity = this.role === "watcher" ? 0.48 : flashlightOn && battery > 8 ? 0.3 : 0.16;
    this.flashlight.target.updateMatrixWorld();

    if (this.role === "walker") {
      this.renderer.toneMappingExposure = 1.05;
      this.scene.fog = this.fogWalker;
      this.scene.background = this.bgWalker;
    } else {
      if (this.mode === "spirit") {
        this.renderer.toneMappingExposure = 1.15;
        this.fogWatcher.color.copy(this.fogSpirit);
        this.fogWatcher.density = 0.016;
        this.scene.background = this.bgSpirit;
      } else if (this.mode === "echo") {
        this.renderer.toneMappingExposure = 1.08;
        this.fogWatcher.color.copy(this.fogEcho);
        this.fogWatcher.density = 0.018;
        this.scene.background = this.bgEcho;
      } else if (this.mode === "danger") {
        this.renderer.toneMappingExposure = 1.12;
        this.fogWatcher.color.copy(this.fogDanger);
        this.fogWatcher.density = 0.016;
        this.scene.background = this.bgDanger;
      } else {
        this.renderer.toneMappingExposure = 0.95;
        this.fogWatcher.color.copy(this.fogNormal);
        this.fogWatcher.density = 0.022;
        this.scene.background = this.bgNormal;
      }
      this.scene.fog = this.fogWatcher;
    }

    const monsterPos = this.monsterLerp.sample(dt);
    const hunting = snap?.monster?.ai === "hunting" || snap?.monster?.ai === "attack";
    const showMonster =
      this.role === "watcher"
        ? this.mode === "spirit" || this.mode === "echo" || hunting || Boolean(snap?.monster)
        : Boolean(snap?.monster?.visibleToWalker) || hunting;

    // Storm flicker during hunts / behind-you pressure
    this.stormAcc += dt;
    if (this.lightningT > 0) {
      this.lightningT -= dt;
      const fall = Math.max(0, this.lightningT / 0.2);
      this.lightning.intensity = 42 * fall;
      const boltMat = this.lightningBolt.material as THREE.MeshBasicMaterial;
      boltMat.opacity = 0.75 * fall;
      if (this.lightningT <= 0) {
        this.lightning.intensity = 0;
        this.lightningBolt.visible = false;
      }
    } else if (hunting && this.stormAcc > 2.8 + Math.random() * 3) {
      this.stormAcc = 0;
      this.strikeLightning(0.75 + Math.random() * 0.5);
      getAudio().thunder();
    }

    this.hollow.visible = showMonster && Boolean(snap?.monster);
    if (snap?.monster && this.hollow.visible) {
      this.hollow.position.set(monsterPos.x, 0, monsterPos.z);
      this.hollow.rotation.y = snap.monster.yaw;
      this.hollow.scale.setScalar(hunting ? 1.35 : 1);
      animateHollow(this.hollow, performance.now() / 1000, hunting);
      this.echoTrail.push({ x: monsterPos.x, z: monsterPos.z, yaw: snap.monster.yaw });
      if (this.echoTrail.length > 48) this.echoTrail.shift();
    }
    if (scaring) {
      this.jumpscareT = Math.max(0, this.jumpscareT - dt);
      const elapsed = 2.5 - this.jumpscareT;
      const slam = Math.min(1, elapsed / 0.16);
      const yaw = this.controller.yaw;
      const dist = 1.05 - slam * 0.38;
      this.hollow.visible = true;
      this.echoHollow.visible = false;
      this.hollow.position.set(
        this.camera.position.x - Math.sin(yaw) * dist,
        0.08 + Math.sin(elapsed * 28) * 0.05,
        this.camera.position.z - Math.cos(yaw) * dist,
      );
      this.hollow.rotation.y = yaw + Math.PI;
      this.hollow.scale.setScalar(1.55 + slam * 1.15);
      animateHollow(this.hollow, performance.now() / 1000, true, true);
      if (!this.settings.reduceMotion) {
        this.camera.fov = this.baseFov + slam * 22;
        this.camera.updateProjectionMatrix();
        this.renderer.toneMappingExposure = 1.7 + Math.sin(elapsed * 42) * 0.45;
      }
    }
    const echoShow = this.role === "watcher" && this.mode === "echo" && this.echoTrail.length > 18 && !scaring;
    this.echoHollow.visible = echoShow;
    if (echoShow) {
      const old = this.echoTrail[0]!;
      this.echoHollow.position.set(old.x, 0, old.z);
      this.echoHollow.rotation.y = old.yaw;
      animateHollow(this.echoHollow, performance.now() / 1000, false);
    }

    if (this.role === "watcher" && snap) {
      const wp = this.walkerLerp.sample(dt);
      this.walkerMarker.position.set(wp.x, 0.9, wp.z);
      this.walkerMarker.rotation.y = snap.walker.yaw;
      this.walkerMarker.visible = true;
      const mat = this.walkerMarker.material as THREE.MeshStandardMaterial;
      mat.opacity = this.mode === "normal" ? 0.16 : 0.35;
    }

    const showGlyphs = this.role === "watcher" && (this.mode === "spirit" || this.mode === "echo");
    for (const plate of this.world.glyphs) {
      plate.visible = showGlyphs;
      const mat = plate.material as THREE.MeshStandardMaterial;
      const name = plate.userData.glyph as string;
      const inSol = snap?.symbolSolution?.includes(name);
      mat.emissiveIntensity = showGlyphs ? (inSol ? 1.4 : 0.35) : 0;
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
      getAudio().flashlight(next);
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
    if (!scaring && this.sendAcc >= 1 / 15) {
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
      this.footAcc += dt * Math.max(0.65, spd / WALK_SPEED);
      if (this.footAcc > (sprinting ? 0.3 : 0.46)) {
        this.footAcc = 0;
        getAudio().footstep();
      }
    } else {
      this.footAcc = 0;
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unbind();
    window.removeEventListener("resize", this.onResize);
    this.resizeObserver.disconnect();
    window.visualViewport?.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
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

function dampRoll(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
