import { DEFAULT_SETTINGS, type GameSettings } from "./settings";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private drone: OscillatorNode | null = null;
  private settings: GameSettings;
  private started = false;

  constructor(settings: GameSettings) {
    this.settings = settings;
  }

  applySettings(settings: GameSettings): void {
    this.settings = settings;
    if (!this.master || !this.music || !this.sfx) return;
    this.master.gain.value = settings.master;
    this.music.gain.value = settings.music;
    this.sfx.gain.value = settings.sfx;
  }

  async resume(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applySettings(this.settings);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (!this.started && this.ctx) {
      this.started = true;
      this.startDrone();
    }
  }

  private startDrone(): void {
    if (!this.ctx || !this.music) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 46;
    filter.type = "lowpass";
    filter.frequency.value = 180;
    gain.gain.value = 0.12;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.music);
    osc.start();
    this.drone = osc;
  }

  tone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.08): void {
    if (!this.ctx || !this.sfx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume * this.settings.sfx;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.sfx);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  noise(duration: number, volume = 0.04): void {
    if (!this.ctx || !this.sfx) return;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    src.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 1400;
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfx);
    src.start();
  }

  footstep(): void {
    this.noise(0.05, 0.03);
    this.tone(90, 0.08, "triangle", 0.03);
  }

  heartbeat(): void {
    this.tone(70, 0.12, "sine", 0.1);
    setTimeout(() => this.tone(62, 0.12, "sine", 0.08), 180);
  }

  door(): void {
    this.tone(140, 0.4, "sawtooth", 0.05);
  }

  ui(): void {
    this.tone(420, 0.08, "square", 0.03);
  }

  scare(): void {
    this.noise(0.55, 0.16);
    this.tone(38, 0.9, "sawtooth", 0.16);
    this.tone(180, 0.35, "square", 0.07);
  }

  laugh(): void {
    if (!this.ctx || !this.sfx) return;
    const t0 = this.ctx.currentTime;
    const bursts = [0, 0.16, 0.3, 0.48, 0.7, 0.92];
    for (const t of bursts) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = "sawtooth";
      osc.frequency.value = 140 + Math.random() * 80;
      osc.frequency.exponentialRampToValueAtTime(70 + Math.random() * 40, t0 + t + 0.14);
      filter.type = "bandpass";
      filter.frequency.value = 900;
      gain.gain.value = 0.12 * this.settings.sfx;
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + t + 0.18);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfx);
      osc.start(t0 + t);
      osc.stop(t0 + t + 0.2);
    }
    this.noise(1.1, 0.1);
    this.tone(55, 1.2, "sawtooth", 0.12);
  }

  scream(): void {
    this.tone(620, 0.45, "sawtooth", 0.12);
    this.tone(980, 0.28, "square", 0.08);
    this.noise(0.35, 0.14);
  }

  radio(): void {
    this.noise(0.25, 0.05);
    this.tone(310, 0.12, "square", 0.03);
  }

  whisper(): void {
    this.noise(0.7, 0.05);
  }

  dispose(): void {
    this.drone?.stop();
    this.drone = null;
    void this.ctx?.close();
    this.ctx = null;
    this.started = false;
  }
}

let audio: AudioManager | null = null;

export function getAudio(settings?: GameSettings): AudioManager {
  if (!audio && settings) audio = new AudioManager(settings);
  if (!audio) audio = new AudioManager({ ...DEFAULT_SETTINGS });
  if (settings) audio.applySettings(settings);
  return audio;
}
