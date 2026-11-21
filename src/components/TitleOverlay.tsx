import React from 'react';

interface TitleOverlayProps {
  onStart: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-between px-6 py-10 pointer-events-none">
      <div className="h-6" aria-hidden="true" />

      <div className="flex flex-col items-center text-center max-w-xl pointer-events-auto">
        <svg
          width="84"
          height="84"
          viewBox="0 0 84 84"
          fill="none"
          aria-hidden="true"
          className="mb-6"
        >
          <circle cx="42" cy="42" r="5" fill="#ffffff" />
          <path
            d="M27.5 27.5A20.5 20.5 0 0 1 56.5 27.5"
            stroke="#67e8f9"
            strokeWidth="1.75"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d="M56.5 56.5A20.5 20.5 0 0 1 27.5 56.5"
            stroke="#67e8f9"
            strokeWidth="1.75"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d="M17.5 22A31.5 31.5 0 0 1 66.5 22"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M66.5 62A31.5 31.5 0 0 1 17.5 62"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.55"
          />
          <circle cx="42" cy="42" r="39" stroke="#38bdf8" strokeWidth="1" opacity="0.22" />
        </svg>

        <h1
          className="text-4xl sm:text-6xl font-semibold tracking-tight text-white mb-4"
          style={{ textWrap: 'balance' }}
        >
          Echolocation
        </h1>

        <p className="text-sm sm:text-base text-slate-400 leading-relaxed mb-8 max-w-md">
          Sound is your only sight. Emit sonar pulses to map the dark, uncover four acoustic logs, and evade what listens back.
        </p>

        <button
          type="button"
          data-start="true"
          onClick={onStart}
          className="px-8 py-3.5 rounded-md bg-white text-black text-sm font-semibold tracking-wide hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
        >
          Enter the Dark
        </button>
      </div>

      <p className="text-xs sm:text-sm text-slate-500 text-center tracking-wide">
        WASD / Arrows to move • Click or Space to pulse sonar • Find clues &amp; reach the exit
      </p>
    </div>
  );
};
