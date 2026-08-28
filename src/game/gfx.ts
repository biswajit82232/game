import { isTouchPreferred } from "../utils/touch";
import type { GameSettings } from "../systems/settings";

export interface GfxProfile {
  high: boolean;
  mobile: boolean;
  antialias: boolean;
  dprCap: number;
  texSize: number;
  texNoise: number;
  extraProps: boolean;
  far: number;
  anisotropy: number;
}

export function gfxProfile(settings: GameSettings, mobile = isTouchPreferred()): GfxProfile {
  const high = settings.graphics === "high";
  return {
    high,
    mobile,
    antialias: high && !mobile,
    dprCap: high ? (mobile ? 1.45 : 1.8) : mobile ? 1.15 : 1.3,
    texSize: high ? (mobile ? 256 : 512) : 128,
    texNoise: high ? (mobile ? 380 : 820) : 140,
    extraProps: high,
    far: high ? (mobile ? 58 : 80) : 44,
    anisotropy: high ? (mobile ? 4 : 8) : 2,
  };
}
