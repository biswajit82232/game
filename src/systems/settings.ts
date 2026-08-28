export type GraphicsQuality = "low" | "high";

export interface GameSettings {
  master: number;
  music: number;
  sfx: number;
  sensitivity: number;
  graphics: GraphicsQuality;
  shake: boolean;
  grain: boolean;
  fullscreen: boolean;
  subtitles: boolean;
  reduceMotion: boolean;
}

const KEY = "dta-settings";

export const DEFAULT_SETTINGS: GameSettings = {
  master: 0.8,
  music: 0.45,
  sfx: 0.7,
  sensitivity: 0.22,
  graphics: "high",
  shake: true,
  grain: true,
  fullscreen: false,
  subtitles: true,
  reduceMotion: false,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
