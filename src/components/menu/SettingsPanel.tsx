import { HorrorButton } from "../../ui/HorrorButton";
import type { GameSettings, GraphicsQuality } from "../../systems/settings";

export function SettingsPanel({
  settings,
  onChange,
  onBack,
}: {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onBack: () => void;
}) {
  const set = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="screen menu-overlay">
      <div className="panel">
        <h2>SETTINGS</h2>
        <Slider label="MASTER VOLUME" value={settings.master} onChange={(v) => set({ master: v })} />
        <Slider label="MUSIC VOLUME" value={settings.music} onChange={(v) => set({ music: v })} />
        <Slider label="SFX VOLUME" value={settings.sfx} onChange={(v) => set({ sfx: v })} />
        <Slider label="LOOK SENSITIVITY" value={settings.sensitivity} min={0.08} max={0.5} onChange={(v) => set({ sensitivity: v })} />
        <div className="field">
          <label>GRAPHICS QUALITY</label>
          <div className="row">
            {(["low", "high"] as GraphicsQuality[]).map((g) => (
              <HorrorButton key={g} variant={settings.graphics === g ? "primary" : "ghost"} onClick={() => set({ graphics: g })}>
                {g.toUpperCase()}
              </HorrorButton>
            ))}
          </div>
        </div>
        <Toggle label="SCREEN SHAKE" on={settings.shake} onToggle={() => set({ shake: !settings.shake })} />
        <Toggle label="FILM GRAIN" on={settings.grain} onToggle={() => set({ grain: !settings.grain })} />
        <Toggle label="SUBTITLES" on={settings.subtitles} onToggle={() => set({ subtitles: !settings.subtitles })} />
        <Toggle label="REDUCE MOTION" on={settings.reduceMotion} onToggle={() => set({ reduceMotion: !settings.reduceMotion })} />
        <Toggle label="INVERT LOOK Y" on={settings.invertLookY} onToggle={() => set({ invertLookY: !settings.invertLookY })} />
        <Toggle label="GYRO LOOK (PHONE)" on={settings.gyroLook} onToggle={() => set({ gyroLook: !settings.gyroLook })} />
        <Toggle
          label="FULLSCREEN"
          on={settings.fullscreen}
          onToggle={() => {
            const next = !settings.fullscreen;
            set({ fullscreen: next });
            if (next) void document.documentElement.requestFullscreen?.();
            else if (document.fullscreenElement) void document.exitFullscreen();
          }}
        />
        <HorrorButton onClick={onBack}>BACK</HorrorButton>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="field">
      <label>
        {label} — {Math.round(value * 100)}%
      </label>
      <input type="range" min={min} max={max} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <HorrorButton variant="ghost" onClick={onToggle}>
        {on ? "ON" : "OFF"}
      </HorrorButton>
    </label>
  );
}
