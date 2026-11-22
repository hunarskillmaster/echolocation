import React from 'react';
import { HudSnapshot } from '../game/types';

interface StatusModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  hud,
  onResume,
  onRestart,
  onReturnTitle,
}) => {
  if (hud.phase === 'paused') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center px-6 bg-black/75">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
          className="w-full max-w-sm rounded-lg bg-black border border-white/15 p-8 text-center"
        >
          <h2 id="pause-title" className="text-2xl font-semibold text-white tracking-tight mb-2">
            Paused
          </h2>
          <p className="text-sm text-slate-400 mb-7">
            Listen closely when you step back into the dark.
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 px-4 rounded-md bg-white text-black text-sm font-semibold hover:bg-sky-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-2.5 px-4 rounded-md bg-white/5 border border-white/15 text-slate-200 text-sm font-medium hover:border-white/35 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Restart
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-2.5 px-4 rounded-md text-slate-400 text-sm hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Title Screen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hud.phase === 'gameover') {
    const isVictory = hud.outcome === 'victory';
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center px-6 bg-black/80">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="outcome-title"
          className="w-full max-w-md rounded-lg bg-black border border-white/15 p-8 text-center"
        >
          <h2 id="outcome-title" className="text-3xl font-semibold text-white tracking-tight mb-2">
            {isVictory ? 'Escaped the Dark' : 'Swallowed by the Dark'}
          </h2>
          <p className="text-sm text-slate-400 mb-7">
            {isVictory
              ? 'All four acoustic relays chimed and the east bulkhead gave way.'
              : 'Something followed your echo before you reached the bulkhead.'}
          </p>

          <div className="grid grid-cols-3 gap-4 py-5 mb-7 border-y border-white/10">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">
                {isVictory ? 'Clear Time' : 'Survived'}
              </div>
              <div className="font-mono-tabular text-xl font-semibold text-white">
                {formatClock(hud.elapsedSeconds)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">Clues</div>
              <div className="font-mono-tabular text-xl font-semibold text-sky-300">
                {hud.cluesCollected}/{hud.totalClues}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">Pulses</div>
              <div className="font-mono-tabular text-xl font-semibold text-white">
                {hud.pulsesUsed}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="flex-1 py-3 px-5 rounded-md bg-white text-black text-sm font-semibold hover:bg-sky-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              {isVictory ? 'Play Again' : 'Try Again'}
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="py-3 px-5 rounded-md bg-white/5 border border-white/15 text-slate-200 text-sm font-medium hover:border-white/35 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Title
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
