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
    dprCap: high ? (mobile ? 1.4 : 1.75) : mobile ? 1.1 : 1.25,
    texSize: high ? (mobile ? 320 : 512) : 160,
    texNoise: high ? (mobile ? 360 : 720) : 140,
    extraProps: high && !mobile,
    far: high ? (mobile ? 42 : 62) : 36,
    anisotropy: high ? (mobile ? 2 : 8) : 2,
  };
}
