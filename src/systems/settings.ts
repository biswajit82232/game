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
  invertLookY: boolean;
  gyroLook: boolean;
}

const KEY = "dta-settings";

function defaultGraphics(): GraphicsQuality {
  if (typeof window === "undefined") return "high";
  try {
    if (window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 1024) return "low";
  } catch {
    /* ignore */
  }
  return "high";
}

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
  invertLookY: false,
  gyroLook: false,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const graphics = defaultGraphics();
      return { ...DEFAULT_SETTINGS, graphics, grain: graphics === "high" };
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS, graphics: defaultGraphics() };
  }
}

export function saveSettings(settings: GameSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
