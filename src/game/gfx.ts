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
    dprCap: high ? (mobile ? 1.55 : 1.9) : mobile ? 1.15 : 1.3,
    texSize: high ? (mobile ? 384 : 768) : 160,
    texNoise: high ? (mobile ? 420 : 900) : 140,
    extraProps: high,
    far: high ? (mobile ? 48 : 68) : 38,
    anisotropy: high ? (mobile ? 4 : 8) : 2,
  };
}
