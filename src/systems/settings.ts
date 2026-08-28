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
  gyroLook: true,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const graphics = defaultGraphics();
      return { ...DEFAULT_SETTINGS, graphics, grain: graphics === "high" };
    }
    const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as GameSettings;
    if (!localStorage.getItem("dta-gfx-v3") && merged.graphics === "low") {
      merged.graphics = "high";
      merged.grain = true;
      localStorage.setItem("dta-gfx-v3", "1");
      saveSettings(merged);
    }
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS, graphics: defaultGraphics() };
  }
}

export function saveSettings(settings: GameSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
