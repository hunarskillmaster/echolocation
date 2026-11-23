import { clamp } from './math';
import { EntityKind, GameEvent, SurfaceKind } from './types';

export interface FootstepAcousticProfile {
  volume: number;
  hardness: number;
  cutoffHz: number;
  transientGain: number;
  thumpStartHz: number;
  thumpEndHz: number;
  durationSec: number;
}

// returns a profile describing how "loud" and "hard" a step sounds
// sneaking softens the attack a lot, running makes it snappy
export function computeFootstepProfile(
  speedRatio: number,
  sneaking: boolean,
): FootstepAcousticProfile {
  const s = clamp(speedRatio, 0, 1);
  // Sneaking dampens impact hardness and overall acoustic energy sharply
  const hardness = sneaking
    ? clamp(0.08 + s * 0.24, 0.08, 0.32)
    : clamp(0.28 + s * 0.72, 0.28, 1);

  const baseVolume = 0.028 + 0.152 * Math.pow(s, 1.2);
  const volume = sneaking ? baseVolume * 0.36 : baseVolume;

  const cutoffHz = 220 + hardness * 2350;
  const transientGain = volume * (0.18 + hardness * 0.92);
  const thumpStartHz = 72 + hardness * 68;
  const thumpEndHz = 36 + hardness * 16;
  const durationSec = 0.095 - hardness * 0.036;

  return {
    volume,
    hardness,
    cutoffHz,
    transientGain,
    thumpStartHz,
    thumpEndHz,
    durationSec,
  };
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private stepParity = 0; // alternates L/R stride

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, this.ctx.currentTime, 0.03);
    }
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.72;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public processEvents(events: GameEvent[]): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    if (this.ctx.state !== 'running') return;

    for (const ev of events) {
      switch (ev.type) {
        case 'sonar_emit':
          this.playSonarPing(Boolean(ev.isFocused), ev.pan);
          break;
        case 'echo_return':
          this.playEchoReturn(ev.distanceRatio ?? 0.5, ev.pan, ev.surfaceKind ?? 'wall');
          break;
        case 'footstep':
          this.playFootstep(Boolean(ev.sneaking), ev.speedRatio ?? (ev.sneaking ? 0.48 : 1), ev.pan);
          break;
        case 'entity_sound':
          this.playEntitySound(ev.entityKind ?? 'patroller', ev.distanceRatio ?? 0.5, ev.pan);
          break;
        case 'entity_telegraph':
          this.playEntityTelegraph(ev.distanceRatio ?? 0.4, ev.pan);
          break;
        case 'clue_collected':
          this.playClueCollected();
          break;
        case 'exit_unlocked':
          this.playExitUnlocked();
          break;
        case 'player_hit':
          this.playPlayerHit(ev.pan);
          break;
        case 'victory':
          this.playVictory();
          break;
        case 'defeat':
          this.playDefeat();
          break;
      }
    }
  }

  private createPanner(pan: number): StereoPannerNode {
    const panner = this.ctx!.createStereoPanner();
    panner.pan.value = Math.max(-0.95, Math.min(0.95, pan));
    panner.connect(this.masterGain!);
    return panner;
  }

  private playSonarPing(isFocused: boolean, pan: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const dest = this.createPanner(pan);

    // Deep sub-bass acoustic thump
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(isFocused ? 115 : 88, now);
    subOsc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    subGain.gain.setValueAtTime(0.38, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.start(now);
    subOsc.stop(now + 0.27);

    // Resonant sonar chime
    const pingOsc = ctx.createOscillator();
    const pingFilter = ctx.createBiquadFilter();
    const pingGain = ctx.createGain();
    pingOsc.type = 'triangle';
    const baseFreq = isFocused ? 920 : 660;
    pingOsc.frequency.setValueAtTime(baseFreq, now);
    pingOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.94, now + 0.52);

    pingFilter.type = 'bandpass';
    pingFilter.frequency.setValueAtTime(baseFreq, now);
    pingFilter.Q.value = 5.5;

    pingGain.gain.setValueAtTime(0.001, now);
    pingGain.gain.linearRampToValueAtTime(isFocused ? 0.24 : 0.2, now + 0.012);
    pingGain.gain.exponentialRampToValueAtTime(0.0008, now + (isFocused ? 0.55 : 0.7));

    pingOsc.connect(pingFilter);
    pingFilter.connect(pingGain);
    pingGain.connect(dest);
    pingOsc.start(now);
    pingOsc.stop(now + 0.72);
  }

  private playEchoReturn(distanceRatio: number, pan: number, surface: SurfaceKind): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const dest = this.createPanner(pan);

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const atten = Math.max(0.08, 1 - distanceRatio * 0.82);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800 * atten + 260, now);

    if (surface === 'clue' || surface === 'exit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(surface === 'exit' ? 1180 : 1380, now);
      gain.gain.setValueAtTime(0.14 * atten, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.32);
    } else if (surface === 'entity') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
      gain.gain.setValueAtTime(0.16 * atten, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);
    } else {
      osc.type = 'sine';
      const pitchJitter = 520 + (Math.random() - 0.5) * 60;
      osc.frequency.setValueAtTime(pitchJitter, now);
      gain.gain.setValueAtTime(0.065 * atten, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.14);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  private playFootstep(sneaking: boolean, speedRatio: number, pan: number): void {
    if (!this.noiseBuffer) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    // slight L/R offset each step to fake walking stereo feel
    this.stepParity = (this.stepParity + 1) % 2;
    const strideOffset = this.stepParity === 0 ? -0.045 : 0.045;
    const dest = this.createPanner(pan + strideOffset);
    const pitchJitter = 1 + (this.stepParity === 0 ? -0.04 : 0.04) + (Math.random() - 0.5) * 0.06;

    const profile = computeFootstepProfile(speedRatio, sneaking);

    // Layer 1: Heel/sole impact body thump (scales in pitch & snap with hardness)
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = profile.hardness > 0.55 ? 'triangle' : 'sine';
    bodyOsc.frequency.setValueAtTime(profile.thumpStartHz * pitchJitter, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(
      Math.max(24, profile.thumpEndHz * pitchJitter),
      now + profile.durationSec,
    );

    bodyGain.gain.setValueAtTime(0.001, now);
    bodyGain.gain.linearRampToValueAtTime(profile.volume * 0.85, now + 0.005);
    bodyGain.gain.exponentialRampToValueAtTime(0.0008, now + profile.durationSec + 0.012);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(dest);
    bodyOsc.start(now);
    bodyOsc.stop(now + profile.durationSec + 0.02);

    // Layer 2: Filtered floor grit & crisp contact transient (hardness-modulated)
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    noiseSrc.playbackRate.value = (0.85 + profile.hardness * 0.35) * pitchJitter;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(profile.cutoffHz, now);
    lowpass.Q.value = 0.7 + profile.hardness * 1.4;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(profile.transientGain, now + 0.004);
    noiseGain.gain.exponentialRampToValueAtTime(0.0008, now + profile.durationSec);

    noiseSrc.connect(lowpass);
    lowpass.connect(noiseGain);
    noiseGain.connect(dest);
    noiseSrc.start(now, Math.random() * 0.25);
    noiseSrc.stop(now + profile.durationSec + 0.015);

    // Layer 3: Sharp surface tap click when walking briskly (hardly audible when sneaking)
    if (profile.hardness > 0.35) {
      const clickSrc = ctx.createBufferSource();
      clickSrc.buffer = this.noiseBuffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime((1350 + profile.hardness * 1150) * pitchJitter, now);
      bandpass.Q.value = 2.4;

      const clickGain = ctx.createGain();
      const clickAmp = profile.transientGain * (profile.hardness - 0.3) * 0.75;
      clickGain.gain.setValueAtTime(clickAmp, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.026);

      clickSrc.connect(bandpass);
      bandpass.connect(clickGain);
      clickGain.connect(dest);
      clickSrc.start(now, Math.random() * 0.25);
      clickSrc.stop(now + 0.03);
    }
  }

  private playEntitySound(kind: EntityKind, distanceRatio: number, pan: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const dest = this.createPanner(pan);
    const proximity = Math.max(0.05, 1 - distanceRatio);

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180 + proximity * 1400, now);

    if (kind === 'sentinel') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(145, now);
      osc.frequency.exponentialRampToValueAtTime(92, now + 0.11);
      gain.gain.setValueAtTime(0.11 * proximity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.14);
      return;
    }

    osc.type = kind === 'stalker' ? 'sawtooth' : 'triangle';
    const base = kind === 'stalker' ? 84 : 62;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.linearRampToValueAtTime(base * 0.78, now + 0.34);

    // Subtle distortion when dangerously close
    if (proximity > 0.55) {
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      const amount = (proximity - 0.55) * 40;
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
      }
      shaper.curve = curve;
      osc.connect(shaper);
      shaper.connect(filter);
    } else {
      osc.connect(filter);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18 * proximity * proximity + 0.015, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    filter.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  private playEntityTelegraph(distanceRatio: number, pan: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const dest = this.createPanner(pan);
    const proximity = Math.max(0.15, 1 - distanceRatio);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.28);
    gain.gain.setValueAtTime(0.16 * proximity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  private playClueCollected(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);
      gain.gain.setValueAtTime(0.001, now + idx * 0.065);
      gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.065 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.065 + 0.48);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.5);
    });
  }

  private playExitUnlocked(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const notes = [392.0, 523.25, 659.25, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.16, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.08 + 0.65);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.68);
    });
  }

  private playPlayerHit(pan: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const dest = this.createPanner(pan);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.35);
    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  private playVictory(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const chord = [440, 554.37, 659.25, 880];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.15, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.09 + 1.1);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 1.15);
    });
  }

  private playDefeat(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.9);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.98);
  }
}
