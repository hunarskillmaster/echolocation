import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { StatusModal } from './components/StatusModal';
import { TitleOverlay } from './components/TitleOverlay';
import { SoundEngine } from './game/audio';
import { createInitialWorld, emitSonarPulse, getHudSnapshot, stepWorld } from './game/engine';
import { renderWorld, screenToWorld } from './game/renderer';
import { HudSnapshot, InputState, WorldState } from './game/types';

function shouldAutostart(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  if (!soundRef.current) {
    soundRef.current = new SoundEngine();
  }

  const initialAutostart = shouldAutostart();
  const worldRef = useRef<WorldState>(createInitialWorld(initialAutostart ? 'playing' : 'title'));
  const inputRef = useRef<InputState>({
    up: false,
    down: false,
    left: false,
    right: false,
    sneak: false,
    mouseWorld: { x: 400, y: 760 },
    pulseDirectionalJustPressed: false,
    pulseOmniJustPressed: false,
  });

  const [hud, setHud] = useState<HudSnapshot>(() => getHudSnapshot(worldRef.current));
  const [muted, setMuted] = useState<boolean>(false);

  const syncBodyState = useCallback((phase: WorldState['phase']) => {
    document.body.dataset.state = phase;
  }, []);

  const clearInputs = useCallback(() => {
    const inp = inputRef.current;
    inp.up = false;
    inp.down = false;
    inp.left = false;
    inp.right = false;
    inp.sneak = false;
    inp.pulseDirectionalJustPressed = false;
    inp.pulseOmniJustPressed = false;
  }, []);

  const startGame = useCallback(() => {
    soundRef.current?.unlock();
    clearInputs();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const fresh = createInitialWorld('playing');
    // Welcome ping so the opening vestibule outlines briefly on start
    emitSonarPulse(fresh, fresh.player.pos, 0, false, true);
    worldRef.current = fresh;
    syncBodyState('playing');
    setHud(getHudSnapshot(fresh));
    canvasRef.current?.focus();
  }, [clearInputs, syncBodyState]);

  const pauseGame = useCallback(() => {
    const w = worldRef.current;
    if (w.phase !== 'playing') return;
    w.phase = 'paused';
    clearInputs();
    syncBodyState('paused');
    setHud(getHudSnapshot(w));
  }, [clearInputs, syncBodyState]);

  const resumeGame = useCallback(() => {
    const w = worldRef.current;
    if (w.phase !== 'paused') return;
    soundRef.current?.unlock();
    clearInputs();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    w.phase = 'playing';
    syncBodyState('playing');
    setHud(getHudSnapshot(w));
    canvasRef.current?.focus();
  }, [clearInputs, syncBodyState]);

  const returnToTitle = useCallback(() => {
    clearInputs();
    const titleWorld = createInitialWorld('title');
    worldRef.current = titleWorld;
    syncBodyState('title');
    setHud(getHudSnapshot(titleWorld));
  }, [clearInputs, syncBodyState]);

  const toggleMute = useCallback(() => {
    soundRef.current?.unlock();
    const next = !soundRef.current?.isMuted();
    soundRef.current?.setMuted(next);
    setMuted(next);
  }, []);

  const callbacksRef = useRef({
    startGame,
    pauseGame,
    resumeGame,
    toggleMute,
    clearInputs,
    syncBodyState,
  });
  callbacksRef.current = {
    startGame,
    pauseGame,
    resumeGame,
    toggleMute,
    clearInputs,
    syncBodyState,
  };

  useEffect(() => {
    syncBodyState(worldRef.current.phase);
    if (initialAutostart) {
      emitSonarPulse(worldRef.current, worldRef.current.player.pos, 0, false, true);
    }
  }, [initialAutostart, syncBodyState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = mountRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let viewW = container.clientWidth || window.innerWidth;
    let viewH = container.clientHeight || window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const applySize = () => {
      viewW = container.clientWidth || window.innerWidth;
      viewH = container.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewW * dpr);
      canvas.height = Math.floor(viewH * dpr);
      canvas.style.width = `${viewW}px`;
      canvas.style.height = `${viewH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    applySize();

    const ro = new ResizeObserver(() => applySize());
    ro.observe(container);

    let lastMouseClient = { x: viewW * 0.65, y: viewH * 0.5 };

    const handleMouseMove = (e: MouseEvent) => {
      lastMouseClient = { x: e.clientX, y: e.clientY };
      const rect = canvas.getBoundingClientRect();
      inputRef.current.mouseWorld = screenToWorld(e.clientX, e.clientY, rect, worldRef.current);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      soundRef.current?.unlock();
      if (worldRef.current.phase !== 'playing') return;
      const rect = canvas.getBoundingClientRect();
      inputRef.current.mouseWorld = screenToWorld(e.clientX, e.clientY, rect, worldRef.current);
      inputRef.current.pulseDirectionalJustPressed = true;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const w = worldRef.current;

      if (w.phase === 'title' && (code === 'Enter' || code === 'Space')) {
        e.preventDefault();
        callbacksRef.current.startGame();
        return;
      }

      if (code === 'KeyM') {
        callbacksRef.current.toggleMute();
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        if (w.phase === 'playing') {
          callbacksRef.current.pauseGame();
        } else if (w.phase === 'paused') {
          callbacksRef.current.resumeGame();
        }
        return;
      }

      if (w.phase !== 'playing') return;

      soundRef.current?.unlock();

      if (code === 'KeyW' || code === 'ArrowUp') inputRef.current.up = true;
      if (code === 'KeyS' || code === 'ArrowDown') inputRef.current.down = true;
      if (code === 'KeyA' || code === 'ArrowLeft') inputRef.current.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') inputRef.current.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') inputRef.current.sneak = true;

      if (code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          inputRef.current.pulseOmniJustPressed = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') inputRef.current.up = false;
      if (code === 'KeyS' || code === 'ArrowDown') inputRef.current.down = false;
      if (code === 'KeyA' || code === 'ArrowLeft') inputRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') inputRef.current.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') inputRef.current.sneak = false;
    };

    const handleBlurOrHide = () => {
      callbacksRef.current.clearInputs();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlurOrHide);
    document.addEventListener('visibilitychange', handleBlurOrHide);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);

    let rafId = 0;
    let prevTime = performance.now();
    let hudAccum = 0;
    let lastPhase = worldRef.current.phase;
    let lastIntegrity = worldRef.current.player.integrity;
    let lastClues = worldRef.current.cluesCollected;
    let lastUnlocked = worldRef.current.exit.unlocked;
    let lastNoise = worldRef.current.player.lastNoiseLevel;
    let lastActiveClueTitle = worldRef.current.activeClue?.title ?? null;

    const frame = (now: number) => {
      const rawDt = Math.max(0, (now - prevTime) / 1000);
      prevTime = now;

      const world = worldRef.current;
      const rect = canvas.getBoundingClientRect();
      inputRef.current.mouseWorld = screenToWorld(
        lastMouseClient.x,
        lastMouseClient.y,
        rect,
        world,
      );

      stepWorld(world, rawDt, inputRef.current);
      inputRef.current.pulseDirectionalJustPressed = false;
      inputRef.current.pulseOmniJustPressed = false;

      if (world.events.length > 0) {
        soundRef.current?.processEvents(world.events);
      }

      renderWorld(ctx, world, viewW, viewH);

      hudAccum += rawDt;
      const activeClueTitle = world.activeClue?.title ?? null;
      const discreteChanged =
        world.phase !== lastPhase ||
        world.player.integrity !== lastIntegrity ||
        world.cluesCollected !== lastClues ||
        world.exit.unlocked !== lastUnlocked ||
        world.player.lastNoiseLevel !== lastNoise ||
        activeClueTitle !== lastActiveClueTitle;

      if (discreteChanged || hudAccum >= 0.12) {
        hudAccum = 0;
        if (world.phase !== lastPhase) {
          callbacksRef.current.syncBodyState(world.phase);
        }
        lastPhase = world.phase;
        lastIntegrity = world.player.integrity;
        lastClues = world.cluesCollected;
        lastUnlocked = world.exit.unlocked;
        lastNoise = world.player.lastNoiseLevel;
        lastActiveClueTitle = activeClueTitle;
        setHud(getHudSnapshot(world));
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlurOrHide);
      document.removeEventListener('visibilitychange', handleBlurOrHide);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden">
      <div ref={mountRef} className="fixed inset-0 bg-black">
        <canvas
          ref={canvasRef}
          data-testid="game-canvas"
          tabIndex={0}
          aria-label="Echolocation game viewport"
          className="block w-full h-full outline-none cursor-crosshair"
        />
      </div>

      {hud.phase === 'title' && <TitleOverlay onStart={startGame} />}

      {(hud.phase === 'playing' || hud.phase === 'paused') && (
        <GameHud
          hud={hud}
          muted={muted}
          onToggleMute={toggleMute}
          onPause={pauseGame}
        />
      )}

      {(hud.phase === 'paused' || hud.phase === 'gameover') && (
        <StatusModal
          hud={hud}
          onResume={resumeGame}
          onRestart={startGame}
          onReturnTitle={returnToTitle}
        />
      )}
    </main>
  );
}
