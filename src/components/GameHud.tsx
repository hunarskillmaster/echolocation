import React from 'react';
import { Volume2, VolumeX, Pause } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  muted,
  onToggleMute,
  onPause,
}) => {
  const chargePct = Math.max(0, Math.min(100, Math.round((hud.echoCharge / hud.maxEchoCharge) * 100)));

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Subtle proximity danger vignette when an entity is close */}
      {hud.nearestDangerRatio > 0.05 && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none transition-opacity duration-150"
          style={{
            opacity: hud.nearestDangerRatio * 0.65,
            boxShadow: 'inset 0 0 110px 24px rgba(220, 38, 38, 0.55)',
          }}
        />
      )}

      {/* Top-Left Cluster: Integrity Pips + Clues + Exit State */}
      <div className="fixed top-5 left-6 flex flex-col gap-2.5">
        <div className="flex items-center gap-4">
          {/* Integrity Diamonds */}
          <div className="flex items-center gap-1.5" aria-label={`Integrity ${hud.integrity} of ${hud.maxIntegrity}`}>
            {Array.from({ length: hud.maxIntegrity }).map((_, idx) => {
              const active = idx < hud.integrity;
              return (
                <svg
                  key={idx}
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M10 2L18 10L10 18L2 10Z"
                    fill={active ? '#ffffff' : 'transparent'}
                    stroke={active ? '#67e8f9' : '#334155'}
                    strokeWidth="1.6"
                  />
                </svg>
              );
            })}
          </div>

          <span className="text-slate-600" aria-hidden="true">·</span>

          <div className="flex items-baseline gap-2">
            <span className="text-[11px] uppercase tracking-widest text-slate-400">Clues</span>
            <span className="font-mono-tabular text-lg font-semibold text-white">
              {hud.cluesCollected}/{hud.totalClues}
            </span>
          </div>

          <span className="text-slate-600" aria-hidden="true">·</span>

          <span className="font-mono-tabular text-xs tracking-wider text-slate-400">
            {formatClock(hud.elapsedSeconds)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs tracking-wide">
          <span className={hud.exitUnlocked ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
            {hud.exitUnlocked ? 'East Exit Unlocked' : 'Exit Sealed'}
          </span>
        </div>
      </div>

      {/* Top-Right Cluster: Mute [M] and Pause [P] */}
      <div className="fixed top-5 right-6 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          className="h-10 px-3 flex items-center gap-2 rounded bg-black/80 border border-white/15 text-xs text-slate-200 hover:border-sky-400/60 hover:text-white transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
        >
          {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-sky-300" />}
          <span className="font-mono-tabular">{muted ? 'Muted [M]' : 'Sound [M]'}</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Pause game (P)"
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
          className="h-10 w-10 flex items-center justify-center rounded bg-black/80 border border-white/15 text-slate-200 hover:border-sky-400/60 hover:text-white transition-colors duration-150 cursor-pointer shrink-0"
        >
          <Pause className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom-Left Cluster: Echo Charge & Noise State */}
      <div className="fixed bottom-5 left-6 flex flex-col gap-2 w-48">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] uppercase tracking-widest text-slate-400">Sonar</span>
          <span className="font-mono-tabular text-xs text-sky-300">{chargePct}%</span>
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-300 origin-left transition-transform duration-75"
            style={{ transform: `scaleX(${chargePct / 100})` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 tracking-wide">
          <span>Shift Sneak</span>
          <span
            className={
              hud.noiseLevel === 'PING'
                ? 'font-mono-tabular text-sky-300'
                : hud.noiseLevel === 'STEP'
                  ? 'font-mono-tabular text-slate-200'
                  : 'font-mono-tabular text-slate-500'
            }
          >
            {hud.noiseLevel}
          </span>
        </div>
      </div>

      {/* Ephemeral Clue Discovery Fragment */}
      {hud.activeClue && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 max-w-md w-[90vw] px-5 py-4 rounded bg-black/90 border border-sky-400/35 text-center"
        >
          <div className="text-xs font-mono-tabular uppercase tracking-wider text-sky-300 mb-1.5">
            {hud.activeClue.title}
          </div>
          <p className="text-sm text-slate-100 leading-relaxed">{hud.activeClue.text}</p>
        </div>
      )}
    </div>
  );
};
